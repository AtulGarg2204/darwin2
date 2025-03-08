import React, { useState, useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import axios from 'axios';
import { useAuth } from '../../context/AuthContext';
import * as XLSX from 'xlsx';
import { 
  LineChart, Line, BarChart, Bar, PieChart, Pie, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer 
} from 'recharts';

const DataGrid = forwardRef(({ data, setData, activeCell, onCellClick }, ref) => {
    const [headers, setHeaders] = useState(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J']);
    const [fileName, setFileName] = useState('');
    const { token } = useAuth();
    const fileInputRef = useRef(null);
    const [chartDimensions, setChartDimensions] = useState({ width: 5, height: 5 }); // 5x5 chart size

    // Generate row numbers
    const rowNumbers = Array.from({ length: data.length }, (_, i) => i + 1);

    // Update headers when data changes
    useEffect(() => {
        if (data && data[0]) {
            const colCount = Math.max(...data.map(row => row.length));
            const newHeaders = Array.from({ length: colCount }, (_, i) => 
                String.fromCharCode(65 + i)
            );
            setHeaders(newHeaders);
        }
    }, [data]);

    const handleCellChange = (rowIndex, colIndex, value) => {
        const newData = [...data];
        newData[rowIndex][colIndex] = value;
        setData(newData);
    };

    const handleAddRow = () => {
        const newRow = Array(headers.length).fill('');
        setData([...data, newRow]);
    };

    const handleAddColumn = () => {
        const nextColLetter = String.fromCharCode(65 + headers.length);
        setHeaders([...headers, nextColLetter]);
        setData(data.map(row => [...row, '']));
    };

    const handlePaste = (e) => {
        e.preventDefault();
        const pasteData = e.clipboardData.getData('text');
        const rows = pasteData.split('\n').filter(row => row.trim() !== '');
        
        if (rows.length > 0) {
            const parsedData = rows.map(row => row.split('\t'));
            
            // Get starting position from active cell
            const startRow = activeCell.row;
            const startCol = activeCell.col;
            
            // Create a copy of the current data
            const newData = [...data];
            
            // Update data with pasted content
            parsedData.forEach((row, rowIndex) => {
                if (startRow + rowIndex >= newData.length) {
                    // Add new rows if needed
                    const emptyRow = Array(headers.length).fill('');
                    newData.push(emptyRow);
                }
                
                row.forEach((cell, colIndex) => {
                    if (startCol + colIndex >= headers.length) {
                        // Add new columns if needed
                        headers.push(String.fromCharCode(65 + headers.length));
                        newData.forEach(r => r.push(''));
                    }
                    
                    if (startRow + rowIndex < newData.length && startCol + colIndex < newData[0].length) {
                        newData[startRow + rowIndex][startCol + colIndex] = cell;
                    }
                });
            });
            
            setData(newData);
        }
    };

    const handleFileUpload = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        
        setFileName(file.name);
        
        const reader = new FileReader();
        reader.onload = (event) => {
            const content = event.target.result;
            
            if (file.name.endsWith('.csv')) {
                // Parse CSV
                const parsedData = content.split('\n')
                    .filter(row => row.trim() !== '')
                    .map(row => row.split(','));
                
                if (parsedData.length > 0) {
                    // Generate column headers (A, B, C, etc.)
                    const colCount = Math.max(...parsedData.map(row => row.length));
                    const newHeaders = Array.from({ length: colCount }, (_, i) => 
                        String.fromCharCode(65 + i)
                    );
                    
                    setHeaders(newHeaders);
                    setData(parsedData);
                }
            } else if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
                // Parse Excel using xlsx library
                try {
                    const workbook = XLSX.read(content, { type: 'binary' });
                    const sheetName = workbook.SheetNames[0];
                    const worksheet = workbook.Sheets[sheetName];
                    const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
                    
                    if (jsonData.length > 0) {
                        // Generate column headers (A, B, C, etc.)
                        const colCount = Math.max(...jsonData.map(row => row.length));
                        const newHeaders = Array.from({ length: colCount }, (_, i) => 
                            String.fromCharCode(65 + i)
                        );
                        
                        setHeaders(newHeaders);
                        setData(jsonData);
                    }
                } catch (error) {
                    console.error('Error parsing Excel file:', error);
                    alert('Error parsing Excel file. Please check the format.');
                }
            } else {
                alert('Unsupported file format. Please use CSV or Excel files.');
            }
        };
        
        if (file.name.endsWith('.csv')) {
            reader.readAsText(file);
        } else {
            reader.readAsBinaryString(file);
        }
    };

    const handleSave = async () => {
        try {
            const formattedData = data.map(row => {
                const rowData = {};
                headers.forEach((header, index) => {
                    rowData[header] = row[index] || '';
                });
                return rowData;
            });
            
            const response = await axios.post('http://localhost:5000/api/records', {
                data: formattedData,
                fileName: fileName || 'Untitled Data'
            }, {
                headers: {
                    'x-auth-token': token
                }
            });
            
            alert('Data saved successfully!');
        } catch (err) {
            console.error(err);
            alert('Error saving data');
        }
    };

    // Function to prepare chart data from the spreadsheet
    const prepareChartData = () => {
        if (!data || data.length < 2) return [];
        
        // Get data from columns A and B (indices 0 and 1)
        return data.filter(row => row[0] && row[1]).map(row => ({
            name: row[0],
            value: parseFloat(row[1]) || 0
        }));
    };
    
    // Function to create a chart at the active cell
    const createChartAtActiveCell = (chartType = 'line') => {
        if (!activeCell) return;
        
        const chartData = prepareChartData();
        if (chartData.length === 0) {
            alert("Please enter data in columns A and B before creating a chart");
            return;
        }
        
        const newData = [...data];
        
        // Ensure we have enough rows and columns
        while (newData.length <= activeCell.row + chartDimensions.height) {
            newData.push([]);
        }
        
        // Mark the starting cell with chart type
        newData[activeCell.row][activeCell.col] = `CHART:${chartType}:START`;
        
        // Mark other cells in the chart area as occupied
        for (let i = 0; i < chartDimensions.height; i++) {
            if (!newData[activeCell.row + i]) {
                newData[activeCell.row + i] = [];
            }
            
            for (let j = 0; j < chartDimensions.width; j++) {
                if (i === 0 && j === 0) continue; // Skip the start cell
                newData[activeCell.row + i][activeCell.col + j] = 'CHART:OCCUPIED';
            }
        }
        
        setData(newData);
    };
    
    // Function to render different chart types
    const renderChart = (chartType) => {
        const chartData = prepareChartData();
        
        const chartStyle = {
            position: 'absolute',
            top: '0',
            left: '0',
            width: `${chartDimensions.width * 120}px`,
            height: `${chartDimensions.height * 30}px`,
            backgroundColor: 'white',
            zIndex: 100,
            border: '1px solid #ddd',
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
            borderRadius: '4px',
            overflow: 'hidden'
        };
        
        return (
            <div className="chart-container" style={chartStyle}>
                <div className="chart-title" style={{
                    padding: '8px 12px',
                    borderBottom: '1px solid #eee',
                    fontWeight: 'bold',
                    backgroundColor: '#f9fafb'
                }}>
                    {chartType.charAt(0).toUpperCase() + chartType.slice(1)} Chart
                </div>
                <ResponsiveContainer width="100%" height="90%">
                    {chartType === 'line' && (
                        <LineChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 30 }}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="name" />
                            <YAxis />
                            <Tooltip />
                            <Legend />
                            <Line type="monotone" dataKey="value" stroke="#4f46e5" strokeWidth={2} />
                        </LineChart>
                    )}
                    {chartType === 'bar' && (
                        <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 30 }}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="name" />
                            <YAxis />
                            <Tooltip />
                            <Legend />
                            <Bar dataKey="value" fill="#4f46e5" />
                        </BarChart>
                    )}
                    {chartType === 'pie' && (
                        <PieChart margin={{ top: 20, right: 30, left: 20, bottom: 30 }}>
                            <Pie
                                data={chartData}
                                cx="50%"
                                cy="50%"
                                labelLine={true}
                                outerRadius={80}
                                fill="#8884d8"
                                dataKey="value"
                                nameKey="name"
                                label
                            />
                            <Tooltip />
                            <Legend />
                        </PieChart>
                    )}
                    {chartType === 'area' && (
                        <AreaChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 30 }}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="name" />
                            <YAxis />
                            <Tooltip />
                            <Legend />
                            <Area type="monotone" dataKey="value" stroke="#4f46e5" fill="#c7d2fe" />
                        </AreaChart>
                    )}
                </ResponsiveContainer>
            </div>
        );
    };
    
    // Function to get cell content based on cell value
    const getCellContent = (rowIndex, colIndex, cell) => {
        if (cell && cell.startsWith('CHART:')) {
            if (cell.includes(':START')) {
                const chartType = cell.split(':')[1];
                return renderChart(chartType);
            } else if (cell === 'CHART:OCCUPIED') {
                return null; // These cells are part of the chart but don't render anything
            }
        }
        
        return (
            <input
                type="text"
                value={cell || ''}
                onChange={(e) => handleCellChange(rowIndex, colIndex, e.target.value)}
                className="w-full h-6 px-1 border-0 focus:outline-none text-sm"
                onPaste={handlePaste}
            />
        );
    };

    // Expose functions to parent component
    useImperativeHandle(ref, () => ({
        createChartAtActiveCell
    }));

    return (
        <div className="h-full flex flex-col">
            {/* Hidden file input */}
            <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileUpload}
                accept=".csv,.xlsx,.xls"
                className="hidden"
            />
            
            {/* Excel-like grid */}
            <div className="flex-1 overflow-auto relative">
                <table className="border-collapse w-full">
                    <thead>
                        <tr>
                            {/* Empty corner cell */}
                            <th className="w-10 h-6 bg-gray-100 border border-gray-300 text-center text-xs font-normal text-gray-500"></th>
                            
                            {/* Column headers (A, B, C, etc.) */}
                            {headers.map((header, index) => (
                                <th 
                                    key={index} 
                                    className="w-24 h-6 bg-gray-100 border border-gray-300 text-center text-xs font-normal text-gray-500"
                                >
                                    {header}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {data.map((row, rowIndex) => (
                            <tr key={rowIndex}>
                                {/* Row number */}
                                <td className="w-10 bg-gray-100 border border-gray-300 text-center text-xs font-normal text-gray-500">
                                    {rowNumbers[rowIndex]}
                                </td>
                                
                                {/* Cells */}
                                {row.map((cell, colIndex) => (
                                    <td 
                                        key={colIndex} 
                                        className={`border border-gray-200 p-0 relative ${
                                            activeCell?.row === rowIndex && 
                                            activeCell?.col === colIndex 
                                                ? 'bg-blue-50 outline outline-2 outline-blue-500 z-10' 
                                                : ''
                                        } ${cell === 'CHART:OCCUPIED' ? 'bg-gray-50' : ''}`}
                                        onClick={() => onCellClick(rowIndex, colIndex)}
                                        style={{ 
                                            minWidth: '120px',
                                            height: '30px'
                                        }}
                                    >
                                        {getCellContent(rowIndex, colIndex, cell)}
                                    </td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            
            {/* Floating action buttons */}
            <div className="absolute bottom-8 right-8 flex space-x-2">
                <button
                    onClick={() => fileInputRef.current.click()}
                    className="bg-blue-600 text-white p-2 rounded-full shadow-lg hover:bg-blue-700"
                    title="Upload File"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM6.293 6.707a1 1 0 010-1.414l3-3a1 1 0 011.414 0l3 3a1 1 0 01-1.414 1.414L11 5.414V13a1 1 0 11-2 0V5.414L7.707 6.707a1 1 0 01-1.414 0z" clipRule="evenodd" />
                    </svg>
                </button>
                <button
                    onClick={handleSave}
                    className="bg-green-600 text-white p-2 rounded-full shadow-lg hover:bg-green-700"
                    title="Save Data"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                </button>
            </div>
        </div>
    );
});

export default DataGrid; 