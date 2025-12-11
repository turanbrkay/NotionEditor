import { usePage } from '../context/PageContext';

interface SidebarProps {
    collapsed: boolean;
    onToggle: () => void;
}

export function Sidebar({ collapsed, onToggle }: SidebarProps) {
    const { pages, currentPageId, setCurrentPage, addPage } = usePage();

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
                    <div className="sidebar__list">
                        {pages.map((page) => (
                            <button
                                key={page.id}
                                className={`sidebar__item ${page.id === currentPageId ? 'sidebar__item--active' : ''}`}
                                onClick={() => setCurrentPage(page.id)}
                            >
                                {page.title || 'Untitled'}
                            </button>
                        ))}
                    </div>
                    <button className="sidebar__add" onClick={handleAddPage}>
                        + Add page
                    </button>
                </>
            )}
        </aside>
    );
}
