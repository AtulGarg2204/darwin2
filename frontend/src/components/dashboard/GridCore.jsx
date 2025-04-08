import React from 'react';

// Constants
const CELL_WIDTH = 120;
const CELL_HEIGHT = 32;
const MIN_VISIBLE_ROWS = 50;
const MIN_VISIBLE_COLS = 10;

const GridCore = {
  // Grid expansion
  expandGrid: (data, addRows, addCols, headers, generateColumnLabel, setData, setHeaders, setVisibleCols) => {
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
  },

  // Cell selection
  isCellSelected: (rowIndex, colIndex, selectionStart, selectionEnd) => {
    if (!selectionStart || !selectionEnd) return false;
    
    const startRow = Math.min(selectionStart.row, selectionEnd.row);
    const endRow = Math.max(selectionStart.row, selectionEnd.row);
    const startCol = Math.min(selectionStart.col, selectionEnd.col);
    const endCol = Math.max(selectionStart.col, selectionEnd.col);
    
    return rowIndex >= startRow && rowIndex <= endRow && 
           colIndex >= startCol && colIndex <= endCol;
  },

 // Cell formatting
formatCellValue: (value, rowIndex, colIndex, cellFormats) => {
  if (value === '' || value === null || value === undefined) return '';
  
  const format = cellFormats[`${rowIndex}-${colIndex}`] || {};
  let formattedValue = value;
  
  // Handle date formatting
  if (format.isDate && typeof value === 'string') {
    try {
      const date = new Date(value);
      if (!isNaN(date.getTime())) {
        if (format.dateType === 'short') {
          formattedValue = date.toLocaleDateString();
        } else if (format.dateType === 'long') {
          formattedValue = date.toLocaleDateString(undefined, { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
          });
        } else if (format.dateType === 'time') {
          formattedValue = date.toLocaleTimeString();
        }
        return formattedValue;
      }
    } catch (e) {
      console.error('Error formatting date:', e);
    }
  }
  
  // Handle number formatting
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
},

// Cell styling
getCellStyle: (rowIndex, colIndex, cellFormats) => {
  const format = cellFormats[`${rowIndex}-${colIndex}`] || {};
  
  // Generate border styles based on format.borders
  let borderStyle = {};
  if (format.borders) {
    if (format.borders.top) borderStyle.borderTop = '1px solid #000';
    if (format.borders.right) borderStyle.borderRight = '1px solid #000';
    if (format.borders.bottom) borderStyle.borderBottom = '1px solid #000';
    if (format.borders.left) borderStyle.borderLeft = '1px solid #000';
  }
  
  return {
    fontWeight: format.bold ? 'bold' : 'normal',
    fontStyle: format.italic ? 'italic' : 'normal',
    textDecoration: [
      format.underline && 'underline',
      format.strikethrough && 'line-through'
    ].filter(Boolean).join(' '),
    color: format.textColor || 'inherit',
    backgroundColor: format.fillColor || 'inherit',
    textAlign: format.align || 'left',
    ...borderStyle
  };
},
  // Generate column headers beyond Z (AA, AB, etc.)
  generateColumnLabel: (index) => {
    let label = '';
    let i = index;
    
    do {
      label = String.fromCharCode(65 + (i % 26)) + label;
      i = Math.floor(i / 26) - 1;
    } while (i >= 0);
    
    return label;
  },

  // Cell content rendering with drag and drop support
  renderCellContent: (
    rowIndex, colIndex, row, activeCell, onCellClick, 
    handleMouseDown, handleMouseMove, handleMouseUp, 
    isCellSelected, showGridLines, formulas, handleCellChange, 
    formatCellValue, getCellStyle, renderChart, data, 
    chartSizes, selectedChart, handleResizeStart, handleChartDrop
  ) => {
    return (
      <td 
        key={colIndex}
        data-row={rowIndex}
        data-col={colIndex}
        onClick={() => onCellClick(rowIndex, colIndex)}
        onMouseDown={(e) => handleMouseDown(rowIndex, colIndex, e)}
        onMouseMove={() => handleMouseMove(rowIndex, colIndex)}
        onMouseUp={handleMouseUp}
        onDragOver={(e) => {
          e.preventDefault(); // Allow drop
          e.stopPropagation();
          e.dataTransfer.dropEffect = "move";
          e.currentTarget.classList.add('drag-over'); // Add visual cue
        }}
        onDragEnter={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          e.stopPropagation();
          e.currentTarget.classList.remove('drag-over'); // Remove visual cue
        }}
        onDrop={(e) => {
          e.preventDefault();
          e.stopPropagation();
          e.currentTarget.classList.remove('drag-over'); // Remove visual cue
          if (handleChartDrop) {
            handleChartDrop(e, rowIndex, colIndex);
          }
        }}
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
          userSelect: 'none',
          backgroundColor: isCellSelected(rowIndex, colIndex) ? 'rgba(219, 234, 254, 0.4)' : 'white' // Ensure proper background
        }}
      >
        {typeof row[colIndex] === 'string' && row[colIndex]?.startsWith('CHART:') ? (
          row[colIndex].includes(':START') && (() => {
            const parts = row[colIndex].split(':');
            try {
              // Extract the chart configuration from the cell value
              const chartConfigStr = parts.slice(1, -1).join(':');
              
              const chartConfig = JSON.parse(chartConfigStr);
              
              // Validate the chart data
              if (!chartConfig.data || !Array.isArray(chartConfig.data) || chartConfig.data.length === 0) {
                console.error("Invalid chart data extracted:", chartConfig.data);
                return <div className="p-4 bg-red-50 text-red-700">
                  Chart data is missing or invalid
                </div>;
              }
              
              // Render the chart with the extracted configuration
              return renderChart(
                chartConfig.type || 'bar', 
                { row: rowIndex, col: colIndex }, 
                chartConfig,
                chartSizes,
                selectedChart,
                handleResizeStart
              );
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
              // Handle blur event if needed
            }}
            onFocus={() => {
              // Handle focus event if needed
            }}
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
  },

  // Initialize grid with minimum dimensions
  initializeGrid: (data, setData) => {
    // Initialize with empty data if not provided
    if (!data || data.length === 0) {
      const initialData = Array(MIN_VISIBLE_ROWS).fill().map(() => Array(MIN_VISIBLE_COLS).fill(''));
      setData(initialData);
      return;
    } 
    
    if (data.length < MIN_VISIBLE_ROWS || Math.max(...data.map(row => row.length)) < MIN_VISIBLE_COLS) {
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
  },

  // Handle grid scrolling for expansion
  handleScroll: (gridRef, expandGrid) => {
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
  }
};

export default GridCore;