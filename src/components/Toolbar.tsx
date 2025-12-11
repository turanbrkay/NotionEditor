import { usePage } from '../context/PageContext';
import { downloadJSON } from '../utils/export';

export function Toolbar() {
    const { page } = usePage();

    const handleExport = () => {
        downloadJSON(page);
    };

    return (
        <div className="toolbar">
            <div style={{ flex: 1 }} />
            <button className="toolbar-button toolbar-button--primary" onClick={handleExport}>
                <span>↓</span>
                <span>Export JSON</span>
            </button>
        </div>
    );
}
