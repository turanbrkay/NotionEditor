import { useEffect, useRef } from 'react';
import { usePage } from '../context/PageContext';

/**
 * Hook to auto-focus a contentEditable element when the block is newly created
 * or when navigating with arrow keys.
 * Returns a ref to attach to the contentEditable element.
 */
export function useBlockFocus(blockId: string) {
    const { focusBlockId, focusPosition, clearFocusBlock } = usePage();
    const contentRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (focusBlockId === blockId && contentRef.current) {
            contentRef.current.focus();

            const range = document.createRange();
            const sel = window.getSelection();

            if (contentRef.current.childNodes.length > 0) {
                if (focusPosition === 'start') {
                    // Place cursor at the start
                    range.setStart(contentRef.current, 0);
                    range.collapse(true);
                } else {
                    // Place cursor at the end (default)
                    range.selectNodeContents(contentRef.current);
                    range.collapse(false);
                }
            } else {
                range.selectNodeContents(contentRef.current);
                range.collapse(false);
            }

            sel?.removeAllRanges();
            sel?.addRange(range);
            clearFocusBlock();
        }
    }, [focusBlockId, focusPosition, blockId, clearFocusBlock]);

    return contentRef;
}

/**
 * Check if cursor is at the first line of a contentEditable element
 */
export function isAtFirstLine(element: HTMLElement): boolean {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return false;

    const range = selection.getRangeAt(0);
    const preCaretRange = range.cloneRange();
    preCaretRange.selectNodeContents(element);
    preCaretRange.setEnd(range.startContainer, range.startOffset);

    const textBefore = preCaretRange.toString();
    return !textBefore.includes('\n');
}

/**
 * Check if cursor is at the last line of a contentEditable element
 */
export function isAtLastLine(element: HTMLElement): boolean {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return false;

    const range = selection.getRangeAt(0);
    const postCaretRange = range.cloneRange();
    postCaretRange.selectNodeContents(element);
    postCaretRange.setStart(range.endContainer, range.endOffset);

    const textAfter = postCaretRange.toString();
    return !textAfter.includes('\n');
}
