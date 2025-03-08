import React, { useState, useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import axios from 'axios';
import { useAuth } from '../../context/AuthContext';
import * as XLSX from 'xlsx';
import { 
  LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer 
} from 'recharts';
import excelFunctions from "../../utils/ExcelFunctions";

const DataGrid = forwardRef(({ 
  data, 
  setData, 
  activeCell, 
  onCellClick,
  showHeaders,
  showGridLines,
  zoomLevel,
  cellFormats
}, ref) => {
    const [headers, setHeaders] = useState(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J']);
    const [fileName, setFileName] = useState('');
    const { token } = useAuth();
    const fileInputRef = useRef(null);
    const [chartConfig, setChartConfig] = useState(null);
    const CHART_SIZE = { width: 5, height: 5 }; // 5x5 chart size
    const [formulaBar, setFormulaBar] = useState('');
    const [formulas, setFormulas] = useState({});
   console.log(chartConfig);
    // Generate row numbers
   

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

    // Function to get range of cells (e.g., A1:A2)
    const getCellRange = (start, end) => {
        try {
            const startCol = start.match(/[A-Z]+/)[0];
            const startRow = parseInt(start.match(/[0-9]+/)[0]) - 1;
            const endCol = end.match(/[A-Z]+/)[0];
            const endRow = parseInt(end.match(/[0-9]+/)[0]) - 1;

            const startColIndex = startCol.split('').reduce((acc, char) => 
                acc * 26 + char.charCodeAt(0) - 'A'.charCodeAt(0), 0
            );
            const endColIndex = endCol.split('').reduce((acc, char) => 
                acc * 26 + char.charCodeAt(0) - 'A'.charCodeAt(0), 0
            );

            const values = [];
            for (let row = startRow; row <= endRow; row++) {
                for (let col = startColIndex; col <= endColIndex; col++) {
                    const value = parseFloat(data[row]?.[col]) || 0;
                    values.push(value);
                }
            }
            return values;
        } catch (error) {
            return [];
        }
    };

    // Excel functions
    const excelFunctions = {
        SUM: (values) => values.reduce((sum, val) => sum + (parseFloat(val) || 0), 0),
        AVERAGE: (values) => values.length ? excelFunctions.SUM(values) / values.length : 0,
        MAX: (values) => Math.max(...values.map(v => parseFloat(v) || 0)),
        MIN: (values) => Math.min(...values.map(v => parseFloat(v) || 0)),
        COUNT: (values) => values.filter(v => !isNaN(parseFloat(v))).length
    };

    // Function to get cell value from a reference like 'A1'
    const getCellValue = (cellRef) => {
        try {
            const col = cellRef.match(/[A-Z]+/)[0];
            const row = parseInt(cellRef.match(/[0-9]+/)[0]) - 1;
            const colIndex = col.split('').reduce((acc, char) => 
                acc * 26 + char.charCodeAt(0) - 'A'.charCodeAt(0), 0
            );
            const value = data[row]?.[colIndex];
            return parseFloat(value) || 0;
        } catch (error) {
            return 0;
        }
    };

    // Function to evaluate formula
    const evaluateFormula = (formula) => {
        if (!formula.startsWith('=')) return formula;

        try {
            // Check for Excel functions
            const functionMatch = formula.match(/^=([A-Z]+)\((.*)\)$/);
            if (functionMatch) {
                const [_, functionName, params] = functionMatch;
                const fn = excelFunctions[functionName];
                if (!fn) return '#NAME?';

                // Check for range notation (e.g., A1:A2)
                const rangeMatch = params.match(/([A-Z]+[0-9]+):([A-Z]+[0-9]+)/);
                if (rangeMatch) {
                    const [_, start, end] = rangeMatch;
                    const values = getCellRange(start, end);
                    return fn(values).toString();
                }

                // Handle comma-separated values
                const values = params.split(',').map(param => {
                    const cellRef = param.trim().match(/[A-Z]+[0-9]+/);
                    return cellRef ? getCellValue(cellRef[0]) : parseFloat(param.trim());
                });
                return fn(values).toString();
            }

            // Handle basic arithmetic
            let expression = formula.substring(1);
            expression = expression.replace(/[A-Z]+[0-9]+/g, (cellRef) => {
                return getCellValue(cellRef);
            });
            // eslint-disable-next-line no-eval
            const result = eval(expression);
            return isNaN(result) ? '#ERROR!' : result.toString();
        } catch (error) {
            return '#ERROR!';
        }
    };

    // // Function to get cell display value
    // const getCellDisplayValue = (rowIndex, colIndex) => {
    //     const cellKey = `${rowIndex}-${colIndex}`;
    //     const formula = formulas[cellKey];
    //     if (formula) {
    //         return evaluateFormula(formula);
    //     }
    //     return data[rowIndex]?.[colIndex] || '';
    // };

    // Modified handleCellChange
    const handleCellChange = (rowIndex, colIndex, value) => {
        const newData = [...data];
        if (!newData[rowIndex]) {
            newData[rowIndex] = [];
        }

        const cellKey = `${rowIndex}-${colIndex}`;

        if (value.startsWith('=')) {
            // Store the formula
            setFormulas(prev => ({
                ...prev,
                [cellKey]: value
            }));
            // Store the evaluated result in the data
            const result = evaluateFormula(value);
            newData[rowIndex][colIndex] = result;
        } else {
            // If it's not a formula, remove any stored formula and store the value
            const newFormulas = { ...formulas };
            delete newFormulas[cellKey];
            setFormulas(newFormulas);
            newData[rowIndex][colIndex] = value;
        }

        setData(newData);

        // Re-evaluate all formulas
        Object.entries(formulas).forEach(([key, formula]) => {
            const [r, c] = key.split('-').map(Number);
            if (r !== rowIndex || c !== colIndex) { // Don't re-evaluate the current cell
                newData[r][c] = evaluateFormula(formula);
            }
        });
    };

    // Add this effect to update formula results when data changes
    useEffect(() => {
        const newData = [...data];
        let hasChanges = false;

        Object.entries(formulas).forEach(([key, formula]) => {
            const [row, col] = key.split('-').map(Number);
            const result = evaluateFormula(formula);
            if (newData[row]?.[col] !== result) {
                if (!newData[row]) newData[row] = [];
                newData[row][col] = result;
                hasChanges = true;
            }
        });

        if (hasChanges) {
            setData(newData);
        }
    }, [data, formulas]);

    // Add keyboard navigation
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (activeCell) {
                const { key, shiftKey } = e;
                const { row, col } = activeCell;
                let newRow = row;
                let newCol = col;

                switch (key) {
                    case 'ArrowUp':
                        newRow = Math.max(0, row - 1);
                        e.preventDefault();
                        break;
                    case 'ArrowDown':
                        newRow = Math.min(data.length - 1, row + 1);
                        e.preventDefault();
                        break;
                    case 'ArrowLeft':
                        newCol = Math.max(0, col - 1);
                        e.preventDefault();
                        break;
                    case 'ArrowRight':
                        newCol = Math.min(headers.length - 1, col + 1);
                        e.preventDefault();
                        break;
                    case 'Tab':
                        newCol = shiftKey ? Math.max(0, col - 1) : Math.min(headers.length - 1, col + 1);
                        e.preventDefault();
                        break;
                    case 'Enter':
                        newRow = Math.min(data.length - 1, row + 1);
                        e.preventDefault();
                        break;
                }

                if (newRow !== row || newCol !== col) {
                    onCellClick(newRow, newCol);
                }
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [activeCell, data, headers.length]);

    // const handleAddRow = () => {
    //     const newRow = Array(headers.length).fill('');
    //     setData([...data, newRow]);
    // };

    // const handleAddColumn = () => {
    //     const nextColLetter = String.fromCharCode(65 + headers.length);
    //     setHeaders([...headers, nextColLetter]);
    //     setData(data.map(row => [...row, '']));
    // };

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

    // Add zoom style
    const gridStyle = {
        transform: `scale(${zoomLevel / 100})`,
        transformOrigin: '0 0',
        width: `${100 * (100 / zoomLevel)}%`
    };

    // Add this function to format cell values
    const formatCellValue = (value, rowIndex, colIndex) => {
        if (value === '' || value === null || value === undefined) return '';
        
        const format = cellFormats[`${rowIndex}-${colIndex}`] || {};
        let formattedValue = value;
        
        if (!isNaN(parseFloat(value))) {
            let numValue = parseFloat(value);
            
            if (format.isPercentage) {
                formattedValue = `${(numValue * 100).toFixed(format.decimals || 0)}%`;
            } else {
                if (format.useCommas) {
                    formattedValue = numValue.toLocaleString('en-US', {
                        minimumFractionDigits: format.decimals || 0,
                        maximumFractionDigits: format.decimals || 0
                    });
                } else {
                    formattedValue = numValue.toFixed(format.decimals || 0);
                }
                
                if (format.isCurrency) {
                    formattedValue = `$${formattedValue}`;
                }
            }
        }
        
        return formattedValue;
    };

    // Add this function to get cell styles
    const getCellStyle = (rowIndex, colIndex) => {
        const format = cellFormats[`${rowIndex}-${colIndex}`] || {};
        return {
            fontWeight: format.bold ? 'bold' : 'normal',
            fontStyle: format.italic ? 'italic' : 'normal',
            textDecoration: [
                format.underline && 'underline',
                format.strikethrough && 'line-through'
            ].filter(Boolean).join(' '),
            color: format.textColor || 'inherit',
            backgroundColor: format.fillColor || 'inherit',
            textAlign: format.align || 'left'
        };
    };

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
            
            {/* Add Formula Bar */}
            <div className="flex items-center px-2 py-1 border-b border-gray-200">
                <div className="flex items-center bg-white border border-gray-300 rounded px-2">
                    <span className="text-gray-500 mr-2">fx</span>
                    <input
                        type="text"
                        value={formulaBar}
                        onChange={(e) => {
                            setFormulaBar(e.target.value);
                            if (activeCell) {
                                handleCellChange(activeCell.row, activeCell.col, e.target.value);
                            }
                        }}
                        className="w-full outline-none py-1"
                        placeholder="Enter formula..."
                    />
                </div>
            </div>
            
            <div className="flex-1 overflow-auto">
                <table className="border-collapse w-full" style={gridStyle}>
                    {showHeaders && (
                        <thead>
                            <tr>
                                <th className="w-10 bg-gray-100 border border-gray-300"></th>
                                {headers.map((header, index) => (
                                    <th 
                                        key={index}
                                        className="w-24 bg-gray-100 border border-gray-300 text-center text-xs font-normal text-gray-500"
                                    >
                                        {header}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                    )}
                    <tbody>
                        {data.map((row, rowIndex) => (
                            <tr key={rowIndex}>
                                {showHeaders && (
                                    <td className="w-10 bg-gray-100 border border-gray-300 text-center text-xs font-normal text-gray-500">
                                        {rowIndex + 1}
                                    </td>
                                )}
                                {row.map((cell, colIndex) => (
                                    <td 
                                        key={colIndex}
                                        onClick={() => onCellClick(rowIndex, colIndex)}
                                        className={`
                                            ${showGridLines ? 'border border-gray-200' : 'border-0'} 
                                            p-1 relative
                                            ${activeCell?.row === rowIndex && 
                                            activeCell?.col === colIndex 
                                                ? 'bg-blue-50 outline outline-2 outline-blue-500' 
                                                : ''}
                                        `}
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
                                                value={
                                                    activeCell?.row === rowIndex && activeCell?.col === colIndex
                                                        ? data[rowIndex][colIndex] || ''
                                                        : formatCellValue(data[rowIndex][colIndex], rowIndex, colIndex)
                                                }
                                                onChange={(e) => handleCellChange(rowIndex, colIndex, e.target.value)}
                                                style={getCellStyle(rowIndex, colIndex)}
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