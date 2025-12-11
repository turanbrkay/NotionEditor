import { useState, useEffect, useCallback, useRef } from 'react';

interface FloatingToolbarProps {
    onFormat: (format: string) => void;
    onColorChange?: (range?: Range | null) => void;
}

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

export function FloatingToolbar({ onFormat, onColorChange }: FloatingToolbarProps) {
    const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
    const [hasSelection, setHasSelection] = useState(false);
    const [showTextColorMenu, setShowTextColorMenu] = useState(false);
    const [showBgColorMenu, setShowBgColorMenu] = useState(false);
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
            left: rect.left + rect.width / 2 - 90,
        });
        setHasSelection(true);
        setShowTextColorMenu(false);
        setShowBgColorMenu(false);
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
        console.log('[FloatingToolbar] applyColorToSelection called with color:', color);
        const sel = window.getSelection();
        let range: Range | null = null;

        // Get or restore selection
        if (sel && sel.rangeCount > 0 && !sel.isCollapsed) {
            range = sel.getRangeAt(0).cloneRange();
            console.log('[FloatingToolbar] Got range from active selection');
        } else if (selectionRef.current && sel) {
            range = selectionRef.current.cloneRange();
            sel.removeAllRanges();
            sel.addRange(range);
            console.log('[FloatingToolbar] Restored range from selectionRef');
        }

        if (!range) {
            console.log('[FloatingToolbar] No range available, returning null');
            return null;
        }

        // Find the contenteditable container
        const container = range.commonAncestorContainer;
        const editableParent = (container instanceof HTMLElement ? container : container.parentElement)
            ?.closest('[contenteditable="true"]') as HTMLElement | null;
        if (!editableParent) {
            console.log('[FloatingToolbar] No contenteditable parent found');
            return null;
        }
        console.log('[FloatingToolbar] Found contenteditable parent:', editableParent);

        // Save the original selection boundaries before any DOM manipulation
        const startContainer = range.startContainer;
        const startOffset = range.startOffset;
        const endContainer = range.endContainer;
        const endOffset = range.endOffset;

        console.log('[FloatingToolbar] Selection boundaries:', {
            startContainer,
            startOffset,
            endContainer,
            endOffset,
            selectedText: range.toString()
        });

        // Step 1: Remove existing color spans that intersect the selection
        const colorSpans = Array.from(editableParent.querySelectorAll('.rt-color'));
        console.log('[FloatingToolbar] Found', colorSpans.length, 'existing color spans');
        for (const span of colorSpans) {
            if (range.intersectsNode(span)) {
                console.log('[FloatingToolbar] Unwrapping color span:', span);
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
            console.log('[FloatingToolbar] Recreated range after unwrapping');
        } catch (e) {
            console.log('[FloatingToolbar] Failed to recreate range:', e);
            // Try to use selectionRef as fallback
            if (selectionRef.current) {
                range = selectionRef.current.cloneRange();
                console.log('[FloatingToolbar] Using selectionRef as fallback');
            } else {
                return null;
            }
        }

        // If color is "default", we're done - just unwrapping was the goal
        if (color === 'default') {
            console.log('[FloatingToolbar] Color is default, done unwrapping');
            const finalSel = window.getSelection();
            if (finalSel) {
                finalSel.removeAllRanges();
                finalSel.addRange(range);
            }
            selectionRef.current = range.cloneRange();
            return range;
        }
        console.log('[FloatingToolbar] Re-got range after normalization');

        // Step 3: Wrap selection in new color span
        const span = document.createElement('span');
        span.className = 'rt-color';
        span.classList.add(`rt-color-${color}`);
        span.setAttribute('data-color', color);

        // Set inline style for immediate visual feedback
        if (color.endsWith('_background')) {
            span.style.backgroundColor = COLOR_VALUES[color];
            console.log('[FloatingToolbar] Applied background color:', COLOR_VALUES[color]);
        } else {
            span.style.color = COLOR_VALUES[color];
            console.log('[FloatingToolbar] Applied text color:', COLOR_VALUES[color]);
        }

        try {
            range.surroundContents(span);
            console.log('[FloatingToolbar] Successfully wrapped with surroundContents');
        } catch (e) {
            console.log('[FloatingToolbar] surroundContents failed, using fallback:', e);
            // If surroundContents fails (partial selection across elements)
            const contents = range.extractContents();
            span.appendChild(contents);
            range.insertNode(span);
            range.selectNodeContents(span);
            console.log('[FloatingToolbar] Applied color with fallback method');
        }

        console.log('[FloatingToolbar] Created color span:', span);

        // Update selection to the new span contents
        const finalSel = window.getSelection();
        if (finalSel) {
            finalSel.removeAllRanges();
            finalSel.addRange(range);
        }
        selectionRef.current = range.cloneRange();

        console.log('[FloatingToolbar] Color application complete, returning range');
        return range;
    };

    const handleColorSelect = (color: string) => {
        console.log('[FloatingToolbar] handleColorSelect called with:', color);
        const usedRange = applyColorToSelection(color);
        console.log('[FloatingToolbar] applyColorToSelection returned:', usedRange);
        setShowTextColorMenu(false);
        setShowBgColorMenu(false);
        console.log('[FloatingToolbar] Calling onColorChange with range:', usedRange ?? selectionRef.current);
        onColorChange?.(usedRange ?? selectionRef.current);
        console.log('[FloatingToolbar] handleColorSelect complete');
    };

    const handleClick = (format: string) => (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        onFormat(format);
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
                    console.log('[FloatingToolbar] Text color button clicked');
                    e.preventDefault();
                    e.stopPropagation();
                    setShowTextColorMenu((v) => {
                        console.log('[FloatingToolbar] Toggle text color menu, was:', v, 'will be:', !v);
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
                                        console.log('[FloatingToolbar] Color swatch mousedown:', c);
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
                                        console.log('[FloatingToolbar] BG color swatch mousedown:', c);
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
        </div>
    );
}
