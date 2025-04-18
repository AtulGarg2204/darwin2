// FilterMenu.js
import React, { useState, useRef, useEffect } from 'react';

const FilterMenu = ({ 
    selectedColumn, 
    onToggleColumnFilter, 
    hasFilters,
    sheets,
    activeSheetId
}) => {
    const [showFilterMenu, setShowFilterMenu] = useState(false);
    const menuRef = useRef(null);
    
    // Determine if the filter menu button should be disabled
    const isDisabled = selectedColumn === null || selectedColumn === undefined;
    
    // Close the menu when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (menuRef.current && !menuRef.current.contains(event.target)) {
                setShowFilterMenu(false);
            }
        };
        
        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);
    
    // Handle toggling the filter for the selected column
    const handleToggleFilter = () => {
        if (selectedColumn !== null && selectedColumn !== undefined) {
            onToggleColumnFilter(selectedColumn);
            setShowFilterMenu(false);
        }
    };
    
    // Handle clearing all filters
    const handleClearAllFilters = () => {
        if (onToggleColumnFilter) {
            onToggleColumnFilter(null, true); // Pass true to indicate clear all filters
            setShowFilterMenu(false);
        }
    };
    
    // Get column label for the selected column
    const getColumnLabel = (colIndex) => {
        if (colIndex === null || colIndex === undefined) return '';
        
        // Generate column label (A, B, C, etc.)
        let label = '';
        let i = colIndex;
        
        do {
            label = String.fromCharCode(65 + (i % 26)) + label;
            i = Math.floor(i / 26) - 1;
        } while (i >= 0);
        
        return label;
    };
    
    const selectedColumnLabel = getColumnLabel(selectedColumn);
    
    return (
        <div className="relative" ref={menuRef}>
            <button 
                className={`flex items-center text-sm px-3 py-1 rounded ${
                    hasFilters ? 'text-blue-600 bg-blue-50' : 'text-gray-700 hover:bg-gray-100'
                } ${isDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                onClick={() => !isDisabled && setShowFilterMenu(!showFilterMenu)}
                disabled={isDisabled}
                title={isDisabled ? "Select a column first" : "Filter"}
            >
                <span className="mr-1">Filter</span>
                {hasFilters && (
                    <span className="ml-1 bg-blue-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                        {Object.keys(sheets[activeSheetId]?.filters || {}).length}
                    </span>
                )}
            </button>
            
            {showFilterMenu && (
                <div className="absolute left-0 top-full mt-1 w-56 bg-white rounded-md shadow-lg border border-gray-200 z-50 py-1">
                    <div className="px-4 py-2 text-xs font-semibold text-gray-500 border-b border-gray-200">
                        Filter Options
                    </div>
                    
                    <button
                        onClick={handleToggleFilter}
                        className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                        disabled={isDisabled}
                    >
                        {selectedColumnLabel ? `Filter Column ${selectedColumnLabel}` : 'Select a column first'}
                    </button>
                    
                    {hasFilters && (
                        <>
                            <div className="border-t border-gray-200 my-1"></div>
                            <button
                                onClick={handleClearAllFilters}
                                className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                            >
                                Clear All Filters
                            </button>
                        </>
                    )}
                </div>
            )}
        </div>
    );
};

export default FilterMenu;