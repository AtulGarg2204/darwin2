import { useState, useEffect, useCallback } from 'react';

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

// Main issue: The clipboard operations aren't actually using the document.execCommand
// or the clipboard API, so they don't interact with the system clipboard
// Close the menu when clicking outside
useEffect(() => {
    const handleClickOutside = (e) => {
        if (showEditMenu && !e.target.closest('.edit-menu')) {
            setShowEditMenu(false);
        }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
}, [showEditMenu]);
const handleCut = useCallback(() => {
    console.log('Cut triggered from menu');
    
    // If no active cell, cannot cut
    if (!activeCell) {
      console.log('No active cell, cannot cut');
      return;
    }
    
    // Check if the active cell contains a chart
    const cellValue = currentData[activeCell.row]?.[activeCell.col];
    if (typeof cellValue === 'string' && cellValue.startsWith('CHART:') && cellValue.includes(':START')) {
      console.log('Chart detected at active cell, handling chart cut operation');
      
      // Get the chart config from the cell
      try {
        const configStr = cellValue.split(':').slice(1, -1).join(':');
        const chartConfig = JSON.parse(configStr);
        
        // Dispatch a custom event for chart clipboard operation
        const chartEvent = new CustomEvent('chartClipboardOperation', {
          detail: {
            action: 'cut',
            chartConfig,
            sourceSheetId: window.activeSheetId, // Need to have this accessible
            chartPosition: activeCell
          }
        });
        document.dispatchEvent(chartEvent);
        
        return; // Stop here - chart operation handled
      } catch (err) {
        console.error('Error parsing chart config for cut:', err);
        // Fall back to normal cell cut if chart parsing fails
      }
    }
    
    // If not a chart or chart parsing failed, proceed with regular cell cut
    // Create a temporary event to pass to DataGrid's cut handler
    const tempEvent = new Event('cut');
    tempEvent.preventDefault = () => {};
    
    // Store current cell value in clipboard
    const value = currentData[activeCell.row]?.[activeCell.col] || '';
    setClipboard(value);
    
    // Set to clipboard
    navigator.clipboard.writeText(value).catch(err => {
      console.error('Failed to write to clipboard:', err);
    });
    
    // Clear the cell
    const newData = [...currentData];
    if (!newData[activeCell.row]) {
      newData[activeCell.row] = [];
    }
    newData[activeCell.row][activeCell.col] = '';
    setCurrentData(newData);
    
    // Dispatch a custom event that DataGrid might be listening for
    document.dispatchEvent(new CustomEvent('clipboardOperation', { 
      detail: { type: 'cut', cell: activeCell } 
    }));
  }, [activeCell, currentData, setCurrentData]);
  
  const handleCopy = useCallback(() => {
    console.log('Copy triggered from menu');
    
    if (!activeCell) {
      console.log('No active cell, cannot copy');
      return;
    }
    
    // Check if the active cell contains a chart
    const cellValue = currentData[activeCell.row]?.[activeCell.col];
    if (typeof cellValue === 'string' && cellValue.startsWith('CHART:') && cellValue.includes(':START')) {
      console.log('Chart detected at active cell, handling chart copy operation');
      
      // Get the chart config from the cell
      try {
        const configStr = cellValue.split(':').slice(1, -1).join(':');
        const chartConfig = JSON.parse(configStr);
        
        // Dispatch a custom event for chart clipboard operation
        const chartEvent = new CustomEvent('chartClipboardOperation', {
          detail: {
            action: 'copy',
            chartConfig,
            sourceSheetId: window.activeSheetId, // Need to have this accessible
            chartPosition: activeCell
          }
        });
        document.dispatchEvent(chartEvent);
        
        return; // Stop here - chart operation handled
      } catch (err) {
        console.error('Error parsing chart config for copy:', err);
        // Fall back to normal cell copy if chart parsing fails
      }
    }
    
    // If not a chart or chart parsing failed, proceed with regular cell copy
    // Get the value to copy
    const value = currentData[activeCell.row]?.[activeCell.col] || '';
    console.log(`Copying value: "${value}" from cell [${activeCell.row},${activeCell.col}]`);
    
    // Store in internal clipboard
    setClipboard(value);
    
    // Copy to system clipboard
    navigator.clipboard.writeText(value).catch(err => {
      console.error('Failed to write to clipboard:', err);
    });
    
    // Dispatch a custom event that DataGrid might be listening for
    document.dispatchEvent(new CustomEvent('clipboardOperation', { 
      detail: { type: 'copy', cell: activeCell } 
    }));
  }, [activeCell, currentData]);
  
  const handlePaste = useCallback(() => {
    console.log('Paste triggered from menu');
    
    if (!activeCell) {
      console.log('No active cell, cannot paste');
      return;
    }
    
    // First check if we need to handle chart paste
    // Dispatch a custom event for chart paste attempt
    const chartPasteEvent = new CustomEvent('chartClipboardOperation', {
      detail: {
        action: 'paste',
        targetCell: activeCell
      }
    });
    
    // Set a flag to check if chart paste was handled
    window.chartPasteHandled = false;
    document.dispatchEvent(chartPasteEvent);
    
    // If chart paste was handled, don't proceed with regular paste
    if (window.chartPasteHandled) {
      console.log('Chart paste was handled by chart handler');
      return;
    }
    
    // If no chart paste or it wasn't handled, proceed with regular cell paste
    // First try to get clipboard data from the system clipboard
    navigator.clipboard.readText()
      .then(text => {
        console.log(`Read from clipboard: "${text.substring(0, 20)}..."`);
        // Update the cell with clipboard content
        const newData = [...currentData];
        if (!newData[activeCell.row]) {
          newData[activeCell.row] = [];
        }
        newData[activeCell.row][activeCell.col] = text;
        setCurrentData(newData);
        
        // Dispatch a custom event that DataGrid might be listening for
        document.dispatchEvent(new CustomEvent('clipboardOperation', { 
          detail: { type: 'paste', cell: activeCell, data: text } 
        }));
      })
      .catch(err => {
        console.error('Failed to read from clipboard:', err);
        // Fall back to internal clipboard
        if (clipboard !== null) {
          const newData = [...currentData];
          if (!newData[activeCell.row]) {
            newData[activeCell.row] = [];
          }
          newData[activeCell.row][activeCell.col] = clipboard;
          setCurrentData(newData);
        }
      });
  }, [activeCell, clipboard, currentData, setCurrentData]);

const handlePasteValuesOnly = useCallback(() => {
    // For simple implementation, just call the regular paste
    handlePaste();
}, [handlePaste]);

const handleGoTo = useCallback(() => {
    const cellRef = prompt('Enter cell reference (e.g., A1):');
    if (!cellRef) return;

    // Convert cell reference to row/col indices
    try {
        const colMatch = cellRef.match(/[A-Z]+/);
        const rowMatch = cellRef.match(/\d+/);
        
        if (!colMatch || !rowMatch) {
            alert('Invalid cell reference format. Please use format like A1, B2, etc.');
            return;
        }
        
        const col = colMatch[0];
        const row = parseInt(rowMatch[0]) - 1;
        
        const colIndex = col.split('').reduce((acc, char) => 
            acc * 26 + char.charCodeAt(0) - 'A'.charCodeAt(0), 0
        );

        // Dispatch a custom event that Dashboard can listen for
        const event = new CustomEvent('gotocell', { 
            detail: { row, col: colIndex }
        });
        document.dispatchEvent(event);
        
        console.log(`Go to cell: row ${row}, col ${colIndex}`);
    } catch (error) {
        console.error('Error parsing cell reference:', error);
        alert('Invalid cell reference. Please use format like A1, B2, etc.');
    }
}, []);

const handleFind = useCallback(() => {
    const searchTerm = prompt('Enter search term:');
    if (!searchTerm) return;

    // Search through the current data
    const results = [];
    
    currentData.forEach((row, rowIndex) => {
        row.forEach((cell, colIndex) => {
            if (cell && cell.toString().includes(searchTerm)) {
                results.push({ row: rowIndex, col: colIndex, value: cell });
            }
        });
    });
    
    if (results.length > 0) {
        console.log(`Found ${results.length} matches:`, results);
        
        // Navigate to the first result
        const firstResult = results[0];
        
        // Dispatch a custom event that Dashboard can listen for
        const event = new CustomEvent('gotocell', { 
            detail: { row: firstResult.row, col: firstResult.col }
        });
        document.dispatchEvent(event);
        
        alert(`Found ${results.length} matches. Navigating to the first match.`);
    } else {
        alert('No matches found.');
    }
}, [currentData]);

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
        disabled: false // Allow cut even on empty cells
    },
    { 
        label: 'Copy', 
        shortcut: 'Ctrl+C', 
        onClick: handleCopy, 
        icon: '📄',
        disabled: false // Allow copy even on empty cells
    },
    { 
        label: 'Paste', 
        shortcut: 'Ctrl+V', 
        onClick: handlePaste, 
        icon: '📋',
        disabled: false // Always allow paste attempts
    },
    { 
        label: 'Paste values only', 
        shortcut: 'Ctrl+Shift+V', 
        onClick: handlePasteValuesOnly, 
        icon: '📋',
        disabled: false // Always allow paste attempts
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
        shortcut: 'Ctrl+Shift+F', 
        onClick: () => {}, 
        icon: '🔍',
        disabled: true 
    }
];

// Update keyboard shortcuts
useEffect(() => {
    const handleKeyDown = (e) => {
        // Make sure we're not handling events when focused on input/textarea elements
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
            // Only handle specific shortcuts globally
            if (e.ctrlKey && (e.key.toLowerCase() === 'z' || e.key.toLowerCase() === 'y')) {
                // Allow undo/redo globally
            } else {
                return;
            }
        }
        
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
                    if (document.activeElement.tagName !== 'INPUT') {
                        e.preventDefault();
                        handleCut();
                    }
                    break;
                case 'c':
                    if (document.activeElement.tagName !== 'INPUT') {
                        e.preventDefault();
                        handleCopy();
                    }
                    break;
                case 'v':
                    if (document.activeElement.tagName !== 'INPUT') {
                        e.preventDefault();
                        if (e.shiftKey) {
                            handlePasteValuesOnly();
                        } else {
                            handlePaste();
                        }
                    }
                    break;
                case 'g':
                    e.preventDefault();
                    handleGoTo();
                    break;
                case 'f':
                    e.preventDefault();
                    if (e.shiftKey) {
                        // Find in all sheets (not implemented)
                        alert('Find in all sheets is not implemented yet.');
                    } else {
                        handleFind();
                    }
                    break;
                default:
                    break;
            }
        }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
}, [
    activeCell,
    currentData,
    clipboard,
    canUndo,
    canRedo,
    undoHistory,
    redoHistory,
    handleCut,
    handleCopy,
    handlePaste,
    handlePasteValuesOnly,
    handleGoTo,
    handleFind
]);

// Effect to log when activeCell changes
useEffect(() => {
    console.log('activeCell updated in EditMenu:', activeCell);
}, [activeCell]);

// Implement useEffect to log props for debugging
useEffect(() => {
    console.log('EditMenu props:', {
        hasActiveCell: !!activeCell,
        activeCell,
        canUndo,
        canRedo,
        currentDataSize: currentData?.length
    });
}, [activeCell, canUndo, canRedo, currentData]);

// Log menu state when it opens
useEffect(() => {
    if (showEditMenu) {
        console.log('Edit menu opened with state:', {
            activeCell,
            clipboard: clipboard ? `${clipboard.substring(0, 20)}...` : null
        });
    }
}, [showEditMenu, activeCell, clipboard]);

return (
    <div className="relative edit-menu">
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
                                    console.log(`Clicked ${item.label} menu item`);
                                    if (item.onClick) {
                                        item.onClick();
                                        console.log(`${item.label} handler executed`);
                                    }
                                    setShowEditMenu(false);
                                }}
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