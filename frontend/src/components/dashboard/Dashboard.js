import { useState, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import DataGrid from './DataGrid';
import ChatInterface from '../chat/ChatInterface';
import Toolbar from './Toolbar';
import useSpreadsheetHistory from '../../hooks/useSpreadsheetHistory';

const Dashboard = ({ currentData, setCurrentData }) => {
    const [savedRecordId, setSavedRecordId] = useState(null);
    const dataGridRef = useRef(null);
    const { pushState, undo, redo, canUndo, canRedo } = useSpreadsheetHistory(currentData);
    const [activeCell, setActiveCell] = useState({ row: 0, col: 0 });

    const handleChartRequest = (chartType) => {
        if (dataGridRef.current && dataGridRef.current.createChartAtActiveCell) {
            dataGridRef.current.createChartAtActiveCell(chartType);
        }
    };

    const handleCellChange = (newData) => {
        setCurrentData(newData);
        pushState(newData);
    };

    const handleCellClick = (row, col) => {
        setActiveCell({ row, col });
    };

    return (
        <div className="flex h-[calc(100vh-48px)]">
            {/* Left sidebar - Chat interface (25% width) */}
            <div className="w-1/4 border-r border-gray-200 bg-gray-50 overflow-y-auto">
                <ChatInterface 
                    recordId={savedRecordId} 
                    data={currentData}
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
                    <Toolbar />
                </div>

                {/* Spreadsheet */}
                <div className="flex-1 overflow-auto bg-white">
                    <DataGrid 
                        ref={dataGridRef}
                        data={currentData}
                        setData={(newData) => handleCellChange(newData)}
                        onDataSaved={(data, recordId) => {
                            setSavedRecordId(recordId);
                        }}
                        activeCell={activeCell}
                        onCellClick={handleCellClick}
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
};

export default Dashboard; 