import { useState, useEffect } from 'react';

const EditMenu = ({ 
    activeCell, 
    currentData, 
    setCurrentData, 
    undoHistory, 
    redoHistory,
    canUndo,
    canRedo 
}) => {
    const [showEditMenu, setShowEditMenu] = useState(false);
    const [clipboard, setClipboard] = useState(null);

    const handleCut = () => {
        if (!activeCell) return;
        
        // Store the current cell value in clipboard
        const value = currentData[activeCell.row][activeCell.col];
        setClipboard(value);
        
        // Clear the cell
        const newData = [...currentData];
        newData[activeCell.row][activeCell.col] = '';
        setCurrentData(newData);
    };

    const handleCopy = () => {
        if (!activeCell) return;
        const value = currentData[activeCell.row][activeCell.col];
        setClipboard(value);
    };

    const handlePaste = () => {
        if (!activeCell || clipboard === null) return;
        
        const newData = [...currentData];
        newData[activeCell.row][activeCell.col] = clipboard;
        setCurrentData(newData);
    };

    const handlePasteValuesOnly = () => {
        if (!activeCell || clipboard === null) return;
        // For now, this works the same as regular paste since we don't have formatting
        handlePaste();
    };

    const handleGoTo = () => {
        const cellRef = prompt('Enter cell reference (e.g., A1):');
        if (!cellRef) return;

        // Convert cell reference to row/col indices
        const col = cellRef.match(/[A-Z]+/)[0];
        const row = parseInt(cellRef.match(/\d+/)[0]) - 1;
        const colIndex = col.split('').reduce((acc, char) => 
            acc * 26 + char.charCodeAt(0) - 'A'.charCodeAt(0), 0
        );

        // TODO: Implement scrolling to the cell and selecting it
        console.log(`Go to cell: row ${row}, col ${colIndex}`);
    };

    const handleFind = () => {
        const searchTerm = prompt('Enter search term:');
        if (!searchTerm) return;

        // TODO: Implement find functionality
        console.log(`Searching for: ${searchTerm}`);
    };

    const menuItems = [
        { 
            label: 'Undo', 
            shortcut: 'Ctrl+Z', 
            onClick: undoHistory, 
            icon: '↩',
            disabled: !canUndo
        },
        { 
            label: 'Redo', 
            shortcut: 'Ctrl+Y', 
            onClick: redoHistory, 
            icon: '↪',
            disabled: !canRedo
        },
        { type: 'divider' },
        { 
            label: 'Cut', 
            shortcut: 'Ctrl+X', 
            onClick: handleCut, 
            icon: '✂',
            disabled: !activeCell
        },
        { 
            label: 'Copy', 
            shortcut: 'Ctrl+C', 
            onClick: handleCopy, 
            icon: '📄',
            disabled: !activeCell
        },
        { 
            label: 'Paste', 
            shortcut: 'Ctrl+V', 
            onClick: handlePaste, 
            icon: '📋',
            disabled: !clipboard || !activeCell 
        },
        { 
            label: 'Paste values only', 
            shortcut: 'Ctrl+V', 
            onClick: handlePasteValuesOnly, 
            icon: '📋',
            disabled: !clipboard || !activeCell 
        },
        { 
            label: 'Paste formatting only', 
            onClick: () => {}, 
            icon: '📋',
            disabled: true 
        },
        { type: 'divider' },
        { 
            label: 'Go to', 
            shortcut: 'Ctrl+G', 
            onClick: handleGoTo, 
            icon: '🔍' 
        },
        { 
            label: 'Find in current sheet', 
            shortcut: 'Ctrl+F', 
            onClick: handleFind, 
            icon: '🔎' 
        },
        { 
            label: 'Find in all sheets', 
            shortcut: 'Ctrl+F', 
            onClick: handleFind, 
            icon: '🔍',
            disabled: true 
        }
    ];

    // Update keyboard shortcuts
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.ctrlKey) {
                switch (e.key.toLowerCase()) {
                    case 'z':
                        e.preventDefault();
                        if (canUndo) undoHistory();
                        break;
                    case 'y':
                        e.preventDefault();
                        if (canRedo) redoHistory();
                        break;
                    case 'x':
                        e.preventDefault();
                        handleCut();
                        break;
                    case 'c':
                        e.preventDefault();
                        handleCopy();
                        break;
                    case 'v':
                        e.preventDefault();
                        handlePaste();
                        break;
                    case 'g':
                        e.preventDefault();
                        handleGoTo();
                        break;
                    case 'f':
                        e.preventDefault();
                        handleFind();
                        break;
                    default:
                        break;
                }
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [activeCell, currentData, clipboard, canUndo, canRedo, undoHistory, redoHistory]);

    return (
        <div className="relative">
            <button 
                className="flex items-center text-sm text-gray-700 hover:bg-gray-100 px-3 py-1 rounded"
                onClick={() => setShowEditMenu(!showEditMenu)}
            >
                <span className="mr-1">Edit</span>
            </button>
            
            {showEditMenu && (
                <div className="absolute left-0 top-full mt-1 w-64 bg-white rounded-md shadow-lg border border-gray-200 z-50">
                    <div className="py-1">
                        {menuItems.map((item, index) => (
                            item.type === 'divider' ? (
                                <hr key={index} className="my-1 border-gray-200" />
                            ) : (
                                <button
                                    key={index}
                                    onClick={() => {
                                        item.onClick?.();
                                        setShowEditMenu(false);
                                    }}
                                    disabled={item.disabled}
                                    className={`flex items-center justify-between w-full px-4 py-2 text-sm 
                                        ${item.disabled 
                                            ? 'text-gray-400 cursor-not-allowed' 
                                            : 'text-gray-700 hover:bg-gray-100'}`}
                                >
                                    <div className="flex items-center">
                                        <span className="w-5">{item.icon}</span>
                                        <span className="ml-2">{item.label}</span>
                                    </div>
                                    {item.shortcut && (
                                        <span className="text-gray-400 text-xs">{item.shortcut}</span>
                                    )}
                                </button>
                            )
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default EditMenu; 