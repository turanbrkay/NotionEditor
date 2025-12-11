import React, { useRef, useEffect } from 'react';
import { usePage } from '../../context/PageContext';
import type { EditorBlock } from '../../types/types';
import { getPlainText, createRichText } from '../../utils/blocks';

interface CodeBlockProps {
    block: EditorBlock;
}

// Simple C++ syntax highlighting
function highlightCpp(code: string): string {
    const applyToText = (input: string, regex: RegExp, replacer: string) =>
        input
            .split(/(<[^>]+>)/g)
            .map((part) => (part.startsWith('<') ? part : part.replace(regex, replacer)))
            .join('');

    let html = code
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');

    html = applyToText(html, /("(?:[^"\\]|\\.)*")/g, '<span class="string">$1</span>');
    html = applyToText(html, /('(?:[^'\\]|\\.)')/g, '<span class="string">$1</span>');
    html = applyToText(html, /(\/\/[^\n]*)/g, '<span class="comment">$1</span>');
    html = applyToText(html, /(\/\*[\s\S]*?\*\/)/g, '<span class="comment">$1</span>');
    html = applyToText(html, /(#\w+)/g, '<span class="preprocessor">$1</span>');

    const keywords = /\b(int|void|char|double|float|bool|long|short|unsigned|signed|const|static|extern|inline|virtual|override|public|private|protected|class|struct|enum|union|typedef|typename|template|namespace|using|new|delete|return|if|else|for|while|do|switch|case|break|continue|default|try|catch|throw|nullptr|true|false|this|sizeof|auto|decltype|constexpr|noexcept|explicit|friend|mutable|volatile|register)\b/g;
    html = applyToText(html, keywords, '<span class="keyword">$1</span>');

    const types = /\b(std|string|vector|map|set|list|deque|array|pair|tuple|unique_ptr|shared_ptr|weak_ptr|optional|variant|any|function|iostream|fstream|sstream|stringstream|ostream|istream|cout|cin|cerr|endl|size_t|ptrdiff_t|int8_t|int16_t|int32_t|int64_t|uint8_t|uint16_t|uint32_t|uint64_t)\b/g;
    html = applyToText(html, types, '<span class="type">$1</span>');

    html = applyToText(html, /\b(\d+\.?\d*[fFlL]?)\b/g, '<span class="number">$1</span>');
    html = applyToText(html, /\b([a-zA-Z_]\w*)\s*(?=\()/g, '<span class="function">$1</span>');

    return html;
}

export function CodeBlock({ block }: CodeBlockProps) {
    const { updateBlock, addBlock, deleteBlock, focusBlockId, clearFocusBlock, focusPreviousBlock, focusNextBlock } = usePage();
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const highlightRef = useRef<HTMLDivElement>(null);

    const autoResize = () => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
        }
    };

    const sanitizePlain = (input: string): string => {
        if (!input) return '';
        let out = input;
        // Remove span tags if any slipped in
        out = out.replace(/<\/?span[^>]*>/gi, '');
        // Remove attribute-like fragments
        out = out.replace(/\s*\bclass\s*=\s*class\s*=\s*"[^"]*"?/gi, '');
        out = out.replace(/\s*\bclass\s*=\s*"[^"]*"?/gi, '');
        out = out.replace(/\s*\bstyle\s*=\s*"[^"]*"?/gi, '');
        out = out.replace(/\s*\bdata-[\w-]+\s*=\s*"[^"]*"?/gi, '');
        // Decode entities
        out = out.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
        // Normalize newlines
        out = out.replace(/\r\n/g, '\n');
        return out;
    };

    useEffect(() => {
        if (textareaRef.current) {
            const blockText = sanitizePlain(getPlainText(block.rich_text));
            if (textareaRef.current.value !== blockText) {
                textareaRef.current.value = blockText;
            }
            autoResize();

            if (highlightRef.current) {
                highlightRef.current.innerHTML = highlightCpp(blockText) + '\n';
            }
        }
    }, [block.rich_text]);

    useEffect(() => {
        if (focusBlockId === block.id && textareaRef.current) {
            textareaRef.current.focus();
            clearFocusBlock();
        }
    }, [focusBlockId, block.id, clearFocusBlock]);

    const handleInput = () => {
        if (textareaRef.current) {
            const textRaw = textareaRef.current.value;
            const text = sanitizePlain(textRaw);
            if (text !== textRaw) {
                textareaRef.current.value = text;
            }
            updateBlock(block.id, { rich_text: createRichText(text) });
            autoResize();

            if (highlightRef.current) {
                highlightRef.current.innerHTML = highlightCpp(text) + '\n';
            }
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        const textarea = textareaRef.current;
        if (!textarea) return;

        const text = textarea.value;
        const cursorPos = textarea.selectionStart;
        const textBeforeCursor = text.substring(0, cursorPos);
        const textAfterCursor = text.substring(cursorPos);

        // Ctrl+Enter = EXIT code block
        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            addBlock('paragraph', block.id);
            return;
        }

        // Arrow up at first line
        if (e.key === 'ArrowUp' && !textBeforeCursor.includes('\n')) {
            e.preventDefault();
            focusPreviousBlock(block.id);
            return;
        }

        // Arrow down at last line
        if (e.key === 'ArrowDown' && !textAfterCursor.includes('\n')) {
            e.preventDefault();
            focusNextBlock(block.id);
            return;
        }

        // Backspace on empty
        if (e.key === 'Backspace' && text === '') {
            e.preventDefault();
            deleteBlock(block.id);
        }
    };

    const handlePaste = (e: React.ClipboardEvent) => {
        const textarea = textareaRef.current;
        if (!textarea) return;

        const plain = sanitizePlain(e.clipboardData.getData('text/plain'));

        if (plain) {
            e.preventDefault();
            const start = textarea.selectionStart;
            const end = textarea.selectionEnd;
            const before = textarea.value.slice(0, start);
            const after = textarea.value.slice(end);
            const next = before + plain + after;
            textarea.value = next;

            // Move caret to end of pasted content
            const caret = before.length + plain.length;
            textarea.selectionStart = textarea.selectionEnd = caret;

            updateBlock(block.id, { rich_text: createRichText(next) });
            autoResize();

            if (highlightRef.current) {
                highlightRef.current.innerHTML = highlightCpp(next) + '\n';
            }
        }
    };

    return (
        <div className="code-block">
            <div className="code-header">
                <span className="code-lang-label">C++</span>
                <span className="code-hint">Ctrl+Enter to exit</span>
            </div>
            <div className="code-editor">
                <div
                    ref={highlightRef}
                    className="code-highlight"
                    aria-hidden="true"
                />
                <textarea
                    ref={textareaRef}
                className="code-input"
                onInput={handleInput}
                onKeyDown={handleKeyDown}
                onPaste={handlePaste}
                placeholder="// Write your C++ code here..."
                spellCheck={false}
                rows={1}
            />
        </div>
        </div>
    );
}
