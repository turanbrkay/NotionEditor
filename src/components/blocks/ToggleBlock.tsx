import React, { useRef, useEffect } from 'react';
import { usePage } from '../../context/PageContext';
import type { EditorBlock, ToggleBlockType } from '../../types/types';
import { getPlainText, createRichText } from '../../utils/blocks';
import { BlockRenderer } from './BlockRenderer';
import { isAtFirstLine, isAtLastLine } from '../../utils/useBlockFocus';

interface ToggleBlockProps {
    block: EditorBlock;
}

function getToggleHeadingLevel(type: ToggleBlockType): 1 | 2 | 3 | null {
    switch (type) {
        case 'toggle_heading_1':
            return 1;
        case 'toggle_heading_2':
            return 2;
        case 'toggle_heading_3':
            return 3;
        case 'toggle_list':
            return null;
    }
}

export function ToggleBlock({ block }: ToggleBlockProps) {
    const { updateBlock, toggleCollapse, addChildBlock, deleteBlock, focusBlockId, clearFocusBlock, focusPreviousBlock, focusNextBlock, escapeToMainLevel } = usePage();
    const contentRef = useRef<HTMLDivElement>(null);
    const headingLevel = getToggleHeadingLevel(block.type as ToggleBlockType);
    const isExpanded = !block.collapsed;

    // Sync content with block state
    useEffect(() => {
        if (contentRef.current) {
            const currentText = contentRef.current.textContent || '';
            const blockText = getPlainText(block.rich_text);
            if (currentText !== blockText) {
                contentRef.current.textContent = blockText;
            }
        }
    }, [block.rich_text]);

    // Auto-focus when this block is newly created
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
            const text = contentRef.current.textContent || '';
            updateBlock(block.id, { rich_text: createRichText(text) });
        }
    };

    const handleToggle = () => {
        toggleCollapse(block.id);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        const text = contentRef.current?.textContent || '';

        // Ctrl+Enter = EXIT toggle and create paragraph below (at main level)
        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            escapeToMainLevel(block.id);
            return;
        }

        // Arrow key navigation
        if (e.key === 'ArrowUp' && contentRef.current && isAtFirstLine(contentRef.current)) {
            e.preventDefault();
            focusPreviousBlock(block.id);
            return;
        }

        if (e.key === 'ArrowDown' && contentRef.current && isAtLastLine(contentRef.current)) {
            e.preventDefault();
            if (isExpanded && block.children && block.children.length > 0) {
                focusNextBlock(block.id);
            } else {
                focusNextBlock(block.id);
            }
            return;
        }

        // Enter creates child block inside toggle
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            if (block.collapsed) {
                toggleCollapse(block.id);
            }
            addChildBlock(block.id, 'paragraph');
        }

        // Backspace on empty to delete
        if (e.key === 'Backspace' && text === '') {
            e.preventDefault();
            deleteBlock(block.id);
        }
    };

    const getClassName = () => {
        const base = 'toggle-block';
        if (headingLevel) {
            return `${base} toggle-heading--${headingLevel}`;
        }
        return base;
    };

    const children = block.children || [];

    return (
        <div className={getClassName()}>
            <div className="toggle-header">
                {/* Caret icon - vertically centered */}
                <button
                    className={`toggle-caret ${headingLevel ? `toggle-caret--h${headingLevel}` : ''}`}
                    onClick={handleToggle}
                    aria-expanded={isExpanded}
                    aria-label={isExpanded ? 'Collapse' : 'Expand'}
                >
                    <span className={`toggle-caret-icon ${isExpanded ? 'toggle-caret-icon--expanded' : ''}`}>
                        ▶
                    </span>
                </button>

                <div
                    ref={contentRef}
                    className="toggle-content"
                    contentEditable
                    suppressContentEditableWarning
                    onInput={handleInput}
                    onKeyDown={handleKeyDown}
                    data-placeholder={headingLevel ? '' : ''}
                    role={headingLevel ? 'heading' : undefined}
                    aria-level={headingLevel || undefined}
                />
            </div>

            {/* Children - rendered when expanded, no "+ Add a block" button */}
            {isExpanded && (
                <div className="toggle-children">
                    {children.length === 0 ? (
                        // Empty toggle - show a subtle empty block ready for typing
                        <div
                            className="toggle-empty-hint"
                            onClick={() => addChildBlock(block.id, 'paragraph')}
                        >
                            Click or press Enter to add content
                        </div>
                    ) : (
                        children.map((child, index) => (
                            <BlockRenderer
                                key={child.id}
                                block={child}
                                index={index}
                                siblings={children}
                            />
                        ))
                    )}
                </div>
            )}
        </div>
    );
}
