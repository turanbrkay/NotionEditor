import { v4 as uuidv4 } from 'uuid';
import type { BlockType, EditorBlock, RichTextText } from '../types/types';

type AnnotationState = {
    bold: boolean;
    italic: boolean;
    strikethrough: boolean;
    underline: boolean;
    code: boolean;
    color: string;
};

const DEFAULT_ANNOTATIONS: AnnotationState = {
    bold: false,
    italic: false,
    strikethrough: false,
    underline: false,
    code: false,
    color: 'default',
};

const BLOCK_BREAK_TAGS = new Set(['DIV', 'P']);

const COLOR_VALUES: Record<string, string> = {
    default: 'inherit',
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

function mapCssColorToAnnotation(cssColor: string, fallback: string, isBackground = false): string {
    const entries = Object.entries(COLOR_VALUES);
    const target = cssColor.trim().toLowerCase();
    for (const [name, value] of entries) {
        if ((isBackground && name.endsWith('_background')) || (!isBackground && !name.endsWith('_background'))) {
            if (value.toLowerCase() === target) {
                return name;
            }
        }
    }
    return fallback;
}

function normalizeInlineColor(el: HTMLElement, base: AnnotationState): AnnotationState {
    const next = { ...base };
    const dataColor = el.getAttribute('data-color');
    if (dataColor) {
        next.color = dataColor;
    } else if (el.style?.backgroundColor) {
        next.color = mapCssColorToAnnotation(el.style.backgroundColor, next.color, true);
    } else if (el.style?.color) {
        next.color = mapCssColorToAnnotation(el.style.color, next.color, false);
    }
    return next;
}

function normalizeAnnotations(annotations?: RichTextText['annotations']): AnnotationState {
    return {
        bold: annotations?.bold ?? false,
        italic: annotations?.italic ?? false,
        strikethrough: annotations?.strikethrough ?? false,
        underline: annotations?.underline ?? false,
        code: annotations?.code ?? false,
        color: annotations?.color ?? 'default',
    };
}

/**
 * Normalize rich text objects to ensure annotations/plain_text are always present
 */
export function normalizeRichText(richText?: RichTextText[]): RichTextText[] {
    if (!richText) {
        return [];
    }

    return richText.map((item) => {
        const content = item.text?.content ?? item.plain_text ?? '';
        return {
            type: 'text',
            text: {
                content,
                ...(item.text?.link ? { link: item.text.link } : {}),
            },
            annotations: normalizeAnnotations(item.annotations),
            plain_text: item.plain_text ?? content,
            href: item.href ?? null,
        };
    });
}

function annotationsEqual(a?: RichTextText['annotations'], b?: RichTextText['annotations']): boolean {
    const na = normalizeAnnotations(a);
    const nb = normalizeAnnotations(b);
    return (
        na.bold === nb.bold &&
        na.italic === nb.italic &&
        na.strikethrough === nb.strikethrough &&
        na.underline === nb.underline &&
        na.code === nb.code &&
        na.color === nb.color
    );
}

function escapeHtml(text: string): string {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

function wrapWithAnnotations(content: string, annotations: AnnotationState): string {
    let html = content.replace(/\n/g, '<br>');

    if (annotations.code) {
        html = `<span class="inline-code">${html}</span>`;
    }
    if (annotations.color && annotations.color !== 'default') {
        const colorValue = COLOR_VALUES[annotations.color];
        const style = annotations.color.endsWith('_background')
            ? `style="background-color:${colorValue}"`
            : `style="color:${colorValue}"`;
        html = `<span class="rt-color rt-color-${annotations.color}" data-color="${annotations.color}" ${style}>${html}</span>`;
    }
    if (annotations.bold) {
        html = `<strong>${html}</strong>`;
    }
    if (annotations.italic) {
        html = `<em>${html}</em>`;
    }
    if (annotations.underline) {
        html = `<u>${html}</u>`;
    }
    if (annotations.strikethrough) {
        html = `<s>${html}</s>`;
    }

    return html;
}

/**
 * Convert rich text data into HTML markup for contentEditable fields
 */
export function richTextToHTML(richText?: RichTextText[]): string {
    const normalized = normalizeRichText(richText);
    if (normalized.length === 0) {
        return '';
    }

    return normalized
        .map((item) => wrapWithAnnotations(escapeHtml(item.text.content), normalizeAnnotations(item.annotations)))
        .join('');
}

/**
 * Serialize a contentEditable element (including inline formatting) to rich text
 */
export function serializeRichTextFromElement(element: HTMLElement): RichTextText[] {
    const segments: RichTextText[] = [];

    const pushText = (text: string, annotations: AnnotationState) => {
        if (!text) return;
        const normalizedText = text.replace(/\u00A0/g, ' ');
        if (normalizedText === '') return;

        const last = segments[segments.length - 1];
        if (last && annotationsEqual(last.annotations, annotations)) {
            last.text.content += normalizedText;
            last.plain_text += normalizedText;
            return;
        }

        segments.push({
            type: 'text',
            text: { content: normalizedText },
            plain_text: normalizedText,
            annotations: { ...annotations },
        });
    };

    const applyElementAnnotations = (el: HTMLElement, base: AnnotationState): AnnotationState => {
        const next = { ...base };
        const tag = el.tagName.toLowerCase();

        if (tag === 'b' || tag === 'strong') next.bold = true;
        if (tag === 'i' || tag === 'em') next.italic = true;
        if (tag === 'u') next.underline = true;
        if (tag === 's' || tag === 'strike' || tag === 'del') next.strikethrough = true;
        if (tag === 'code') next.code = true;
        if (el.classList.contains('inline-code')) next.code = true;
        // normalize color/background
        Object.assign(next, normalizeInlineColor(el, next));

        const weight = el.style.fontWeight;
        if (weight && (weight.toLowerCase() === 'bold' || parseInt(weight, 10) >= 600)) {
            next.bold = true;
        }
        if (el.style.fontStyle === 'italic') next.italic = true;

        const decoration = el.style.textDecoration || '';
        if (decoration.includes('underline')) next.underline = true;
        if (decoration.includes('line-through')) next.strikethrough = true;

        // Default inline code color to red for Notion export when no color set
        if (next.code && (!next.color || next.color === 'default')) {
            next.color = 'red';
        }

        return next;
    };

    const walk = (node: Node, annotations: AnnotationState) => {
        if (node.nodeType === Node.TEXT_NODE) {
            pushText(node.textContent || '', annotations);
            return;
        }

        if (!(node instanceof HTMLElement)) {
            return;
        }

        if (node.tagName === 'BR') {
            pushText('\n', annotations);
            return;
        }

        const nextAnnotations = applyElementAnnotations(node, annotations);

        if (BLOCK_BREAK_TAGS.has(node.tagName) && segments.length > 0) {
            pushText('\n', annotations);
        }

        node.childNodes.forEach((child) => walk(child, nextAnnotations));
    };

    walk(element, { ...DEFAULT_ANNOTATIONS });
    return segments;
}

/**
 * Sync a contentEditable element to the given rich text, without clobbering unchanged content
 */
export function setElementRichText(element: HTMLElement, richText?: RichTextText[]): void {
    const html = richTextToHTML(richText);
    if (element.innerHTML !== html) {
        element.innerHTML = html;
    }
}

export function richTextEquals(a?: RichTextText[], b?: RichTextText[]): boolean {
    return JSON.stringify(normalizeRichText(a)) === JSON.stringify(normalizeRichText(b));
}

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
            annotations: { ...DEFAULT_ANNOTATIONS },
            plain_text: content,
            href: null,
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
    return normalizeRichText(richText).map((rt) => rt.plain_text).join('');
}

export const DEFAULT_IMAGE_WIDTH = 70;

/**
 * Default values for different block types
 */
const blockDefaults: Partial<Record<BlockType, Partial<EditorBlock>>> = {
    to_do: { checked: false },
    toggle_heading_1: { collapsed: false, children: [] },
    toggle_heading_2: { collapsed: false, children: [] },
    toggle_heading_3: { collapsed: false, children: [] },
    toggle_list: { collapsed: false, children: [] },
    code: { language: 'cpp' },
    callout: { icon: 'DY' },
    image: { imageUrl: '', imageWidthPercent: DEFAULT_IMAGE_WIDTH },
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
        image: 'Image',
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
    'image',
    'divider',
];
