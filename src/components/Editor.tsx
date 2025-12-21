import { useCallback, useEffect, useRef } from 'react';
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
    } = usePage();
    const blocks = page.blocks;

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

        // Check if selection is inside an inline-code span
        const container = range.commonAncestorContainer;
        const inlineCodeParent = container.nodeType === Node.TEXT_NODE
            ? container.parentElement?.closest('.inline-code')
            : (container as Element).closest?.('.inline-code');

        if (inlineCodeParent) {
            // Already in inline code - remove the formatting
            const parent = inlineCodeParent.parentNode;
            if (parent) {
                // Move children out and remove the span
                while (inlineCodeParent.firstChild) {
                    parent.insertBefore(inlineCodeParent.firstChild, inlineCodeParent);
                }
                parent.removeChild(inlineCodeParent);
                // Normalize to merge adjacent text nodes
                parent.normalize();
            }
        } else {
            // Not in inline code - apply formatting
            try {
                const span = document.createElement('span');
                span.className = 'inline-code';
                range.surroundContents(span);
            } catch {
                // If surroundContents fails (partial selection across elements),
                // extract and wrap the contents
                const contents = range.extractContents();
                const span = document.createElement('span');
                span.className = 'inline-code';
                span.appendChild(contents);
                range.insertNode(span);
            }
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

                if (meta && e.key.toLowerCase() === 'a' && isFullBlockSelection()) {
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

function getClosestBlockId(node: Node): string | null {
    const element = node instanceof HTMLElement ? node : node.parentElement;
    const wrapper = element?.closest('[data-block-id]');
    return wrapper ? wrapper.getAttribute('data-block-id') : null;
}

function getEditableAncestor(node: Node): HTMLElement | null {
    const element = node instanceof HTMLElement ? node : node.parentElement;
    return element?.closest?.('[contenteditable="true"]') || null;
}
