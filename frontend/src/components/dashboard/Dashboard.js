import { useState, useRef, forwardRef, useImperativeHandle } from 'react';

import DataGrid from './DataGrid';
import ChatInterface from '../chat/ChatInterface';
import Toolbar from './Toolbar';
import useSpreadsheetHistory from '../../hooks/useSpreadsheetHistory';

const Dashboard = forwardRef(({ 
    currentData, 
    setCurrentData, 
    activeCell, 
    setActiveCell,
    showHeaders,
    showGridLines,
    zoomLevel
}, ref) => {
    const [savedRecordId, setSavedRecordId] = useState(null);
    const dataGridRef = useRef();
    const {undo, redo,} = useSpreadsheetHistory(currentData);
    // Add state for cell formatting
    const [cellFormats, setCellFormats] = useState({});

    const handleCellClick = (row, col) => {
        setActiveCell({ row, col });
    };

    const handleChartRequest = (chartType) => {
        if (dataGridRef.current && activeCell) {
            dataGridRef.current.createChart(chartType, activeCell);
        }
    };

    // Add format handling function
    const handleFormatChange = (type, value) => {
        if (!activeCell) return;
        
        const cellKey = `${activeCell.row}-${activeCell.col}`;
        const currentFormat = cellFormats[cellKey] || {};
        let newFormat = { ...currentFormat };
        let newData = [...currentData];
        let cellValue = currentData[activeCell.row][activeCell.col];

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
                        newData[activeCell.row][activeCell.col] = parseFloat(cellValue) / 100;
                    } else if (!newFormat.isPercentage && currentFormat.isPercentage) {
                        newData[activeCell.row][activeCell.col] = parseFloat(cellValue) * 100;
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
        }

        setCellFormats({
            ...cellFormats,
            [cellKey]: newFormat
        });

        if (newData !== currentData) {
            setCurrentData(newData);
        }
    };

    // Get current cell format
    const getCurrentFormat = () => {
        if (!activeCell) return {};
        return cellFormats[`${activeCell.row}-${activeCell.col}`] || {};
    };

    // Add this to expose the formatting function to parent
    useImperativeHandle(ref, () => ({
        handleFormatChange: (type, value) => {
            if (!activeCell) return;
            // Update cell formatting
            const newFormats = { ...cellFormats };
            const cellKey = `${activeCell.row}-${activeCell.col}`;
            
            switch(type) {
                case 'bold':
                case 'italic':
                case 'underline':
                    newFormats[cellKey] = {
                        ...newFormats[cellKey],
                        [type]: !newFormats[cellKey]?.[type]
                    };
                    break;
                case 'align':
                case 'fillColor':
                case 'border':
                    newFormats[cellKey] = {
                        ...newFormats[cellKey],
                        [type]: value
                    };
                    break;
                case 'clear':
                    delete newFormats[cellKey];
                    break;
                // Add other cases as needed
            }
            
            setCellFormats(newFormats);
        }
    }));

    return (
        <div className="flex h-[calc(100vh-48px)]">
            {/* Left sidebar - Chat interface (25% width) */}
            <div className="w-1/4 border-r border-gray-200 bg-gray-50 overflow-y-auto">
                <ChatInterface 
                    data={currentData}
                    activeCell={activeCell}
                    onChartRequest={handleChartRequest}
                />
            </div>

            {/* Right side - Spreadsheet (75% width) */}
            <div className="w-3/4 flex flex-col">
                {/* Cell reference and formula bar */}
                <div className="flex items-center px-2 h-8 border-b border-gray-200 bg-white">
                    <div className="flex items-center space-x-2">
                        <span className="w-16 px-2 text-sm text-gray-600">A1</span>
                        <span className="w-8 text-center text-gray-600">fx</span>
                        <input 
                            type="text" 
                            className="flex-1 px-2 text-sm border-none focus:outline-none focus:ring-1 focus:ring-blue-500"
                            placeholder="Enter formula or value"
                        />
                    </div>
                </div>

                {/* Toolbar */}
                <div className="border-b border-gray-200 bg-gray-50">
                    <Toolbar 
                        onFormatChange={handleFormatChange}
                        activeCell={activeCell}
                        currentFormat={getCurrentFormat()}
                    />
                </div>

                {/* Spreadsheet */}
                <div className="flex-1 overflow-auto bg-white">
                    <DataGrid 
                        ref={dataGridRef}
                        data={currentData}
                        setData={setCurrentData}
                        onDataSaved={(data, recordId) => {
                            setSavedRecordId(recordId);
                        }}
                        activeCell={activeCell}
                        onCellClick={handleCellClick}
                        showHeaders={showHeaders}
                        showGridLines={showGridLines}
                        zoomLevel={zoomLevel}
                        cellFormats={cellFormats}
                    />
                </div>
            </div>

            {/* Pass these props up to Navbar through App.js */}
            <div style={{ display: 'none' }}>
                {/* This div is just to expose props to parent */}
                <button onClick={undo}>Undo</button>
                <button onClick={redo}>Redo</button>
            </div>
        </div>
    );
});

export default Dashboard; 