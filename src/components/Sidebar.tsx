import { usePage } from '../context/PageContext';

interface SidebarProps {
    collapsed: boolean;
    onToggle: () => void;
}

export function Sidebar({ collapsed, onToggle }: SidebarProps) {
    const { pages, currentPageId, setCurrentPage, addPage, deletePage } = usePage();

    const handleAddPage = () => {
        const id = addPage();
        setCurrentPage(id);
    };

    return (
        <aside className={`sidebar ${collapsed ? 'sidebar--collapsed' : ''}`}>
            <div className="sidebar__header">
                <button className="sidebar__toggle" onClick={onToggle} aria-label="Toggle sidebar">
                    ≡
                </button>
                {!collapsed && <span className="sidebar__title">Pages</span>}
            </div>
            {!collapsed && (
                <>
                    <button className="sidebar__add" onClick={handleAddPage}>
                        + Add page
                    </button>
                    <div className="sidebar__list">
                        {pages.map((page) => (
                            <div
                                key={page.id}
                                className={`sidebar__item ${page.id === currentPageId ? 'sidebar__item--active' : ''}`}
                            >
                                <button
                                    className="sidebar__item-btn"
                                    onClick={() => setCurrentPage(page.id)}
                                    title={page.title || 'Untitled'}
                                >
                                    <span className="sidebar__item-label">{page.title || 'Untitled'}</span>
                                </button>
                                <button
                                    className="sidebar__item-delete"
                                    onClick={() => deletePage(page.id)}
                                    aria-label="Delete page"
                                    title="Delete page"
                                >
                                    🗑️
                                </button>
                            </div>
                        ))}
                    </div>
                </>
            )}
        </aside>
    );
}
