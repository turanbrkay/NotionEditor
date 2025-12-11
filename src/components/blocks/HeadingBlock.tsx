import { useEffect } from 'react';
import { usePage } from '../../context/PageContext';
import type { EditorBlock, HeadingBlockType } from '../../types/types';
import { getPlainText, createRichText } from '../../utils/blocks';
import { useBlockFocus, isAtFirstLine, isAtLastLine } from '../../utils/useBlockFocus';

interface HeadingBlockProps {
    block: EditorBlock;
}

function getHeadingLevel(type: HeadingBlockType): 1 | 2 | 3 {
    switch (type) {
        case 'heading_1':
            return 1;
        case 'heading_2':
            return 2;
        case 'heading_3':
            return 3;
    }
}

export function HeadingBlock({ block }: HeadingBlockProps) {
    const { updateBlock, addBlock, deleteBlock, focusPreviousBlock, focusNextBlock } = usePage();
    const contentRef = useBlockFocus(block.id);
    const level = getHeadingLevel(block.type as HeadingBlockType);

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
            addBlock('paragraph', block.id);
        }

        if (e.key === 'Backspace' && text === '') {
            e.preventDefault();
            deleteBlock(block.id);
        }
    };

    return (
        <div
            ref={contentRef}
            className={`block-content block-heading block-heading--${level}`}
            contentEditable
            suppressContentEditableWarning
            onInput={handleInput}
            onKeyDown={handleKeyDown}
            data-placeholder=""
            role="heading"
            aria-level={level}
        />
    );
}
