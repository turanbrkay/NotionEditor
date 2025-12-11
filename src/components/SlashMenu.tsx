import { useState, useEffect, useRef } from 'react';
import type { BlockType } from '../types/types';

interface SlashMenuItem {
    type: BlockType;
    title: string;
    description: string;
    icon: string;
}

const MENU_ITEMS: SlashMenuItem[] = [
    { type: 'paragraph', title: 'Text', description: 'Plain text block', icon: 'T' },
    { type: 'heading_1', title: 'Heading 1', description: 'Large section heading', icon: 'H1' },
    { type: 'heading_2', title: 'Heading 2', description: 'Medium section heading', icon: 'H2' },
    { type: 'heading_3', title: 'Heading 3', description: 'Small section heading', icon: 'H3' },
    { type: 'bulleted_list_item', title: 'Bulleted list', description: 'Create a bulleted list', icon: '•' },
    { type: 'numbered_list_item', title: 'Numbered list', description: 'Create a numbered list', icon: '1.' },
    { type: 'to_do', title: 'To-do', description: 'Track tasks with a checkbox', icon: '☑' },
    { type: 'toggle_list', title: 'Toggle', description: 'Collapsible content', icon: '▶' },
    { type: 'toggle_heading_1', title: 'Toggle H1', description: 'Collapsible heading 1', icon: '▶' },
    { type: 'toggle_heading_2', title: 'Toggle H2', description: 'Collapsible heading 2', icon: '▶' },
    { type: 'toggle_heading_3', title: 'Toggle H3', description: 'Collapsible heading 3', icon: '▶' },
    { type: 'callout', title: 'Callout', description: 'Highlighted callout box', icon: 'DY' },
    { type: 'quote', title: 'Quote', description: 'Block quote', icon: '"' },
    { type: 'code', title: 'Code', description: 'Code block with syntax', icon: '</>' },
    { type: 'image', title: 'Image', description: 'Insert an image', icon: 'img' },
    { type: 'divider', title: 'Divider', description: 'Horizontal line', icon: '—' },
];

interface SlashMenuProps {
    onSelect: (type: BlockType) => void;
    onClose: () => void;
}

export function SlashMenu({ onSelect, onClose }: SlashMenuProps) {
    const [filter, setFilter] = useState('');
    const [activeIndex, setActiveIndex] = useState(0);
    const menuRef = useRef<HTMLDivElement>(null);

    const filteredItems = MENU_ITEMS.filter(
        (item) =>
            item.title.toLowerCase().includes(filter.toLowerCase()) ||
            item.description.toLowerCase().includes(filter.toLowerCase())
    );

    // Handle keyboard navigation at document level
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            switch (e.key) {
                case 'ArrowDown':
                    e.preventDefault();
                    setActiveIndex((prev) => (prev + 1) % filteredItems.length);
                    break;
                case 'ArrowUp':
                    e.preventDefault();
                    setActiveIndex((prev) => (prev - 1 + filteredItems.length) % filteredItems.length);
                    break;
                case 'Enter':
                    e.preventDefault();
                    if (filteredItems[activeIndex]) {
                        onSelect(filteredItems[activeIndex].type);
                    }
                    break;
                case 'Escape':
                    e.preventDefault();
                    onClose();
                    break;
                default:
                    // Capture typing for filter
                    if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) {
                        setFilter((prev) => prev + e.key);
                        setActiveIndex(0);
                    } else if (e.key === 'Backspace') {
                        setFilter((prev) => prev.slice(0, -1));
                        setActiveIndex(0);
                    }
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [filteredItems, activeIndex, onSelect, onClose]);

    // Click outside to close
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
                onClose();
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [onClose]);

    return (
        <div className="slash-menu" ref={menuRef}>
            {filteredItems.length === 0 ? (
                <div className="slash-menu-item">
                    <span className="slash-menu-item-title" style={{ color: 'var(--color-text-secondary)' }}>
                        No results for "{filter}"
                    </span>
                </div>
            ) : (
                filteredItems.map((item, index) => (
                    <div
                        key={item.type}
                        className={`slash-menu-item ${index === activeIndex ? 'slash-menu-item--active' : ''}`}
                        onClick={() => onSelect(item.type)}
                        onMouseEnter={() => setActiveIndex(index)}
                    >
                        <div className="slash-menu-item-icon">{item.icon}</div>
                        <div className="slash-menu-item-content">
                            <div className="slash-menu-item-title">{item.title}</div>
                            <div className="slash-menu-item-desc">{item.description}</div>
                        </div>
                    </div>
                ))
            )}
        </div>
    );
}
