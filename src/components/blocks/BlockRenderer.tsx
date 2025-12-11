import type { EditorBlock } from '../../types/types';
import { isToggleType, isHeadingType } from '../../types/types';
import { BlockWrapper } from './BlockWrapper';
import { ParagraphBlock } from './ParagraphBlock';
import { HeadingBlock } from './HeadingBlock';
import { ToggleBlock } from './ToggleBlock';
import { BulletedListBlock } from './BulletedListBlock';
import { NumberedListBlock } from './NumberedListBlock';
import { ToDoBlock } from './ToDoBlock';
import { CalloutBlock } from './CalloutBlock';
import { CodeBlock } from './CodeBlock';
import { QuoteBlock } from './QuoteBlock';
import { DividerBlock } from './DividerBlock';

interface BlockRendererProps {
    block: EditorBlock;
    index: number;
    siblings: EditorBlock[];
}

/**
 * Calculate the display number for a numbered list item
 * Numbers reset when interrupted by non-numbered-list blocks
 */
function calculateNumberedListIndex(
    index: number,
    siblings: EditorBlock[]
): number {
    let count = 1;
    for (let i = index - 1; i >= 0; i--) {
        if (siblings[i].type === 'numbered_list_item') {
            count++;
        } else {
            break;
        }
    }
    return count;
}

export function BlockRenderer({ block, index, siblings }: BlockRendererProps) {
    const renderBlockContent = () => {
        // Toggle blocks (including toggle headings)
        if (isToggleType(block.type)) {
            return <ToggleBlock block={block} />;
        }

        // Regular headings
        if (isHeadingType(block.type)) {
            return <HeadingBlock block={block} />;
        }

        // Other block types
        switch (block.type) {
            case 'paragraph':
                return <ParagraphBlock block={block} />;

            case 'bulleted_list_item':
                return <BulletedListBlock block={block} />;

            case 'numbered_list_item': {
                const displayNumber = calculateNumberedListIndex(index, siblings);
                return <NumberedListBlock block={block} displayNumber={displayNumber} />;
            }

            case 'to_do':
                return <ToDoBlock block={block} />;

            case 'callout':
                return <CalloutBlock block={block} />;

            case 'code':
                return <CodeBlock block={block} />;

            case 'quote':
                return <QuoteBlock block={block} />;

            case 'divider':
                return <DividerBlock />;

            default: {
                const _exhaustive: never = block.type;
                console.warn(`Unknown block type: ${_exhaustive}`);
                return <ParagraphBlock block={block} />;
            }
        }
    };

    return (
        <BlockWrapper block={block}>
            {renderBlockContent()}
        </BlockWrapper>
    );
}
