import { useState, useEffect, useCallback } from 'react';

interface FloatingToolbarProps {
    onFormat: (format: string) => void;
}

export function FloatingToolbar({ onFormat }: FloatingToolbarProps) {
    const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
    const [hasSelection, setHasSelection] = useState(false);

    const updatePosition = useCallback(() => {
        const selection = window.getSelection();
        if (!selection || selection.isCollapsed || selection.rangeCount === 0) {
            setHasSelection(false);
            return;
        }

        const text = selection.toString().trim();
        if (!text) {
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
        </div>
    );
}
