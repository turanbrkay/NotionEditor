import React from 'react';
import { usePage } from '../context/PageContext';
import { downloadJSON } from '../utils/export';

export function PageTitle() {
    const { page, setTitle } = usePage();

    const handleExport = () => {
        downloadJSON(page);
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setTitle(e.target.value);
    };

    return (
        <div className="page-title-row">
            <input
                type="text"
                className="page-title"
                value={page.title}
                onChange={handleChange}
                placeholder="Untitled"
                aria-label="Page title"
            />
            <button className="toolbar-button toolbar-button--primary" onClick={handleExport}>
                Export JSON
            </button>
        </div>
    );
}
