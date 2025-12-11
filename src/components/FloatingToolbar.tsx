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
        const sel = window.getSelection();
        let range: Range | null = null;

        if (sel && sel.rangeCount > 0 && !sel.isCollapsed) {
            range = sel.getRangeAt(0).cloneRange();
        } else if (selectionRef.current && sel) {
            range = selectionRef.current.cloneRange();
            sel.removeAllRanges();
            sel.addRange(range);
        } else {
            return null;
        }

        if (!range) return null;

        const span = document.createElement('span');
        span.className = 'rt-color';
        if (color !== 'default') {
            span.classList.add(`rt-color-${color}`);
            // Inline styles ensure immediate visual feedback
            if (color.endsWith('_background')) {
                span.style.backgroundColor = COLOR_VALUES[color];
            } else {
                span.style.color = COLOR_VALUES[color];
            }
        } else {
            span.style.color = '';
            span.style.backgroundColor = '';
        }
        span.setAttribute('data-color', color);

        try {
            range.surroundContents(span);
        } catch {
            const contents = range.extractContents();
            span.appendChild(contents);
            range.insertNode(span);
            range.selectNodeContents(span);
        }

        // Keep selection and cached range in sync after DOM changes
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
                    e.preventDefault();
                    e.stopPropagation();
                    setShowTextColorMenu((v) => !v);
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
                                    onMouseDown={(e) => e.preventDefault()}
                                    onClick={() => handleColorSelect(c)}
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
                                    onMouseDown={(e) => e.preventDefault()}
                                    onClick={() => handleColorSelect(c)}
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
