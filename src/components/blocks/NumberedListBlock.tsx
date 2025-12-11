import { useEffect } from 'react';
import { usePage } from '../../context/PageContext';
import type { EditorBlock } from '../../types/types';
import { richTextEquals, serializeRichTextFromElement, setElementRichText } from '../../utils/blocks';
import { useBlockFocus, isAtFirstLine, isAtLastLine } from '../../utils/useBlockFocus';

interface NumberedListBlockProps {
    block: EditorBlock;
    displayNumber: number;
}

export function NumberedListBlock({ block, displayNumber }: NumberedListBlockProps) {
    const { updateBlock, addBlock, deleteBlock, focusPreviousBlock, focusNextBlock } = usePage();
    const contentRef = useBlockFocus(block.id);

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
                addBlock('numbered_list_item', block.id);
            }
        }

        if (e.key === 'Backspace' && text === '') {
            e.preventDefault();
            deleteBlock(block.id);
        }
    };

    return (
        <div className="list-block">
            <span className="list-marker" aria-hidden="true">
                {displayNumber}.
            </span>
            <div
                ref={contentRef}
                className="list-content"
                contentEditable
                suppressContentEditableWarning
                onInput={handleInput}
                onKeyDown={handleKeyDown}
                data-placeholder=""
                role="listitem"
            />
        </div>
    );
}
