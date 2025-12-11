import React, {
    createContext,
    useContext,
    useReducer,
    useEffect,
    useCallback,
    useMemo,
} from 'react';
import { v4 as uuidv4 } from 'uuid';
import type { BlockType, EditorBlock, Page } from '../types/types';
import { createBlock } from '../utils/blocks';
import { savePage, loadPage, debounce } from '../utils/storage';

// ============================================
// Constants
// ============================================

const DEFAULT_TITLE = 'Untitled';
const SAVE_DEBOUNCE_MS = 300;

// ============================================
// Context Types
// ============================================

interface PageContextValue {
    page: Page;
    focusBlockId: string | null;
    focusPosition: 'start' | 'end' | null;
    clearFocusBlock: () => void;
    setFocusBlock: (id: string) => void;
    // Page operations
    setTitle: (title: string) => void;
    // Block CRUD
    addBlock: (type: BlockType, afterId?: string) => string;
    addBlockBefore: (type: BlockType, beforeId: string) => string;
    updateBlock: (id: string, updates: Partial<EditorBlock>) => void;
    deleteBlock: (id: string) => void;
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
}

// ============================================
// Reducer Actions
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
// Reducer
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
    const [page, dispatch] = useReducer(pageReducer, null, () => {
        // Try to load from localStorage on init
        const saved = loadPage();
        return saved || createInitialPage();
    });

    // Track which block should be focused (after creation)
    const [focusBlockId, setFocusBlockId] = React.useState<string | null>(null);
    const [focusPosition, setFocusPosition] = React.useState<'start' | 'end' | null>(null);

    const clearFocusBlock = useCallback(() => {
        setFocusBlockId(null);
        setFocusPosition(null);
    }, []);

    const setFocusBlock = useCallback((id: string) => {
        setFocusBlockId(id);
        setFocusPosition('start');
    }, []);

    // Debounced save to localStorage
    const debouncedSave = useMemo(
        () => debounce((p: Page) => savePage(p), SAVE_DEBOUNCE_MS),
        []
    );

    // Save on every change
    useEffect(() => {
        debouncedSave(page);
    }, [page, debouncedSave]);

    // Actions
    const setTitle = useCallback((title: string) => {
        dispatch({ type: 'SET_TITLE', payload: title });
    }, []);

    const addBlock = useCallback((type: BlockType, afterId?: string): string => {
        const block = createBlock(type);
        dispatch({ type: 'ADD_BLOCK', payload: { block, afterId } });
        setFocusBlockId(block.id);
        return block.id;
    }, []);

    const addBlockBefore = useCallback((type: BlockType, beforeId: string): string => {
        const block = createBlock(type);
        dispatch({ type: 'ADD_BLOCK_BEFORE', payload: { block, beforeId } });
        setFocusBlockId(block.id);
        return block.id;
    }, []);

    const updateBlock = useCallback((id: string, updates: Partial<EditorBlock>) => {
        dispatch({ type: 'UPDATE_BLOCK', payload: { id, updates } });
    }, []);

    const deleteBlock = useCallback((id: string) => {
        dispatch({ type: 'DELETE_BLOCK', payload: { id } });
    }, []);

    const moveBlockUp = useCallback((id: string) => {
        dispatch({ type: 'MOVE_BLOCK_UP', payload: { id } });
    }, []);

    const moveBlockDown = useCallback((id: string) => {
        dispatch({ type: 'MOVE_BLOCK_DOWN', payload: { id } });
    }, []);

    const toggleCollapse = useCallback((id: string) => {
        dispatch({ type: 'TOGGLE_COLLAPSE', payload: { id } });
    }, []);

    const addChildBlock = useCallback((parentId: string, type: BlockType): string => {
        const block = createBlock(type);
        dispatch({ type: 'ADD_CHILD_BLOCK', payload: { parentId, block } });
        setFocusBlockId(block.id);
        return block.id;
    }, []);

    // Navigation functions for arrow keys
    const focusPreviousBlock = useCallback((currentId: string) => {
        const index = page.blocks.findIndex(b => b.id === currentId);
        if (index > 0) {
            setFocusBlockId(page.blocks[index - 1].id);
            setFocusPosition('end');
        }
    }, [page.blocks]);

    const focusNextBlock = useCallback((currentId: string) => {
        const index = page.blocks.findIndex(b => b.id === currentId);
        if (index >= 0 && index < page.blocks.length - 1) {
            setFocusBlockId(page.blocks[index + 1].id);
            setFocusPosition('start');
        }
    }, [page.blocks]);

    // Escape from nested block (toggle child) to main level
    const escapeToMainLevel = useCallback((fromBlockId: string) => {
        // Find if this block is inside a toggle (nested)
        const result = findBlockAndParent(page.blocks, fromBlockId);
        if (result && result.parentBlock) {
            // This block is nested - find the parent toggle and add block after it
            const newBlock = createBlock('paragraph');
            dispatch({ type: 'ADD_BLOCK', payload: { block: newBlock, afterId: result.parentBlock.id } });
            setFocusBlockId(newBlock.id);
        } else {
            // Not nested - just add block after current
            const newBlock = createBlock('paragraph');
            dispatch({ type: 'ADD_BLOCK', payload: { block: newBlock, afterId: fromBlockId } });
            setFocusBlockId(newBlock.id);
        }
    }, [page.blocks]);

    const value = useMemo<PageContextValue>(
        () => ({
            page,
            focusBlockId,
            focusPosition,
            clearFocusBlock,
            setFocusBlock,
            setTitle,
            addBlock,
            addBlockBefore,
            updateBlock,
            deleteBlock,
            moveBlockUp,
            moveBlockDown,
            toggleCollapse,
            addChildBlock,
            escapeToMainLevel,
            focusPreviousBlock,
            focusNextBlock,
        }),
        [
            page,
            focusBlockId,
            focusPosition,
            clearFocusBlock,
            setFocusBlock,
            setTitle,
            addBlock,
            addBlockBefore,
            updateBlock,
            deleteBlock,
            moveBlockUp,
            moveBlockDown,
            toggleCollapse,
            addChildBlock,
            escapeToMainLevel,
            focusPreviousBlock,
            focusNextBlock,
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
