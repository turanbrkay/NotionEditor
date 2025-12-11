import type { Page } from '../types/types';

const STORAGE_KEY = 'notion-editor-page';

/**
 * Save the page to localStorage
 */
export function savePage(page: Page): void {
    try {
        const json = JSON.stringify(page);
        localStorage.setItem(STORAGE_KEY, json);
    } catch (error) {
        console.error('Failed to save page to localStorage:', error);
    }
}

/**
 * Load the page from localStorage
 * Returns null if not found or invalid
 */
export function loadPage(): Page | null {
    try {
        const json = localStorage.getItem(STORAGE_KEY);
        if (!json) {
            return null;
        }
        const page = JSON.parse(json) as Page;
        // Basic validation
        if (!page.id || !page.title || !Array.isArray(page.blocks)) {
            console.warn('Invalid page structure in localStorage, ignoring');
            return null;
        }
        return page;
    } catch (error) {
        console.error('Failed to load page from localStorage:', error);
        return null;
    }
}

/**
 * Clear the saved page from localStorage
 */
export function clearSavedPage(): void {
    try {
        localStorage.removeItem(STORAGE_KEY);
    } catch (error) {
        console.error('Failed to clear page from localStorage:', error);
    }
}

/**
 * Create a debounced version of a function
 */
export function debounce<T extends (...args: Parameters<T>) => void>(
    fn: T,
    delay: number
): (...args: Parameters<T>) => void {
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    return (...args: Parameters<T>) => {
        if (timeoutId) {
            clearTimeout(timeoutId);
        }
        timeoutId = setTimeout(() => {
            fn(...args);
            timeoutId = null;
        }, delay);
    };
}
