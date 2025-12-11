import React from 'react';
import { usePage } from '../context/PageContext';

export function PageTitle() {
    const { page, setTitle } = usePage();

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setTitle(e.target.value);
    };

    return (
        <input
            type="text"
            className="page-title"
            value={page.title}
            onChange={handleChange}
            placeholder="Untitled"
            aria-label="Page title"
        />
    );
}
