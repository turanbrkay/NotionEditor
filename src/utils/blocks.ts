import { v4 as uuidv4 } from 'uuid';
import type { BlockType, EditorBlock, RichTextText } from '../types/types';

/**
 * Create a new RichTextText array from plain text content
 */
export function createRichText(content: string): RichTextText[] {
    if (!content) {
        return [];
    }
    return [
        {
            type: 'text',
            text: { content },
            plain_text: content,
        },
    ];
}

/**
 * Extract plain text from a RichTextText array
 */
export function getPlainText(richText?: RichTextText[]): string {
    if (!richText || richText.length === 0) {
        return '';
    }
    return richText.map((rt) => rt.plain_text).join('');
}

/**
 * Default values for different block types
 */
const blockDefaults: Partial<Record<BlockType, Partial<EditorBlock>>> = {
    to_do: { checked: false },
    toggle_heading_1: { collapsed: false, children: [] },
    toggle_heading_2: { collapsed: false, children: [] },
    toggle_heading_3: { collapsed: false, children: [] },
    toggle_list: { collapsed: false, children: [] },
    code: { language: 'javascript' },
    callout: { icon: '💡' },
};

/**
 * Create a new block of the specified type with default values
 */
export function createBlock(type: BlockType, content: string = ''): EditorBlock {
    const defaults = blockDefaults[type] || {};

    // Divider doesn't have text content
    if (type === 'divider') {
        return {
            id: uuidv4(),
            type,
            ...defaults,
        };
    }

    return {
        id: uuidv4(),
        type,
        rich_text: createRichText(content),
        ...defaults,
    };
}

/**
 * Update the text content of a block
 */
export function updateBlockText(block: EditorBlock, content: string): EditorBlock {
    return {
        ...block,
        rich_text: createRichText(content),
    };
}

/**
 * Deep clone a block and its children with new IDs
 */
export function cloneBlockWithNewIds(block: EditorBlock): EditorBlock {
    return {
        ...block,
        id: uuidv4(),
        children: block.children?.map(cloneBlockWithNewIds),
    };
}

/**
 * Get the display name for a block type
 */
export function getBlockTypeLabel(type: BlockType): string {
    const labels: Record<BlockType, string> = {
        paragraph: 'Paragraph',
        heading_1: 'Heading 1',
        heading_2: 'Heading 2',
        heading_3: 'Heading 3',
        toggle_heading_1: 'Toggle Heading 1',
        toggle_heading_2: 'Toggle Heading 2',
        toggle_heading_3: 'Toggle Heading 3',
        toggle_list: 'Toggle List',
        bulleted_list_item: 'Bulleted List',
        numbered_list_item: 'Numbered List',
        to_do: 'To-do',
        callout: 'Callout',
        code: 'Code',
        quote: 'Quote',
        divider: 'Divider',
    };
    return labels[type];
}

/**
 * All available block types for the toolbar
 */
export const ALL_BLOCK_TYPES: BlockType[] = [
    'paragraph',
    'heading_1',
    'heading_2',
    'heading_3',
    'toggle_heading_1',
    'toggle_heading_2',
    'toggle_heading_3',
    'toggle_list',
    'bulleted_list_item',
    'numbered_list_item',
    'to_do',
    'callout',
    'code',
    'quote',
    'divider',
];
