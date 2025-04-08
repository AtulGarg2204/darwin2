import { useState, useRef, forwardRef, useImperativeHandle } from 'react';

import DataGrid from './DataGrid';
import ChatInterface from '../chat/ChatInterface';
import Toolbar from './Toolbar';
import SheetTabs from './SheetTabs'; // New component


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
    zoomLevel
}, ref) => {
    const dataGridRef = useRef();
    
    // Get the active sheet
    const activeSheet = sheets[activeSheetId];
    
    // Add state for cell formatting (now per sheet)
    const [formulaBar, setFormulaBar] = useState('');
    
    const handleCellClick = (row, col) => {
        const newActiveCell = { row, col };
        setActiveCell(newActiveCell);
        
        // Update formula bar with cell content or formula
        const cellContent = activeSheet.data[row]?.[col] || '';
        const cellKey = `${row}-${col}`;
        const formula = activeSheet.formulas?.[cellKey];
        setFormulaBar(formula || cellContent);
    };
    
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
            
            // Create a new sheet specifically for statistical analysis
            const sheetCount = Object.keys(sheets).length + 1;
            const newSheetId = `sheet${Date.now()}`; // Use timestamp for unique ID
            
            // Create initial empty data for the new sheet (more rows for multiple charts)
            // Ensure we have enough rows and columns for multiple charts
            const emptyData = Array(100).fill().map(() => Array(20).fill(''));
            
            // Create the new sheet
            const newSheets = {
                ...sheets,
                [newSheetId]: {
                    id: newSheetId,
                    name: `Sheet ${sheetCount}`, // Name to indicate it's an analysis sheet
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
                    chartConfig.forEach((config, index) => {
                        // Calculate row and column position for this chart
                        const row = Math.floor(index / chartsPerRow) * (chartHeight + paddingRows);
                        const col = (index % chartsPerRow) * (chartWidth + paddingCols);
                        
                        // Ensure we have a deep copy of the chart config
                        const chartConfigCopy = JSON.parse(JSON.stringify(config));
                        
                        // Create the chart at the calculated position
                        dataGridRef.current.createChart(
                            chartConfigCopy.type || 'bar',
                            { row, col },
                            chartConfigCopy
                        );
                        
                        console.log(`Created chart ${index} at position (${row}, ${col})`);
                    });
                }
            }, 500);
            
            return;
        }
        
        // Handle single chart case (existing logic)
        if (!chartConfig) return;
        
        console.log("Creating chart:", {
            type: chartConfig?.type,
            dataPoints: chartConfig?.data?.length,
            source: sourceSheetId || activeSheetId,
            target: targetSheetId || "New Sheet" // Now defaults to new sheet
        });
        
        // Create a deep copy of the chart configuration
        const chartConfigCopy = JSON.parse(JSON.stringify(chartConfig));
        
        // If targetSheetId is specified, create chart in that sheet
        if (targetSheetId && sheets[targetSheetId]) {
            // If the target sheet is different from active, switch to it with a timeout
            if (targetSheetId !== activeSheetId) {
                // First switch to the target sheet
                onSheetChange(targetSheetId);
                
                // Then wait for the sheet change to take effect
                setTimeout(() => {
                    if (dataGridRef.current) {
                        // Get target cell in the new sheet
                        const targetCell = sheets[targetSheetId]?.activeCell || { row: 0, col: 0 };
                        
                        // Create the chart with the preserved configuration
                        dataGridRef.current.createChart(
                            chartConfigCopy.type, 
                            targetCell, 
                            chartConfigCopy
                        );
                    }
                }, 500); // Timeout for reliable sheet switching
            } else {
                // Same sheet, create chart immediately
                const targetCell = sheets[targetSheetId]?.activeCell || { row: 0, col: 0 };
                dataGridRef.current.createChart(chartConfigCopy.type, targetCell, chartConfigCopy);
            }
        } 
        // No target sheet specified - create a new sheet for the chart
        else {
            // Create a new sheet for the chart
            const sheetCount = Object.keys(sheets).length + 1;
            const newSheetId = `sheet${Date.now()}`; // Use timestamp for unique ID
            
            // Create initial empty data for the new sheet
            // Ensure we have enough rows and columns for the chart (default 50x10)
            const emptyData = Array(50).fill().map(() => Array(10).fill(''));
            
            // Create the new sheet
            const newSheets = {
                ...sheets,
                [newSheetId]: {
                    id: newSheetId,
                    name: `Sheet ${sheetCount}`, // Name to indicate it's a chart sheet
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
                    dataGridRef.current.createChart(
                        chartConfigCopy.type,
                        { row: 0, col: 0 }, // Place at the beginning
                        chartConfigCopy
                    );
                    
                    console.log("Chart created in new sheet:", newSheetId);
                }
            }, 500);
        }
    };
    

   // Update format handling function to work with sheets
const handleFormatChange = (type, value) => {
    if (!activeSheet?.activeCell) return;
    
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
                const date = new Date(cellValue);
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
};

    // Get current cell format for the active sheet
    const getCurrentFormat = () => {
        if (!activeSheet?.activeCell) return {};
        
        const { row, col } = activeSheet.activeCell;
        const cellKey = `${row}-${col}`;
        return (activeSheet.cellFormats || {})[cellKey] || {};
    };

    // Add this to expose the formatting function to parent
    useImperativeHandle(ref, () => ({
        handleFormatChange: (type, value) => {
            handleFormatChange(type, value);
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
