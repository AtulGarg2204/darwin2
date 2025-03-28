import React, { useState, useEffect, useRef, forwardRef, useImperativeHandle, useCallback } from 'react';
import axios from 'axios';
import { useAuth } from '../../context/AuthContext';
import * as XLSX from 'xlsx';
import {
    LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
    XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, AreaChart, Area,
    RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
    ScatterChart, Scatter, RadialBarChart, RadialBar,
    ComposedChart, Treemap
} from 'recharts';
import excelFunctions from "../../utils/ExcelFunctions";

// Set minimum visible rows and columns
const MIN_VISIBLE_ROWS = 50;
const MIN_VISIBLE_COLS = 10;

// Add these constants at the top with other constants
const CELL_WIDTH = 120; // Fixed cell width in pixels
const CELL_HEIGHT = 32; // Fixed cell height in pixels
const ROW_HEADER_WIDTH = 50; // Fixed width for row numbers column

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
    const [headers, setHeaders] = useState(Array.from({ length: MIN_VISIBLE_COLS }, (_, i) => String.fromCharCode(65 + i)));
    const [fileName, setFileName] = useState('');
    const { token } = useAuth();
    const fileInputRef = useRef(null);

    const CHART_SIZE = { width: 5, height: 15 }; // 5x5 chart size
    const [formulaBar, setFormulaBar] = useState('');
    const [isEditing, setIsEditing] = useState(false);
    const [formulas, setFormulas] = useState({});
  
    const [visibleCols, setVisibleCols] = useState(MIN_VISIBLE_COLS);
    const gridRef = useRef(null);

    const [selectionStart, setSelectionStart] = useState(null);
    const [selectionEnd, setSelectionEnd] = useState(null);
    const [isSelecting, setIsSelecting] = useState(false);
   
    // Initialize with minimum number of rows and columns
    useEffect(() => {
        // Initialize with empty data if not provided
        if (!data || data.length === 0) {
            const initialData = Array(MIN_VISIBLE_ROWS).fill().map(() => Array(MIN_VISIBLE_COLS).fill(''));
            setData(initialData);
        } else if (data.length < MIN_VISIBLE_ROWS || Math.max(...data.map(row => row.length)) < MIN_VISIBLE_COLS) {
            // Ensure we have at least the minimum rows and columns
            const newData = [...data];
            
            // Expand to minimum rows
            while (newData.length < MIN_VISIBLE_ROWS) {
                newData.push(Array(Math.max(MIN_VISIBLE_COLS, data[0]?.length || 0)).fill(''));
            }
            
            // Expand each row to minimum columns
            newData.forEach((row, index) => {
                if (row.length < MIN_VISIBLE_COLS) {
                    newData[index] = [...row, ...Array(MIN_VISIBLE_COLS - row.length).fill('')];
                }
            });
            
            setData(newData);
        }
    }, [data, setData]);

    // Function to handle scrolling near edges to expand grid
    const handleScroll = () => {
        if (!gridRef.current) return;
        const { scrollTop, scrollHeight, clientHeight, scrollLeft, scrollWidth, clientWidth } = gridRef.current;
        const scrollBottom = scrollHeight - scrollTop - clientHeight;
        const scrollRight = scrollWidth - scrollLeft - clientWidth;
        
        // Add more rows if we're near the bottom
        if (scrollBottom < 200) {
            expandGrid(20, 0); // Add 20 more rows
        }
        
        // Add more columns if we're near the right edge
        if (scrollRight < 200) {
            expandGrid(0, 10); // Add 10 more columns
        }
    };
    
    // Function to expand the grid
  
    
    // Function to generate column headers beyond Z (AA, AB, etc.)
    const generateColumnLabel = useCallback((index) => {
        let label = '';
        let i = index;
        
        do {
            label = String.fromCharCode(65 + (i % 26)) + label;
            i = Math.floor(i / 26) - 1;
        } while (i >= 0);
        
        return label;
    }, []);
    const expandGrid = useCallback((addRows, addCols) => {
        if (addRows > 0) {
           
            const newData = [...data];
            
            // Add new rows
            for (let i = 0; i < addRows; i++) {
                newData.push(Array(headers.length).fill(''));
            }
            
            setData(newData);
           
        }
        
        if (addCols > 0) {
            const currentColCount = headers.length;
            const newHeaders = [...headers];
            
            // Generate new column headers beyond Z
            for (let i = 0; i < addCols; i++) {
                newHeaders.push(generateColumnLabel(currentColCount + i));
            }
            
            // Expand each row with new columns
            const newData = data.map(row => [...row, ...Array(addCols).fill('')]);
            
            setHeaders(newHeaders);
            setData(newData);
            setVisibleCols(currentColCount + addCols);
        }
    }, [data,setData, generateColumnLabel,headers]);
    // Update headers when data changes
    useEffect(() => {
        if (data && data[0]) {
            const colCount = Math.max(...data.map(row => row.length));
            if (colCount > headers.length) {
                const newHeaders = Array.from({ length: colCount }, (_, i) => generateColumnLabel(i));
                setHeaders(newHeaders);
                setVisibleCols(colCount);
            }
        }
    }, [data, headers.length, generateColumnLabel]);

    // Function to get range of cells (e.g., A1:A2)
    const getCellRange = useCallback((start, end) => {
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
    }, [data]);

    // Function to get cell value from a reference like 'A1'
    const getCellValue = useCallback((cellRef) => {
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
    }, [data]);
   
    // Helper function to apply operators
    const applyOperator = useCallback((a, b, operator) => {
        switch (operator) {
            case '+': return a + b;
            case '-': return a - b;
            case '*': return a * b;
            case '/': return b !== 0 ? a / b : NaN;
            default: return NaN;
        }
    }, []);

    // Add this helper function for safe mathematical expression evaluation
    const evaluateMathExpression = useCallback((expression) => {
        try {
            // Remove all spaces and convert to lowercase
            expression = expression.replace(/\s+/g, '').toLowerCase();
            
            // Split the expression into tokens
            const tokens = expression.match(/(\d*\.?\d+|[+\-*/()])/g) || [];
            
            // Stack for numbers and operators
            const numbers = [];
            const operators = [];
            
            // Operator precedence
            const precedence = {
                '+': 1,
                '-': 1,
                '*': 2,
                '/': 2
            };
            
            // Process each token
            for (let i = 0; i < tokens.length; i++) {
                const token = tokens[i];
                
                if (!isNaN(token) || token.includes('.')) {
                    // If it's a number, push to numbers stack
                    numbers.push(parseFloat(token));
                } else if (token === '(') {
                    // If it's an opening parenthesis, push to operators stack
                    operators.push(token);
                } else if (token === ')') {
                    // If it's a closing parenthesis, process until we find matching opening parenthesis
                    while (operators.length > 0 && operators[operators.length - 1] !== '(') {
                        const operator = operators.pop();
                        const b = numbers.pop();
                        const a = numbers.pop();
                        numbers.push(applyOperator(a, b, operator));
                    }
                    operators.pop(); // Remove the opening parenthesis
                } else if (['+', '-', '*', '/'].includes(token)) {
                    // If it's an operator, process higher precedence operators first
                    while (operators.length > 0 && 
                           operators[operators.length - 1] !== '(' && 
                           precedence[operators[operators.length - 1]] >= precedence[token]) {
                        const operator = operators.pop();
                        const b = numbers.pop();
                        const a = numbers.pop();
                        numbers.push(applyOperator(a, b, operator));
                    }
                    operators.push(token);
                }
            }
            
            // Process remaining operators
            while (operators.length > 0) {
                const operator = operators.pop();
                const b = numbers.pop();
                const a = numbers.pop();
                numbers.push(applyOperator(a, b, operator));
            }
            
            return numbers[0];
        } catch (error) {
            console.error('Math expression evaluation error:', error);
            return NaN;
        }
    }, [applyOperator]);

    const evaluateFormula = useCallback((formula) => {
        if (!formula.startsWith('=')) return formula;

        try {
            // Check for Excel functions
            const functionMatch = formula.match(/^=([A-Z]+)\((.*)\)$/);
            if (functionMatch) {
                const [functionName, params] = functionMatch;
                const fn = excelFunctions[functionName];
                if (!fn) return '#NAME?';

                // Check for range notation (e.g., A1:A2)
                const rangeMatch = params.match(/([A-Z]+[0-9]+):([A-Z]+[0-9]+)/);
                if (rangeMatch) {
                    const [start, end] = rangeMatch;
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
            
            // Evaluate the expression safely
            const result = evaluateMathExpression(expression);
            return isNaN(result) ? '#ERROR!' : result.toString();
        } catch (error) {
            console.error('Formula evaluation error:', error);
            return '#ERROR!';
        }
    }, [getCellRange, getCellValue, evaluateMathExpression]);

    const handleCellChange = (rowIndex, colIndex, value) => {
        const newData = [...data];
        if (!newData[rowIndex]) {
            newData[rowIndex] = [];
        }

        const cellKey = `${rowIndex}-${colIndex}`;

        if (value.startsWith('=')) {
            // If it's just '=' or we're still typing the formula, store the raw value
            if (value === '=' || isEditing) {
                newData[rowIndex][colIndex] = value;
                setFormulas(prev => ({
                    ...prev,
                    [cellKey]: value
                }));
            } else {
                // Only evaluate if it's a complete formula
                setFormulas(prev => ({
                    ...prev,
                    [cellKey]: value
                }));
                const result = evaluateFormula(value);
                newData[rowIndex][colIndex] = result;
            }
        } else {
            // If it's not a formula, remove any stored formula and store the value
            const newFormulas = { ...formulas };
            delete newFormulas[cellKey];
            setFormulas(newFormulas);
        newData[rowIndex][colIndex] = value;
        }

        setData(newData);

        // Re-evaluate all formulas except the current cell
        Object.entries(formulas).forEach(([key, formula]) => {
            const [r, c] = key.split('-').map(Number);
            if (r !== rowIndex || c !== colIndex) {
                newData[r][c] = evaluateFormula(formula);
            }
        });
    };

    // // Add this effect to update formula results when data changes
    // useEffect(() => {
    //     const newData = [...data];
    //     let hasChanges = false;

    //     Object.entries(formulas).forEach(([key, formula]) => {
    //         const [row, col] = key.split('-').map(Number);
    //         const result = evaluateFormula(formula);
    //         if (newData[row]?.[col] !== result) {
    //             if (!newData[row]) newData[row] = [];
    //             newData[row][col] = result;
    //             hasChanges = true;
    //         }
    //     });

    //     if (hasChanges) {
    //         setData(newData);
    //     }
    // }, [data, formulas,setData,evaluateFormula]);
    useEffect(() => {
        const newData = [...data];
        let hasChanges = false;
    
        Object.entries(formulas || {}).forEach(([key, formula]) => {
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
    }, [data, formulas, setData, evaluateFormula]);

    // Add keyboard navigation with expansion capability
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
                        newRow = row + 1;
                        // Expand if at the bottom
                        if (newRow >= data.length) {
                            expandGrid(10, 0);
                        }
                        e.preventDefault();
                        break;
                    case 'ArrowLeft':
                        newCol = Math.max(0, col - 1);
                        e.preventDefault();
                        break;
                    case 'ArrowRight':
                        newCol = col + 1;
                        // Expand if at the right edge
                        if (newCol >= headers.length) {
                            expandGrid(0, 5);
                        }
                        e.preventDefault();
                        break;
                    case 'Tab':
                        newCol = shiftKey ? Math.max(0, col - 1) : col + 1;
                        // Expand if needed
                        if (newCol >= headers.length) {
                            expandGrid(0, 5);
                        }
                        e.preventDefault();
                        break;
                    case 'Enter':
                        newRow = row + 1;
                        // Expand if needed
                        if (newRow >= data.length) {
                            expandGrid(10, 0);
                        }
                        e.preventDefault();
                        break;
                    default:
                        // Let other keys be handled by the browser
                        return;
                }

                if (newRow !== row || newCol !== col) {
                    onCellClick(newRow, newCol);
                }
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [activeCell, data, headers.length,expandGrid, onCellClick]);



    // Handle mouse events for selection
    const handleMouseDown = (rowIndex, colIndex, e) => {
     
        setIsSelecting(true);
        setSelectionStart({ row: rowIndex, col: colIndex });
        setSelectionEnd({ row: rowIndex, col: colIndex });
        onCellClick(rowIndex, colIndex);
    };

    const handleMouseMove = (rowIndex, colIndex) => {
        if (isSelecting) {
          
            setSelectionEnd({ row: rowIndex, col: colIndex });
        }
    };

    const handleMouseUp = () => {
       
        setIsSelecting(false);
    };

    // Function to check if a cell is within selection
    const isCellSelected = (rowIndex, colIndex) => {
        if (!selectionStart || !selectionEnd) return false;
        
        const startRow = Math.min(selectionStart.row, selectionEnd.row);
        const endRow = Math.max(selectionStart.row, selectionEnd.row);
        const startCol = Math.min(selectionStart.col, selectionEnd.col);
        const endCol = Math.max(selectionStart.col, selectionEnd.col);
        
        return rowIndex >= startRow && rowIndex <= endRow && 
               colIndex >= startCol && colIndex <= endCol;
    };

    // Create stable callback functions for clipboard operations
    const handleCopyCallback = useCallback((e) => {
        e.preventDefault();

        
        // If no selection, use active cell
        const startRow = selectionStart ? Math.min(selectionStart.row, selectionEnd.row) : activeCell.row;
        const endRow = selectionStart ? Math.max(selectionStart.row, selectionEnd.row) : activeCell.row;
        const startCol = selectionStart ? Math.min(selectionStart.col, selectionEnd.col) : activeCell.col;
        const endCol = selectionStart ? Math.max(selectionStart.col, selectionEnd.col) : activeCell.col;

  

        const selectedData = [];
        for (let i = startRow; i <= endRow; i++) {
            const row = [];
            for (let j = startCol; j <= endCol; j++) {
                row.push(data[i]?.[j] || '');
            }
            selectedData.push(row.join('\t'));
        }
        const copyText = selectedData.join('\n');

        navigator.clipboard.writeText(copyText).catch(err => {
            console.error('Failed to copy:', err);
            // Fallback
            e.clipboardData.setData('text/plain', copyText);
        });
    }, [data, selectionStart, selectionEnd, activeCell]);

    const handleCutCallback = useCallback((e) => {
        e.preventDefault();
    
        
        handleCopyCallback(e);
        
        // If no selection, use active cell
        const startRow = selectionStart ? Math.min(selectionStart.row, selectionEnd.row) : activeCell.row;
        const endRow = selectionStart ? Math.max(selectionStart.row, selectionEnd.row) : activeCell.row;
        const startCol = selectionStart ? Math.min(selectionStart.col, selectionEnd.col) : activeCell.col;
        const endCol = selectionStart ? Math.max(selectionStart.col, selectionEnd.col) : activeCell.col;

        const newData = [...data];
        for (let i = startRow; i <= endRow; i++) {
            for (let j = startCol; j <= endCol; j++) {
                if (newData[i]) {
                    newData[i][j] = '';
                }
            }
        }
        setData(newData);
    }, [data, selectionStart, selectionEnd, activeCell, handleCopyCallback, setData]);
// In DataGrid.jsx 
const handlePasteCallback = useCallback(async (e) => {
    e.preventDefault();
    
    if (!activeCell) {
        console.log("No active cell selected for paste operation");
        return;
    }

    let pasteData;
    try {
        // Try various clipboard access methods
        if (e.clipboardData) {
            pasteData = e.clipboardData.getData('text');
        } else if (window.clipboardData) {
            pasteData = window.clipboardData.getData('text');
        } else {
            pasteData = await navigator.clipboard.readText();
        }
        
        if (!pasteData) {
            console.error('No data in clipboard');
            return;
        }
    } catch (error) {
        console.error('Failed to get clipboard data:', error);
        try {
            pasteData = await navigator.clipboard.readText();
        } catch (err) {
            console.error('All clipboard methods failed:', err);
            return;
        }
    }
    
    console.log("Raw paste data:", pasteData.slice(0, 100) + "...");
    
    // Split by newline first
    const rows = pasteData.split(/[\r\n]+/).filter(row => row.trim() !== '');
    console.log(`Detected ${rows.length} rows in pasted data`);

    const startRow = activeCell.row;
    const startCol = activeCell.col;
    const newData = [...data];
    
    // Detect if data is tab-delimited or CSV
    const isTabDelimited = pasteData.includes('\t');
    console.log(`Data appears to be ${isTabDelimited ? 'tab-delimited' : 'comma-separated'}`);
    
    // Parse the pasted data
    rows.forEach((row, rowIndex) => {
        console.log(`Processing row ${rowIndex}: ${row.slice(0, 50)}...`);
        
        let cells;
        if (isTabDelimited) {
            // For tab-delimited data (from Excel, Google Sheets)
            cells = row.split('\t');
            console.log(`Split into ${cells.length} cells by tabs`);
        } else {
            // For CSV data, use a proper parser that respects quotes
            cells = [];
            let inQuote = false;
            let currentCell = '';
            
            // Parse CSV with proper quote handling
            for (let i = 0; i < row.length; i++) {
                const char = row[i];
                
                if (char === '"') {
                    if (i + 1 < row.length && row[i + 1] === '"') {
                        // Double quote inside quoted field = literal quote
                        currentCell += '"';
                        i++; // Skip the next quote
                    } else {
                        // Toggle quote state
                        inQuote = !inQuote;
                    }
                } else if (char === ',' && !inQuote) {
                    // Comma outside quotes = field separator
                    cells.push(currentCell);
                    currentCell = '';
                } else {
                    // Regular character
                    currentCell += char;
                }
            }
            
            // Add the last cell
            cells.push(currentCell);
            console.log(`Split into ${cells.length} cells with CSV parsing`);
        }
        
        // Apply the parsed cells to the grid
        cells.forEach((cell, colIndex) => {
            const targetRow = startRow + rowIndex;
            const targetCol = startCol + colIndex;
            
            // Trim quotes from the beginning and end of the cell
            const trimmedCell = cell.replace(/^"|"$/g, '');
            
            // Ensure we have enough rows
            while (newData.length <= targetRow) {
                newData.push(Array(Math.max(newData[0]?.length || 0, targetCol + 1)).fill(''));
            }
            
            // Ensure we have enough columns in this row
            while (newData[targetRow].length <= targetCol) {
                newData[targetRow].push('');
            }
            
            console.log(`Setting cell [${targetRow},${targetCol}] to: ${trimmedCell.slice(0, 30)}...`);
            newData[targetRow][targetCol] = trimmedCell;
        });
    });
    
    setData(newData);
}, [data, activeCell, setData]);

    // Update useEffect to use the new callback functions
    useEffect(() => {
        const handleKeyboardEvent = (e) => {
            if (!activeCell) return;
            
            if (e.ctrlKey || e.metaKey) {
                switch (e.key.toLowerCase()) {
                    case 'c':
                        handleCopyCallback(e);
                        break;
                    case 'x':
                        handleCutCallback(e);
                        break;
                    case 'v':
                        handlePasteCallback(e);
                        break;
                    default:
                        break;
                }
            }
        };

        const handleGlobalPaste = (e) => {
            if (document.activeElement.closest('.DataGrid')) {
                handlePasteCallback(e);
            }
        };

        window.addEventListener('keydown', handleKeyboardEvent);
        window.addEventListener('paste', handleGlobalPaste);

        return () => {
            window.removeEventListener('keydown', handleKeyboardEvent);
            window.removeEventListener('paste', handleGlobalPaste);
        };
    }, [activeCell, handleCopyCallback, handleCutCallback, handlePasteCallback]);

    const handleFileUpload = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        
        setFileName(file.name);
        console.log(`Loading file: ${file.name}`);
        
        const reader = new FileReader();
        reader.onload = (event) => {
            const content = event.target.result;
            
            if (file.name.endsWith('.csv')) {
                console.log("Processing CSV file");
                
                // Use XLSX library for CSV parsing to handle quotes correctly
                try {
                    const workbook = XLSX.read(content, { type: 'string' });
                    const sheetName = workbook.SheetNames[0];
                    const worksheet = workbook.Sheets[sheetName];
                    const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
                    
                    console.log(`Parsed CSV with ${jsonData.length} rows`);
                    if (jsonData.length > 0) {
                        console.log(`First row has ${jsonData[0].length} columns`);
                    }
                    
                    if (jsonData.length > 0) {
                        // Generate column headers (A, B, C, etc.)
                        const colCount = Math.max(
                            MIN_VISIBLE_COLS,
                            Math.max(...jsonData.map(row => row.length))
                        );
                        const newHeaders = Array.from({ length: colCount }, (_, i) => 
                            generateColumnLabel(i)
                        );
                        
                        // Ensure we have at least minimum rows
                        const paddedData = [...jsonData];
                        while (paddedData.length < MIN_VISIBLE_ROWS) {
                            paddedData.push(Array(colCount).fill(''));
                        }
                        
                        // Ensure each row has the same length
                        const uniformData = paddedData.map(row => {
                            if (row.length < colCount) {
                                return [...row, ...Array(colCount - row.length).fill('')];
                            }
                            return row;
                        });
                        
                        setHeaders(newHeaders);
                        setData(uniformData);
                        setVisibleCols(colCount);
                    }
                } catch (error) {
                    console.error('Error parsing CSV with XLSX:', error);
                    
                    // Fallback to parsing CSV with proper handling of quoted fields
                    console.log("Falling back to manual CSV parsing");
                    
                    // This regex properly handles quoted fields with commas
                    const parseCSVLine = (line) => {
                        const result = [];
                        let inQuotes = false;
                        let currentField = '';
                        
                        for (let i = 0; i < line.length; i++) {
                            const char = line[i];
                            
                            if (char === '"') {
                                if (i + 1 < line.length && line[i + 1] === '"') {
                                    // Escaped quote
                                    currentField += '"';
                                    i++;
                                } else {
                                    // Toggle quote mode
                                    inQuotes = !inQuotes;
                                }
                            } else if (char === ',' && !inQuotes) {
                                // Field separator
                                result.push(currentField);
                                currentField = '';
                            } else {
                                // Regular character
                                currentField += char;
                            }
                        }
                        
                        // Add the last field
                        result.push(currentField);
                        return result;
                    };
                    
                    // Split into lines and parse each line
                    const lines = content.split(/\r?\n/).filter(line => line.trim() !== '');
                    const parsedData = lines.map(parseCSVLine);
                    
                    console.log(`Manually parsed CSV with ${parsedData.length} rows`);
                    if (parsedData.length > 0) {
                        console.log(`First row has ${parsedData[0].length} columns`);
                    }
                    
                    if (parsedData.length > 0) {
                        // Generate column headers (A, B, C, etc.)
                        const colCount = Math.max(
                            MIN_VISIBLE_COLS,
                            Math.max(...parsedData.map(row => row.length))
                        );
                        const newHeaders = Array.from({ length: colCount }, (_, i) => 
                            generateColumnLabel(i)
                        );
                        
                        // Ensure we have at least minimum rows
                        const paddedData = [...parsedData];
                        while (paddedData.length < MIN_VISIBLE_ROWS) {
                            paddedData.push(Array(colCount).fill(''));
                        }
                        
                        // Ensure each row has the same length
                        const uniformData = paddedData.map(row => {
                            if (row.length < colCount) {
                                return [...row, ...Array(colCount - row.length).fill('')];
                            }
                            return row;
                        });
                        
                        setHeaders(newHeaders);
                        setData(uniformData);
                        setVisibleCols(colCount);
                    }
                }
            } else if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
                // Parse Excel using xlsx library (your existing code)
                try {
                    const workbook = XLSX.read(content, { type: 'binary' });
                    const sheetName = workbook.SheetNames[0];
                    const worksheet = workbook.Sheets[sheetName];
                    const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
                    
                    if (jsonData.length > 0) {
                        // Generate column headers (A, B, C, etc.)
                        const colCount = Math.max(
                            MIN_VISIBLE_COLS,
                            Math.max(...jsonData.map(row => row.length))
                        );
                        const newHeaders = Array.from({ length: colCount }, (_, i) => 
                            generateColumnLabel(i)
                        );
                        
                        // Ensure we have at least minimum rows
                        const paddedData = [...jsonData];
                        while (paddedData.length < MIN_VISIBLE_ROWS) {
                            paddedData.push(Array(colCount).fill(''));
                        }
                        
                        // Ensure each row has the same length
                        const uniformData = paddedData.map(row => {
                            if (row.length < colCount) {
                                return [...row, ...Array(colCount - row.length).fill('')];
                            }
                            return row;
                        });
                        
                        setHeaders(newHeaders);
                        setData(uniformData);
                        setVisibleCols(colCount);
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
            
            const response = await axios.post(`${process.env.REACT_APP_API_URL}/api/records`, {
                data: formattedData,
                fileName: fileName || 'Untitled Data'
            }, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            console.log(response);
            alert('Data saved successfully!');
        } catch (err) {
            console.error(err);
            alert('Error saving data');
        }
    };

    // // Function to prepare chart data from OpenAI format
    // const prepareChartData = (aiResponse = null) => {
    //     if (aiResponse) {
    //         console.log('Preparing chart data from AI response:', aiResponse);
            
    //         // If we have AI-generated data, use it directly
    //         if (aiResponse.data?.labels && aiResponse.data?.datasets) {
    //             const chartData = aiResponse.data.labels.map((label, index) => {
    //                 const dataPoint = { name: label };
    //                 // Add all dataset values
    //                 aiResponse.data.datasets.forEach(dataset => {
    //                     if (dataset.data && dataset.data[index] !== undefined) {
    //                         dataPoint[dataset.label || 'Value'] = dataset.data[index];
    //                     }
    //                 });
    //                 return dataPoint;
    //             });
                
    //             console.log('Prepared chart data:', chartData);
    //             return chartData;
    //         }
    //     }
    //     console.log("DATA",data);
    //     // Fallback to grid data format
    //     if (!data || data.length < 2) {
    //         console.log('No data available for chart');
    //         return [];
    //     }
        
    //     // Get the data rows (skip empty rows)
    //     const rows = data.filter(row => row && row.some(cell => cell !== ''));
    //     if (rows.length < 2) {
    //         console.log('Not enough data rows for chart');
    //         return [];
    //     }

    //     // Get the header row (first row)
    //     const headerRow = rows[0];
    //     console.log(headerRow,"headerRowsss");
    //     // Find numeric columns
    //     const numericColumns = [];
    //     for (let i = 0; i < headerRow.length; i++) {
    //         // Check if this column has any numeric values
    //         const hasNumericValues = rows.slice(1).some(row => {
    //             const value = row[i];
    //             return value !== '' && !isNaN(parseFloat(value));
    //         });
    //         if (hasNumericValues) {
    //             numericColumns.push(i);
    //         }
    //     }

    //     console.log('Found numeric columns:', numericColumns);

    //     // Transform data rows into chart format
    //     const chartData = rows.slice(1) // Skip header row
    //         .map(row => {
    //             if (!row || row.length === 0) return null;

    //             const dataPoint = {
    //                 name: row[0] || 'Unnamed' // Use first column as name
    //             };

    //             // Add all numeric columns to the data point
    //             numericColumns.forEach(colIndex => {
    //                 if (colIndex !== 0) { // Skip the name column
    //                     const value = parseFloat(row[colIndex]);
    //                     if (!isNaN(value)) {
    //                         dataPoint[headerRow[colIndex] || `Column ${colIndex}`] = value;
    //                     }
    //                 }
    //             });

    //             return dataPoint;
    //         })
    //         .filter(point => point !== null && Object.keys(point).length > 1); // Must have at least name and one value

    //     console.log('Generated chart data:', chartData);
    //     return chartData;
    // };
    
    // Function to create chart
    // const createChart = (type = 'bar', startCell = activeCell, chartConfig = null) => {
    //     if (!startCell) return;
        
    //     const newData = [...data];
    //     console.log(newData,"NEW DATA IS ");
    //     console.log("Creating chart with config:", chartConfig);
        
    //     // Ensure we have enough rows and columns for the chart
    //     while (newData.length <= startCell.row + CHART_SIZE.height) {
    //         newData.push(Array(newData[0]?.length || 1).fill(''));
    //     }
    
    //     // Mark the chart area
    //     for (let i = 0; i < CHART_SIZE.height; i++) {
    //         for (let j = 0; j < CHART_SIZE.width; j++) {
    //             if (!newData[startCell.row + i]) {
    //                 newData[startCell.row + i] = [];
    //             }
    //             if (i === 0 && j === 0) {
    //                 // Store chart configuration in the cell
    //                 newData[startCell.row][startCell.col] = `CHART:${JSON.stringify(chartConfig)}:START`;
    //             } else {
    //                 newData[startCell.row + i][startCell.col + j] = 'CHART:OCCUPIED';
    //             }
    //         }
    //     }
        
    //     setData(newData);
    // };
    const createChart = (type = 'bar', startCell = activeCell, chartConfig = null) => {
        if (!startCell) return;
        
        console.log("Creating chart with config:", chartConfig);
        console.log("Chart data length:", chartConfig?.data?.length || 0);
        console.log("Sample data:", chartConfig?.data?.slice(0, 3));
        
        const newData = [...data];
        
        // Ensure we have enough rows and columns for the chart
        while (newData.length <= startCell.row + CHART_SIZE.height) {
            newData.push(Array(newData[0]?.length || 1).fill(''));
        }
    
        // Make ANOTHER deep copy to ensure nothing modifies our chart data
        const chartConfigCopy = JSON.parse(JSON.stringify(chartConfig));
        
        // Mark the chart area
        for (let i = 0; i < CHART_SIZE.height; i++) {
            for (let j = 0; j < CHART_SIZE.width; j++) {
                if (!newData[startCell.row + i]) {
                    newData[startCell.row + i] = [];
                }
                if (i === 0 && j === 0) {
                    // Store chart configuration in the cell
                    const chartConfigString = JSON.stringify(chartConfigCopy);
                    console.log("Storing chart with data length:", 
                        chartConfigCopy?.data?.length || 0);
                    console.log("Storing chart config string length:", 
                        chartConfigString.length);
                        
                    newData[startCell.row][startCell.col] = `CHART:${chartConfigString}:START`;
                } else {
                    newData[startCell.row + i][startCell.col + j] = 'CHART:OCCUPIED';
                }
            }
        }
        
        setData(newData);
    };
    // Custom component for Treemap to display labels inside
const CustomizedTreemapContent = (props) => {
    const {  depth, x, y, width, height, name, value } = props;
  
    return (
      <g>
        <rect
          x={x}
          y={y}
          width={width}
          height={height}
          style={{
            fill: props.fill || '#8884d8',
            stroke: '#fff',
            strokeWidth: 2 / (depth + 1e-10),
            strokeOpacity: 1 / (depth + 1e-10),
          }}
        />
        {width > 50 && height > 30 ? (
          <text
            x={x + width / 2}
            y={y + height / 2}
            textAnchor="middle"
            dominantBaseline="middle"
            fill="#fff"
            fontSize={12}
          >
            {name}: {value !== undefined ? value.toFixed(1) : ''}
          </text>
        ) : null}
      </g>
    );
  };
    // Function to render chart
    const renderChart = (type, startCell, chartConfig = null) => {
        console.log("Rendering chart with config:", chartConfig);
        console.log("Chart data length:", chartConfig?.data?.length || 0);
        
        // Create default style for the chart container
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
    
        // Validate chart config
        if (!chartConfig || !chartConfig.data || !chartConfig.type) {
            console.error("Invalid chart configuration:", chartConfig);
            return <div style={chartStyle} className="p-4">Invalid chart configuration</div>;
        }
        
        // Validate chart data
        if (!Array.isArray(chartConfig.data) || chartConfig.data.length === 0) {
            console.error("Chart data is missing or empty:", chartConfig.data);
            return <div style={chartStyle} className="p-4">Chart data is missing or empty</div>;
        }
        
        // Extract data and settings from the chart config
        const chartData = chartConfig.data;
        const chartTitle = chartConfig.title || 'Chart';
        const chartColors = chartConfig.colors || ['#8884d8', '#82ca9d', '#ffc658', '#ff8042'];
        
        // Get data keys (excluding 'name')
        const dataKeys = Object.keys(chartData[0] || {}).filter(key => key !== 'name');
        
        if (dataKeys.length === 0) {
            console.error("No data keys found in chart data");
            return <div style={chartStyle} className="p-4">No data values found for chart</div>;
        }
       
        
        // Render the appropriate chart type
        switch (chartConfig.type.toLowerCase()) {
            case 'bar':
                return (
                    <div style={chartStyle}>
                        <h3 className="text-sm font-semibold m-2">{chartTitle}</h3>
                        <ResponsiveContainer width="100%" height="90%">
                            <BarChart data={chartData}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="name" />
                                <YAxis />
                                <Tooltip />
                                <Legend />
                                {dataKeys.map((key, index) => (
                                    <Bar 
                                        key={key} 
                                        dataKey={key} 
                                        fill={chartColors[index % chartColors.length]} 
                                        name={key}
                                        label={{
                                position: 'top',
                               formatter: (value) => (typeof value === 'number' ? value.toFixed(1) : value),
                                fill: '#666',
                                fontSize: 12
                            }}
                                    />
                                ))}
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                );
                case 'column':
                    return (
                        <div style={chartStyle}>
                            <h3 className="text-sm font-semibold m-2">{chartTitle}</h3>
                            <ResponsiveContainer width="100%" height="90%">
                                <BarChart 
                                    data={chartData}
                                    layout="vertical"
                                >
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis type="number" />
                                    <YAxis 
                                        dataKey="name" 
                                        type="category" 
                                        width={80}
                                    />
                                    <Tooltip />
                                    <Legend />
                                    {dataKeys.map((key, index) => (
                                        <Bar 
                                            key={key} 
                                            dataKey={key} 
                                            fill={chartColors[index % chartColors.length]} 
                                            name={key}
                                            label={{
                                position: 'right',
                                formatter: (value) => value.toFixed(1),
                                fill: '#666',
                                fontSize: 12
                            }}
                                        />
                                    ))}
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    );

            case 'line':
                return (
                    <div style={chartStyle}>
                        <h3 className="text-sm font-semibold m-2">{chartTitle}</h3>
                        <ResponsiveContainer width="100%" height="90%">
                            <LineChart data={chartData}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="name" />
                                <YAxis />
                                <Tooltip />
                                <Legend />
                                {dataKeys.map((key, index) => (
                                    <Line 
                                        key={key} 
                                        type="monotone" 
                                        dataKey={key} 
                                        stroke={chartColors[index % chartColors.length]} 
                                        name={key}
                                        label={{
                                position: 'top',
                                formatter: (value) => value.toFixed(1),
                                fill: '#666',
                                fontSize: 12
                            }}
                                    />
                                ))}
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                );
                
            case 'pie':
                return (
                    <div style={chartStyle}>
                        <h3 className="text-sm font-semibold m-2">{chartTitle}</h3>
                        <ResponsiveContainer width="100%" height="90%">
                            <PieChart>
                                <Pie
                                    data={chartData}
                                    dataKey={dataKeys[0]}
                                    nameKey="name"
                                    cx="50%"
                                    cy="50%"
                                    outerRadius={80}
                                    fill="#8884d8"
                                    label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                                >
                                    {chartData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={chartColors[index % chartColors.length]} />
                                    ))}
                                </Pie>
                                <Tooltip />
                                <Legend />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                );
                
            case 'area':
                return (
                    <div style={chartStyle}>
                        <h3 className="text-sm font-semibold m-2">{chartTitle}</h3>
                        <ResponsiveContainer width="100%" height="90%">
                            <AreaChart data={chartData}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="name" />
                                <YAxis />
                                <Tooltip />
                                <Legend />
                                {dataKeys.map((key, index) => (
                                    <Area 
                                        key={key} 
                                        type="monotone" 
                                        dataKey={key} 
                                        fill={chartColors[index % chartColors.length]} 
                                        stroke={chartColors[index % chartColors.length]} 
                                        fillOpacity={0.6}
                                        name={key}
                                        label={{
                                position: 'top',
                                formatter: (value) => value.toFixed(1),
                                fill: '#666',
                                fontSize: 12
                            }}
                                    />
                                ))}
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                );
            case 'radar':
            return (
                <div style={chartStyle}>
                    <h3 className="text-sm font-semibold m-2">{chartTitle}</h3>
                    <ResponsiveContainer width="100%" height="90%">
                        <RadarChart cx="50%" cy="50%" outerRadius={80} data={chartData}>
                            <PolarGrid />
                            <PolarAngleAxis dataKey="name" />
                            <PolarRadiusAxis />
                            {dataKeys.map((key, index) => (
                                <Radar
                                    key={key}
                                    name={key}
                                    dataKey={key}
                                    stroke={chartColors[index % chartColors.length]}
                                    fill={chartColors[index % chartColors.length]}
                                    fillOpacity={0.6}
                                    label={{
                                formatter: (value) => value.toFixed(1),
                                fill: '#666',
                                fontSize: 12,
                                position: 'outside'
                            }}
                                />
                            ))}
                            <Legend />
                            <Tooltip />
                        </RadarChart>
                    </ResponsiveContainer>
                </div>
            );
            
            case 'scatter':
    return (
        <div style={chartStyle}>
            <h3 className="text-sm font-semibold m-2">{chartTitle}</h3>
            <ResponsiveContainer width="100%" height="90%">
                <ScatterChart>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                        type="category"
                        dataKey="year"
                        name="Year"
                        allowDuplicatedCategory={false}
                    />
                    <YAxis 
                        type="number" 
                        dataKey="sales"
                        name="Sales"
                    />
                    <Tooltip 
                        cursor={{ strokeDasharray: '3 3' }}
                        formatter={(value, name) => {
                            return typeof value === 'number' ? 
                                [value.toFixed(2), name] : [value, name];
                        }}
                        labelFormatter={(value, payload) => {
                            if (payload && payload.length > 0) {
                                return `${payload[0].payload.subCategory} (${value})`;
                            }
                            return value;
                        }}
                    />
                    <Legend />
                    {Array.from(new Set(chartData.map(item => item.subCategory))).map((category, index) => (
                        <Scatter
                            key={category}
                            name={category}
                            data={chartData.filter(item => item.subCategory === category)}
                            fill={chartColors[index % chartColors.length]}
                        />
                    ))}
                </ScatterChart>
            </ResponsiveContainer>
        </div>
    );
            
        case 'funnel':
            // For funnel charts, we'll use a simple Bar chart with some styling
            return (
                <div style={chartStyle}>
                    <h3 className="text-sm font-semibold m-2">{chartTitle}</h3>
                    <ResponsiveContainer width="100%" height="90%">
                        <BarChart 
                            data={chartData}
                            layout="vertical"
                            barCategoryGap={1}
                            maxBarSize={40}
                        >
                            <XAxis type="number" hide />
                            <YAxis 
                                dataKey="name" 
                                type="category" 
                                width={100}
                                axisLine={false}
                                tickLine={false}
                            />
                            <Tooltip />
                            <Legend />
                            {dataKeys.map((key, index) => (
                                <Bar 
                                    key={key} 
                                    dataKey={key} 
                                    fill={chartColors[index % chartColors.length]} 
                                    name={key}
                                    label={{
                                position: 'right',
                                formatter: (value) => value.toFixed(1),
                                fill: '#666',
                                fontSize: 12
                            }}
                                    shape={(props) => {
                                        // Create trapezoid shape for funnel effect
                                        const { x, y, width, height } = props;
                                        return (
                                            <path
                                                d={`M${x},${y} L${x + width * 0.95},${y} L${x + width},${y + height} L${x},${y + height} Z`}
                                                fill={props.fill}
                                            />
                                        );
                                    }}
                                />
                            ))}
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            );
            
        case 'radialbar':
            return (
                <div style={chartStyle}>
                    <h3 className="text-sm font-semibold m-2">{chartTitle}</h3>
                    <ResponsiveContainer width="100%" height="90%">
                        <RadialBarChart 
                            cx="50%" 
                            cy="50%" 
                            innerRadius="20%" 
                            outerRadius="80%" 
                            data={chartData}
                            startAngle={180} 
                            endAngle={0}
                        >
                            <RadialBar
                                label={{
                            position: 'insideEnd',
                            fill: '#fff',
                            formatter: (value) => `${value.toFixed(1)}`,
                            fontSize: 12
                        }}
                                background
                                dataKey={dataKeys[0]}
                            >
                                {chartData.map((entry, index) => (
                                    <Cell 
                                        key={`cell-${index}`} 
                                        fill={chartColors[index % chartColors.length]} 
                                    />
                                ))}
                            </RadialBar>
                            <Legend 
                                iconSize={10} 
                                layout="vertical" 
                                verticalAlign="middle" 
                                align="right"
                            />
                            <Tooltip />
                        </RadialBarChart>
                    </ResponsiveContainer>
                </div>
            );
            
        case 'composed':
            return (
                <div style={chartStyle}>
                    <h3 className="text-sm font-semibold m-2">{chartTitle}</h3>
                    <ResponsiveContainer width="100%" height="90%">
                        <ComposedChart data={chartData}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="name" />
                            <YAxis />
                            <Tooltip />
                            <Legend />
                            {dataKeys.map((key, index, array) => {
                                if (index === 0) {
                                    return (
                                        <Bar 
                                            key={key} 
                                            dataKey={key} 
                                            fill={chartColors[index % chartColors.length]} 
                                            name={key}
                                            label={{
                                            position: 'top',
                                            formatter: (value) => value.toFixed(1),
                                            fill: '#666',
                                            fontSize: 12
                                        }}
                                        />
                                    );
                                } else if (index === 1) {
                                    return (
                                        <Line 
                                            key={key}
                                            type="monotone"
                                            dataKey={key}
                                            stroke={chartColors[index % chartColors.length]}
                                            name={key}
                                            label={{
                                            position: 'top',
                                            formatter: (value) => value.toFixed(1),
                                            fill: '#666',
                                            fontSize: 12
                                        }}
                                        />
                                    );
                                } else if (index === 2) {
                                    return (
                                        <Area
                                            key={key}
                                            type="monotone"
                                            dataKey={key}
                                            fill={chartColors[index % chartColors.length]}
                                            stroke={chartColors[index % chartColors.length]}
                                            fillOpacity={0.6}
                                            name={key}
                                            label={{
                                            position: 'top',
                                            formatter: (value) => value.toFixed(1),
                                            fill: '#666',
                                            fontSize: 12
                                        }}
                                        />
                                    );
                                }
                                return null;
                            })}
                        </ComposedChart>
                    </ResponsiveContainer>
                </div>
            );
            
        case 'treemap':
            return (
                <div style={chartStyle}>
                    <h3 className="text-sm font-semibold m-2">{chartTitle}</h3>
                    <ResponsiveContainer width="100%" height="90%">
                        <Treemap
                            data={chartData.map(item => ({
                                name: item.name,
                                size: item[dataKeys[0]],
                                value: item[dataKeys[0]]
                            }))}
                            dataKey="size"
                            aspectRatio={4/3}
                            stroke="#fff"
                            fill={chartColors[0]}
                            content={<CustomizedTreemapContent />}
                        >
                            {chartData.map((entry, index) => (
                                <Cell 
                                    key={`cell-${index}`} 
                                    fill={chartColors[index % chartColors.length]} 
                                />
                            ))}
                            <Tooltip formatter={(value) => [`${value}`, dataKeys[0]]} />
                        </Treemap>
                    </ResponsiveContainer>
                </div>
            );
            
            default:
              
                return (
                    <div style={chartStyle}>
                        <h3 className="text-sm font-semibold m-2">{chartTitle} (Bar Chart)</h3>
                        <ResponsiveContainer width="100%" height="90%">
                            <BarChart data={chartData}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="name" />
                                <YAxis />
                                <Tooltip />
                                <Legend />
                                {dataKeys.map((key, index) => (
                                    <Bar 
                                        key={key} 
                                        dataKey={key} 
                                        fill={chartColors[index % chartColors.length]} 
                                        name={key}
                                        label={{
                                position: 'top',
                                formatter: (value) => value.toFixed(1),
                                fill: '#666',
                                fontSize: 12
                            }}
                                    />
                                ))}
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                );
    
        }
    };
    
    // Expose createChart to parent components
    useImperativeHandle(ref, () => ({
        createChart,
        expandGrid
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
    const cellContent = (rowIndex, colIndex, row) => (
        <td 
            key={colIndex} 
            onClick={() => onCellClick(rowIndex, colIndex)}
            onMouseDown={(e) => handleMouseDown(rowIndex, colIndex, e)}
            onMouseMove={() => handleMouseMove(rowIndex, colIndex)}
            onMouseUp={handleMouseUp}
            className={`
                ${showGridLines ? 'border border-gray-200' : 'border-0'} 
                relative
                ${activeCell?.row === rowIndex && activeCell?.col === colIndex 
                    ? 'bg-blue-50 outline outline-2 outline-blue-500' 
                    : ''}
                ${isCellSelected(rowIndex, colIndex) ? 'bg-blue-100' : ''}
            `}
            style={{ 
                width: `${CELL_WIDTH}px`,
                height: `${CELL_HEIGHT}px`,
                minWidth: `${CELL_WIDTH}px`,
                maxWidth: `${CELL_WIDTH}px`,
                minHeight: `${CELL_HEIGHT}px`,
                padding: '0 4px',
                userSelect: 'none'
            }}
        >
           {typeof row[colIndex] === 'string' && row[colIndex]?.startsWith('CHART:') ? (
    row[colIndex].includes(':START') && (() => {
        const parts = row[colIndex].split(':');
        try {
            // Extract the chart configuration from the cell value
            const chartConfigStr = parts.slice(1, -1).join(':');
            console.log("Extracted chart config string length:", chartConfigStr.length);
            
            const chartConfig = JSON.parse(chartConfigStr);
            console.log("Extracted chart data length:", chartConfig?.data?.length || 0);
            
            // Validate the chart data
            if (!chartConfig.data || !Array.isArray(chartConfig.data) || chartConfig.data.length === 0) {
                console.error("Invalid chart data extracted:", chartConfig.data);
                return <div className="p-4 bg-red-50 text-red-700">
                    Chart data is missing or invalid
                </div>;
            }
            
            // Render the chart with the extracted configuration
            return renderChart(chartConfig.type || 'bar', { row: rowIndex, col: colIndex }, chartConfig);
        } catch (error) {
            console.error("Error parsing chart config from cell:", error);
            return <div className="p-4 bg-red-50 text-red-700">
                Error parsing chart: {error.message}
            </div>;
        }
    })()
) : (
                <input
                    type="text"
                    value={
                        activeCell?.row === rowIndex && activeCell?.col === colIndex
                            ? formulas[`${rowIndex}-${colIndex}`] || row[colIndex] || ''
                            : formatCellValue(row[colIndex], rowIndex, colIndex)
                    }
                    onChange={(e) => handleCellChange(rowIndex, colIndex, e.target.value)}
                    onBlur={() => {
                        if (isEditing) {
                            setIsEditing(false);
                            const formula = formulas[`${rowIndex}-${colIndex}`];
                            if (formula && formula.startsWith('=')) {
                                const result = evaluateFormula(formula);
                                const newData = [...data];
                                newData[rowIndex][colIndex] = result;
                                setData(newData);
                            }
                        }
                    }}
                    onFocus={() => setIsEditing(true)}
                    style={{
                        ...getCellStyle(rowIndex, colIndex),
                        width: '100%',
                        height: '100%'
                    }}
                    className="border-none focus:outline-none bg-transparent overflow-hidden text-ellipsis"
                />
            )}
        </td>
    );

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
            
            <div 
                className="flex-1 overflow-auto" 
                ref={gridRef}
                onScroll={handleScroll}
            >
                <div className="relative">
                    <table 
                        className="border-collapse table-fixed" 
                        style={{
                            ...gridStyle,
                            width: `${(visibleCols * CELL_WIDTH) + ROW_HEADER_WIDTH}px`
                        }}
                    >
                        {showHeaders && (
                    <thead>
                        <tr>
                                <th 
                                    className="bg-gray-100 border border-gray-300 sticky top-0 left-0 z-20"
                                    style={{ 
                                        width: `${ROW_HEADER_WIDTH}px`,
                                        height: `${CELL_HEIGHT}px`
                                    }}
                                ></th>
                            {headers.map((header, index) => (
                                <th 
                                    key={index} 
                                        className="bg-gray-100 border border-gray-300 text-center text-xs font-normal text-gray-500 sticky top-0 z-10 overflow-hidden text-ellipsis whitespace-nowrap"
                                        style={{ 
                                            width: `${CELL_WIDTH}px`,
                                            height: `${CELL_HEIGHT}px`,
                                            minWidth: `${CELL_WIDTH}px`,
                                            maxWidth: `${CELL_WIDTH}px`
                                        }}
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
                                        <td 
                                            className="bg-gray-100 border border-gray-300 text-center text-xs font-normal text-gray-500 sticky left-0 z-10"
                                        style={{ 
                                                width: `${ROW_HEADER_WIDTH}px`,
                                                height: `${CELL_HEIGHT}px`,
                                                minHeight: `${CELL_HEIGHT}px`
                                        }}
                                    >
                                            {rowIndex + 1}
                                    </td>
                                    )}
                                    {headers.map((_, colIndex) => cellContent(rowIndex, colIndex, row))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
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