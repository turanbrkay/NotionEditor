

interface FormattingBarProps {
    onFormat: (format: string) => void;
    activeFormats: string[];
}

export function FormattingBar({ onFormat, activeFormats }: FormattingBarProps) {
    const isActive = (format: string) => activeFormats.includes(format);

    return (
        <div className="formatting-bar">
            <button
                className={`formatting-bar-btn ${isActive('bold') ? 'formatting-bar-btn--active' : ''}`}
                onClick={() => onFormat('bold')}
                title="Bold"
            >
                B
            </button>
            <button
                className={`formatting-bar-btn ${isActive('italic') ? 'formatting-bar-btn--active' : ''}`}
                onClick={() => onFormat('italic')}
                title="Italic"
                style={{ fontStyle: 'italic' }}
            >
                I
            </button>
            <button
                className={`formatting-bar-btn ${isActive('underline') ? 'formatting-bar-btn--active' : ''}`}
                onClick={() => onFormat('underline')}
                title="Underline"
                style={{ textDecoration: 'underline' }}
            >
                U
            </button>
            <button
                className={`formatting-bar-btn ${isActive('strikethrough') ? 'formatting-bar-btn--active' : ''}`}
                onClick={() => onFormat('strikethrough')}
                title="Strikethrough"
                style={{ textDecoration: 'line-through' }}
            >
                S
            </button>
            <div className="formatting-bar-divider" />
            <button
                className={`formatting-bar-btn ${isActive('code') ? 'formatting-bar-btn--active' : ''}`}
                onClick={() => onFormat('code')}
                title="Inline code"
                style={{ fontFamily: 'monospace' }}
            >
                {'</>'}
            </button>
        </div>
    );
}
