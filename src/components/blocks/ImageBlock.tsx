import { useEffect, useState } from 'react';
import { usePage } from '../../context/PageContext';
import type { EditorBlock } from '../../types/types';
import {
    DEFAULT_IMAGE_WIDTH,
    getPlainText,
    richTextEquals,
    serializeRichTextFromElement,
    setElementRichText,
} from '../../utils/blocks';
import { useBlockFocus, isAtFirstLine, isAtLastLine } from '../../utils/useBlockFocus';

interface ImageBlockProps {
    block: EditorBlock;
}

export function ImageBlock({ block }: ImageBlockProps) {
    const { updateBlock, addBlock, deleteBlock, focusPreviousBlock, focusNextBlock, setFocusBlock } = usePage();
    const captionRef = useBlockFocus(block.id);
    const [isHovered, setIsHovered] = useState(false);

    const imageUrl = block.imageUrl || '';
    const width = Math.min(100, Math.max(20, block.imageWidthPercent ?? DEFAULT_IMAGE_WIDTH));

    useEffect(() => {
        if (!captionRef.current) return;

        const current = serializeRichTextFromElement(captionRef.current);
        if (!richTextEquals(current, block.rich_text || [])) {
            setElementRichText(captionRef.current, block.rich_text || []);
        }
    }, [block.rich_text, captionRef]);

    const handleCaptionInput = () => {
        if (captionRef.current) {
            updateBlock(block.id, { rich_text: serializeRichTextFromElement(captionRef.current) });
        }
    };

    const handleCaptionKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
        const text = captionRef.current?.textContent || '';

        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            const newId = addBlock('paragraph', block.id);
            setFocusBlock(newId);
            return;
        }

        if (e.key === 'ArrowUp' && captionRef.current && (text === '' || isAtFirstLine(captionRef.current))) {
            e.preventDefault();
            focusPreviousBlock(block.id);
            return;
        }

        if (e.key === 'ArrowDown' && captionRef.current && (text === '' || isAtLastLine(captionRef.current))) {
            e.preventDefault();
            focusNextBlock(block.id);
            return;
        }

        if ((e.key === 'Backspace' || e.key === 'Delete') && text === '') {
            e.preventDefault();
            deleteBlock(block.id);
        }
    };

    const handleWidthChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = Number(e.target.value);
        const clamped = Math.min(100, Math.max(20, Number.isFinite(value) ? value : width));
        updateBlock(block.id, { imageWidthPercent: clamped });
    };

    const handleImageKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            const newId = addBlock('paragraph', block.id);
            setFocusBlock(newId);
            return;
        }

        if (e.key === 'ArrowUp') {
            e.preventDefault();
            focusPreviousBlock(block.id);
            return;
        }

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            focusNextBlock(block.id);
            return;
        }

        if (e.key === 'Backspace' || e.key === 'Delete') {
            e.preventDefault();
            deleteBlock(block.id);
        }
    };

    const promptForUrl = () => {
        const next = window.prompt('Paste image URL', imageUrl);
        if (!next || !next.trim()) return;
        updateBlock(block.id, { imageUrl: next.trim() });
    };

    const altText = getPlainText(block.rich_text) || 'Image block';

    return (
        <div
            className="image-block"
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
            <div
                className="image-frame"
                tabIndex={0}
                onKeyDown={handleImageKeyDown}
                onClick={() => captionRef.current?.focus()}
            >
                {imageUrl ? (
                    <img
                        src={imageUrl}
                        alt={altText}
                        className="image-block-img"
                        style={{ width: `${width}%` }}
                    />
                ) : (
                    <button className="image-placeholder" onClick={promptForUrl}>
                        Add image URL
                    </button>
                )}
            </div>

            <div className={`image-resize ${isHovered ? 'image-resize--active' : ''}`}>
                <input
                    type="range"
                    min={20}
                    max={100}
                    value={width}
                    onChange={handleWidthChange}
                    aria-label="Resize image"
                    disabled={!imageUrl}
                />
                <span className="image-resize-value">{Math.round(width)}%</span>
                <button className="image-replace-btn" onClick={promptForUrl}>
                    {imageUrl ? 'Replace' : 'Set image'}
                </button>
            </div>

            <div
                ref={captionRef}
                className="image-caption"
                contentEditable
                suppressContentEditableWarning
                spellCheck={false}
                onInput={handleCaptionInput}
                onKeyDown={handleCaptionKeyDown}
                data-placeholder="Add caption"
            />
        </div>
    );
}
