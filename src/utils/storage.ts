import type { Page } from '../types/types';

const STORAGE_KEY = 'notion-editor-workspace';

export interface WorkspaceState {
    pages: Page[];
    currentPageId: string;
}

/**
 * Save the workspace (pages + current page id) to localStorage
 */
export function saveWorkspace(workspace: WorkspaceState): void {
    try {
        const json = JSON.stringify(workspace);
        localStorage.setItem(STORAGE_KEY, json);
    } catch (error) {
        console.error('Failed to save workspace to localStorage:', error);
    }
}

/**
 * Load the workspace from localStorage.
 * Backward compatible with the legacy single-page save.
 */
export function loadWorkspace(): WorkspaceState | null {
    try {
        const json = localStorage.getItem(STORAGE_KEY);
        if (!json) {
            // Attempt legacy single-page load
            const legacy = localStorage.getItem('notion-editor-page');
            if (!legacy) return null;
            const page = JSON.parse(legacy) as Page;
            if (!page?.id || !page.title || !Array.isArray(page.blocks)) {
                console.warn('Invalid legacy page structure in localStorage, ignoring');
                return null;
            }
            return { pages: [page], currentPageId: page.id };
        }
        const ws = JSON.parse(json) as WorkspaceState;
        if (!ws?.pages || !Array.isArray(ws.pages) || !ws.currentPageId) {
            console.warn('Invalid workspace structure in localStorage, ignoring');
            return null;
        }
        return ws;
    } catch (error) {
        console.error('Failed to load workspace from localStorage:', error);
        return null;
    }
}

/**
 * Clear the saved workspace from localStorage
 */
export function clearSavedWorkspace(): void {
    try {
        localStorage.removeItem(STORAGE_KEY);
    } catch (error) {
        console.error('Failed to clear workspace from localStorage:', error);
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
