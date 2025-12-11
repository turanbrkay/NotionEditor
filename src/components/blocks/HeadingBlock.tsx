import { useEffect } from 'react';
import { usePage } from '../../context/PageContext';
import type { EditorBlock, HeadingBlockType } from '../../types/types';
import { richTextEquals, serializeRichTextFromElement, setElementRichText } from '../../utils/blocks';
import { parsePastedText, handlePasteIntoBlocks } from '../../utils/paste';
import { useBlockFocus, isAtFirstLine, isAtLastLine, isAtBlockStart } from '../../utils/useBlockFocus';

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
    const { updateBlock, addBlock, addBlockBefore, deleteBlock, focusPreviousBlock, focusNextBlock, setFocusBlock } = usePage();
    const contentRef = useBlockFocus(block.id);
    const level = getHeadingLevel(block.type as HeadingBlockType);

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
        handlePasteIntoBlocks(block.id, parsed, { updateBlock, addBlock, setFocusBlock: () => {} });
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
            if (text.trim() === '---') {
                updateBlock(block.id, { type: 'divider', rich_text: [] });
                const newId = addBlock('paragraph', block.id);
                setFocusBlock(newId);
                return;
            }
            if (contentRef.current && isAtBlockStart(contentRef.current)) {
                const newId = addBlockBefore(block.type, block.id);
                setFocusBlock(newId);
            } else {
                addBlock('paragraph', block.id);
            }
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
            spellCheck={false}
            onInput={handleInput}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            data-placeholder=""
            role="heading"
            aria-level={level}
        />
    );
}
