import React, { useState, useCallback } from 'react';
import { usePage } from '../../context/PageContext';
import type { EditorBlock } from '../../types/types';

interface BlockWrapperProps {
    block: EditorBlock;
    children: React.ReactNode;
}

export function BlockWrapper({ block, children }: BlockWrapperProps) {
    const [isHovered, setIsHovered] = useState(false);
    const {
        selectedBlockIds,
        setSelectedBlocks,
        selectBlockRange,
        clearSelectedBlocks,
    } = usePage();
    const isSelected = selectedBlockIds.includes(block.id);

    // Only trigger hover when mouse enters THIS element directly, not from children
    const handleMouseEnter = useCallback((e: React.MouseEvent) => {
        // Check if the mouse came from outside this block-wrapper
        const relatedTarget = e.relatedTarget as HTMLElement | null;
        const currentTarget = e.currentTarget as HTMLElement;

        // If relatedTarget is a child of currentTarget, don't set hover
        if (relatedTarget && currentTarget.contains(relatedTarget)) {
            return;
        }
        setIsHovered(true);
    }, []);

    const handleMouseLeave = useCallback((e: React.MouseEvent) => {
        // Check if mouse is leaving to a child - if so, don't remove hover yet
        const relatedTarget = e.relatedTarget as HTMLElement | null;
        const currentTarget = e.currentTarget as HTMLElement;

        if (relatedTarget && currentTarget.contains(relatedTarget)) {
            return;
        }
        setIsHovered(false);
    }, []);

    // Also handle direct movement over the block-main area
    const handleBlockMainEnter = useCallback(() => {
        setIsHovered(true);
    }, []);

    const handleBlockMainLeave = useCallback((e: React.MouseEvent) => {
        const relatedTarget = e.relatedTarget as HTMLElement | null;
        const currentTarget = e.currentTarget.parentElement as HTMLElement;

        if (relatedTarget && currentTarget && currentTarget.contains(relatedTarget)) {
            return;
        }
        setIsHovered(false);
    }, []);

    const handleHandleMouseDown = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.shiftKey) {
            selectBlockRange(block.id);
        } else {
            setSelectedBlocks([block.id]);
        }
    }, [block.id, selectBlockRange, setSelectedBlocks]);

    const handleBlockMainMouseDown = useCallback(() => {
        if (selectedBlockIds.length > 0) {
            clearSelectedBlocks();
        }
    }, [clearSelectedBlocks, selectedBlockIds.length]);

    return (
        <div
            className={`block-wrapper ${isHovered ? 'block-wrapper--hovered' : ''} ${isSelected ? 'block-wrapper--selected' : ''}`}
            data-block-id={block.id}
            data-block-type={block.type}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            aria-selected={isSelected}
        >
            {/* Drag handle - visible based on isHovered state */}
            <div
                className="block-handle"
                title="Drag to reorder"
                style={{ opacity: isHovered ? 0.4 : 0 }}
                onMouseDown={handleHandleMouseDown}
            >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
                    <circle cx="4" cy="3" r="1.5" />
                    <circle cx="10" cy="3" r="1.5" />
                    <circle cx="4" cy="7" r="1.5" />
                    <circle cx="10" cy="7" r="1.5" />
                    <circle cx="4" cy="11" r="1.5" />
                    <circle cx="10" cy="11" r="1.5" />
                </svg>
            </div>

            {/* Block content */}
            <div
                className="block-main"
                onMouseEnter={handleBlockMainEnter}
                onMouseLeave={handleBlockMainLeave}
                onMouseDown={handleBlockMainMouseDown}
            >
                {children}
            </div>
        </div>
    );
}
