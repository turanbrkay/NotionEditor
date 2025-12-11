import type { EditorBlock, RichTextText, BlockType } from '../types/types';
import { v4 as uuidv4 } from 'uuid';

type ParsedBlock = EditorBlock;

const INLINE_PATTERN = /(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*)/g;

function buildRichTextSegment(content: string, annotations: Partial<RichTextText['annotations']> = {}): RichTextText {
    return {
        type: 'text',
        text: { content },
        annotations: {
            bold: annotations.bold ?? false,
            italic: annotations.italic ?? false,
            strikethrough: annotations.strikethrough ?? false,
            underline: annotations.underline ?? false,
            code: annotations.code ?? false,
            color: annotations.color ?? 'default',
        },
        plain_text: content,
        href: null,
    };
}

export function parseInlineRichText(text: string): RichTextText[] {
    if (!text) return [];

    const segments: RichTextText[] = [];
    let lastIndex = 0;
    const matches = [...text.matchAll(INLINE_PATTERN)];

    for (const match of matches) {
        const start = match.index ?? 0;
        const end = start + match[0].length;

        // push plain text before match
        if (start > lastIndex) {
            const plain = text.slice(lastIndex, start);
            segments.push(buildRichTextSegment(plain));
        }

        const token = match[0];
        if (token.startsWith('`') && token.endsWith('`')) {
            const content = token.slice(1, -1);
            segments.push(buildRichTextSegment(content, { code: true }));
        } else if (token.startsWith('**') && token.endsWith('**')) {
            const content = token.slice(2, -2);
            segments.push(buildRichTextSegment(content, { bold: true }));
        } else if (token.startsWith('*') && token.endsWith('*')) {
            const content = token.slice(1, -1);
            segments.push(buildRichTextSegment(content, { italic: true }));
        }

        lastIndex = end;
    }

    if (lastIndex < text.length) {
        segments.push(buildRichTextSegment(text.slice(lastIndex)));
    }

    return segments;
}

function createBlockFromType(type: BlockType, content: string): ParsedBlock {
    const base: ParsedBlock = {
        id: uuidv4(),
        type,
    };

    if (type === 'divider') {
        return base;
    }

    if (type === 'code') {
        return {
            ...base,
            language: 'cpp',
            rich_text: [buildRichTextSegment(content)],
        };
    }

    return {
        ...base,
        rich_text: parseInlineRichText(content),
    };
}

function trimQuotes(line: string): string {
    return line.replace(/^>\s?/, '');
}

function isDividerLine(line: string): boolean {
    return /^-{3,}$/.test(line.trim());
}

/**
 * Parse plain-text / Markdown-ish content into EditorBlock list.
 * Supports headings (#, ##, ###), numbered lists, paragraphs, quotes, code fences, divider, inline bold/italic/code.
 */
export function parsePastedText(text: string): ParsedBlock[] {
    const lines = text.replace(/\r\n/g, '\n').split('\n');
    const blocks: ParsedBlock[] = [];
    let i = 0;

    while (i < lines.length) {
        const raw = lines[i];
        const line = raw.trim();

        // Skip leading blank lines
        if (line === '') {
            i++;
            continue;
        }

        // Divider
        if (isDividerLine(line)) {
            blocks.push(createBlockFromType('divider', ''));
            i++;
            continue;
        }

        // Headings
        if (/^###\s+/.test(line)) {
            const content = line.replace(/^###\s+/, '');
            blocks.push(createBlockFromType('heading_3', content));
            i++;
            continue;
        }
        if (/^##\s+/.test(line)) {
            const content = line.replace(/^##\s+/, '');
            blocks.push(createBlockFromType('heading_2', content));
            i++;
            continue;
        }
        if (/^#\s+/.test(line)) {
            const content = line.replace(/^#\s+/, '');
            blocks.push(createBlockFromType('heading_1', content));
            i++;
            continue;
        }

        // Code fence
        if (/^```/.test(line)) {
            const lang = line.replace(/^```/, '').trim() || 'plain text';
            const codeLines: string[] = [];
            i++;
            while (i < lines.length && !/^```/.test(lines[i])) {
                codeLines.push(lines[i]);
                i++;
            }
            // Skip closing fence
            if (i < lines.length && /^```/.test(lines[i])) {
                i++;
            }
            const codeContent = codeLines.join('\n');
            const block: ParsedBlock = {
                id: uuidv4(),
                type: 'code',
                language: lang.toLowerCase() === 'cpp' || lang.toLowerCase() === 'c++' ? 'cpp' : lang,
                rich_text: [buildRichTextSegment(codeContent)],
            };
            blocks.push(block);
            continue;
        }

        // Quote block (consecutive lines starting with '>')
        if (/^>/.test(line)) {
            const quoteLines: string[] = [];
            while (i < lines.length && /^>/.test(lines[i].trim())) {
                quoteLines.push(trimQuotes(lines[i]));
                i++;
            }
            const content = quoteLines.join('\n');
            blocks.push(createBlockFromType('quote', content));
            continue;
        }

        // Numbered list sequence
        if (/^\d+\.\s+/.test(line)) {
            while (i < lines.length && /^\d+\.\s+/.test(lines[i].trim())) {
                const content = lines[i].trim().replace(/^\d+\.\s+/, '');
                blocks.push(createBlockFromType('numbered_list_item', content));
                i++;
            }
            continue;
        }

        // Default: paragraph(s) separated by blank lines
        const paragraphLines: string[] = [];
        while (i < lines.length && lines[i].trim() !== '' && !isDividerLine(lines[i].trim())) {
            paragraphLines.push(lines[i]);
            i++;
        }
        const paragraphText = paragraphLines.join('\n');
        blocks.push(createBlockFromType('paragraph', paragraphText));
    }

    return blocks;
}

/**
 * Apply parsed blocks into the editor:
 * - Replace current block with first parsed block
 * - Insert remaining blocks after current, preserving order
 */
export function handlePasteIntoBlocks(
    currentBlockId: string,
    parsed: ParsedBlock[],
    opts: {
        updateBlock: (id: string, updates: Partial<EditorBlock>) => void;
        addBlock: (type: BlockType, afterId?: string) => string;
        setFocusBlock: (id: string) => void;
    }
): void {
    if (parsed.length === 0) return;
    const [first, ...rest] = parsed;

    const baseUpdate: Partial<EditorBlock> = {
        type: first.type,
        rich_text: first.rich_text,
        checked: first.checked,
        collapsed: first.collapsed,
        language: first.language,
        icon: first.icon,
        children: first.children,
    };
    opts.updateBlock(currentBlockId, baseUpdate);

    let lastId = currentBlockId;
    rest.forEach((blk) => {
        const newId = opts.addBlock(blk.type, lastId);
        opts.updateBlock(newId, {
            type: blk.type,
            rich_text: blk.rich_text,
            checked: blk.checked,
            collapsed: blk.collapsed,
            language: blk.language,
            icon: blk.icon,
            children: blk.children,
        });
        lastId = newId;
    });

    opts.setFocusBlock(lastId);
}
