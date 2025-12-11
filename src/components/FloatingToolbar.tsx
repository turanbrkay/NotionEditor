import { useState, useEffect, useCallback, useRef } from 'react';

interface FloatingToolbarProps {
    onFormat: (format: string) => void;
    onColorChange?: (range?: Range | null) => void;
    onBlockTypeChange?: (blockId: string, newType: string) => void;
}

const BLOCK_TYPES = [
    { value: 'paragraph', label: 'Text' },
    { value: 'heading_1', label: 'Heading 1' },
    { value: 'heading_2', label: 'Heading 2' },
    { value: 'heading_3', label: 'Heading 3' },
    { value: 'bulleted_list_item', label: 'Bulleted List' },
    { value: 'numbered_list_item', label: 'Numbered List' },
    { value: 'to_do', label: 'To-do' },
    { value: 'toggle_list', label: 'Toggle List' },
    { value: 'quote', label: 'Quote' },
    { value: 'callout', label: 'Callout' },
    { value: 'image', label: 'Image' },
    { value: 'code', label: 'Code' },
] as const;

const TEXT_COLORS = ['default', 'gray', 'brown', 'orange', 'yellow', 'green', 'blue', 'purple', 'pink', 'red'] as const;
const BG_COLORS = ['default', 'gray_background', 'brown_background', 'orange_background', 'yellow_background', 'green_background', 'blue_background', 'purple_background', 'pink_background', 'red_background'] as const;
const COLOR_VALUES: Record<string, string> = {
    default: '',
    gray: '#9ca3af',
    brown: '#b5651d',
    orange: '#f97316',
    yellow: '#eab308',
    green: '#22c55e',
    blue: '#3b82f6',
    purple: '#a855f7',
    pink: '#ec4899',
    red: '#ef4444',
    gray_background: '#1f2937',
    brown_background: '#3b2f2f',
    orange_background: '#3a2412',
    yellow_background: '#3b2f0a',
    green_background: '#0f2e1f',
    blue_background: '#0f1f3a',
    purple_background: '#231137',
    pink_background: '#2f0f1f',
    red_background: '#3a0f14',
};

export function FloatingToolbar({ onFormat, onColorChange, onBlockTypeChange }: FloatingToolbarProps) {
    const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
    const [hasSelection, setHasSelection] = useState(false);
    const [showTextColorMenu, setShowTextColorMenu] = useState(false);
    const [showBgColorMenu, setShowBgColorMenu] = useState(false);
    const [showBlockTypeMenu, setShowBlockTypeMenu] = useState(false);
    const [currentBlockType, setCurrentBlockType] = useState<string>('paragraph');
    const [currentBlockId, setCurrentBlockId] = useState<string | null>(null);
    const selectionRef = useRef<Range | null>(null);

    const updatePosition = useCallback(() => {
        const selection = window.getSelection();
        if (!selection || selection.isCollapsed || selection.rangeCount === 0) {
            setHasSelection(false);
            return;
        }

        const text = selection.toString();
        if (!text || text.trim() === '') {
            setHasSelection(false);
            return;
        }

        // Check if selection is within an editable block
        const range = selection.getRangeAt(0);
        const container = range.commonAncestorContainer;
        const editableParent = (container as Element).closest?.('[contenteditable="true"]')
            || (container.parentElement as Element)?.closest?.('[contenteditable="true"]');

        if (!editableParent) {
            setHasSelection(false);
            return;
        }

        const rect = range.getBoundingClientRect();
        setPosition({
            top: rect.top - 45,
            left: rect.left + rect.width / 2 - 120,
        });
        setHasSelection(true);
        setShowTextColorMenu(false);
        setShowBgColorMenu(false);
        setShowBlockTypeMenu(false);

        // Detect current block type and ID
        const blockWrapper = editableParent.closest('[data-block-id]');
        if (blockWrapper) {
            const blockId = blockWrapper.getAttribute('data-block-id');
            const blockTypeAttr = blockWrapper.getAttribute('data-block-type');
            setCurrentBlockId(blockId);
            setCurrentBlockType(blockTypeAttr || 'paragraph');
        }

        // store selection range so we can restore after clicking menu buttons
        selectionRef.current = selection.getRangeAt(0).cloneRange();
    }, []);

    useEffect(() => {
        document.addEventListener('selectionchange', updatePosition);
        document.addEventListener('mouseup', updatePosition);

        return () => {
            document.removeEventListener('selectionchange', updatePosition);
            document.removeEventListener('mouseup', updatePosition);
        };
    }, [updatePosition]);

    // Hide on scroll or click outside
    useEffect(() => {
        const handleScroll = () => setHasSelection(false);
        window.addEventListener('scroll', handleScroll, true);
        return () => window.removeEventListener('scroll', handleScroll, true);
    }, []);

    if (!hasSelection || !position) {
        return null;
    }

    const applyColorToSelection = (color: string): Range | null => {
        const sel = window.getSelection();
        let range: Range | null = null;

        // Get or restore selection
        if (sel && sel.rangeCount > 0 && !sel.isCollapsed) {
            range = sel.getRangeAt(0).cloneRange();
        } else if (selectionRef.current && sel) {
            range = selectionRef.current.cloneRange();
            sel.removeAllRanges();
            sel.addRange(range);
        }

        if (!range) {
            return null;
        }

        // Find the contenteditable container
        const container = range.commonAncestorContainer;
        const editableParent = (container instanceof HTMLElement ? container : container.parentElement)
            ?.closest('[contenteditable="true"]') as HTMLElement | null;
        if (!editableParent) {
            return null;
        }

        // Save the original selection boundaries before any DOM manipulation
        const startContainer = range.startContainer;
        const startOffset = range.startOffset;
        const endContainer = range.endContainer;
        const endOffset = range.endOffset;

        // Step 1: Remove existing color spans that intersect the selection
        const colorSpans = Array.from(editableParent.querySelectorAll('.rt-color'));
        for (const span of colorSpans) {
            if (range.intersectsNode(span)) {
                const parent = span.parentNode;
                if (parent) {
                    // Move all children out of the span
                    while (span.firstChild) {
                        parent.insertBefore(span.firstChild, span);
                    }
                    parent.removeChild(span);
                }
            }
        }

        // Normalize to merge adjacent text nodes
        editableParent.normalize();

        // Recreate the range using the saved boundaries
        try {
            const newRange = document.createRange();
            newRange.setStart(startContainer, startOffset);
            newRange.setEnd(endContainer, endOffset);
            range = newRange;
        } catch (e) {
            // Try to use selectionRef as fallback
            if (selectionRef.current) {
                range = selectionRef.current.cloneRange();
            } else {
                return null;
            }
        }

        // If color is "default", we're done - just unwrapping was the goal
        if (color === 'default') {
            const finalSel = window.getSelection();
            if (finalSel) {
                finalSel.removeAllRanges();
                finalSel.addRange(range);
            }
            selectionRef.current = range.cloneRange();
            return range;
        }

        // Step 3: Wrap selection in new color span
        const span = document.createElement('span');
        span.className = 'rt-color';
        span.classList.add(`rt-color-${color}`);
        span.setAttribute('data-color', color);

        // Set inline style for immediate visual feedback
        if (color.endsWith('_background')) {
            span.style.backgroundColor = COLOR_VALUES[color];
        } else {
            span.style.color = COLOR_VALUES[color];
        }

        try {
            range.surroundContents(span);
        } catch (e) {
            // If surroundContents fails (partial selection across elements)
            const contents = range.extractContents();
            span.appendChild(contents);
            range.insertNode(span);
            range.selectNodeContents(span);
        }


        // Update selection to the new span contents
        const finalSel = window.getSelection();
        if (finalSel) {
            finalSel.removeAllRanges();
            finalSel.addRange(range);
        }
        selectionRef.current = range.cloneRange();

        return range;
    };

    const handleColorSelect = (color: string) => {
        const usedRange = applyColorToSelection(color);
        setShowTextColorMenu(false);
        setShowBgColorMenu(false);
        onColorChange?.(usedRange ?? selectionRef.current);
    };

    const handleClick = (format: string) => (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        onFormat(format);
    };

    const handleBlockTypeSelect = (newType: string) => {
        if (currentBlockId && onBlockTypeChange) {
            onBlockTypeChange(currentBlockId, newType);
        }
        setShowBlockTypeMenu(false);
    };

    const getCurrentBlockTypeLabel = () => {
        const blockType = BLOCK_TYPES.find(bt => bt.value === currentBlockType);
        return blockType?.label || 'Text';
    };

    return (
        <div
            className="floating-toolbar"
            style={{
                top: Math.max(10, position.top),
                left: Math.max(10, position.left),
            }}
            onMouseDown={(e) => e.preventDefault()} // Prevent losing selection
        >
            <button
                className="floating-toolbar-btn"
                onMouseDown={(e) => e.preventDefault()}
                onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setShowBlockTypeMenu((v) => !v);
                    setShowTextColorMenu(false);
                    setShowBgColorMenu(false);
                }}
                title="Turn into"
                style={{ minWidth: '80px', justifyContent: 'space-between', display: 'flex', alignItems: 'center' }}
            >
                <span>{getCurrentBlockTypeLabel()}</span>
                <span style={{ marginLeft: '4px' }}>▼</span>
            </button>
            <div className="floating-toolbar-divider" />
            <button
                className="floating-toolbar-btn"
                onClick={handleClick('bold')}
                title="Bold"
            >
                B
            </button>
            <button
                className="floating-toolbar-btn"
                onClick={handleClick('italic')}
                title="Italic"
                style={{ fontStyle: 'italic' }}
            >
                I
            </button>
            <button
                className="floating-toolbar-btn"
                onClick={handleClick('underline')}
                title="Underline"
                style={{ textDecoration: 'underline' }}
            >
                U
            </button>
            <button
                className="floating-toolbar-btn"
                onClick={handleClick('strikethrough')}
                title="Strikethrough"
                style={{ textDecoration: 'line-through' }}
            >
                S
            </button>
            <div className="floating-toolbar-divider" />
            <button
                className="floating-toolbar-btn"
                onClick={handleClick('code')}
                title="Inline code"
                style={{ fontFamily: 'monospace', fontSize: '12px' }}
            >
                {'</>'}
            </button>
            <div className="floating-toolbar-divider" />
            <button
                className="floating-toolbar-btn"
                onMouseDown={(e) => e.preventDefault()}
                onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setShowTextColorMenu((v) => {
                        return !v;
                    });
                    setShowBgColorMenu(false);
                }}
                title="Text color"
            >
                A
            </button>
            <button
                className="floating-toolbar-btn"
                onMouseDown={(e) => e.preventDefault()}
                onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setShowBgColorMenu((v) => !v);
                    setShowTextColorMenu(false);
                }}
                title="Background color"
            >
                ▇
            </button>
            {showTextColorMenu && (
                <div className="floating-toolbar-color-menu">
                    <div className="floating-toolbar-color-section">
                        <div className="floating-toolbar-color-title">Color</div>
                        <div className="floating-toolbar-color-grid">
                            {TEXT_COLORS.map((c) => (
                                <button
                                    key={c}
                                    className="floating-toolbar-color-swatch"
                                    onMouseDown={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        handleColorSelect(c);
                                    }}
                                    data-color={c}
                                >
                                    <span className={`rt-color ${c !== 'default' ? `rt-color-${c}` : ''}`}>
                                        {c === 'default' ? 'Default' : c.replace('_', ' ')}
                                    </span>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            )}
            {showBgColorMenu && (
                <div className="floating-toolbar-color-menu">
                    <div className="floating-toolbar-color-section">
                        <div className="floating-toolbar-color-title">Background</div>
                        <div className="floating-toolbar-color-grid">
                            {BG_COLORS.map((c) => (
                                <button
                                    key={c}
                                    className="floating-toolbar-color-swatch"
                                    onMouseDown={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        handleColorSelect(c);
                                    }}
                                    data-color={c}
                                >
                                    <span className={`rt-color ${c !== 'default' ? `rt-color-${c}` : ''}`}>
                                        {c === 'default' ? 'Default' : c.replace('_', ' ')}
                                    </span>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            )}
            {showBlockTypeMenu && (
                <div className="floating-toolbar-color-menu">
                    <div className="floating-toolbar-color-section">
                        <div className="floating-toolbar-color-title">Turn into</div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                            {BLOCK_TYPES.map((bt) => (
                                <button
                                    key={bt.value}
                                    className="floating-toolbar-color-swatch"
                                    onMouseDown={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        handleBlockTypeSelect(bt.value);
                                    }}
                                    style={{
                                        textAlign: 'left',
                                        padding: '6px 12px',
                                        backgroundColor: currentBlockType === bt.value ? 'rgba(255, 255, 255, 0.1)' : 'transparent',
                                    }}
                                >
                                    <span>{bt.label}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
