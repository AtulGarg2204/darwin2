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
  excelSerialToDate: (serial) => {
    // Excel dates start at January 1, 1900
    const date = new Date(1900, 0, 0);
    
    // Excel incorrectly treats 1900 as a leap year, adjust for dates after Feb 28, 1900
    let adjustedSerial = serial;
    if (serial > 59) { // Feb 29, 1900 (doesn't exist)
      adjustedSerial -= 1;
    }
    
    // Add days
    date.setDate(date.getDate() + adjustedSerial);
    return date;
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

  formatCellValue: (value, rowIndex, colIndex, cellFormats) => {
    // Handle empty values
    if (value === '' || value === null || value === undefined) return '';
    
    // Handle complex cell objects (used for Excel date serials)
    if (value && typeof value === 'object' && value.isDate) {
      // Already processed date from Excel import
      return value.value; // Return the pre-formatted date string
    }
    
    const format = cellFormats[`${rowIndex}-${colIndex}`] || {};
    let formattedValue = value;
    
    // Handle date formatting
    if (format.isDate) {
      try {
        // Convert value to a date object based on its type
        let date;
        
        if (typeof value === 'string') {
          date = new Date(value);
        } else if (typeof value === 'number' && value > 0 && value < 50000) {
          date = GridCore.excelSerialToDate(value);
        } else if (value instanceof Date) {
          date = value;
        }
        
        if (date && !isNaN(date.getTime())) {
          switch (format.dateType) {
            case 'short':
              formattedValue = date.toLocaleDateString();
              break;
            case 'long':
              formattedValue = date.toLocaleDateString(undefined, { 
                weekday: 'long', 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
              });
              break;
            case 'dd-mm-yyyy':
              formattedValue = `${date.getDate().toString().padStart(2, '0')}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getFullYear()}`;
              break;
            case 'dd.mm.yyyy':
              formattedValue = `${date.getDate().toString().padStart(2, '0')}.${(date.getMonth() + 1).toString().padStart(2, '0')}.${date.getFullYear()}`;
              break;
            case 'yyyy-mm-dd':
              formattedValue = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')}`;
              break;
            case 'd-mmm-yy':
              const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
              formattedValue = `${date.getDate()}-${months[date.getMonth()]}-${date.getFullYear().toString().substr(2)}`;
              break;
            case 'time':
              formattedValue = date.toLocaleTimeString();
              break;
            default:
              formattedValue = date.toLocaleDateString();
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
              
              let chartConfig;
              try {
                chartConfig = JSON.parse(chartConfigStr);
              } catch (jsonError) {
                console.error("Error parsing chart JSON:", jsonError);
                return (
                  <div className="p-4 bg-red-50 text-red-700 absolute" style={{
                    width: '240px',
                    height: '160px',
                    zIndex: 10,
                    border: '1px solid #fee2e2',
                    borderRadius: '4px',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.12)',
                    overflow: 'auto'
                  }}>
                    <h3 className="font-semibold mb-1">Chart JSON Error</h3>
                    <p className="text-xs mb-1">{jsonError.message}</p>
                    <p className="text-xs italic">Check for special characters or invalid JSON format</p>
                  </div>
                );
              }
              
              // Validate the chart data
              if (!chartConfig.data || !Array.isArray(chartConfig.data) || chartConfig.data.length === 0) {
                console.error("Invalid chart data extracted:", chartConfig.data);
                return (
                  <div className="p-4 bg-red-50 text-red-700 absolute" style={{
                    width: '240px',
                    height: '160px',
                    zIndex: 10,
                    border: '1px solid #fee2e2',
                    borderRadius: '4px',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.12)'
                  }}>
                    <h3 className="font-semibold mb-1">Chart Data Error</h3>
                    <p className="text-xs">Chart data is missing or invalid</p>
                  </div>
                );
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
              return (
                <div className="p-4 bg-red-50 text-red-700 absolute" style={{
                  width: '240px',
                  height: '160px',
                  zIndex: 10,
                  border: '1px solid #fee2e2',
                  borderRadius: '4px',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.12)',
                  overflow: 'auto'
                }}>
                  <h3 className="font-semibold mb-1">Chart Error</h3>
                  <p className="text-xs">{error.message || 'Error parsing chart configuration'}</p>
                </div>
              );
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