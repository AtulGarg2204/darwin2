// import { useState, useRef, forwardRef, useImperativeHandle } from 'react';

// import DataGrid from '../dashboard/DataGrid';
// import ChatInterface from '../chat/ChatInterface';
// import Toolbar from './Toolbar';
// import useSpreadsheetHistory from '../../hooks/useSpreadsheetHistory';

// const Dashboard = forwardRef(({ 
//     currentData, 
//     setCurrentData, 
//     activeCell, 
//     setActiveCell,
//     showHeaders,
//     showGridLines,
//     zoomLevel
// }, ref) => {
//     const dataGridRef = useRef();
//     const {undo, redo,} = useSpreadsheetHistory(currentData);
//     // Add state for cell formatting
//     const [cellFormats, setCellFormats] = useState({});

//     const handleCellClick = (row, col) => {
//         setActiveCell({ row, col });
//     };

//     // In Dashboard.jsx, update the handleChartRequest function
// const handleChartRequest = (chartConfig) => {
//     if (dataGridRef.current && activeCell) {
//         console.log("Creating chart with config:", chartConfig);
//         dataGridRef.current.createChart(chartConfig.type, activeCell, chartConfig);
//     }
// };

//     // Add format handling function
//     const handleFormatChange = (type, value) => {
//         if (!activeCell) return;
        
//         const cellKey = `${activeCell.row}-${activeCell.col}`;
//         const currentFormat = cellFormats[cellKey] || {};
//         let newFormat = { ...currentFormat };
//         let newData = [...currentData];
//         let cellValue = currentData[activeCell.row][activeCell.col];

//         switch (type) {
//             case 'toggleCommas':
//                 if (!isNaN(parseFloat(cellValue))) {
//                     newFormat.useCommas = !currentFormat.useCommas;
//                 }
//                 break;
//             case 'decreaseDecimals':
//                 newFormat.decimals = Math.max((currentFormat.decimals || 2) - 1, 0);
//                 break;
//             case 'increaseDecimals':
//                 newFormat.decimals = (currentFormat.decimals || 2) + 1;
//                 break;
//             case 'currency':
//                 newFormat.isCurrency = !currentFormat.isCurrency;
//                 break;
//             case 'percentage':
//                 if (!isNaN(parseFloat(cellValue))) {
//                     newFormat.isPercentage = !currentFormat.isPercentage;
//                     if (newFormat.isPercentage && !currentFormat.isPercentage) {
//                         newData[activeCell.row][activeCell.col] = parseFloat(cellValue) / 100;
//                     } else if (!newFormat.isPercentage && currentFormat.isPercentage) {
//                         newData[activeCell.row][activeCell.col] = parseFloat(cellValue) * 100;
//                     }
//                 }
//                 break;
//             case 'bold':
//                 newFormat.bold = !currentFormat.bold;
//                 break;
//             case 'italic':
//                 newFormat.italic = !currentFormat.italic;
//                 break;
//             case 'underline':
//                 newFormat.underline = !currentFormat.underline;
//                 break;
//             case 'strikethrough':
//                 newFormat.strikethrough = !currentFormat.strikethrough;
//                 break;
//             case 'textColor':
//                 newFormat.textColor = value;
//                 break;
//             case 'fillColor':
//                 newFormat.fillColor = value;
//                 break;
//             case 'align':
//                 newFormat.align = value;
//                 break;
//             default:
//                 // Keep existing format for unhandled types
//                 return;
//         }

//         setCellFormats({
//             ...cellFormats,
//             [cellKey]: newFormat
//         });

//         if (newData !== currentData) {
//             setCurrentData(newData);
//         }
//     };

//     // Get current cell format
//     const getCurrentFormat = () => {
//         if (!activeCell) return {};
//         return cellFormats[`${activeCell.row}-${activeCell.col}`] || {};
//     };

//     // Add this to expose the formatting function to parent
//     useImperativeHandle(ref, () => ({
//         handleFormatChange: (type, value) => {
//             if (!activeCell) return;
//             // Update cell formatting
//             const newFormats = { ...cellFormats };
//             const cellKey = `${activeCell.row}-${activeCell.col}`;
            
//             switch(type) {
//                 case 'bold':
//                 case 'italic':
//                 case 'underline':
//                     newFormats[cellKey] = {
//                         ...newFormats[cellKey],
//                         [type]: !newFormats[cellKey]?.[type]
//                     };
//                     break;
//                 case 'align':
//                 case 'fillColor':
//                 case 'border':
//                     newFormats[cellKey] = {
//                         ...newFormats[cellKey],
//                         [type]: value
//                     };
//                     break;
//                 case 'clear':
//                     delete newFormats[cellKey];
//                     break;
//                 default:
//                     // Keep existing format for unhandled types
//                     return;
//             }
            
//             setCellFormats(newFormats);
//         }
//     }));

//     return (
//         <div className="flex h-[calc(100vh-48px)]">
//             {/* Left sidebar - Chat interface (25% width) */}
//             <div className="w-1/4 border-r border-gray-200 bg-gray-50 overflow-y-auto">
//                 <ChatInterface 
//                     data={currentData}
//                     activeCell={activeCell}
//                     onChartRequest={handleChartRequest}
//                 />
//             </div>

//             {/* Right side - Spreadsheet (75% width) */}
//             <div className="w-3/4 flex flex-col">
//                 {/* Cell reference and formula bar */}
//                 <div className="flex items-center px-2 h-8 border-b border-gray-200 bg-white">
//                     <div className="flex items-center space-x-2">
//                         <span className="w-16 px-2 text-sm text-gray-600">A1</span>
//                         <span className="w-8 text-center text-gray-600">fx</span>
//                         <input 
//                             type="text" 
//                             className="flex-1 px-2 text-sm border-none focus:outline-none focus:ring-1 focus:ring-blue-500"
//                             placeholder="Enter formula or value"
//                         />
//                     </div>
//                 </div>

//                 {/* Toolbar */}
//                 <div className="border-b border-gray-200 bg-gray-50">
//                     <Toolbar 
//                         onFormatChange={handleFormatChange}
//                         activeCell={activeCell}
//                         currentFormat={getCurrentFormat()}
//                     />
//                 </div>

//                 {/* Spreadsheet */}
//                 <div className="flex-1 overflow-auto bg-white">
//                     <DataGrid 
//                         ref={dataGridRef}
//                         data={currentData}
//                         setData={setCurrentData}
//                         activeCell={activeCell}
//                         onCellClick={handleCellClick}
//                         showHeaders={showHeaders}
//                         showGridLines={showGridLines}
//                         zoomLevel={zoomLevel}
//                         cellFormats={cellFormats}
//                     />
//                 </div>
//             </div>

//             {/* Pass these props up to Navbar through App.js */}
//             <div style={{ display: 'none' }}>
//                 {/* This div is just to expose props to parent */}
//                 <button onClick={undo}>Undo</button>
//                 <button onClick={redo}>Redo</button>
//             </div>
//         </div>
//     );
// });

// export default Dashboard; 
import { useState, useRef, forwardRef, useImperativeHandle } from 'react';

import DataGrid from '../dashboard/DataGrid';
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
    // const handleChartRequest = (chartConfig) => {
    //     if (dataGridRef.current && activeSheet.activeCell) {
    //         console.log("Creating chart with config:", chartConfig);
    //         dataGridRef.current.createChart(chartConfig.type, activeSheet.activeCell, chartConfig);
    //     }
    // };
    const handleChartRequest = (chartConfig, sourceSheetId, targetSheetId) => {
        if (!dataGridRef.current) return;
        
        console.log("Creating chart:", {
            type: chartConfig?.type,
            dataPoints: chartConfig?.data?.length,
            source: sourceSheetId || activeSheetId,
            target: targetSheetId || activeSheetId
        });
        
        // Create a deep copy of the chart configuration
        const chartConfigCopy = JSON.parse(JSON.stringify(chartConfig));
        
        // Determine final source and target sheet IDs
      
        const finalTargetId = targetSheetId || activeSheetId;
        
        // If the target sheet is different from active, switch to it with a timeout
        if (finalTargetId !== activeSheetId) {
            // First switch to the target sheet
            onSheetChange(finalTargetId);
            
            // Then wait for the sheet change to take effect
            setTimeout(() => {
                if (dataGridRef.current) {
                    // Get target cell in the new sheet
                    const targetCell = sheets[finalTargetId]?.activeCell || { row: 0, col: 0 };
                    
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
            const targetCell = sheets[finalTargetId]?.activeCell || { row: 0, col: 0 };
            dataGridRef.current.createChart(chartConfigCopy.type, targetCell, chartConfigCopy);
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

                    {/* Spreadsheet */}
                    <div className="flex-1 overflow-auto bg-white">
                        <DataGrid 
                            ref={dataGridRef}
                            data={activeSheet?.data || []}
                            setData={(newData) => {
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