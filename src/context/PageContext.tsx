import React, {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useRef,
    useState,
} from 'react';
import { v4 as uuidv4 } from 'uuid';
import type { BlockType, EditorBlock, Page } from '../types/types';
import { cloneBlockWithNewIds, createBlock } from '../utils/blocks';
import { debounce, loadWorkspace, saveWorkspace } from '../utils/storage';
import type { WorkspaceState } from '../utils/storage';

// ============================================
// Constants
// ============================================

const DEFAULT_TITLE = 'Untitled';
const SAVE_DEBOUNCE_MS = 300;
const HISTORY_LIMIT = 50;
const HISTORY_DEBOUNCE_MS = 500; // Group rapid changes into single undo

// ============================================
// Context Types
// ============================================

interface PageContextValue {
    pages: Page[];
    currentPageId: string;
    page: Page;
    setCurrentPage: (id: string) => void;
    addPage: () => string;
    deletePage: (id: string) => void;
    focusBlockId: string | null;
    focusPosition: 'start' | 'end' | null;
    clearFocusBlock: () => void;
    setFocusBlock: (id: string) => void;
    selectedBlockIds: string[];
    setSelectedBlocks: (ids: string[]) => void;
    selectBlockRange: (targetId: string) => void;
    selectBlockRangeByIds: (startId: string, endId: string) => void;
    clearSelectedBlocks: () => void;
    selectAllBlocks: () => void;
    // Page operations
    setTitle: (title: string) => void;
    // Block CRUD
    addBlock: (type: BlockType, afterId?: string, skipHistory?: boolean) => string;
    addBlockBefore: (type: BlockType, beforeId: string) => string;
    updateBlock: (id: string, updates: Partial<EditorBlock>, skipHistory?: boolean) => void;
    deleteBlock: (id: string) => void;
    deleteBlocksById: (ids: string[]) => void;
    insertBlocksAfter: (targetId: string | null, blocks: EditorBlock[], skipHistory?: boolean) => string[];
    // Block reordering
    moveBlockUp: (id: string) => void;
    moveBlockDown: (id: string) => void;
    // Toggle operations
    toggleCollapse: (id: string) => void;
    // Child block operations
    addChildBlock: (parentId: string, type: BlockType) => string;
    // Escape nested block to main level
    escapeToMainLevel: (fromBlockId: string) => void;
    // Navigation
    focusPreviousBlock: (currentId: string) => void;
    focusNextBlock: (currentId: string) => void;
    // Undo/Redo
    pushHistory: () => void;
    undo: () => void;
    redo: () => void;
    canUndo: boolean;
    canRedo: boolean;
}

// ============================================
// Reducer Actions (per-page)
// ============================================

type Action =
    | { type: 'SET_PAGE'; payload: Page }
    | { type: 'SET_TITLE'; payload: string }
    | { type: 'ADD_BLOCK'; payload: { block: EditorBlock; afterId?: string } }
    | { type: 'ADD_BLOCK_BEFORE'; payload: { block: EditorBlock; beforeId: string } }
    | { type: 'UPDATE_BLOCK'; payload: { id: string; updates: Partial<EditorBlock> } }
    | { type: 'DELETE_BLOCK'; payload: { id: string } }
    | { type: 'MOVE_BLOCK_UP'; payload: { id: string } }
    | { type: 'MOVE_BLOCK_DOWN'; payload: { id: string } }
    | { type: 'TOGGLE_COLLAPSE'; payload: { id: string } }
    | { type: 'ADD_CHILD_BLOCK'; payload: { parentId: string; block: EditorBlock } };

// ============================================
// Helper Functions
// ============================================

/**
 * Find a block by ID in a nested structure
 * Returns the block, its parent array, index, and the parent block if nested
 */
function findBlockAndParent(
    blocks: EditorBlock[],
    id: string,
    parentBlock: EditorBlock | null = null
): { block: EditorBlock; parent: EditorBlock[]; index: number; parentBlock: EditorBlock | null } | null {
    for (let i = 0; i < blocks.length; i++) {
        if (blocks[i].id === id) {
            return { block: blocks[i], parent: blocks, index: i, parentBlock };
        }
        if (blocks[i].children) {
            const result = findBlockAndParent(blocks[i].children!, id, blocks[i]);
            if (result) return result;
        }
    }
    return null;
}

/**
 * Flatten a block tree into document order (preorder)
 */
function flattenBlocks(blocks: EditorBlock[]): EditorBlock[] {
    const result: EditorBlock[] = [];
    const walk = (nodes: EditorBlock[]) => {
        for (const blk of nodes) {
            result.push(blk);
            if (blk.children?.length) {
                walk(blk.children);
            }
        }
    };
    walk(blocks);
    return result;
}

/**
 * Delete a set of blocks (by id) from the tree
 */
function deleteBlocksFromTreeSet(blocks: EditorBlock[], ids: Set<string>): EditorBlock[] {
    return blocks
        .filter((block) => !ids.has(block.id))
        .map((block) => {
            if (block.children?.length) {
                return { ...block, children: deleteBlocksFromTreeSet(block.children, ids) };
            }
            return block;
        });
}

/**
 * Insert a block after another in a nested structure (immutably)
 */
function insertBlockAfterInTree(
    blocks: EditorBlock[],
    afterId: string,
    newBlock: EditorBlock
): EditorBlock[] {
    return blocks.map((block) => {
        // Check if afterId is in this block's children
        if (block.children) {
            const childIndex = block.children.findIndex(c => c.id === afterId);
            if (childIndex >= 0) {
                const newChildren = [...block.children];
                newChildren.splice(childIndex + 1, 0, newBlock);
                return { ...block, children: newChildren };
            }
            // Recurse into children
            return {
                ...block,
                children: insertBlockAfterInTree(block.children, afterId, newBlock),
            };
        }
        return block;
    });
}

/**
 * Insert multiple blocks after a given id (or append if no id)
 */
function insertBlocksAfterInTree(
    blocks: EditorBlock[],
    targetId: string | null,
    newBlocks: EditorBlock[]
): EditorBlock[] {
    if (!targetId) {
        return [...blocks, ...newBlocks];
    }

    const result = findBlockAndParent(blocks, targetId);
    if (result) {
        const updatedParent = [...result.parent];
        updatedParent.splice(result.index + 1, 0, ...newBlocks);

        if (result.parent === blocks) {
            return updatedParent;
        }

        if (result.parentBlock) {
            return updateBlockInTree(blocks, result.parentBlock.id, { children: updatedParent });
        }
    }

    return [...blocks, ...newBlocks];
}

/**
 * Update a block in a nested structure (immutably)
 */
function updateBlockInTree(
    blocks: EditorBlock[],
    id: string,
    updates: Partial<EditorBlock>
): EditorBlock[] {
    return blocks.map((block) => {
        if (block.id === id) {
            return { ...block, ...updates };
        }
        if (block.children) {
            return {
                ...block,
                children: updateBlockInTree(block.children, id, updates),
            };
        }
        return block;
    });
}

/**
 * Delete a block from a nested structure (immutably)
 * Also deletes all children (cascade delete for toggles)
 */
function deleteBlockFromTree(blocks: EditorBlock[], id: string): EditorBlock[] {
    return blocks
        .filter((block) => block.id !== id)
        .map((block) => {
            if (block.children) {
                return {
                    ...block,
                    children: deleteBlockFromTree(block.children, id),
                };
            }
            return block;
        });
}

/**
 * Add a child block to a parent block (immutably)
 */
function addChildToBlock(
    blocks: EditorBlock[],
    parentId: string,
    newChild: EditorBlock
): EditorBlock[] {
    return blocks.map((block) => {
        if (block.id === parentId) {
            return {
                ...block,
                children: [...(block.children || []), newChild],
            };
        }
        if (block.children) {
            return {
                ...block,
                children: addChildToBlock(block.children, parentId, newChild),
            };
        }
        return block;
    });
}

// ============================================
// Reducer (per-page)
// ============================================

function pageReducer(state: Page, action: Action): Page {
    switch (action.type) {
        case 'SET_PAGE':
            return action.payload;

        case 'SET_TITLE':
            return { ...state, title: action.payload };

        case 'ADD_BLOCK': {
            const { block, afterId } = action.payload;
            if (!afterId) {
                return { ...state, blocks: [...state.blocks, block] };
            }
            // Find position and insert after
            const result = findBlockAndParent(state.blocks, afterId);
            if (result) {
                if (result.parent === state.blocks) {
                    // Top-level block
                    const newBlocks = [...state.blocks];
                    newBlocks.splice(result.index + 1, 0, block);
                    return { ...state, blocks: newBlocks };
                }
                // Nested block - use helper to update tree
                return {
                    ...state,
                    blocks: insertBlockAfterInTree(state.blocks, afterId, block),
                };
            }
            return { ...state, blocks: [...state.blocks, block] };
        }

        case 'ADD_BLOCK_BEFORE': {
            const { block, beforeId } = action.payload;
            const result = findBlockAndParent(state.blocks, beforeId);
            if (result) {
                const newBlocks = [...result.parent];
                newBlocks.splice(result.index, 0, block);
                if (result.parent === state.blocks) {
                    return { ...state, blocks: newBlocks };
                }
                return {
                    ...state,
                    blocks: updateBlockInTree(state.blocks, result.parent[0].id, {
                        children: newBlocks,
                    }),
                };
            }
            return state;
        }

        case 'UPDATE_BLOCK':
            return {
                ...state,
                blocks: updateBlockInTree(state.blocks, action.payload.id, action.payload.updates),
            };

        case 'DELETE_BLOCK':
            return {
                ...state,
                blocks: deleteBlockFromTree(state.blocks, action.payload.id),
            };

        case 'MOVE_BLOCK_UP': {
            const { id } = action.payload;
            const result = findBlockAndParent(state.blocks, id);
            if (result && result.index > 0) {
                const newBlocks = [...result.parent];
                // Swap with previous
                [newBlocks[result.index - 1], newBlocks[result.index]] = [
                    newBlocks[result.index],
                    newBlocks[result.index - 1],
                ];
                if (result.parent === state.blocks) {
                    return { ...state, blocks: newBlocks };
                }
                // Handle nested case - find parent block
                for (const block of state.blocks) {
                    if (block.children === result.parent) {
                        return {
                            ...state,
                            blocks: updateBlockInTree(state.blocks, block.id, { children: newBlocks }),
                        };
                    }
                }
            }
            return state;
        }

        case 'MOVE_BLOCK_DOWN': {
            const { id } = action.payload;
            const result = findBlockAndParent(state.blocks, id);
            if (result && result.index < result.parent.length - 1) {
                const newBlocks = [...result.parent];
                // Swap with next
                [newBlocks[result.index], newBlocks[result.index + 1]] = [
                    newBlocks[result.index + 1],
                    newBlocks[result.index],
                ];
                if (result.parent === state.blocks) {
                    return { ...state, blocks: newBlocks };
                }
                // Handle nested case
                for (const block of state.blocks) {
                    if (block.children === result.parent) {
                        return {
                            ...state,
                            blocks: updateBlockInTree(state.blocks, block.id, { children: newBlocks }),
                        };
                    }
                }
            }
            return state;
        }

        case 'TOGGLE_COLLAPSE': {
            const { id } = action.payload;
            const result = findBlockAndParent(state.blocks, id);
            if (result) {
                return {
                    ...state,
                    blocks: updateBlockInTree(state.blocks, id, {
                        collapsed: !result.block.collapsed,
                    }),
                };
            }
            return state;
        }

        case 'ADD_CHILD_BLOCK':
            return {
                ...state,
                blocks: addChildToBlock(state.blocks, action.payload.parentId, action.payload.block),
            };

        default:
            return state;
    }
}

// ============================================
// Context
// ============================================

const PageContext = createContext<PageContextValue | null>(null);

// ============================================
// Provider
// ============================================

function createInitialPage(): Page {
    return {
        id: uuidv4(),
        title: DEFAULT_TITLE,
        blocks: [createBlock('paragraph')], // Start with one paragraph ready to type
    };
}

export function PageProvider({ children }: { children: React.ReactNode }) {
    const [workspace, setWorkspace] = useState<WorkspaceState>(() => {
        const saved = loadWorkspace();
        if (saved && saved.pages.length > 0) {
            return saved;
        }
        const page = createInitialPage();
        return { pages: [page], currentPageId: page.id };
    });

    // Track which block should be focused (after creation)
    const [focusBlockId, setFocusBlockId] = React.useState<string | null>(null);
    const [focusPosition, setFocusPosition] = React.useState<'start' | 'end' | null>(null);
    const [selectedBlockIds, setSelectedBlockIds] = useState<string[]>([]);
    const [selectionAnchorId, setSelectionAnchorId] = useState<string | null>(null);

    // Track last history save time for debouncing typing
    const lastHistorySaveRef = useRef<number>(0);

    // History stacks keyed by page ID - includes cursor position
    interface HistoryEntry {
        page: Page;
        cursorInfo?: {
            blockId: string | null;
            offset: number;
        };
    }
    const [historyState, setHistoryState] = useState<{
        [pageId: string]: { undoStack: HistoryEntry[]; redoStack: HistoryEntry[] };
    }>({});

    const clearFocusBlock = useCallback(() => {
        setFocusBlockId(null);
        setFocusPosition(null);
    }, []);

    const setFocusBlock = useCallback((id: string) => {
        setFocusBlockId(id);
        setFocusPosition('start');
    }, []);

    const clearSelectedBlocks = useCallback(() => {
        setSelectedBlockIds([]);
        setSelectionAnchorId(null);
    }, []);

    const setSelectedBlocks = useCallback((ids: string[]) => {
        const unique = Array.from(new Set(ids));
        setSelectedBlockIds(unique);
        setSelectionAnchorId(unique[0] ?? null);
        if (unique.length > 0) {
            const sel = window.getSelection();
            sel?.removeAllRanges();
        }
    }, []);

    // Debounced save to localStorage
    const debouncedSave = useMemo(
        () => debounce((ws: WorkspaceState) => saveWorkspace(ws), SAVE_DEBOUNCE_MS),
        []
    );

    // Save on every change
    useEffect(() => {
        debouncedSave(workspace);
    }, [workspace, debouncedSave]);

    const currentPage = useMemo(() => {
        return workspace.pages.find((p) => p.id === workspace.currentPageId) || workspace.pages[0];
    }, [workspace]);

    const updateCurrentPage = useCallback(
        (updater: (page: Page) => Page, skipHistory = false) => {
            setWorkspace((ws) => {
                const idx = ws.pages.findIndex((p) => p.id === ws.currentPageId);
                if (idx === -1) return ws;
                const currentPage = ws.pages[idx];

                // Auto-push to history before making changes (unless skipping)
                // Use debounce to group rapid changes (like typing) into single undo
                if (!skipHistory) {
                    const now = Date.now();
                    const timeSinceLastSave = now - lastHistorySaveRef.current;

                    // Only save if enough time has passed since last save
                    if (timeSinceLastSave >= HISTORY_DEBOUNCE_MS) {
                        lastHistorySaveRef.current = now;

                        const cursorInfo = (() => {
                            const selection = window.getSelection();
                            if (!selection || selection.rangeCount === 0) {
                                return { blockId: null, offset: 0 };
                            }
                            const range = selection.getRangeAt(0);
                            const node = range.startContainer;
                            const element = node instanceof HTMLElement ? node : node.parentElement;
                            const blockWrapper = element?.closest('[data-block-id]');
                            const blockId = blockWrapper?.getAttribute('data-block-id') || null;
                            return { blockId, offset: range.startOffset };
                        })();

                        setHistoryState((prev) => {
                            const pageHistory = prev[currentPage.id] || { undoStack: [], redoStack: [] };
                            const entry: HistoryEntry = { page: currentPage, cursorInfo };
                            const newUndoStack = [...pageHistory.undoStack, entry].slice(-HISTORY_LIMIT);
                            return {
                                ...prev,
                                [currentPage.id]: {
                                    undoStack: newUndoStack,
                                    redoStack: [], // Clear redo stack on new action
                                },
                            };
                        });
                    }
                }

                const nextPages = [...ws.pages];
                nextPages[idx] = updater(currentPage);
                return { ...ws, pages: nextPages };
            });
        },
        []
    );

    // Helper to get current cursor position from DOM
    const getCursorInfo = useCallback((): { blockId: string | null; offset: number } => {
        const selection = window.getSelection();
        if (!selection || selection.rangeCount === 0) {
            return { blockId: null, offset: 0 };
        }
        const range = selection.getRangeAt(0);
        const node = range.startContainer;
        const element = node instanceof HTMLElement ? node : node.parentElement;
        const blockWrapper = element?.closest('[data-block-id]');
        const blockId = blockWrapper?.getAttribute('data-block-id') || null;
        return { blockId, offset: range.startOffset };
    }, []);

    // Save current state to history (call this BEFORE making changes)
    const pushHistory = useCallback(() => {
        // Reset debounce timer since we're explicitly saving
        lastHistorySaveRef.current = Date.now();

        const cursorInfo = getCursorInfo();
        setHistoryState((prev) => {
            const pageHistory = prev[currentPage.id] || { undoStack: [], redoStack: [] };
            const entry: HistoryEntry = { page: currentPage, cursorInfo };
            const newUndoStack = [...pageHistory.undoStack, entry].slice(-HISTORY_LIMIT);
            return {
                ...prev,
                [currentPage.id]: {
                    undoStack: newUndoStack,
                    redoStack: [], // Clear redo stack on new action
                },
            };
        });
    }, [currentPage, getCursorInfo]);

    const selectBlockRange = useCallback((targetId: string) => {
        const order = flattenBlocks(currentPage.blocks).map((b) => b.id);
        const anchor = selectionAnchorId ?? selectedBlockIds[0] ?? targetId;
        const anchorIndex = order.indexOf(anchor);
        const targetIndex = order.indexOf(targetId);
        if (anchorIndex === -1 || targetIndex === -1) return;

        const [start, end] = anchorIndex < targetIndex
            ? [anchorIndex, targetIndex]
            : [targetIndex, anchorIndex];
        const ids = order.slice(start, end + 1);
        setSelectedBlocks(ids);
        setSelectionAnchorId(anchor);
    }, [currentPage.blocks, selectionAnchorId, selectedBlockIds, setSelectedBlocks]);

    const selectAllBlocks = useCallback(() => {
        const ids = flattenBlocks(currentPage.blocks).map((b) => b.id);
        setSelectedBlocks(ids);
    }, [currentPage.blocks, setSelectedBlocks]);

    const selectBlockRangeByIds = useCallback((startId: string, endId: string) => {
        const order = flattenBlocks(currentPage.blocks).map((b) => b.id);
        const startIndex = order.indexOf(startId);
        const endIndex = order.indexOf(endId);
        if (startIndex === -1 || endIndex === -1) return;

        const [begin, finish] = startIndex < endIndex
            ? [startIndex, endIndex]
            : [endIndex, startIndex];
        const ids = order.slice(begin, finish + 1);
        setSelectedBlocks(ids);
        setSelectionAnchorId(startId);
    }, [currentPage.blocks, setSelectedBlocks]);

    const setCurrentPage = useCallback((id: string) => {
        setWorkspace((ws) => ({
            ...ws,
            currentPageId: id,
        }));
        setFocusBlockId(null);
        setFocusPosition(null);
        clearSelectedBlocks();
    }, [clearSelectedBlocks]);

    const addPage = useCallback((): string => {
        const page = createInitialPage();
        setWorkspace((ws) => ({
            pages: [...ws.pages, page],
            currentPageId: page.id,
        }));
        setFocusBlockId(page.blocks[0]?.id || null);
        setFocusPosition('start');
        clearSelectedBlocks();
        return page.id;
    }, [clearSelectedBlocks]);

    const deletePage = useCallback((id: string) => {
        setWorkspace((ws) => {
            const remaining = ws.pages.filter((p) => p.id !== id);
            let nextPages = remaining;
            let nextCurrent = ws.currentPageId;

            if (remaining.length === 0) {
                const page = createInitialPage();
                nextPages = [page];
                nextCurrent = page.id;
            } else if (ws.currentPageId === id) {
                nextCurrent = remaining[0].id;
            }

            return {
                pages: nextPages,
                currentPageId: nextCurrent,
            };
        });
        setFocusBlockId(null);
        setFocusPosition(null);
        clearSelectedBlocks();
    }, [clearSelectedBlocks]);

    // Actions
    const setTitle = useCallback((title: string) => {
        updateCurrentPage((p) => pageReducer(p, { type: 'SET_TITLE', payload: title }));
    }, [updateCurrentPage]);

    const addBlock = useCallback((type: BlockType, afterId?: string, skipHistory = false): string => {
        const block = createBlock(type);
        updateCurrentPage((p) => pageReducer(p, { type: 'ADD_BLOCK', payload: { block, afterId } }), skipHistory);
        setFocusBlockId(block.id);
        return block.id;
    }, [updateCurrentPage]);

    const addBlockBefore = useCallback((type: BlockType, beforeId: string): string => {
        const block = createBlock(type);
        updateCurrentPage((p) => pageReducer(p, { type: 'ADD_BLOCK_BEFORE', payload: { block, beforeId } }));
        setFocusBlockId(block.id);
        return block.id;
    }, [updateCurrentPage]);

    const updateBlock = useCallback((id: string, updates: Partial<EditorBlock>, skipHistory = false) => {
        updateCurrentPage((p) => pageReducer(p, { type: 'UPDATE_BLOCK', payload: { id, updates } }), skipHistory);
    }, [updateCurrentPage]);

    const deleteBlock = useCallback((id: string) => {
        updateCurrentPage((p) => pageReducer(p, { type: 'DELETE_BLOCK', payload: { id } }));
        clearSelectedBlocks();
    }, [clearSelectedBlocks, updateCurrentPage]);

    const deleteBlocksById = useCallback((ids: string[]) => {
        if (ids.length === 0) return;
        const idsSet = new Set(ids);
        const order = flattenBlocks(currentPage.blocks).map((b) => b.id);

        const selectedIndices = order
            .map((bid, idx) => (idsSet.has(bid) ? idx : -1))
            .filter((idx) => idx >= 0);

        updateCurrentPage((p) => ({
            ...p,
            blocks: deleteBlocksFromTreeSet(p.blocks, idsSet),
        }));
        clearSelectedBlocks();

        if (selectedIndices.length === 0) return;
        const maxIndex = Math.max(...selectedIndices);
        const minIndex = Math.min(...selectedIndices);

        const nextId = order.slice(maxIndex + 1).find((bid) => !idsSet.has(bid));
        const prevId = order.slice(0, minIndex).reverse().find((bid) => !idsSet.has(bid));
        const focusId = nextId || prevId || null;
        if (focusId) {
            setFocusBlockId(focusId);
            setFocusPosition('start');
        } else {
            setFocusBlockId(null);
            setFocusPosition(null);
        }
    }, [clearSelectedBlocks, currentPage.blocks, updateCurrentPage]);

    const insertBlocksAfter = useCallback((targetId: string | null, blocksToInsert: EditorBlock[], skipHistory = false): string[] => {
        if (blocksToInsert.length === 0) return [];
        const clones = blocksToInsert.map(cloneBlockWithNewIds);
        updateCurrentPage((p) => ({
            ...p,
            blocks: insertBlocksAfterInTree(p.blocks, targetId, clones),
        }), skipHistory);
        return clones.map((b) => b.id);
    }, [updateCurrentPage]);

    const moveBlockUp = useCallback((id: string) => {
        updateCurrentPage((p) => pageReducer(p, { type: 'MOVE_BLOCK_UP', payload: { id } }));
    }, [updateCurrentPage]);

    const moveBlockDown = useCallback((id: string) => {
        updateCurrentPage((p) => pageReducer(p, { type: 'MOVE_BLOCK_DOWN', payload: { id } }));
    }, [updateCurrentPage]);

    const toggleCollapse = useCallback((id: string) => {
        updateCurrentPage((p) => pageReducer(p, { type: 'TOGGLE_COLLAPSE', payload: { id } }));
    }, [updateCurrentPage]);

    const addChildBlock = useCallback((parentId: string, type: BlockType): string => {
        const block = createBlock(type);
        updateCurrentPage((p) => pageReducer(p, { type: 'ADD_CHILD_BLOCK', payload: { parentId, block } }));
        setFocusBlockId(block.id);
        return block.id;
    }, [updateCurrentPage]);

    // Navigation functions for arrow keys
    const focusPreviousBlock = useCallback((currentId: string) => {
        const index = currentPage.blocks.findIndex(b => b.id === currentId);
        if (index > 0) {
            setFocusBlockId(currentPage.blocks[index - 1].id);
            setFocusPosition('end');
        }
    }, [currentPage.blocks]);

    const focusNextBlock = useCallback((currentId: string) => {
        const index = currentPage.blocks.findIndex(b => b.id === currentId);
        if (index >= 0 && index < currentPage.blocks.length - 1) {
            setFocusBlockId(currentPage.blocks[index + 1].id);
            setFocusPosition('start');
        }
    }, [currentPage.blocks]);

    // Escape from nested block (toggle child) to main level
    const escapeToMainLevel = useCallback((fromBlockId: string) => {
        const result = findBlockAndParent(currentPage.blocks, fromBlockId);
        if (result && result.parentBlock) {
            const newBlock = createBlock('paragraph');
            updateCurrentPage((p) => pageReducer(p, { type: 'ADD_BLOCK', payload: { block: newBlock, afterId: result.parentBlock!.id } }));
            setFocusBlockId(newBlock.id);
        } else {
            const newBlock = createBlock('paragraph');
            updateCurrentPage((p) => pageReducer(p, { type: 'ADD_BLOCK', payload: { block: newBlock, afterId: fromBlockId } }));
            setFocusBlockId(newBlock.id);
        }
    }, [currentPage.blocks, updateCurrentPage]);

    // Undo/Redo computed values
    const currentPageHistory = historyState[currentPage.id] || { undoStack: [], redoStack: [] };
    const canUndo = currentPageHistory.undoStack.length > 0;
    const canRedo = currentPageHistory.redoStack.length > 0;

    const undo = useCallback(() => {
        const pageHistory = historyState[currentPage.id];
        if (!pageHistory || pageHistory.undoStack.length === 0) return;

        const undoStack = [...pageHistory.undoStack];
        const previousEntry = undoStack.pop()!;

        // Capture current cursor before making changes
        const currentCursor = getCursorInfo();

        // Push current state to redo stack
        const currentEntry: HistoryEntry = { page: currentPage, cursorInfo: currentCursor };
        setHistoryState((prev) => ({
            ...prev,
            [currentPage.id]: {
                undoStack,
                redoStack: [...pageHistory.redoStack, currentEntry],
            },
        }));

        // Apply the previous state (skip history to avoid double-push)
        updateCurrentPage(() => previousEntry.page, true);

        // Restore cursor position after a microtask (wait for DOM update)
        if (previousEntry.cursorInfo?.blockId) {
            setTimeout(() => {
                const blockEl = document.querySelector(
                    `[data-block-id="${previousEntry.cursorInfo!.blockId}"] [contenteditable="true"]`
                );
                if (blockEl) {
                    const range = document.createRange();
                    const sel = window.getSelection();
                    const textNode = blockEl.firstChild;
                    if (textNode && textNode.nodeType === Node.TEXT_NODE) {
                        const offset = Math.min(previousEntry.cursorInfo!.offset, textNode.textContent?.length || 0);
                        range.setStart(textNode, offset);
                        range.collapse(true);
                        sel?.removeAllRanges();
                        sel?.addRange(range);
                    } else {
                        range.selectNodeContents(blockEl);
                        range.collapse(true);
                        sel?.removeAllRanges();
                        sel?.addRange(range);
                    }
                    (blockEl as HTMLElement).focus();
                }
            }, 0);
        }
    }, [currentPage, historyState, updateCurrentPage, getCursorInfo]);

    const redo = useCallback(() => {
        const pageHistory = historyState[currentPage.id];
        if (!pageHistory || pageHistory.redoStack.length === 0) return;

        const redoStack = [...pageHistory.redoStack];
        const nextEntry = redoStack.pop()!;

        // Capture current cursor before making changes
        const currentCursor = getCursorInfo();

        // Push current state to undo stack
        const currentEntry: HistoryEntry = { page: currentPage, cursorInfo: currentCursor };
        setHistoryState((prev) => ({
            ...prev,
            [currentPage.id]: {
                undoStack: [...pageHistory.undoStack, currentEntry],
                redoStack,
            },
        }));

        // Apply the next state (skip history to avoid double-push)
        updateCurrentPage(() => nextEntry.page, true);

        // Restore cursor position after a microtask (wait for DOM update)
        if (nextEntry.cursorInfo?.blockId) {
            setTimeout(() => {
                const blockEl = document.querySelector(
                    `[data-block-id="${nextEntry.cursorInfo!.blockId}"] [contenteditable="true"]`
                );
                if (blockEl) {
                    const range = document.createRange();
                    const sel = window.getSelection();
                    const textNode = blockEl.firstChild;
                    if (textNode && textNode.nodeType === Node.TEXT_NODE) {
                        const offset = Math.min(nextEntry.cursorInfo!.offset, textNode.textContent?.length || 0);
                        range.setStart(textNode, offset);
                        range.collapse(true);
                        sel?.removeAllRanges();
                        sel?.addRange(range);
                    } else {
                        range.selectNodeContents(blockEl);
                        range.collapse(true);
                        sel?.removeAllRanges();
                        sel?.addRange(range);
                    }
                    (blockEl as HTMLElement).focus();
                }
            }, 0);
        }
    }, [currentPage, historyState, updateCurrentPage, getCursorInfo]);

    const value = useMemo<PageContextValue>(
        () => ({
            pages: workspace.pages,
            currentPageId: currentPage.id,
            page: currentPage,
            setCurrentPage,
            addPage,
            deletePage,
            focusBlockId,
            focusPosition,
            clearFocusBlock,
            setFocusBlock,
            selectedBlockIds,
            setSelectedBlocks,
            selectBlockRange,
            selectBlockRangeByIds,
            clearSelectedBlocks,
            selectAllBlocks,
            setTitle,
            addBlock,
            addBlockBefore,
            updateBlock,
            deleteBlock,
            deleteBlocksById,
            insertBlocksAfter,
            moveBlockUp,
            moveBlockDown,
            toggleCollapse,
            addChildBlock,
            escapeToMainLevel,
            focusPreviousBlock,
            focusNextBlock,
            pushHistory,
            undo,
            redo,
            canUndo,
            canRedo,
        }),
        [
            workspace.pages,
            currentPage.id,
            setCurrentPage,
            addPage,
            deletePage,
            focusBlockId,
            focusPosition,
            clearFocusBlock,
            setFocusBlock,
            selectedBlockIds,
            setSelectedBlocks,
            selectBlockRange,
            selectBlockRangeByIds,
            clearSelectedBlocks,
            selectAllBlocks,
            setTitle,
            addBlock,
            addBlockBefore,
            updateBlock,
            deleteBlock,
            deleteBlocksById,
            insertBlocksAfter,
            moveBlockUp,
            moveBlockDown,
            toggleCollapse,
            addChildBlock,
            escapeToMainLevel,
            focusPreviousBlock,
            focusNextBlock,
            pushHistory,
            undo,
            redo,
            canUndo,
            canRedo,
        ]
    );

    return <PageContext.Provider value={value}>{children}</PageContext.Provider>;
}

// ============================================
// Hook
// ============================================

export function usePage(): PageContextValue {
    const context = useContext(PageContext);
    if (!context) {
        throw new Error('usePage must be used within a PageProvider');
    }
    return context;
}
