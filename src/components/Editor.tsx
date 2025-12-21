import { useCallback, useEffect, useRef, useState } from 'react';
import { usePage } from '../context/PageContext';
import { serializeRichTextFromElement } from '../utils/blocks';
import {
    INTERNAL_CLIPBOARD_MIME,
    blocksToPlainText,
    buildClipboardPayload,
    collectSelectedBlocks,
    parseClipboardPayload,
    serializeClipboardPayload,
} from '../utils/clipboard';
import { PageTitle } from './PageTitle';
import { FloatingToolbar } from './FloatingToolbar';
import { BlockRenderer } from './blocks/BlockRenderer';

// Color constants
const TEXT_COLORS = ['default', 'gray', 'brown', 'orange', 'yellow', 'green', 'blue', 'purple', 'pink', 'red'] as const;
const BG_COLORS = ['default', 'gray_background', 'brown_background', 'orange_background', 'yellow_background', 'green_background', 'blue_background', 'purple_background', 'pink_background', 'red_background'] as const;

// Color menu styles
const colorMenuStyle: React.CSSProperties = {
    position: 'absolute',
    top: '100%',
    left: '50%',
    transform: 'translateX(-50%)',
    marginTop: '4px',
    backgroundColor: '#2d2d2d',
    borderRadius: '6px',
    padding: '6px',
    display: 'grid',
    gridTemplateColumns: 'repeat(5, 1fr)',
    gap: '4px',
    zIndex: 1001,
    border: '1px solid #444',
};

const colorSwatchStyle = (color: string): React.CSSProperties => ({
    width: '24px',
    height: '24px',
    borderRadius: '4px',
    border: 'none',
    cursor: 'pointer',
    backgroundColor: getColorValue(color),
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#fff',
    fontSize: '12px',
});

const getColorValue = (color: string): string => {
    const colorMap: Record<string, string> = {
        default: '#666',
        gray: '#9ca3af',
        brown: '#b5651d',
        orange: '#f97316',
        yellow: '#eab308',
        green: '#22c55e',
        blue: '#3b82f6',
        purple: '#a855f7',
        pink: '#ec4899',
        red: '#ef4444',
        gray_background: '#374151',
        brown_background: '#78350f',
        orange_background: '#7c2d12',
        yellow_background: '#713f12',
        green_background: '#14532d',
        blue_background: '#1e3a8a',
        purple_background: '#581c87',
        pink_background: '#831843',
        red_background: '#7f1d1d',
    };
    return colorMap[color] || color;
};

export function Editor() {
    const {
        page,
        updateBlock,
        selectedBlockIds,
        clearSelectedBlocks,
        selectAllBlocks,
        selectBlockRangeByIds,
        deleteBlocksById,
        insertBlocksAfter,
        setFocusBlock,
        pushHistory,
        undo,
        redo,
        convertBlocksToType,
        mergeBlocksIntoSingle,
    } = usePage();
    const blocks = page.blocks;

    // Color menu states
    const [showTextColorMenu, setShowTextColorMenu] = useState(false);
    const [showBgColorMenu, setShowBgColorMenu] = useState(false);

    // Refs for drag selection state (persist across re-renders)
    const dragStartBlockIdRef = useRef<string | null>(null);
    const isDraggingRef = useRef(false);


    const getOrderedSelection = useCallback(() => {
        if (!selectedBlockIds.length) return [];
        return collectSelectedBlocks(blocks, new Set(selectedBlockIds));
    }, [blocks, selectedBlockIds]);

    const deleteSelectedBlocks = useCallback(() => {
        if (selectedBlockIds.length === 0) return;
        deleteBlocksById(selectedBlockIds);
    }, [deleteBlocksById, selectedBlockIds]);

    // Apply color to all selected blocks
    const applyColorToBlocks = useCallback((color: string, type: 'text' | 'bg') => {
        if (selectedBlockIds.length === 0) return;

        // Push history for atomic undo
        pushHistory();

        selectedBlockIds.forEach((blockId) => {
            // Find the block
            const block = blocks.find((b) => b.id === blockId);
            if (!block || !block.rich_text) return;

            // Update each rich_text item with the new color
            const updatedRichText = block.rich_text.map((rt) => ({
                ...rt,
                annotations: {
                    ...rt.annotations,
                    color: type === 'bg' ? color : (color === 'default' ? 'default' : color),
                },
            }));

            updateBlock(blockId, { rich_text: updatedRichText }, true);
        });

        // Close menus
        setShowTextColorMenu(false);
        setShowBgColorMenu(false);
        clearSelectedBlocks();
    }, [blocks, clearSelectedBlocks, pushHistory, selectedBlockIds, updateBlock]);

    const copySelectedBlocksToClipboard = useCallback((clipboard: DataTransfer | null): boolean => {
        if (!clipboard) return false;
        const ordered = getOrderedSelection();
        if (ordered.length === 0) return false;
        const payload = buildClipboardPayload(ordered);
        clipboard.setData('text/plain', blocksToPlainText(ordered));
        clipboard.setData('application/json', JSON.stringify(payload.notion));
        clipboard.setData(INTERNAL_CLIPBOARD_MIME, serializeClipboardPayload(payload));
        return true;
    }, [getOrderedSelection]);

    const getInsertionTargetId = useCallback((eventTarget: EventTarget | null): string | null => {
        if (selectedBlockIds.length > 0) {
            const ordered = getOrderedSelection();
            return ordered[ordered.length - 1]?.id ?? null;
        }

        const nodeTarget = eventTarget as Node | null;
        const targetFromNode = nodeTarget ? getClosestBlockId(nodeTarget) : null;
        if (targetFromNode) return targetFromNode;

        const selection = window.getSelection();
        if (selection && selection.rangeCount > 0) {
            const rangeTarget = getClosestBlockId(selection.getRangeAt(0).startContainer);
            if (rangeTarget) return rangeTarget;
        }

        return blocks[blocks.length - 1]?.id ?? null;
    }, [blocks, getOrderedSelection, selectedBlockIds.length]);

    const persistSelectionToState = (range?: Range | null) => {
        const selection = window.getSelection();
        const activeRange = range ?? (selection && selection.rangeCount > 0 ? selection.getRangeAt(0) : null);
        if (!activeRange) return;

        const startBlock = getClosestBlockId(activeRange.startContainer);
        const endBlock = getClosestBlockId(activeRange.endContainer);
        if (!startBlock || !endBlock || startBlock !== endBlock) return;

        const blockElement = document.querySelector<HTMLElement>(`[data-block-id="${startBlock}"] [contenteditable="true"]`);
        if (!blockElement) return;

        const richText = serializeRichTextFromElement(blockElement);
        updateBlock(startBlock, { rich_text: richText });
    };

    const handleFormat = (format: string) => {
        switch (format) {
            case 'bold':
                document.execCommand('bold');
                break;
            case 'italic':
                document.execCommand('italic');
                break;
            case 'underline':
                document.execCommand('underline');
                break;
            case 'strikethrough':
                document.execCommand('strikeThrough');
                break;
            case 'code':
                toggleInlineCode();
                break;
        }

        persistSelectionToState();
    };

    const toggleInlineCode = () => {
        const selection = window.getSelection();
        if (!selection || selection.isCollapsed || selection.rangeCount === 0) return;

        const range = selection.getRangeAt(0);

        // Find the closest inline-code parent from either end of the selection
        const findInlineCodeParent = (node: Node): Element | null => {
            if (node.nodeType === Node.TEXT_NODE) {
                return node.parentElement?.closest('.inline-code') || null;
            }
            return (node as Element).closest?.('.inline-code') || null;
        };

        const startCodeParent = findInlineCodeParent(range.startContainer);
        const endCodeParent = findInlineCodeParent(range.endContainer);

        // Use the innermost inline-code parent (prefer startCodeParent)
        const inlineCodeParent = startCodeParent || endCodeParent;

        if (inlineCodeParent) {
            // Already in inline code - REMOVE the formatting
            const parent = inlineCodeParent.parentNode;
            if (parent) {
                // Move all children out of the span (preserves <br> and other elements)
                const firstChild = inlineCodeParent.firstChild;
                const lastChild = inlineCodeParent.lastChild;

                while (inlineCodeParent.firstChild) {
                    parent.insertBefore(inlineCodeParent.firstChild, inlineCodeParent);
                }
                parent.removeChild(inlineCodeParent);

                // Normalize to merge adjacent text nodes
                parent.normalize();

                // Update selection to span the moved content
                if (firstChild && lastChild) {
                    const newRange = document.createRange();
                    newRange.setStartBefore(firstChild);
                    newRange.setEndAfter(lastChild);
                    selection.removeAllRanges();
                    selection.addRange(newRange);
                }
            }
        } else {
            // Not in inline code - APPLY formatting
            const span = document.createElement('span');
            span.className = 'inline-code';

            try {
                range.surroundContents(span);
            } catch {
                // If surroundContents fails, extract and wrap
                const contents = range.extractContents();
                span.appendChild(contents);
                range.insertNode(span);
            }

            // Update selection to be inside the new span
            const newRange = document.createRange();
            newRange.selectNodeContents(span);
            selection.removeAllRanges();
            selection.addRange(newRange);
        }
    };

    const isFullBlockSelection = useCallback(() => {
        const activeElement = document.activeElement;
        if (activeElement instanceof HTMLTextAreaElement) {
            return activeElement.selectionStart === 0
                && activeElement.selectionEnd === activeElement.value.length;
        }

        const selection = window.getSelection();
        if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
            return false;
        }

        const range = selection.getRangeAt(0);
        const startBlock = getClosestBlockId(range.startContainer);
        const endBlock = getClosestBlockId(range.endContainer);
        if (!startBlock || startBlock !== endBlock) return false;

        const editable = getEditableAncestor(range.startContainer);
        if (!editable) return false;

        const fullRange = document.createRange();
        fullRange.selectNodeContents(editable);
        return (
            range.compareBoundaryPoints(Range.START_TO_START, fullRange) <= 0
            && range.compareBoundaryPoints(Range.END_TO_END, fullRange) >= 0
        );
    }, []);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            const meta = e.metaKey || e.ctrlKey;

            // Undo: Ctrl+Z (without Shift)
            if (meta && !e.shiftKey && e.key.toLowerCase() === 'z') {
                e.preventDefault();
                undo();
                return;
            }

            // Redo: Ctrl+Shift+Z or Ctrl+Y
            if ((meta && e.shiftKey && e.key.toLowerCase() === 'z') ||
                (meta && e.key.toLowerCase() === 'y')) {
                e.preventDefault();
                redo();
                return;
            }
            if (selectedBlockIds.length > 0) {
                if (e.key === 'Backspace' || e.key === 'Delete') {
                    e.preventDefault();
                    deleteSelectedBlocks();
                    return;
                }
                if (meta && e.key.toLowerCase() === 'a') {
                    e.preventDefault();
                    selectAllBlocks();
                    return;
                }
                if (e.key === 'Escape') {
                    clearSelectedBlocks();
                    return;
                }
            } else {
                if (e.key === 'Escape') {
                    clearSelectedBlocks();
                    return;
                }

                // Ctrl+A always selects all blocks
                if (meta && e.key.toLowerCase() === 'a') {
                    e.preventDefault();
                    selectAllBlocks();
                    return;
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [clearSelectedBlocks, deleteSelectedBlocks, isFullBlockSelection, selectAllBlocks, selectedBlockIds.length, undo, redo]);

    useEffect(() => {
        const handleCopy = (e: ClipboardEvent) => {
            if (!selectedBlockIds.length) return;
            const success = copySelectedBlocksToClipboard(e.clipboardData);
            if (success) {
                e.preventDefault();
            }
        };

        const handleCut = (e: ClipboardEvent) => {
            if (!selectedBlockIds.length) return;
            const success = copySelectedBlocksToClipboard(e.clipboardData);
            if (success) {
                e.preventDefault();
                deleteSelectedBlocks();
            }
        };

        const handlePaste = (e: ClipboardEvent) => {
            const raw = e.clipboardData?.getData(INTERNAL_CLIPBOARD_MIME) || null;
            const payload = parseClipboardPayload(raw);
            if (!payload) return;
            e.preventDefault();

            // Save state before paste for atomic undo
            pushHistory();
            const targetId = getInsertionTargetId(e.target);
            // Pass skipHistory=true since we manually pushed history
            const insertedIds = insertBlocksAfter(targetId, payload.blocks, true);
            clearSelectedBlocks();
            if (insertedIds.length > 0) {
                setFocusBlock(insertedIds[0]);
            }
        };

        const handleMouseDown = (e: MouseEvent) => {
            // Clear selection if clicking in editable area while blocks are selected
            if (selectedBlockIds.length > 0) {
                const target = e.target as HTMLElement | null;
                if (target) {
                    if (target.closest('.block-handle')) return;
                    const insideEditable = target.closest('[contenteditable="true"]') || target.closest('textarea');
                    if (insideEditable) {
                        clearSelectedBlocks();
                    }
                }
            }

            // Track starting block for potential drag selection
            if (e.button === 0) { // Left mouse button
                const target = e.target as HTMLElement | null;
                const blockId = target ? getClosestBlockId(target) : null;
                // Set drag start if clicking on a block, otherwise leave null for now
                // (will be set when first entering a block during drag)
                dragStartBlockIdRef.current = blockId;
                isDraggingRef.current = true;
            }
        };

        const handleMouseMove = (e: MouseEvent) => {
            if (!isDraggingRef.current || e.buttons !== 1) {
                isDraggingRef.current = false;
                dragStartBlockIdRef.current = null;
                return;
            }

            const target = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null;
            if (!target) return;

            const currentBlockId = getClosestBlockId(target);
            if (!currentBlockId) return;

            // If we started dragging from outside blocks, set first entered block as start
            if (!dragStartBlockIdRef.current) {
                dragStartBlockIdRef.current = currentBlockId;
                return;
            }

            // If mouse has moved to a different block, trigger block selection
            if (currentBlockId !== dragStartBlockIdRef.current) {
                // Clear native text selection
                const selection = window.getSelection();
                selection?.removeAllRanges();

                // Select the range of blocks
                selectBlockRangeByIds(dragStartBlockIdRef.current, currentBlockId);
            }
        };

        const handleMouseUp = () => {
            isDraggingRef.current = false;
            dragStartBlockIdRef.current = null;
        };

        window.addEventListener('copy', handleCopy);
        window.addEventListener('cut', handleCut);
        window.addEventListener('paste', handlePaste);
        window.addEventListener('mousedown', handleMouseDown);
        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);

        return () => {
            window.removeEventListener('copy', handleCopy);
            window.removeEventListener('cut', handleCut);
            window.removeEventListener('paste', handlePaste);
            window.removeEventListener('mousedown', handleMouseDown);
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [
        clearSelectedBlocks,
        copySelectedBlocksToClipboard,
        deleteSelectedBlocks,
        getInsertionTargetId,
        insertBlocksAfter,
        pushHistory,
        selectBlockRangeByIds,
        selectedBlockIds.length,
        setFocusBlock,
    ]);

    return (
        <div className="page-container">
            <div className="page-content">
                <PageTitle />
                {/* Block Selection Toolbar - shown when multiple blocks are selected */}
                {selectedBlockIds.length > 0 && (
                    <div className="block-selection-toolbar" style={{
                        position: 'fixed',
                        top: '60px',
                        left: '50%',
                        transform: 'translateX(-50%)',
                        backgroundColor: '#1e1e1e',
                        borderRadius: '8px',
                        padding: '8px 12px',
                        display: 'flex',
                        gap: '8px',
                        alignItems: 'center',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                        zIndex: 1000,
                        border: '1px solid #333',
                    }}>
                        <span style={{ color: '#999', fontSize: '12px', marginRight: '8px' }}>
                            {selectedBlockIds.length} seçili
                        </span>
                        <button onClick={() => convertBlocksToType(selectedBlockIds, 'bulleted_list_item')} style={toolbarBtnStyle} title="Bullet List">
                            •
                        </button>
                        <button onClick={() => convertBlocksToType(selectedBlockIds, 'numbered_list_item')} style={toolbarBtnStyle} title="Numbered List">
                            1.
                        </button>
                        <button onClick={() => convertBlocksToType(selectedBlockIds, 'to_do')} style={toolbarBtnStyle} title="To-do">
                            ☐
                        </button>
                        <button onClick={() => convertBlocksToType(selectedBlockIds, 'paragraph')} style={toolbarBtnStyle} title="Text">
                            P
                        </button>
                        <button onClick={() => convertBlocksToType(selectedBlockIds, 'heading_1')} style={toolbarBtnStyle} title="Heading 1">
                            H1
                        </button>
                        <button onClick={() => convertBlocksToType(selectedBlockIds, 'heading_2')} style={toolbarBtnStyle} title="Heading 2">
                            H2
                        </button>
                        <button onClick={() => mergeBlocksIntoSingle(selectedBlockIds, 'quote')} style={toolbarBtnStyle} title="Quote (merge)">
                            "
                        </button>
                        <button onClick={() => mergeBlocksIntoSingle(selectedBlockIds, 'code')} style={{ ...toolbarBtnStyle, fontFamily: 'monospace', fontSize: '11px' }} title="Code (merge)">
                            {'</>'}
                        </button>
                        <div style={{ width: '1px', height: '20px', backgroundColor: '#444' }} />
                        {/* Color dropdowns */}
                        <div style={{ position: 'relative' }}>
                            <button onClick={() => setShowTextColorMenu(prev => !prev)} style={toolbarBtnStyle} title="Text Color">
                                A
                            </button>
                            {showTextColorMenu && (
                                <div style={colorMenuStyle}>
                                    {TEXT_COLORS.map(color => (
                                        <button key={color} onClick={() => applyColorToBlocks(color, 'text')} style={colorSwatchStyle(color)}>
                                            {color === 'default' ? '⊘' : ''}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                        <div style={{ position: 'relative' }}>
                            <button onClick={() => setShowBgColorMenu(prev => !prev)} style={toolbarBtnStyle} title="Background Color">
                                ▇
                            </button>
                            {showBgColorMenu && (
                                <div style={colorMenuStyle}>
                                    {BG_COLORS.map(color => (
                                        <button key={color} onClick={() => applyColorToBlocks(color, 'bg')} style={colorSwatchStyle(color)}>
                                            {color === 'default' ? '⊘' : ''}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                        <div style={{ width: '1px', height: '20px', backgroundColor: '#444' }} />
                        <button onClick={deleteSelectedBlocks} style={{ ...toolbarBtnStyle, color: '#ef4444' }} title="Delete">
                            🗑
                        </button>
                    </div>
                )}
                <FloatingToolbar
                    onFormat={handleFormat}
                    onColorChange={persistSelectionToState}
                    onBlockTypeChange={(blockId, newType) => {
                        updateBlock(blockId, { type: newType as any });
                    }}
                />

                <div className="blocks-container">
                    {blocks.map((block, index) => (
                        <BlockRenderer
                            key={block.id}
                            block={block}
                            index={index}
                            siblings={blocks}
                        />
                    ))}
                </div>
            </div>
        </div>
    );
}

const toolbarBtnStyle: React.CSSProperties = {
    background: 'transparent',
    border: 'none',
    color: '#ddd',
    padding: '6px 10px',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: 500,
};

function getClosestBlockId(node: Node): string | null {
    const element = node instanceof HTMLElement ? node : node.parentElement;
    const wrapper = element?.closest('[data-block-id]');
    return wrapper ? wrapper.getAttribute('data-block-id') : null;
}

function getEditableAncestor(node: Node): HTMLElement | null {
    const element = node instanceof HTMLElement ? node : node.parentElement;
    return element?.closest?.('[contenteditable="true"]') || null;
}

