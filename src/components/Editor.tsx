import { usePage } from '../context/PageContext';
import { serializeRichTextFromElement } from '../utils/blocks';
import { PageTitle } from './PageTitle';
import { Toolbar } from './Toolbar';
import { FloatingToolbar } from './FloatingToolbar';
import { BlockRenderer } from './blocks/BlockRenderer';

export function Editor() {
    const { page, updateBlock } = usePage();
    const blocks = page.blocks;

    const persistSelectionToState = () => {
        const selection = window.getSelection();
        if (!selection || selection.rangeCount === 0) {
            return;
        }

        const startBlock = selection.anchorNode ? getClosestBlockId(selection.anchorNode) : null;
        const endBlock = selection.focusNode ? getClosestBlockId(selection.focusNode) : null;

        if (!startBlock || !endBlock || startBlock !== endBlock) {
            return;
        }

        const blockElement = document.querySelector<HTMLElement>(`[data-block-id="${startBlock}"] [contenteditable="true"]`);
        if (!blockElement) {
            return;
        }

        const richText = serializeRichTextFromElement(blockElement);
        updateBlock(startBlock, { rich_text: richText });
    };

    const handleFormat = (format: string) => {
        switch (format) {
            case 'bold':
                document.execCommand('bold');
                break;
            case 'italic':
                document.execCommand('italic');
                break;
            case 'underline':
                document.execCommand('underline');
                break;
            case 'strikethrough':
                document.execCommand('strikeThrough');
                break;
            case 'code':
                toggleInlineCode();
                break;
        }

        persistSelectionToState();
    };

    const toggleInlineCode = () => {
        const selection = window.getSelection();
        if (!selection || selection.isCollapsed || selection.rangeCount === 0) return;

        const range = selection.getRangeAt(0);

        // Check if selection is inside an inline-code span
        const container = range.commonAncestorContainer;
        const inlineCodeParent = container.nodeType === Node.TEXT_NODE
            ? container.parentElement?.closest('.inline-code')
            : (container as Element).closest?.('.inline-code');

        if (inlineCodeParent) {
            // Already in inline code - remove the formatting
            const parent = inlineCodeParent.parentNode;
            if (parent) {
                // Move children out and remove the span
                while (inlineCodeParent.firstChild) {
                    parent.insertBefore(inlineCodeParent.firstChild, inlineCodeParent);
                }
                parent.removeChild(inlineCodeParent);
                // Normalize to merge adjacent text nodes
                parent.normalize();
            }
        } else {
            // Not in inline code - apply formatting
            try {
                const span = document.createElement('span');
                span.className = 'inline-code';
                range.surroundContents(span);
            } catch {
                // If surroundContents fails (partial selection across elements),
                // extract and wrap the contents
                const contents = range.extractContents();
                const span = document.createElement('span');
                span.className = 'inline-code';
                span.appendChild(contents);
                range.insertNode(span);
            }
        }
    };

    return (
        <div className="page-container">
            <div className="page-content">
                <PageTitle />
                <Toolbar />

                <FloatingToolbar onFormat={handleFormat} onColorChange={persistSelectionToState} />

                <div className="blocks-container">
                    {blocks.map((block, index) => (
                        <BlockRenderer
                            key={block.id}
                            block={block}
                            index={index}
                            siblings={blocks}
                        />
                    ))}
                </div>
            </div>
        </div>
    );
}

function getClosestBlockId(node: Node): string | null {
    const element = node instanceof HTMLElement ? node : node.parentElement;
    const wrapper = element?.closest('[data-block-id]');
    return wrapper ? wrapper.getAttribute('data-block-id') : null;
}
