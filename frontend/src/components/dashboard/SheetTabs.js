import React, { useState } from 'react';

const SheetTabs = ({ 
    sheets, 
    activeSheetId, 
    onSheetChange, 
    onAddSheet, 
    onDeleteSheet,
    onRenameSheet
}) => {
    const [editingSheetId, setEditingSheetId] = useState(null);
    const [editingName, setEditingName] = useState('');
    
    const handleRenameStart = (sheetId, currentName) => {
        setEditingSheetId(sheetId);
        setEditingName(currentName);
    };
    
    const handleRenameComplete = () => {
        if (editingSheetId && editingName.trim()) {
            onRenameSheet(editingSheetId, editingName);
        }
        setEditingSheetId(null);
    };
    
    const handleKeyDown = (e) => {
        if (e.key === 'Enter') {
            handleRenameComplete();
        } else if (e.key === 'Escape') {
            setEditingSheetId(null);
        }
    };

    return (
        <div className="flex items-center border-t border-gray-200 bg-gray-100 text-sm">
            {Object.values(sheets).map((sheet) => (
                <div 
                    key={sheet.id}
                    className={`flex items-center border-r border-gray-200 px-3 py-1 max-w-xs cursor-pointer ${
                        activeSheetId === sheet.id ? 'bg-white font-medium' : 'hover:bg-gray-50'
                    }`}
                    onClick={() => onSheetChange(sheet.id)}
                    onDoubleClick={() => handleRenameStart(sheet.id, sheet.name)}
                >
                    {editingSheetId === sheet.id ? (
                        <input
                            type="text"
                            className="w-full px-1 focus:outline-none focus:ring-1 focus:ring-blue-500"
                            value={editingName}
                            onChange={(e) => setEditingName(e.target.value)}
                            onBlur={handleRenameComplete}
                            onKeyDown={handleKeyDown}
                            autoFocus
                        />
                    ) : (
                        <span className="truncate">{sheet.name}</span>
                    )}
                    
                    {/* Only show delete button if we have more than one sheet */}
                    {Object.keys(sheets).length > 1 && (
                        <button 
                            className="ml-2 text-gray-500 hover:text-gray-700"
                            onClick={(e) => {
                                e.stopPropagation();
                                onDeleteSheet(sheet.id);
                            }}
                            title="Delete Sheet"
                        >
                            &times;
                        </button>
                    )}
                </div>
            ))}
            
            <button
                className="flex items-center justify-center w-8 h-8 border-r border-gray-200 text-gray-600 hover:bg-gray-50"
                onClick={onAddSheet}
                title="Add Sheet"
            >
                +
            </button>
        </div>
    );
};

export default SheetTabs;