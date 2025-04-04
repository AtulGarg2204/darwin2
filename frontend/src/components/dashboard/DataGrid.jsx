import React, { useState, useEffect, useRef, forwardRef, useImperativeHandle, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';


// Import our modularized components
import FormulaEngine from './FormulaEngine';
import ChartManager from './ChartManager';
import ClipboardHandler from './ClipboardHandler';
import GridCore from './GridCore';

const MIN_VISIBLE_COLS = 10;
const CELL_WIDTH = 120;
const CELL_HEIGHT = 32;
const ROW_HEADER_WIDTH = 50;
const DEFAULT_CHART_SIZE = { width: 5, height: 15 };

const DataGrid = forwardRef(({ 
  data, 
  setData, 
  activeCell, 
  onCellClick,
  showHeaders,
  showGridLines,
  zoomLevel,
  cellFormats,
  formulas: externalFormulas
}, ref) => {
  // State for grid
  const [headers, setHeaders] = useState(
    Array.from({ length: MIN_VISIBLE_COLS }, (_, i) => GridCore.generateColumnLabel(i))
  );
  const [fileName, setFileName] = useState('');
  const [visibleCols, setVisibleCols] = useState(MIN_VISIBLE_COLS);
  
  // Chart-related state
  const [selectedChart, setSelectedChart] = useState(null);
  const [chartSizes, setChartSizes] = useState({});
  const [isResizing, setIsResizing] = useState(false);    
  const [resizeStartPos, setResizeStartPos] = useState(null);
  const [resizeStartSize, setResizeStartSize] = useState(null);
  
  // Selection state
  const [selectionStart, setSelectionStart] = useState(null);
  const [selectionEnd, setSelectionEnd] = useState(null);
  const [isSelecting, setIsSelecting] = useState(false);
  
  // Refs
  const gridRef = useRef(null);
  const fileInputRef = useRef(null);
  
  // Form state
  const [formulaBar, setFormulaBar] = useState('');
 
  const [formulas, setFormulas] = useState(externalFormulas || {});
  
  // Authentication context
  const { token } = useAuth();

  // Initialize with minimum number of rows and columns
  useEffect(() => {
    GridCore.initializeGrid(data, setData);
  }, [data, setData]);

  // Initialize chart sizes
  useEffect(() => {
    if (data) {
      const newChartSizes = { ...chartSizes };
      let hasChanges = false;
      
      // Find all chart cells and ensure they have sizes
      data.forEach((row, rowIndex) => {
        row.forEach((cell, colIndex) => {
          if (typeof cell === 'string' && cell.startsWith('CHART:') && cell.includes(':START')) {
            const chartKey = `${rowIndex}-${colIndex}`;
            if (!newChartSizes[chartKey]) {
              try {
                const configStr = cell.split(':').slice(1, -1).join(':');
                const config = JSON.parse(configStr);
                newChartSizes[chartKey] = config.size || DEFAULT_CHART_SIZE;
                hasChanges = true;
              } catch (error) {
                console.error('Error parsing chart config:', error);
                newChartSizes[chartKey] = DEFAULT_CHART_SIZE;
                hasChanges = true;
              }
            }
          }
        });
      });
      
      if (hasChanges) {
        setChartSizes(newChartSizes);
      }
    }
  }, [data, chartSizes]);
  const handleChartDragStart = (e, fromRow, fromCol) => {
    console.log("DRAG START:", { fromRow, fromCol });
    
    // Set the data transfer using simple text format
    e.dataTransfer.setData("text/plain", `${fromRow},${fromCol}`);
    e.dataTransfer.effectAllowed = "move";
    
    // Use both formats for maximum compatibility
    try {
      e.dataTransfer.setData("application/json", JSON.stringify({ fromRow, fromCol }));
    } catch (error) {
      console.log("Browser doesn't support complex data types in dataTransfer");
    }
  };
  
  // Function to handle chart drop events
  const handleChartDrop = (e, toRow, toCol) => {
    e.preventDefault();
    e.stopPropagation();
    
    console.log("DROP EVENT on cell:", toRow, toCol);
    console.log("Available data types:", Array.from(e.dataTransfer.types || []));
    
    let fromRow, fromCol;
    
    // Try to get data from dataTransfer in multiple ways for compatibility
    try {
      // Try JSON format first
      const jsonData = e.dataTransfer.getData("application/json");
      if (jsonData) {
        const parsed = JSON.parse(jsonData);
        fromRow = parsed.fromRow;
        fromCol = parsed.fromCol;
        console.log("Retrieved position from JSON:", fromRow, fromCol);
      }
    } catch (err) {
      console.log("JSON data not available, trying text format");
    }
    
    // Fall back to text format if JSON failed
    if (fromRow === undefined || fromCol === undefined) {
      try {
        const textData = e.dataTransfer.getData("text/plain");
        console.log("Text data:", textData);
        
        if (textData && textData.includes(',')) {
          [fromRow, fromCol] = textData.split(',').map(num => parseInt(num));
          console.log("Retrieved position from text:", fromRow, fromCol);
        }
      } catch (err) {
        console.error("Error getting text data:", err);
      }
    }
    
    // Check if we have valid positions
    if (fromRow !== undefined && fromCol !== undefined) {
      console.log("Moving chart from:", fromRow, fromCol, "to:", toRow, toCol);
      
      // Call the move function in ChartManager
      const newPosition = ChartManager.moveChart(
        fromRow, 
        fromCol, 
        toRow, 
        toCol, 
        data, 
        setData
      );
      
      console.log("Move chart result:", newPosition);
      
      if (newPosition) {
        // Update selected chart
        setSelectedChart(newPosition);
        
        // Add visual feedback for successful drop
        setTimeout(() => {
          // Find the cell at the target position
          const targetCell = document.querySelector(`[data-row="${toRow}"][data-col="${toCol}"]`);
          if (targetCell) {
            targetCell.classList.add('drop-success');
            // Remove the class after animation completes
            setTimeout(() => {
              targetCell.classList.remove('drop-success');
            }, 500);
          }
        }, 50);
      }
    } else {
      console.error("Failed to retrieve chart position from drag data");
    }
  };
  
  // Add this debugging effect to help troubleshoot issues
  useEffect(() => {
    const handleGlobalDragStart = (e) => {
      console.log("Global drag start event detected", e.target.tagName);
    };
    
    const handleGlobalDragEnd = (e) => {
      console.log("Global drag end event detected", e.dataTransfer.dropEffect);
    };
    
    document.addEventListener('dragstart', handleGlobalDragStart);
    document.addEventListener('dragend', handleGlobalDragEnd);
    
    return () => {
      document.removeEventListener('dragstart', handleGlobalDragStart);
      document.removeEventListener('dragend', handleGlobalDragEnd);
    };
  }, []);
  
  // Update headers when data changes
  useEffect(() => {
    if (data && data[0]) {
      const colCount = Math.max(...data.map(row => row.length));
      if (colCount > headers.length) {
        const newHeaders = Array.from({ length: colCount }, (_, i) => GridCore.generateColumnLabel(i));
        setHeaders(newHeaders);
        setVisibleCols(colCount);
      }
    }
  }, [data, headers.length]);

  // Handler for grid scroll
  const handleScroll = () => {
    GridCore.handleScroll(gridRef, expandGrid);
  };

  // Function to expand the grid
  const expandGrid = useCallback((addRows, addCols) => {
    GridCore.expandGrid(data, addRows, addCols, headers, GridCore.generateColumnLabel, setData, setHeaders, setVisibleCols);
  }, [data, headers, setData]);

  // Function to handle cell changes (including formulas)
  const handleCellChange = (rowIndex, colIndex, value) => {
    const newData = [...data];
    if (!newData[rowIndex]) {
      newData[rowIndex] = [];
    }

    const cellKey = `${rowIndex}-${colIndex}`;

    if (value.startsWith('=')) {
      // If it's just '=' or we're still typing the formula, store the raw value
      if (value === '=' ) {
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
        const result = FormulaEngine.evaluateFormula(value, data);
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
        newData[r][c] = FormulaEngine.evaluateFormula(formula, newData);
      }
    });
  };

  // Effect to update formula results when data changes
  useEffect(() => {
    const newData = [...data];
    let hasChanges = false;
  
    Object.entries(formulas || {}).forEach(([key, formula]) => {
      const [row, col] = key.split('-').map(Number);
      const result = FormulaEngine.evaluateFormula(formula, data);
      if (newData[row]?.[col] !== result) {
        if (!newData[row]) newData[row] = [];
        newData[row][col] = result;
        hasChanges = true;
      }
    });
  
    if (hasChanges) {
      setData(newData);
    }
  }, [data, formulas, setData]);

  // Function to handle resize movement
  const handleResizeMove = useCallback((e) => {
    // Check if all required state exists
    if (!selectedChart) {
      console.log("No chart selected");
      return;
    }
    
    if (!resizeStartPos) {
      console.log("No start position");
      return;
    }
    
    if (!resizeStartSize) {
      console.log("No start size");
      return;
    }
    
    if (!isResizing) {
      console.log("Not in resize mode");
      return;
    }
    
    // Calculate delta in cell units (not pixels)
    const deltaXCells = Math.round((e.clientX - resizeStartPos.x) / CELL_WIDTH);
    const deltaYCells = Math.round((e.clientY - resizeStartPos.y) / CELL_HEIGHT);
    
    // Calculate new size, with minimum bounds
    const newWidth = Math.max(3, resizeStartSize.width + deltaXCells);
    const newHeight = Math.max(3, resizeStartSize.height + deltaYCells);
    
    // Update chart size in state
    const chartKey = `${selectedChart.row}-${selectedChart.col}`;
    const newSize = { width: newWidth, height: newHeight };
    
    // Use a function form of setState to ensure we're using the latest state
    setChartSizes(prev => ({
      ...prev,
      [chartKey]: newSize
    }));
  }, [selectedChart, isResizing, resizeStartPos, resizeStartSize]);

  // Function to handle resize end
  const handleResizeEnd = useCallback((e) => {
    if (!isResizing || !selectedChart) {
      console.log("Cannot end resize - missing state");
      return;
    }
    
    // Update the chart with final size
    const chartKey = `${selectedChart.row}-${selectedChart.col}`;
    const finalSize = chartSizes[chartKey];
    ChartManager.updateChartSize(selectedChart.row, selectedChart.col, finalSize, data, setData);
    
    // Reset resize state
    setIsResizing(false);
    setResizeStartPos(null);
    setResizeStartSize(null);
    
    // Remove document-level event listeners
    document.removeEventListener('mousemove', handleResizeMove);
    document.removeEventListener('mouseup', handleResizeEnd);
  }, [isResizing, selectedChart, chartSizes, data, setData, handleResizeMove]);

  // Function to handle start of resize drag
  const handleResizeStart = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!selectedChart) {
      console.log("No chart selected, can't resize");
      return;
    }
    
    const chartKey = `${selectedChart.row}-${selectedChart.col}`;
    const chartConfig = ChartManager.getChartConfig(selectedChart.row, selectedChart.col, data);
    
    const currentSize = chartSizes[chartKey] || chartConfig?.size || DEFAULT_CHART_SIZE;
    
    // Set state synchronously
    setResizeStartPos({
      x: e.clientX,
      y: e.clientY
    });
    setResizeStartSize(currentSize);
    setIsResizing(true);
    
    // Add event listeners after a short timeout to ensure state updates
    setTimeout(() => {
      document.addEventListener('mousemove', handleResizeMove);
      document.addEventListener('mouseup', handleResizeEnd);
    }, 0);
  }, [selectedChart, chartSizes, data, handleResizeEnd, handleResizeMove]);

  // Cleanup effect for resize event listeners
  useEffect(() => {
    return () => {
      document.removeEventListener('mousemove', handleResizeMove);
      document.removeEventListener('mouseup', handleResizeEnd);
    };
  }, [handleResizeMove, handleResizeEnd]);

  // Handle mouse events for selection
  const handleMouseDown = (rowIndex, colIndex, e) => {
    setIsSelecting(true);
    setSelectionStart({ row: rowIndex, col: colIndex });
    setSelectionEnd({ row: rowIndex, col: colIndex });
    onCellClick(rowIndex, colIndex);
    
    // Check if clicked on a chart
    const cellValue = data[rowIndex]?.[colIndex];
    
    if (typeof cellValue === 'string' && 
        cellValue.startsWith('CHART:') && 
        cellValue.includes(':START')) {
      setSelectedChart({ row: rowIndex, col: colIndex });
    } else {
      setSelectedChart(null);
    }
  };

  const handleMouseMove = (rowIndex, colIndex) => {
    if (isSelecting) {
      setSelectionEnd({ row: rowIndex, col: colIndex });
    }
  };

  const handleMouseUp = () => {
    setIsSelecting(false);
  };

  // Create stable callback functions for clipboard operations
  const handleCopyCallback = useCallback((e) => {
    e.preventDefault();
    
    const copyText = ClipboardHandler.handleCopy(data, selectionStart, selectionEnd, activeCell);

    navigator.clipboard.writeText(copyText).catch(err => {
      console.error('Failed to copy:', err);
      // Fallback
      e.clipboardData.setData('text/plain', copyText);
    });
  }, [data, selectionStart, selectionEnd, activeCell]);

  const handleCutCallback = useCallback((e) => {
    e.preventDefault();
  
    const { newData, copyText } = ClipboardHandler.handleCut(data, selectionStart, selectionEnd, activeCell);
    
    navigator.clipboard.writeText(copyText).catch(err => {
      console.error('Failed to copy:', err);
      // Fallback
      e.clipboardData.setData('text/plain', copyText);
    });
    
    setData(newData);
  }, [data, selectionStart, selectionEnd, activeCell, setData]);

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
    
    const newData = await ClipboardHandler.handlePaste(pasteData, activeCell, data);
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
          // Clear selected chart when moving to a new cell with keyboard
          setSelectedChart(null);
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [activeCell, data, headers.length, expandGrid, onCellClick]);

  // Expose createChart and expandGrid to parent components
  useImperativeHandle(ref, () => ({
    createChart: (type, startCell, chartConfig) => 
      ChartManager.createChart(type, startCell, chartConfig, data, setData, chartSizes),
    expandGrid: (addRows, addCols) => 
      expandGrid(addRows, addCols)
  }));

  // Grid styling with zoom level
  const gridStyle = {
    transform: `scale(${zoomLevel / 100})`,
    transformOrigin: '0 0',
    width: `${100 * (100 / zoomLevel)}%`
  };

  // Handle file upload
  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    ClipboardHandler.handleFileUpload(
      file, 
      setFileName, 
      setHeaders, 
      setData, 
      setVisibleCols, 
      GridCore.generateColumnLabel
    );
  };

  // Handle save
  const handleSave = async () => {
    await ClipboardHandler.handleSave(data, headers, fileName, token);
  };

  // Main render function
  return (
    <div className="h-full flex flex-col relative DataGrid">
      {/* Hidden file input */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileUpload}
        accept=".csv,.xlsx,.xls"
        className="hidden"
      />
      
      {/* Formula Bar */}
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
                  {headers.map((_, colIndex) => 
  GridCore.renderCellContent(
    rowIndex, colIndex, row, activeCell, onCellClick,
    handleMouseDown, handleMouseMove, handleMouseUp,
    (ri, ci) => GridCore.isCellSelected(ri, ci, selectionStart, selectionEnd),
    showGridLines, formulas, handleCellChange,
    (val, ri, ci) => GridCore.formatCellValue(val, ri, ci, cellFormats),
    (ri, ci) => GridCore.getCellStyle(ri, ci, cellFormats),
    (type, startCell, chartConfig, chartSizes, selectedChart, handleResizeStart) => 
      ChartManager.renderChart(
        type, 
        startCell, 
        chartConfig, 
        chartSizes, 
        selectedChart, 
        handleResizeStart, 
        handleChartDragStart
      ),
    data,
    chartSizes,
    selectedChart,
    handleResizeStart,
    handleChartDrop
  )
)}
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
      
      {/* Render chart controls */}
      {ChartManager.renderChartControls(
        selectedChart, 
        data, 
        chartSizes, 
        setChartSizes, 
        (row, col, size) => ChartManager.updateChartSize(row, col, size, data, setData)
      )}
      
      {/* Chart resize preview */}
      {isResizing && selectedChart && (
        <div 
          className="resize-preview"
          style={{
            position: 'absolute',
            left: `${selectedChart.col * CELL_WIDTH + (showHeaders ? ROW_HEADER_WIDTH : 0)}px`,
            top: `${selectedChart.row * CELL_HEIGHT + (showHeaders ? CELL_HEIGHT : 0)}px`,
            width: `${(chartSizes[`${selectedChart.row}-${selectedChart.col}`] || 
                  ChartManager.getChartConfig(selectedChart.row, selectedChart.col, data)?.size || 
                  DEFAULT_CHART_SIZE).width * CELL_WIDTH}px`,
            height: `${(chartSizes[`${selectedChart.row}-${selectedChart.col}`] || 
                   ChartManager.getChartConfig(selectedChart.row, selectedChart.col, data)?.size || 
                   DEFAULT_CHART_SIZE).height * CELL_HEIGHT}px`,
            border: '3px dashed #0078d7',
            backgroundColor: 'rgba(0, 120, 215, 0.2)',
            pointerEvents: 'none',
            zIndex: 1000
          }}
        />
      )}
    </div>
  );
});

export default DataGrid;