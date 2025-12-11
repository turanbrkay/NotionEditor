/**
 * Block Types - All supported block kinds in the editor
 */
export type BlockType =
    | 'paragraph'
    | 'heading_1'
    | 'heading_2'
    | 'heading_3'
    | 'toggle_heading_1'
    | 'toggle_heading_2'
    | 'toggle_heading_3'
    | 'toggle_list'
    | 'bulleted_list_item'
    | 'numbered_list_item'
    | 'to_do'
    | 'callout'
    | 'code'
    | 'quote'
    | 'divider';

/**
 * Rich Text - Notion-compatible text representation
 * Simplified for v1: only supports plain text with optional annotations
 */
export interface RichTextText {
    type: 'text';
    text: {
        content: string;
        link?: { url: string } | null;
    };
    annotations?: {
        bold?: boolean;
        italic?: boolean;
        strikethrough?: boolean;
        underline?: boolean;
        code?: boolean;
        color?: string;
    };
    plain_text: string;
    href?: string | null;
}

/**
 * Editor Block - Internal representation of a block in the editor
 */
export interface EditorBlock {
    id: string;
    type: BlockType;
    rich_text?: RichTextText[];
    checked?: boolean;         // Used by 'to_do'
    collapsed?: boolean;       // Used by toggle blocks
    language?: string;         // Used by 'code'
    icon?: string;             // Used by 'callout'
    children?: EditorBlock[];  // Nested blocks
}

/**
 * Page - Internal representation of the entire page
 */
export interface Page {
    id: string;
    title: string;
    blocks: EditorBlock[];
}

// ============================================
// Notion Export Types
// ============================================

/**
 * Notion Block Input - Format compatible with Notion API
 * Each block has a 'type' and a property with the same name containing data
 */
export type NotionBlockInput =
    | {
        type: 'paragraph';
        paragraph: {
            rich_text: RichTextText[];
        };
        children?: NotionBlockInput[];
    }
    | {
        type: 'heading_1';
        heading_1: {
            rich_text: RichTextText[];
        };
    }
    | {
        type: 'heading_2';
        heading_2: {
            rich_text: RichTextText[];
        };
    }
    | {
        type: 'heading_3';
        heading_3: {
            rich_text: RichTextText[];
        };
    }
    | {
        type: 'to_do';
        to_do: {
            rich_text: RichTextText[];
            checked: boolean;
        };
        children?: NotionBlockInput[];
    }
    | {
        type: 'bulleted_list_item';
        bulleted_list_item: {
            rich_text: RichTextText[];
        };
        children?: NotionBlockInput[];
    }
    | {
        type: 'numbered_list_item';
        numbered_list_item: {
            rich_text: RichTextText[];
        };
        children?: NotionBlockInput[];
    }
    | {
        type: 'callout';
        callout: {
            rich_text: RichTextText[];
            icon?: { type: 'emoji'; emoji: string };
        };
        children?: NotionBlockInput[];
    }
    | {
        type: 'code';
        code: {
            rich_text: RichTextText[];
            language: string;
        };
    }
    | {
        type: 'quote';
        quote: {
            rich_text: RichTextText[];
        };
        children?: NotionBlockInput[];
    }
    | {
        type: 'divider';
        divider: Record<string, never>;
    }
    | {
        type: 'toggle';
        toggle: {
            rich_text: RichTextText[];
        };
        children?: NotionBlockInput[];
    };

/**
 * Notion Page Export - Complete page structure for Notion API
 */
export interface NotionPageExport {
    title: string;
    blocks: NotionBlockInput[];
}

// ============================================
// Helper Types
// ============================================

/**
 * Block types that support children
 */
export type BlockWithChildren = Extract<
    BlockType,
    | 'toggle_heading_1'
    | 'toggle_heading_2'
    | 'toggle_heading_3'
    | 'toggle_list'
    | 'bulleted_list_item'
    | 'numbered_list_item'
    | 'paragraph'
    | 'callout'
    | 'quote'
    | 'to_do'
>;

/**
 * Toggle block types
 */
export type ToggleBlockType =
    | 'toggle_heading_1'
    | 'toggle_heading_2'
    | 'toggle_heading_3'
    | 'toggle_list';

/**
 * Heading block types
 */
export type HeadingBlockType = 'heading_1' | 'heading_2' | 'heading_3';

/**
 * Toggle heading block types
 */
export type ToggleHeadingBlockType =
    | 'toggle_heading_1'
    | 'toggle_heading_2'
    | 'toggle_heading_3';

/**
 * Check if a block type is a toggle type
 */
export function isToggleType(type: BlockType): type is ToggleBlockType {
    return (
        type === 'toggle_heading_1' ||
        type === 'toggle_heading_2' ||
        type === 'toggle_heading_3' ||
        type === 'toggle_list'
    );
}

/**
 * Check if a block type is a heading type
 */
export function isHeadingType(type: BlockType): type is HeadingBlockType {
    return type === 'heading_1' || type === 'heading_2' || type === 'heading_3';
}

/**
 * Check if a block type is a toggle heading type
 */
export function isToggleHeadingType(type: BlockType): type is ToggleHeadingBlockType {
    return (
        type === 'toggle_heading_1' ||
        type === 'toggle_heading_2' ||
        type === 'toggle_heading_3'
    );
}
