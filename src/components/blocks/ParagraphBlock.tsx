import React, { useEffect, useState } from 'react';
import { usePage } from '../../context/PageContext';
import type { EditorBlock } from '../../types/types';
import {
    createRichText,
    richTextEquals,
    serializeRichTextFromElement,
    setElementRichText,
    DEFAULT_IMAGE_WIDTH,
} from '../../utils/blocks';
import { parsePastedText, handlePasteIntoBlocks } from '../../utils/paste';
import { useBlockFocus, isAtFirstLine, isAtLastLine, isAtBlockStart } from '../../utils/useBlockFocus';
import { SlashMenu } from '../SlashMenu';

interface ParagraphBlockProps {
    block: EditorBlock;
}

export function ParagraphBlock({ block }: ParagraphBlockProps) {
    const { updateBlock, addBlock, addBlockBefore, deleteBlock, focusPreviousBlock, focusNextBlock, setFocusBlock, escapeToMainLevel, pushHistory } = usePage();
    const contentRef = useBlockFocus(block.id);
    const [showSlashMenu, setShowSlashMenu] = useState(false);

    // Sync content with block state
    useEffect(() => {
        if (!contentRef.current) return;

        const current = serializeRichTextFromElement(contentRef.current);
        if (!richTextEquals(current, block.rich_text || [])) {
            setElementRichText(contentRef.current, block.rich_text || []);
        }
    }, [block.rich_text, contentRef]);

    const handleInput = () => {
        if (contentRef.current) {
            const text = contentRef.current.textContent || '';

            // Check for slash command at start
            if (text === '/') {
                setShowSlashMenu(true);
                return;
            }

            if (showSlashMenu && !text.startsWith('/')) {
                setShowSlashMenu(false);
            }

            updateBlock(block.id, { rich_text: serializeRichTextFromElement(contentRef.current) });
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        const text = contentRef.current?.textContent || '';

        // Ctrl+Enter = escape to main level (exits toggle if inside one)
        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            escapeToMainLevel(block.id);
            return;
        }

        // Handle slash menu
        if (showSlashMenu) {
            if (e.key === 'Escape') {
                e.preventDefault();
                setShowSlashMenu(false);
                return;
            }
            if (['ArrowUp', 'ArrowDown', 'Enter'].includes(e.key)) {
                return;
            }
        }

        // Arrow key navigation between blocks
        if (e.key === 'ArrowUp' && contentRef.current && isAtFirstLine(contentRef.current)) {
            e.preventDefault();
            focusPreviousBlock(block.id);
            return;
        }

        if (e.key === 'ArrowDown' && contentRef.current && isAtLastLine(contentRef.current)) {
            e.preventDefault();
            focusNextBlock(block.id);
            return;
        }

        // Enter to create new block, Shift+Enter for line break
        if (e.key === 'Enter') {
            if (e.shiftKey) {
                return;
            }
            e.preventDefault();
            if (showSlashMenu) return;

            if (text.trim() === '---') {
                updateBlock(block.id, { type: 'divider', rich_text: [] });
                const newId = addBlock('paragraph', block.id);
                setFocusBlock(newId);
                return;
            }

            if (contentRef.current && isAtBlockStart(contentRef.current)) {
                const newId = addBlockBefore('paragraph', block.id);
                setFocusBlock(newId);
                return;
            }

            // Split block at cursor position
            if (contentRef.current) {
                const selection = window.getSelection();
                if (selection && selection.rangeCount > 0) {
                    const range = selection.getRangeAt(0);

                    // Create a range for content after cursor
                    const afterRange = document.createRange();
                    afterRange.setStart(range.endContainer, range.endOffset);
                    afterRange.setEndAfter(contentRef.current.lastChild || contentRef.current);

                    // Extract the content after cursor
                    const afterContent = afterRange.extractContents();
                    const tempDiv = document.createElement('div');
                    tempDiv.appendChild(afterContent);
                    const afterText = tempDiv.textContent || '';

                    // Update current block with remaining content
                    updateBlock(block.id, { rich_text: serializeRichTextFromElement(contentRef.current) });

                    // Create new block with the extracted content
                    const newId = addBlock('paragraph', block.id);
                    updateBlock(newId, { rich_text: [{ type: 'text', text: { content: afterText }, annotations: { bold: false, italic: false, strikethrough: false, underline: false, code: false, color: 'default' }, plain_text: afterText, href: null }] });
                    setFocusBlock(newId, 'start');
                    return;
                }
            }

            addBlock('paragraph', block.id);
        }

        // Backspace on empty block to delete it
        if (e.key === 'Backspace' && text === '') {
            e.preventDefault();
            deleteBlock(block.id);
        }
    };

    const handleSlashSelect = (type: string) => {
        setShowSlashMenu(false);

        if (type === 'image') {
            const url = window.prompt('Paste image URL');
            if (contentRef.current) {
                contentRef.current.textContent = '';
            }
            if (!url || !url.trim()) {
                return;
            }
            updateBlock(block.id, {
                type: 'image',
                imageUrl: url.trim(),
                imageWidthPercent: DEFAULT_IMAGE_WIDTH,
                rich_text: [],
            });
            setTimeout(() => {
                setFocusBlock(block.id);
            }, 0);
            return;
        }

        if (contentRef.current) {
            contentRef.current.textContent = '';
        }
        updateBlock(block.id, {
            type: type as EditorBlock['type'],
            rich_text: createRichText(''),
            ...(type === 'to_do' ? { checked: false } : {}),
            ...(type.startsWith('toggle') ? { collapsed: false, children: [] } : {}),
            ...(type === 'code' ? { language: 'cpp' } : {}),
            ...(type === 'callout' ? { icon: 'DY' } : {}),
        });
        // IMPORTANT: Trigger focus on this block so the new component receives focus
        setTimeout(() => {
            setFocusBlock(block.id);
        }, 0);
    };

    const handlePaste = (e: React.ClipboardEvent) => {
        const text = e.clipboardData?.getData('text/plain') || '';
        if (!text) return;
        const parsed = parsePastedText(text);
        if (parsed.length === 0) return;
        e.preventDefault();
        // Save state before paste for atomic undo
        pushHistory();
        handlePasteIntoBlocks(block.id, parsed, { updateBlock, addBlock, setFocusBlock }, true);
    };

    return (
        <div style={{ position: 'relative' }}>
            <div
                ref={contentRef}
                className="block-content block-paragraph"
                contentEditable
                suppressContentEditableWarning
                spellCheck={false}
                onInput={handleInput}
                onKeyDown={handleKeyDown}
                onPaste={handlePaste}
                data-placeholder=""
            />
            {showSlashMenu && (
                <SlashMenu
                    onSelect={handleSlashSelect}
                    onClose={() => setShowSlashMenu(false)}
                />
            )}
        </div>
    );
}
