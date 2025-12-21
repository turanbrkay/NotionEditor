import { useEffect } from 'react';
import { usePage } from '../../context/PageContext';
import type { EditorBlock } from '../../types/types';
import { richTextEquals, serializeRichTextFromElement, setElementRichText } from '../../utils/blocks';
import { parsePastedText, handlePasteIntoBlocks } from '../../utils/paste';
import { useBlockFocus, isAtFirstLine, isAtLastLine, isAtBlockStart } from '../../utils/useBlockFocus';

interface ToDoBlockProps {
    block: EditorBlock;
}

export function ToDoBlock({ block }: ToDoBlockProps) {
    const { updateBlock, addBlock, addBlockBefore, deleteBlock, focusPreviousBlock, focusNextBlock, setFocusBlock, pushHistory } = usePage();
    const contentRef = useBlockFocus(block.id);
    const isChecked = block.checked ?? false;

    useEffect(() => {
        if (!contentRef.current) return;

        const current = serializeRichTextFromElement(contentRef.current);
        if (!richTextEquals(current, block.rich_text || [])) {
            setElementRichText(contentRef.current, block.rich_text || []);
        }
    }, [block.rich_text, contentRef]);

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
        pushHistory();
        handlePasteIntoBlocks(block.id, parsed, { updateBlock, addBlock, setFocusBlock: () => { } }, true);
    };

    const handleCheckboxChange = () => {
        updateBlock(block.id, { checked: !isChecked });
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        const text = contentRef.current?.textContent || '';

        // Arrow key navigation
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

        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            if (text === '') {
                updateBlock(block.id, { type: 'paragraph' });
            } else {
                if (text.trim() === '---') {
                    updateBlock(block.id, { type: 'divider', rich_text: [] });
                    const newId = addBlock('paragraph', block.id);
                    setFocusBlock(newId);
                    return;
                }
                if (contentRef.current && isAtBlockStart(contentRef.current)) {
                    const newId = addBlockBefore('to_do', block.id);
                    setFocusBlock(newId);
                } else {
                    addBlock('to_do', block.id);
                }
            }
        }

        if (e.key === 'Backspace' && text === '') {
            e.preventDefault();
            deleteBlock(block.id);
        }
    };

    return (
        <div className="todo-block">
            <input
                type="checkbox"
                className="todo-checkbox"
                checked={isChecked}
                onChange={handleCheckboxChange}
                aria-label="Toggle task completion"
            />
            <div
                ref={contentRef}
                className={`todo-content ${isChecked ? 'todo-content--checked' : ''}`}
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
