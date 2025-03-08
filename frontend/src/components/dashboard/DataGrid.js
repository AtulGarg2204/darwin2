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
    const [chartConfig, setChartConfig] = useState(null);
    const CHART_SIZE = { width: 5, height: 5 }; // 5x5 chart size

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
        if (!newData[rowIndex]) {
            newData[rowIndex] = [];
        }
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

    // Function to prepare chart data
    const prepareChartData = () => {
        if (!data || data.length < 2) return [];
        return data.slice(0, data.length).map((row, index) => ({
            name: row[0] || `Row ${index + 1}`,
            value: parseFloat(row[1]) || 0
        }));
    };

    // Function to create chart
    const createChart = (type = 'bar', startCell = activeCell) => {
        if (!startCell) return;
        
        const newData = [...data];
        // Ensure we have enough rows and columns for the chart
        while (newData.length <= startCell.row + CHART_SIZE.height) {
            newData.push(Array(newData[0]?.length || 1).fill(''));
        }

        // Mark the chart area
        for (let i = 0; i < CHART_SIZE.height; i++) {
            for (let j = 0; j < CHART_SIZE.width; j++) {
                if (!newData[startCell.row + i]) {
                    newData[startCell.row + i] = [];
                }
                if (i === 0 && j === 0) {
                    newData[startCell.row][startCell.col] = `CHART:${type}:START`;
                } else {
                    newData[startCell.row + i][startCell.col + j] = 'CHART:OCCUPIED';
                }
            }
        }

        setData(newData);
        setChartConfig({
            type,
            startCell: { ...startCell },
            size: CHART_SIZE
        });
    };

    // Function to render chart
    const renderChart = (type, startCell) => {
        const chartData = prepareChartData();
        const chartStyle = {
            width: `${CHART_SIZE.width * 120}px`,
            height: `${CHART_SIZE.height * 25}px`,
            position: 'absolute',
            backgroundColor: 'white',
            border: '1px solid #ddd',
            borderRadius: '4px',
            overflow: 'hidden',
            zIndex: 10
        };

        return (
            <div style={chartStyle}>
                <ResponsiveContainer width="100%" height="100%">
                    {type === 'bar' && (
                        <BarChart data={chartData}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="name" />
                            <YAxis />
                            <Tooltip />
                            <Legend />
                            <Bar dataKey="value" fill="#8884d8" />
                        </BarChart>
                    )}
                    {type === 'line' && (
                        <LineChart data={chartData}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="name" />
                            <YAxis />
                            <Tooltip />
                            <Legend />
                            <Line type="monotone" dataKey="value" stroke="#8884d8" />
                        </LineChart>
                    )}
                    {/* Add other chart types as needed */}
                </ResponsiveContainer>
            </div>
        );
    };

    // Expose createChart to parent components
    useImperativeHandle(ref, () => ({
        createChart
    }));

    return (
        <div className="h-full flex flex-col relative">
            {/* Hidden file input */}
            <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileUpload}
                accept=".csv,.xlsx,.xls"
                className="hidden"
            />
            
            <div className="flex-1 overflow-auto">
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
                                        onClick={() => onCellClick(rowIndex, colIndex)}
                                        className={`border border-gray-200 p-1 relative ${
                                            activeCell?.row === rowIndex && 
                                            activeCell?.col === colIndex 
                                                ? 'bg-blue-50 outline outline-2 outline-blue-500' 
                                                : ''
                                        } ${cell === 'CHART:OCCUPIED' ? 'bg-gray-50' : ''}`}
                                        style={{ 
                                            minWidth: '120px',
                                            height: '25px'
                                        }}
                                    >
                                        {cell?.startsWith('CHART:') ? (
                                            cell.includes(':START') && 
                                            renderChart(
                                                cell.split(':')[1], 
                                                { row: rowIndex, col: colIndex }
                                            )
                                        ) : (
                                            <input
                                                type="text"
                                                value={cell || ''}
                                                onChange={(e) => handleCellChange(rowIndex, colIndex, e.target.value)}
                                                className="w-full border-none focus:outline-none bg-transparent"
                                                onPaste={handlePaste}
                                            />
                                        )}
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