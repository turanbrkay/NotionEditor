import { useEffect } from 'react';
import { usePage } from '../../context/PageContext';
import type { EditorBlock } from '../../types/types';
import { getPlainText, createRichText } from '../../utils/blocks';
import { useBlockFocus, isAtFirstLine, isAtLastLine } from '../../utils/useBlockFocus';

interface BulletedListBlockProps {
    block: EditorBlock;
}

export function BulletedListBlock({ block }: BulletedListBlockProps) {
    const { updateBlock, addBlock, deleteBlock, focusPreviousBlock, focusNextBlock } = usePage();
    const contentRef = useBlockFocus(block.id);

    useEffect(() => {
        if (contentRef.current) {
            const currentText = contentRef.current.textContent || '';
            const blockText = getPlainText(block.rich_text);
            if (currentText !== blockText) {
                contentRef.current.textContent = blockText;
            }
        }
    }, [block.rich_text, contentRef]);

    const handleInput = () => {
        if (contentRef.current) {
            const text = contentRef.current.textContent || '';
            updateBlock(block.id, { rich_text: createRichText(text) });
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
                // Exit list on empty
                updateBlock(block.id, { type: 'paragraph' });
            } else {
                addBlock('bulleted_list_item', block.id);
            }
        }

        if (e.key === 'Backspace' && text === '') {
            e.preventDefault();
            deleteBlock(block.id);
        }
    };

    return (
        <div className="list-block">
            <span className="list-marker list-marker--bullet" aria-hidden="true" />
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
