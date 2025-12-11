import { useEffect, useRef } from 'react';
import { usePage } from '../../context/PageContext';
import type { EditorBlock } from '../../types/types';
import { richTextEquals, serializeRichTextFromElement, setElementRichText } from '../../utils/blocks';
import { parsePastedText, handlePasteIntoBlocks } from '../../utils/paste';
import { isAtFirstLine, isAtLastLine, isAtBlockStart } from '../../utils/useBlockFocus';

interface CalloutBlockProps {
    block: EditorBlock;
}

export function CalloutBlock({ block }: CalloutBlockProps) {
    const { updateBlock, addBlock, deleteBlock, focusPreviousBlock, focusNextBlock, focusBlockId, clearFocusBlock, setFocusBlock } = usePage();
    const contentRef = useRef<HTMLDivElement>(null);
    const icon = block.icon || '💡';

    useEffect(() => {
        if (!contentRef.current) return;

        const current = serializeRichTextFromElement(contentRef.current);
        if (!richTextEquals(current, block.rich_text || [])) {
            setElementRichText(contentRef.current, block.rich_text || []);
        }
    }, [block.rich_text]);

    useEffect(() => {
        if (focusBlockId === block.id && contentRef.current) {
            contentRef.current.focus();
            const range = document.createRange();
            const sel = window.getSelection();
            range.selectNodeContents(contentRef.current);
            range.collapse(false);
            sel?.removeAllRanges();
            sel?.addRange(range);
            clearFocusBlock();
        }
    }, [focusBlockId, block.id, clearFocusBlock]);

    const handleInput = () => {
        if (contentRef.current) {
            updateBlock(block.id, { rich_text: serializeRichTextFromElement(contentRef.current) });
        }
    };

    const handlePaste = (e: React.ClipboardEvent) => {
        const text = e.clipboardData?.getData('text/plain') || '';
        if (!text) return;
        const parsed = parsePastedText(text);
        if (parsed.length === 0) return;
        e.preventDefault();
        handlePasteIntoBlocks(block.id, parsed, { updateBlock, addBlock, setFocusBlock: () => {} });
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (!contentRef.current) return;

        const text = contentRef.current.innerText || '';

        // Ctrl+Enter = EXIT block and create paragraph below
        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            addBlock('paragraph', block.id);
            return;
        }

        if (e.key === 'Enter' && !e.shiftKey && text.trim() === '---') {
            e.preventDefault();
            updateBlock(block.id, { type: 'divider', rich_text: [] });
            const newId = addBlock('paragraph', block.id);
            setFocusBlock(newId);
            return;
        }

        // Arrow navigation
        if (e.key === 'ArrowUp' && isAtFirstLine(contentRef.current)) {
            e.preventDefault();
            focusPreviousBlock(block.id);
            return;
        }

        if (e.key === 'ArrowDown' && isAtLastLine(contentRef.current)) {
            e.preventDefault();
            focusNextBlock(block.id);
            return;
        }

        if (e.key === 'Enter' && !e.shiftKey && contentRef.current && isAtBlockStart(contentRef.current)) {
            const newId = addBlock('callout', block.id);
            setFocusBlock(newId);
            return;
        }

        // Regular Enter = new line inside block (allow default)

        // Backspace on empty
        if (e.key === 'Backspace' && text === '') {
            e.preventDefault();
            deleteBlock(block.id);
        }
    };

    return (
        <div className="callout-block">
            <span className="callout-icon" role="img" aria-label="Callout icon">
                {icon}
            </span>
            <div
                ref={contentRef}
                className="callout-content"
                contentEditable
                spellCheck={false}
                suppressContentEditableWarning
                onInput={handleInput}
                onKeyDown={handleKeyDown}
                onPaste={handlePaste}
                data-placeholder=""
            />
        </div>
    );
}
