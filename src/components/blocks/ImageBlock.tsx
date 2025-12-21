import { useState, useRef } from 'react';
import { usePage } from '../../context/PageContext';
import type { EditorBlock } from '../../types/types';
import {
    DEFAULT_IMAGE_WIDTH,
} from '../../utils/blocks';

interface ImageBlockProps {
    block: EditorBlock;
}

export function ImageBlock({ block }: ImageBlockProps) {
    const { updateBlock, addBlock, deleteBlock, focusPreviousBlock, focusNextBlock, setFocusBlock } = usePage();
    const [isResizing, setIsResizing] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const imageRef = useRef<HTMLImageElement>(null);

    const imageUrl = block.imageUrl || '';
    const isUploading = imageUrl === '__uploading__';
    const width = Math.min(100, Math.max(10, block.imageWidthPercent ?? DEFAULT_IMAGE_WIDTH));

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

    // Corner resize handlers
    const handleResizeStart = (e: React.MouseEvent, corner: 'left' | 'right') => {
        e.preventDefault();
        e.stopPropagation();
        setIsResizing(true);

        const startX = e.clientX;
        const startWidth = width;
        const containerWidth = containerRef.current?.offsetWidth || 800;

        const handleMouseMove = (moveEvent: MouseEvent) => {
            const deltaX = moveEvent.clientX - startX;
            const deltaPercent = (deltaX / containerWidth) * 100;

            let newWidth: number;
            if (corner === 'right') {
                newWidth = startWidth + deltaPercent * 2; // *2 because centered
            } else {
                newWidth = startWidth - deltaPercent * 2;
            }

            const clamped = Math.min(100, Math.max(10, newWidth));
            updateBlock(block.id, { imageWidthPercent: clamped });
        };

        const handleMouseUp = () => {
            setIsResizing(false);
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
    };

    return (
        <div
            ref={containerRef}
            className="image-block"
            tabIndex={0}
            onKeyDown={handleImageKeyDown}
        >
            {isUploading ? (
                <div className="image-uploading">
                    <div className="image-uploading-spinner" />
                    <span>Uploading image...</span>
                </div>
            ) : imageUrl ? (
                <div
                    className="image-wrapper"
                    style={{
                        width: `${width}%`,
                        position: 'relative',
                        margin: '0 auto',
                    }}
                >
                    {/* Left resize handle */}
                    <div
                        className={`image-resize-handle image-resize-handle--left ${isResizing ? 'active' : ''}`}
                        onMouseDown={(e) => handleResizeStart(e, 'left')}
                    />

                    <img
                        ref={imageRef}
                        src={imageUrl}
                        alt="Image"
                        className="image-block-img"
                        style={{ width: '100%', display: 'block' }}
                        draggable={false}
                    />

                    {/* Right resize handle */}
                    <div
                        className={`image-resize-handle image-resize-handle--right ${isResizing ? 'active' : ''}`}
                        onMouseDown={(e) => handleResizeStart(e, 'right')}
                    />
                </div>
            ) : (
                <button className="image-placeholder" onClick={promptForUrl}>
                    Click to add image URL
                </button>
            )}
        </div>
    );
}
