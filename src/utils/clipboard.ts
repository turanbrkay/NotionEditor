import type { EditorBlock, NotionBlockInput } from '../types/types';
import { editorBlockToNotionBlock } from './export';
import { getPlainText } from './blocks';

export const INTERNAL_CLIPBOARD_MIME = 'application/x-notion-blocks';

interface ClipboardPayload {
    blocks: EditorBlock[];
    notion: NotionBlockInput[];
}

function deepCloneBlock(block: EditorBlock): EditorBlock {
    return {
        ...block,
        rich_text: block.rich_text ? JSON.parse(JSON.stringify(block.rich_text)) : undefined,
        children: block.children?.map(deepCloneBlock),
    };
}

function blockToPlainText(block: EditorBlock, depth = 0): string {
    const indent = depth > 0 ? '  '.repeat(depth) : '';
    const text = getPlainText(block.rich_text);
    const normalized = text.replace(/\n/g, `\n${indent}`);

    let line = normalized;
    switch (block.type) {
        case 'heading_1':
            line = `${indent}# ${normalized}`;
            break;
        case 'heading_2':
            line = `${indent}## ${normalized}`;
            break;
        case 'heading_3':
            line = `${indent}### ${normalized}`;
            break;
        case 'bulleted_list_item':
            line = `${indent}- ${normalized}`;
            break;
        case 'numbered_list_item':
            line = `${indent}1. ${normalized}`;
            break;
        case 'to_do':
            line = `${indent}[${block.checked ? 'x' : ' '}] ${normalized}`;
            break;
        case 'quote':
            line = `${indent}> ${normalized.replace(/\n/g, `\n${indent}> `)}`;
            break;
        case 'code':
            line = `${indent}\`\`\`${block.language || ''}\n${normalized}\n${indent}\`\`\``;
            break;
        case 'divider':
            line = `${indent}---`;
            break;
        case 'callout':
            line = `${indent}${block.icon ? `${block.icon} ` : ''}${normalized}`;
            break;
        case 'toggle_heading_1':
        case 'toggle_heading_2':
        case 'toggle_heading_3':
        case 'toggle_list':
            line = `${indent}> ${normalized}`;
            break;
        default:
            line = `${indent}${normalized}`;
    }

    const childLines = block.children?.map((child) => blockToPlainText(child, depth + 1)).filter(Boolean);
    return [line, ...(childLines || [])].join('\n');
}

export function blocksToPlainText(blocks: EditorBlock[]): string {
    return blocks.map((b) => blockToPlainText(b)).filter(Boolean).join('\n');
}

export function buildClipboardPayload(blocks: EditorBlock[]): ClipboardPayload {
    const safeBlocks = blocks.map(deepCloneBlock);
    return {
        blocks: safeBlocks,
        notion: safeBlocks.map(editorBlockToNotionBlock),
    };
}

export function serializeClipboardPayload(payload: ClipboardPayload): string {
    return JSON.stringify(payload);
}

export function parseClipboardPayload(raw: string | null): ClipboardPayload | null {
    if (!raw) return null;
    try {
        const parsed = JSON.parse(raw) as ClipboardPayload;
        if (!parsed || !Array.isArray(parsed.blocks) || !Array.isArray(parsed.notion)) {
            return null;
        }
        return parsed;
    } catch {
        return null;
    }
}

/**
 * Collect selected blocks in document order, skipping descendants when an ancestor is selected.
 */
export function collectSelectedBlocks(blocks: EditorBlock[], ids: Set<string>): EditorBlock[] {
    const result: EditorBlock[] = [];

    const walk = (nodes: EditorBlock[], ancestorSelected: boolean) => {
        for (const node of nodes) {
            const isSelected = ids.has(node.id);
            if (isSelected && !ancestorSelected) {
                result.push(node);
                if (node.children?.length) {
                    walk(node.children, true);
                }
            } else if (node.children?.length) {
                walk(node.children, ancestorSelected || isSelected);
            }
        }
    };

    walk(blocks, false);
    return result;
}
