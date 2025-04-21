import { useState, useRef, forwardRef, useImperativeHandle,useEffect } from 'react';

import DataGrid from './DataGrid';
import ChatInterface from '../chat/ChatInterface';
import Toolbar from './Toolbar';
import SheetTabs from './SheetTabs'; // New component

import StatisticsPanel from './StatisticsPanel'; // Import the new component
const Dashboard = forwardRef(({ 
    sheets, 
    activeSheetId,
    onSheetChange,
    onAddSheet,
    onDeleteSheet,
    onRenameSheet,
    onUpdateSheetData,
    setActiveCell,
    showHeaders,
    showGridLines,
    zoomLevel,
    selectedColumn,
  onToggleColumnFilter,
  onApplyFilter,
  onChartClipboard
}, ref) => {
    const dataGridRef = useRef();
    
    // Get the active sheet
    const activeSheet = sheets[activeSheetId];
    const [visibleRows, setVisibleRows] = useState([]);
    const [selectedRange, setSelectedRange] = useState(null);
    // Add state for cell formatting (now per sheet)
    const [formulaBar, setFormulaBar] = useState('');
  // In Dashboard.js
// Update the handleCellClick function to trigger statistics update
const handleCellClick = (row, col) => {
    const newActiveCell = { row, col };
    setActiveCell(newActiveCell);
    
    // Update formula bar with cell content or formula
    const cellContent = activeSheet.data[row]?.[col] || '';
    const cellKey = `${row}-${col}`;
    const formula = activeSheet.formulas?.[cellKey];
    setFormulaBar(formula || cellContent);
    
    // Immediately update statistics when a cell is clicked
    setTimeout(() => {
        handleSelectionChange();
        handleVisibleRowsChange();
    }, 0);
};

const handleSelectionChange = () => {
    if (dataGridRef.current) {
      const selection = dataGridRef.current.getSelection();
      setSelectedRange(selection);
    }
  };
  
  const handleVisibleRowsChange = () => {
    if (dataGridRef.current) {
      const rows = dataGridRef.current.getVisibleRows();
      setVisibleRows(rows);
    }
  };
  
  // Add this useEffect to detect selection changes
  useEffect(() => {
    // Initial load of selection and visible rows
    handleSelectionChange();
    handleVisibleRowsChange();
    
    // Set up event listeners for selection changes
    const handleMouseUp = () => {
      handleSelectionChange();
    };
    
    document.addEventListener('mouseup', handleMouseUp);
    
    return () => {
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);
  
  // Add this useEffect to update when filters or data change
  useEffect(() => {
    handleVisibleRowsChange();
  }, [activeSheet?.filters, activeSheet?.data]);
    useEffect(() => {
        if (dataGridRef.current) {
            // Get current selection from DataGrid
            const selection = dataGridRef.current.getSelection();
            setSelectedRange(selection);
            
            // Get visible rows after filtering
            const rows = dataGridRef.current.getVisibleRows();
            setVisibleRows(rows);
        }
    }, [activeSheet?.filters, activeSheet?.activeCell]);
    const handleChartRequest = (chartConfig, sourceSheetId, targetSheetId, parsedFile) => {
        if (!dataGridRef.current) return;
        
        // Check if we're dealing with a data insertion request
        if (parsedFile) {
            console.log("Handling data insertion request");
            
            // If parsedFile is provided, we're inserting transformed data
            // First, determine where to insert the data
            if (targetSheetId && sheets[targetSheetId]) {
                // Insert into an existing sheet
                const updatedSheets = { ...sheets };
                
                // Get the active cell position for this sheet or default to 0,0
                const activeCell = sheets[targetSheetId].activeCell || { row: 0, col: 0 };
                
                // Create a copy of the sheet's data
                const newData = [...sheets[targetSheetId].data];
                
                // Insert the transformed data at the active cell position
                parsedFile.parsedData.forEach((row, rowIndex) => {
                    const targetRow = activeCell.row + rowIndex;
                    
                    // Ensure we have enough rows
                    while (newData.length <= targetRow) {
                        newData.push([]);
                    }
                    
                    // Insert each cell in the row
                    if (Array.isArray(row)) {
                        row.forEach((cell, colIndex) => {
                            const targetCol = activeCell.col + colIndex;
                            
                            // Ensure the row has enough cells
                            while (newData[targetRow].length <= targetCol) {
                                newData[targetRow].push('');
                            }
                            
                            newData[targetRow][targetCol] = cell;
                        });
                    } else {
                        // Handle non-array rows (single values)
                        const targetCol = activeCell.col;
                        
                        // Ensure the row has enough cells
                        while (newData[targetRow].length <= targetCol) {
                            newData[targetRow].push('');
                        }
                        
                        newData[targetRow][targetCol] = row;
                    }
                });
                
                updatedSheets[targetSheetId] = {
                    ...sheets[targetSheetId],
                    data: newData
                };
                
                onUpdateSheetData(updatedSheets);
                onSheetChange(targetSheetId);
            } else {
                // Create a new sheet for the data
                const sheetCount = Object.keys(sheets).length + 1;
                const newSheetId = `sheet${Date.now()}`; // Use timestamp for unique ID
                
                const newSheets = {
                    ...sheets,
                    [newSheetId]: {
                        id: newSheetId,
                        name: `Sheet ${sheetCount}`,
                        data: parsedFile.parsedData,
                        activeCell: { row: 0, col: 0 },
                        cellFormats: {}
                    }
                };
                
                onUpdateSheetData(newSheets);
                onSheetChange(newSheetId);
            }
            return;
        }
        
        // Check for statistical analysis with multiple charts
        if (chartConfig && Array.isArray(chartConfig)) {
            console.log("Handling multi-chart statistical analysis:", chartConfig.length, "charts");
            
            // Validate each chart configuration
            const validatedCharts = chartConfig.filter(chart => {
                if (!chart || !chart.data || !Array.isArray(chart.data) || chart.data.length === 0) {
                    console.error("Skipping invalid chart:", chart);
                    return false;
                }
                
                // Check for valid data values and ensure numeric properties
                try {
                    // Clean up the data to ensure numeric values are properly formatted
                    chart.data = chart.data.map(item => {
                        const cleanItem = { ...item };
                        // Keep name and group as is
                        const nameValue = cleanItem.name;
                        const groupValue = cleanItem.group;
                        
                        // Convert other properties to numbers if possible
                        Object.keys(cleanItem).forEach(key => {
                            if (key !== 'name' && key !== 'group') {
                                // Try to convert to number
                                const numVal = parseFloat(cleanItem[key]);
                                if (!isNaN(numVal)) {
                                    cleanItem[key] = numVal;
                                } else if (cleanItem[key] === null || cleanItem[key] === undefined || cleanItem[key] === '') {
                                    // Set empty/null values to 0 for charts
                                    cleanItem[key] = 0;
                                }
                            }
                        });
                        
                        // Restore name and group
                        cleanItem.name = nameValue;
                        if (groupValue) cleanItem.group = groupValue;
                        
                        return cleanItem;
                    });
                    
                    return true;
                } catch (error) {
                    console.error("Error validating chart data:", error);
                    return false;
                }
            });
            
            if (validatedCharts.length === 0) {
                console.error("No valid charts found in the configuration");
                return;
            }
            
            // Create a new sheet specifically for statistical analysis
            const sheetCount = Object.keys(sheets).length + 1;
            const newSheetId = `sheet${Date.now()}`; // Use timestamp for unique ID
            
            // Use a more descriptive name
            const sheetName = `Analysis ${sheetCount}`;
            
            // Create initial empty data for the new sheet (more rows for multiple charts)
            // Ensure we have enough rows and columns for multiple charts
            const emptyData = Array(100).fill().map(() => Array(20).fill(''));
            
            // Create the new sheet
            const newSheets = {
                ...sheets,
                [newSheetId]: {
                    id: newSheetId,
                    name: sheetName,
                    data: emptyData,
                    activeCell: { row: 0, col: 0 },
                    cellFormats: {}
                }
            };
            
            // First update sheets with the new sheet
            onUpdateSheetData(newSheets);
            
            // Switch to the new sheet
            onSheetChange(newSheetId);
            
            // Add a small delay to ensure the sheet switch is complete before creating charts
            setTimeout(() => {
                if (dataGridRef.current) {
                    // Calculate positions for multiple charts in a grid
                    const chartsPerRow = 2; // Adjust as needed
                    const chartWidth = 6; // Default chart width
                    const chartHeight = 15; // Default chart height
                    const paddingRows = 2; // Rows between charts
                    const paddingCols = 1; // Columns between charts
                    
                    // Create each chart with appropriate positioning
                    validatedCharts.forEach((config, index) => {
                        // Calculate row and column position for this chart
                        const row = Math.floor(index / chartsPerRow) * (chartHeight + paddingRows);
                        const col = (index % chartsPerRow) * (chartWidth + paddingCols);
                        
                        // Create the chart at the calculated position
                        try {
                            dataGridRef.current.createChart(
                                config.type || 'bar',
                                { row, col },
                                config
                            );
                            console.log(`Created chart ${index} at position (${row}, ${col})`);
                        } catch (error) {
                            console.error(`Failed to create chart ${index}:`, error);
                        }
                    });
                }
                
                // Show notification
                const notification = document.createElement('div');
                notification.className = 'fixed bottom-4 right-4 bg-green-100 border-l-4 border-green-500 text-green-700 p-4 rounded shadow-lg z-50';
                notification.innerHTML = `<div class="flex items-center">
                    <div class="py-1"><svg class="fill-current h-6 w-6 text-green-500 mr-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M2.93 17.07A10 10 0 1 1 17.07 2.93 10 10 0 0 1 2.93 17.07zm12.73-1.41A8 8 0 1 0 4.34 4.34a8 8 0 0 0 11.32 11.32zM9 11V9h2v6H9v-4zm0-6h2v2H9V5z"/></svg></div>
                    <div>
                        <p class="font-bold">Charts Created</p>
                        <p class="text-sm">Created ${validatedCharts.length} charts in ${sheetName}</p>
                    </div>
                </div>`;
                document.body.appendChild(notification);
                setTimeout(() => notification.remove(), 4000);
            }, 500);
            
            return;
        }
        
        // Handle single chart case (existing logic)
        if (!chartConfig) return;
        
        // Validate single chart data
        try {
            if (!chartConfig.data || !Array.isArray(chartConfig.data) || chartConfig.data.length === 0) {
                console.error("Invalid chart data:", chartConfig.data);
                return;
            }
            
            // Clean up data to ensure numeric values
            chartConfig.data = chartConfig.data.map(item => {
                const cleanItem = { ...item };
                // Keep name and group as is
                const nameValue = cleanItem.name;
                const groupValue = cleanItem.group;
                
                // Convert other properties to numbers if possible
                Object.keys(cleanItem).forEach(key => {
                    if (key !== 'name' && key !== 'group') {
                        const numVal = parseFloat(cleanItem[key]);
                        if (!isNaN(numVal)) {
                            cleanItem[key] = numVal;
                        } else if (cleanItem[key] === null || cleanItem[key] === undefined || cleanItem[key] === '') {
                            cleanItem[key] = 0;
                        }
                    }
                });
                
                // Restore name and group
                cleanItem.name = nameValue;
                if (groupValue) cleanItem.group = groupValue;
                
                return cleanItem;
            });
        } catch (error) {
            console.error("Error validating chart data:", error);
            return;
        }
        
        console.log("Creating chart:", {
            type: chartConfig?.type,
            dataPoints: chartConfig?.data?.length,
            source: sourceSheetId || activeSheetId
        });
        
        // Create a deep copy of the chart configuration
        const chartConfigCopy = JSON.parse(JSON.stringify(chartConfig));
        
        // Always create a new sheet for the chart
        const sheetCount = Object.keys(sheets).length + 1;
        const newSheetId = `sheet${Date.now()}`; // Use timestamp for unique ID
        
        // Create a more descriptive name based on chart type
        const chartTypeName = chartConfigCopy.type?.charAt(0).toUpperCase() + chartConfigCopy.type?.slice(1) || 'Chart';
        const chartTitle = chartConfigCopy.title || chartTypeName;
        const sheetName = `${chartTitle} ${sheetCount}`.substring(0, 20); // Limit length
        
        // Create initial empty data for the new sheet
        // Ensure we have enough rows and columns for the chart (default 50x10)
        const emptyData = Array(50).fill().map(() => Array(10).fill(''));
        
        // Create the new sheet
        const newSheets = {
            ...sheets,
            [newSheetId]: {
                id: newSheetId,
                name: sheetName,
                data: emptyData,
                activeCell: { row: 0, col: 0 }, // Place chart at the beginning of the sheet
                cellFormats: {}
            }
        };
        
        // First update sheets with the new sheet
        onUpdateSheetData(newSheets);
        
        // Switch to the new sheet
        onSheetChange(newSheetId);
        
        // Add a small delay to ensure the sheet switch is complete before creating the chart
        setTimeout(() => {
            if (dataGridRef.current) {
                // Create the chart at the top of the new sheet
                try {
                    dataGridRef.current.createChart(
                        chartConfigCopy.type,
                        { row: 0, col: 0 }, // Place at the beginning
                        chartConfigCopy
                    );
                    
                    console.log("Chart created in new sheet:", newSheetId);
                    
                    // Show notification
                    const notification = document.createElement('div');
                    notification.className = 'fixed bottom-4 right-4 bg-green-100 border-l-4 border-green-500 text-green-700 p-4 rounded shadow-lg z-50';
                    notification.innerHTML = `<div class="flex items-center">
                        <div class="py-1"><svg class="fill-current h-6 w-6 text-green-500 mr-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M2.93 17.07A10 10 0 1 1 17.07 2.93 10 10 0 0 1 2.93 17.07zm12.73-1.41A8 8 0 1 0 4.34 4.34a8 8 0 0 0 11.32 11.32zM9 11V9h2v6H9v-4zm0-6h2v2H9V5z"/></svg></div>
                        <div>
                            <p class="font-bold">Chart Created</p>
                            <p class="text-sm">Chart has been created in ${sheetName}</p>
                        </div>
                    </div>`;
                    document.body.appendChild(notification);
                    setTimeout(() => notification.remove(), 4000);
                } catch (error) {
                    console.error("Error creating chart:", error);
                    // Show error notification
                    const notification = document.createElement('div');
                    notification.className = 'fixed bottom-4 right-4 bg-red-100 border-l-4 border-red-500 text-red-700 p-4 rounded shadow-lg z-50';
                    notification.innerHTML = `<div class="flex items-center">
                        <div class="py-1"><svg class="fill-current h-6 w-6 text-red-500 mr-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M2.93 17.07A10 10 0 1 1 17.07 2.93 10 10 0 0 1 2.93 17.07zm12.73-1.41A8 8 0 1 0 4.34 4.34a8 8 0 0 0 11.32 11.32zM9 11V9h2v6H9v-4zm0-6h2v2H9V5z"/></svg></div>
                        <div>
                            <p class="font-bold">Error Creating Chart</p>
                            <p class="text-sm">${error.message || 'Unknown error'}</p>
                        </div>
                    </div>`;
                    document.body.appendChild(notification);
                    setTimeout(() => notification.remove(), 6000);
                }
            }
        }, 500);
    };
    

   // Update format handling function to work with sheets
// const handleFormatChange = (type, value) => {
//     if (!activeSheet?.activeCell) return;
    
//     const { row, col } = activeSheet.activeCell;
//     const cellKey = `${row}-${col}`;
    
//     // Get current cell formats for the active sheet
//     const cellFormats = activeSheet.cellFormats || {};
//     const currentFormat = cellFormats[cellKey] || {};
    
//     let newFormat = { ...currentFormat };
//     let newData = [...activeSheet.data];
//     let cellValue = activeSheet.data[row]?.[col];

//     switch (type) {
//         case 'toggleCommas':
//             if (!isNaN(parseFloat(cellValue))) {
//                 newFormat.useCommas = !currentFormat.useCommas;
//             }
//             break;
//         case 'decreaseDecimals':
//             newFormat.decimals = Math.max((currentFormat.decimals || 2) - 1, 0);
//             break;
//         case 'increaseDecimals':
//             newFormat.decimals = (currentFormat.decimals || 2) + 1;
//             break;
//         case 'currency':
//             newFormat.isCurrency = !currentFormat.isCurrency;
//             break;
//         case 'percentage':
//             if (!isNaN(parseFloat(cellValue))) {
//                 newFormat.isPercentage = !currentFormat.isPercentage;
//                 if (newFormat.isPercentage && !currentFormat.isPercentage) {
//                     newData[row][col] = parseFloat(cellValue) / 100;
//                 } else if (!newFormat.isPercentage && currentFormat.isPercentage) {
//                     newData[row][col] = parseFloat(cellValue) * 100;
//                 }
//             }
//             break;
//         case 'numberFormat':
//             // Handle general format reset
//             if (value === 'general') {
//                 // Reset all number formatting
//                 delete newFormat.useCommas;
//                 delete newFormat.decimals;
//                 delete newFormat.isCurrency;
//                 delete newFormat.isPercentage;
//             }
//             break;
//         case 'dateFormat':
//             // Apply date formatting
//             newFormat.dateFormat = value;
//             // If the cell doesn't contain a date, try to convert it
//             if (cellValue && !isNaN(Date.parse(cellValue))) {
                
//                 if (value === 'short') {
//                     newFormat.isDate = true;
//                     newFormat.dateType = 'short';
//                 } else if (value === 'long') {
//                     newFormat.isDate = true;
//                     newFormat.dateType = 'long';
//                 } else if (value === 'time') {
//                     newFormat.isDate = true;
//                     newFormat.dateType = 'time';
//                 }
//             }
//             break;
//         case 'bold':
//             newFormat.bold = !currentFormat.bold;
//             break;
//         case 'italic':
//             newFormat.italic = !currentFormat.italic;
//             break;
//         case 'underline':
//             newFormat.underline = !currentFormat.underline;
//             break;
//         case 'strikethrough':
//             newFormat.strikethrough = !currentFormat.strikethrough;
//             break;
//         case 'textColor':
//             newFormat.textColor = value;
//             break;
//         case 'fillColor':
//             newFormat.fillColor = value;
//             break;
//         case 'align':
//             newFormat.align = value;
//             break;
//         case 'border':
//             // Handle border styles
//             if (!newFormat.borders) newFormat.borders = {};
            
//             if (value === 'all') {
//                 newFormat.borders = { top: true, right: true, bottom: true, left: true };
//             } else if (value === 'outside') {
//                 newFormat.borders = { top: true, right: true, bottom: true, left: true, inside: false };
//             } else if (value === 'none') {
//                 newFormat.borders = {};
//             } else {
//                 // Set individual borders (top, bottom, left, right)
//                 newFormat.borders[value] = !newFormat.borders[value];
//             }
//             break;
//         case 'clear':
//             // Clear all formatting
//             newFormat = {};
//             break;
//         default:
//             // Keep existing format for unhandled types
//             return;
//     }

//     // Update the cell formats for this sheet
//     const updatedSheets = { ...sheets };
//     updatedSheets[activeSheetId].cellFormats = {
//         ...cellFormats,
//         [cellKey]: newFormat
//     };

//     // If data changed, update it too
//     if (newData !== activeSheet.data) {
//         updatedSheets[activeSheetId].data = newData;
//     }

//     onUpdateSheetData(updatedSheets);
// };
// Update this function in your Dashboard.js file

// Corrected handleFormatChange function for Dashboard.js

const handleFormatChange = (type, value) => {
    if (!activeSheet?.activeCell) return;
    
    // We need to check if there's a selection in the DataGrid component
    // Since selection state is managed in DataGrid, we'll need to communicate with it
    if (dataGridRef.current && dataGridRef.current.getSelection) {
        // Get the current selection from DataGrid if available
        const selection = dataGridRef.current.getSelection();
        
        // Create a copy of the sheets data and formats
        const updatedSheets = { ...sheets };
        const sheetData = [...activeSheet.data];
        const cellFormats = { ...(activeSheet.cellFormats || {}) };
        
        // Flag to track if data is modified (for percentage conversion, etc.)
        let dataModified = false;
        
        if (selection && selection.start && selection.end) {
            // Apply format to all cells in the selection
            const startRow = Math.min(selection.start.row, selection.end.row);
            const endRow = Math.max(selection.start.row, selection.end.row);
            const startCol = Math.min(selection.start.col, selection.end.col);
            const endCol = Math.max(selection.start.col, selection.end.col);
            
            // Process each cell in the selection
            for (let row = startRow; row <= endRow; row++) {
                for (let col = startCol; col <= endCol; col++) {
                    applyFormatToCell(row, col, type, value, sheetData, cellFormats, dataModified);
                }
            }
        } else {
            // If no selection is available, just format the active cell
            const { row, col } = activeSheet.activeCell;
            applyFormatToCell(row, col, type, value, sheetData, cellFormats, dataModified);
        }
        
        // Update the sheet with new formats and possibly modified data
        updatedSheets[activeSheetId] = {
            ...activeSheet,
            cellFormats: cellFormats,
            data: dataModified ? sheetData : activeSheet.data
        };
        
        // Update all sheets
        onUpdateSheetData(updatedSheets);
    } else {
        // Fallback to just formatting the active cell if DataGrid ref isn't available
        // This is your original formatting logic for a single cell
        const { row, col } = activeSheet.activeCell;
        const cellKey = `${row}-${col}`;
        
        // Get current cell formats for the active sheet
        const cellFormats = activeSheet.cellFormats || {};
        const currentFormat = cellFormats[cellKey] || {};
        
        let newFormat = { ...currentFormat };
        let newData = [...activeSheet.data];
        let cellValue = activeSheet.data[row]?.[col];

        switch (type) {
            case 'toggleCommas':
                if (!isNaN(parseFloat(cellValue))) {
                    newFormat.useCommas = !currentFormat.useCommas;
                }
                break;
            case 'decreaseDecimals':
                newFormat.decimals = Math.max((currentFormat.decimals || 2) - 1, 0);
                break;
            case 'increaseDecimals':
                newFormat.decimals = (currentFormat.decimals || 2) + 1;
                break;
            case 'currency':
                newFormat.isCurrency = !currentFormat.isCurrency;
                break;
            case 'percentage':
                if (!isNaN(parseFloat(cellValue))) {
                    newFormat.isPercentage = !currentFormat.isPercentage;
                    if (newFormat.isPercentage && !currentFormat.isPercentage) {
                        newData[row][col] = parseFloat(cellValue) / 100;
                    } else if (!newFormat.isPercentage && currentFormat.isPercentage) {
                        newData[row][col] = parseFloat(cellValue) * 100;
                    }
                }
                break;
            case 'numberFormat':
                // Handle general format reset
                if (value === 'general') {
                    // Reset all number formatting
                    delete newFormat.useCommas;
                    delete newFormat.decimals;
                    delete newFormat.isCurrency;
                    delete newFormat.isPercentage;
                }
                break;
            case 'dateFormat':
                // Apply date formatting
                newFormat.dateFormat = value;
                // If the cell doesn't contain a date, try to convert it
                if (cellValue && !isNaN(Date.parse(cellValue))) {
                    
                    if (value === 'short') {
                        newFormat.isDate = true;
                        newFormat.dateType = 'short';
                    } else if (value === 'long') {
                        newFormat.isDate = true;
                        newFormat.dateType = 'long';
                    } else if (value === 'time') {
                        newFormat.isDate = true;
                        newFormat.dateType = 'time';
                    }
                } else if (cellValue && !isNaN(parseFloat(cellValue))) {
                    // Try to handle Excel date serial numbers
                    newFormat.isDate = true;
                    newFormat.dateType = value;
                }
                break;
            case 'bold':
                newFormat.bold = !currentFormat.bold;
                break;
            case 'italic':
                newFormat.italic = !currentFormat.italic;
                break;
            case 'underline':
                newFormat.underline = !currentFormat.underline;
                break;
            case 'strikethrough':
                newFormat.strikethrough = !currentFormat.strikethrough;
                break;
            case 'textColor':
                newFormat.textColor = value;
                break;
            case 'fillColor':
                newFormat.fillColor = value;
                break;
            case 'align':
                newFormat.align = value;
                break;
            case 'border':
                // Handle border styles
                if (!newFormat.borders) newFormat.borders = {};
                
                if (value === 'all') {
                    newFormat.borders = { top: true, right: true, bottom: true, left: true };
                } else if (value === 'outside') {
                    newFormat.borders = { top: true, right: true, bottom: true, left: true, inside: false };
                } else if (value === 'none') {
                    newFormat.borders = {};
                } else {
                    // Set individual borders (top, bottom, left, right)
                    newFormat.borders[value] = !newFormat.borders[value];
                }
                break;
            case 'clear':
                // Clear all formatting
                newFormat = {};
                break;
            default:
                // Keep existing format for unhandled types
                return;
        }

        // Update the cell formats for this sheet
        const updatedSheets = { ...sheets };
        updatedSheets[activeSheetId].cellFormats = {
            ...cellFormats,
            [cellKey]: newFormat
        };

        // If data changed, update it too
        if (newData !== activeSheet.data) {
            updatedSheets[activeSheetId].data = newData;
        }

        onUpdateSheetData(updatedSheets);
    }
};

// Helper function to apply formatting to a single cell
function applyFormatToCell(row, col, type, value, sheetData, cellFormats, dataModified) {
    const cellKey = `${row}-${col}`;
    const currentFormat = cellFormats[cellKey] || {};
    let newFormat = { ...currentFormat };
    
    // Ensure the row exists
    if (!sheetData[row]) {
        sheetData[row] = [];
    }
    
    // Get the cell value
    const cellValue = sheetData[row][col];
    
    switch (type) {
        case 'toggleCommas':
            if (cellValue !== undefined && !isNaN(parseFloat(cellValue))) {
                newFormat.useCommas = !currentFormat.useCommas;
            }
            break;
        case 'decreaseDecimals':
            newFormat.decimals = Math.max((currentFormat.decimals || 2) - 1, 0);
            break;
        case 'increaseDecimals':
            newFormat.decimals = (currentFormat.decimals || 2) + 1;
            break;
        case 'currency':
            newFormat.isCurrency = !currentFormat.isCurrency;
            break;
        case 'percentage':
            if (cellValue !== undefined && !isNaN(parseFloat(cellValue))) {
                newFormat.isPercentage = !currentFormat.isPercentage;
                if (newFormat.isPercentage && !currentFormat.isPercentage) {
                    sheetData[row][col] = parseFloat(cellValue) / 100;
                    dataModified = true;
                } else if (!newFormat.isPercentage && currentFormat.isPercentage) {
                    sheetData[row][col] = parseFloat(cellValue) * 100;
                    dataModified = true;
                }
            }
            break;
        case 'numberFormat':
            // Handle general format reset
            if (value === 'general') {
                // Reset all number formatting
                delete newFormat.useCommas;
                delete newFormat.decimals;
                delete newFormat.isCurrency;
                delete newFormat.isPercentage;
                delete newFormat.isDate;
                delete newFormat.dateType;
            }
            break;
            case 'dateFormat':
                // Apply date formatting
                newFormat.dateFormat = value;
                newFormat.isDate = true;
                newFormat.dateType = value; // Store the specific format type (short, long, dd-mm-yyyy, etc.)
            
                // Try to handle different types of cell values that could be dates
                if (cellValue) {
                    // Handle special date objects (already detected as dates)
                    if (typeof cellValue === 'object' && cellValue.isDate) {
                        // Just update the format type, no need to re-validate
                        newFormat.isDate = true;
                        newFormat.dateType = value;
                    }
                    // Handle string dates (try to parse them)
                    else if (typeof cellValue === 'string' && !isNaN(Date.parse(cellValue))) {
                        // Regular date string - mark as date and set format type
                        newFormat.isDate = true;
                        newFormat.dateType = value;
                    }
                    // Handle potential Excel date serial numbers
                    else if (!isNaN(parseFloat(cellValue))) {
                        const numValue = parseFloat(cellValue);
                        // Only consider values in typical Excel date range
                        if (numValue > 0 && numValue < 50000) {
                            newFormat.isDate = true;
                            newFormat.dateType = value;
                        }
                    }
                }
                break;
        case 'bold':
            newFormat.bold = !currentFormat.bold;
            break;
        case 'italic':
            newFormat.italic = !currentFormat.italic;
            break;
        case 'underline':
            newFormat.underline = !currentFormat.underline;
            break;
        case 'strikethrough':
            newFormat.strikethrough = !currentFormat.strikethrough;
            break;
        case 'textColor':
            newFormat.textColor = value;
            break;
        case 'fillColor':
            newFormat.fillColor = value;
            break;
        case 'align':
            newFormat.align = value;
            break;
        case 'border':
            // Handle border styles
            if (!newFormat.borders) newFormat.borders = {};
            
            if (value === 'all') {
                newFormat.borders = { top: true, right: true, bottom: true, left: true };
            } else if (value === 'outside') {
                newFormat.borders = { top: true, right: true, bottom: true, left: true, inside: false };
            } else if (value === 'none') {
                newFormat.borders = {};
            } else {
                // Set individual borders (top, bottom, left, right)
                newFormat.borders[value] = !newFormat.borders[value];
            }
            break;
        case 'clear':
            // Clear all formatting
            newFormat = {};
            break;
        default:
            // Keep existing format for unhandled types
            return;
    }
    
    // Update the format for this cell
    cellFormats[cellKey] = newFormat;
}
    // Get current cell format for the active sheet
    const getCurrentFormat = () => {
        if (!activeSheet?.activeCell) return {};
        
        const { row, col } = activeSheet.activeCell;
        const cellKey = `${row}-${col}`;
        return (activeSheet.cellFormats || {})[cellKey] || {};
    };
// In Dashboard.js
// Add imperative handle method for filter updates
useImperativeHandle(ref, () => ({
    handleFormatChange: (type, value) => {
      handleFormatChange(type, value);
    },
    // Add new method
    updateFilters: (filters) => {
      // Directly update visible rows based on new filters
      if (dataGridRef.current) {
        // Tell DataGrid to update its visible rows
        dataGridRef.current.updateFilters(filters);
        
        // Update statistics immediately
        setTimeout(() => {
          handleVisibleRowsChange();
        }, 0);
      }
    }
  }));

    // Handle formula bar changes
    const handleFormulaChange = (value) => {
        setFormulaBar(value);
        
        if (activeSheet?.activeCell) {
            const { row, col } = activeSheet.activeCell;
            
            // Update the data for this sheet
            const updatedSheets = { ...sheets };
            const newData = [...activeSheet.data];
            
            // Ensure we have enough rows
            while (newData.length <= row) {
                newData.push([]);
            }
            
            // Ensure we have enough columns
            if (!newData[row]) newData[row] = [];
            while (newData[row].length <= col) {
                newData[row].push('');
            }
            
            newData[row][col] = value;
            updatedSheets[activeSheetId].data = newData;
            
            // Store formula if it is one
            if (value.startsWith('=')) {
                if (!updatedSheets[activeSheetId].formulas) {
                    updatedSheets[activeSheetId].formulas = {};
                }
                updatedSheets[activeSheetId].formulas[`${row}-${col}`] = value;
            } else if (updatedSheets[activeSheetId].formulas?.[`${row}-${col}`]) {
                // Remove formula if the cell no longer contains one
                delete updatedSheets[activeSheetId].formulas[`${row}-${col}`];
            }
            
            onUpdateSheetData(updatedSheets);
        }
    };

    return (
        <div className="flex flex-col h-[calc(100vh-48px)]">
            <div className="flex h-full">
                {/* Left sidebar - Chat interface (25% width) */}
                <div className="w-1/4 border-r border-gray-200 bg-gray-50 overflow-y-auto">
                <ChatInterface 
    data={activeSheet?.data || []}
    activeCell={activeSheet?.activeCell}
    onChartRequest={handleChartRequest}
    sheets={sheets}  // Pass the full sheets object
    activeSheetId={activeSheetId}
/>
                </div>

                {/* Right side - Spreadsheet (75% width) */}
                <div className="w-3/4 flex flex-col">
                    {/* Cell reference and formula bar */}
                    <div className="flex items-center px-2 h-8 border-b border-gray-200 bg-white">
                        <div className="flex items-center space-x-2 w-full">
                            <span className="w-16 px-2 text-sm text-gray-600">
                                {activeSheet?.activeCell ? 
                                    `${String.fromCharCode(65 + activeSheet.activeCell.col)}${activeSheet.activeCell.row + 1}` : 
                                    'A1'}
                            </span>
                            <span className="w-8 text-center text-gray-600">fx</span>
                            <input 
                                type="text" 
                                className="flex-1 px-2 text-sm border-none focus:outline-none focus:ring-1 focus:ring-blue-500"
                                placeholder="Enter formula or value"
                                value={formulaBar}
                                onChange={(e) => handleFormulaChange(e.target.value)}
                            />
                        </div>
                    </div>

                    {/* Toolbar */}
                    <div className="border-b border-gray-200 bg-gray-50">
                        <Toolbar 
                            onFormatChange={handleFormatChange}
                            activeCell={activeSheet?.activeCell}
                            currentFormat={getCurrentFormat()}
                        />
                    </div>

                    <div className="flex-1 overflow-auto bg-white">
                    <DataGrid 
                        ref={dataGridRef}
                        data={activeSheet?.data || []}
                        setData={(newData) => {
                            // Check if activeSheetId exists and is valid
                            if (!activeSheetId || !sheets[activeSheetId]) {
                                console.error('Cannot update data: active sheet not found', {
                                    activeSheetId,
                                    availableSheets: Object.keys(sheets)
                                });
                                return;
                            }
                            
                            const updatedSheets = { ...sheets };
                            updatedSheets[activeSheetId].data = newData;
                            onUpdateSheetData(updatedSheets);
                        }}
                        activeCell={activeSheet?.activeCell}
                        onCellClick={handleCellClick}
                        showHeaders={showHeaders}
                        showGridLines={showGridLines}
                        zoomLevel={zoomLevel}
                        cellFormats={activeSheet?.cellFormats || {}}
                        formulas={activeSheet?.formulas || {}}
                        selectedColumn={selectedColumn}
        onSelectedColumnChange={(column) => onToggleColumnFilter(column)}
        filters={activeSheet?.filters || {}}
        onApplyFilter={onApplyFilter}
        onVisibleRowsChange={handleVisibleRowsChange}
        onChartClipboard={onChartClipboard}
        activeSheetId={activeSheetId}
                    />
                </div>
                    
                    {/* Sheet tabs */}
                    <SheetTabs
                        sheets={sheets}
                        activeSheetId={activeSheetId}
                        onSheetChange={onSheetChange}
                        onAddSheet={onAddSheet}
                        onDeleteSheet={onDeleteSheet}
                        onRenameSheet={onRenameSheet}
                    />
                     <StatisticsPanel
                        visibleRows={visibleRows}
                        selectedRange={selectedRange}
                        data={activeSheet?.data || []}
                        filters={activeSheet?.filters || {}}
                    />
                </div>
            </div>

            {/* Pass these props up to Navbar through App.js */}
            <div style={{ display: 'none' }}>
                {/* This div is just to expose props to parent */}
            </div>
        </div>
    );
});

export default Dashboard;
