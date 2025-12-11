import type {
    EditorBlock,
    NotionBlockInput,
    NotionPageExport,
    Page,
    RichTextText,
} from '../types/types';

/**
 * Convert an EditorBlock to Notion API format
 * Toggle variants all export as 'toggle' type since Notion doesn't have toggle_heading
 */
export function editorBlockToNotionBlock(block: EditorBlock): NotionBlockInput {
    const richText: RichTextText[] = block.rich_text || [];
    const children = block.children?.map(editorBlockToNotionBlock);

    switch (block.type) {
        case 'paragraph':
            return {
                type: 'paragraph',
                paragraph: { rich_text: richText },
                ...(children?.length ? { children } : {}),
            };

        case 'heading_1':
            return {
                type: 'heading_1',
                heading_1: { rich_text: richText },
            };

        case 'heading_2':
            return {
                type: 'heading_2',
                heading_2: { rich_text: richText },
            };

        case 'heading_3':
            return {
                type: 'heading_3',
                heading_3: { rich_text: richText },
            };

        // All toggle variants export as Notion's 'toggle' type
        case 'toggle_heading_1':
        case 'toggle_heading_2':
        case 'toggle_heading_3':
        case 'toggle_list':
            return {
                type: 'toggle',
                toggle: { rich_text: richText },
                ...(children?.length ? { children } : {}),
            };

        case 'bulleted_list_item':
            return {
                type: 'bulleted_list_item',
                bulleted_list_item: { rich_text: richText },
                ...(children?.length ? { children } : {}),
            };

        case 'numbered_list_item':
            return {
                type: 'numbered_list_item',
                numbered_list_item: { rich_text: richText },
                ...(children?.length ? { children } : {}),
            };

        case 'to_do':
            return {
                type: 'to_do',
                to_do: {
                    rich_text: richText,
                    checked: block.checked ?? false,
                },
                ...(children?.length ? { children } : {}),
            };

        case 'callout':
            return {
                type: 'callout',
                callout: {
                    rich_text: richText,
                    ...(block.icon ? { icon: { type: 'emoji', emoji: block.icon } } : {}),
                },
                ...(children?.length ? { children } : {}),
            };

        case 'code':
            return {
                type: 'code',
                code: {
                    rich_text: richText,
                    language: block.language || 'plain text',
                },
            };

        case 'quote':
            return {
                type: 'quote',
                quote: { rich_text: richText },
                ...(children?.length ? { children } : {}),
            };

        case 'divider':
            return {
                type: 'divider',
                divider: {},
            };

        default: {
            // Exhaustive check - TypeScript will error if we miss a case
            const _exhaustive: never = block.type;
            throw new Error(`Unknown block type: ${_exhaustive}`);
        }
    }
}

/**
 * Export the entire page to Notion API format
 */
export function exportPage(page: Page): NotionPageExport {
    return {
        title: page.title,
        blocks: page.blocks.map(editorBlockToNotionBlock),
    };
}

/**
 * Download the page as a JSON file
 */
export function downloadJSON(page: Page): void {
    const exported = exportPage(page);
    const json = JSON.stringify(exported, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.download = `${page.title || 'untitled'}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}
