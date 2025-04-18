import React from 'react';
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, 
  AreaChart, Area, RadarChart, PolarGrid, PolarAngleAxis, 
  PolarRadiusAxis, Radar,
} from 'recharts';

// Constants
const CELL_WIDTH = 120;
const CELL_HEIGHT = 32;
const DEFAULT_CHART_SIZE = { width: 5, height: 15 };

const ChartManager = {
  // Chart configuration parsing
  getChartConfig: (row, col, data) => {
    try {
      const cellValue = data[row]?.[col];
      if (!cellValue || !cellValue.startsWith('CHART:') || !cellValue.includes(':START')) {
        return null;
      }
      
      const chartConfigStr = cellValue.split(':').slice(1, -1).join(':');
      return JSON.parse(chartConfigStr);
    } catch (error) {
      console.error("Error parsing chart config:", error);
      return null;
    }
  },

  // Chart size updating
  updateChartSize: (row, col, newSize, data, setData) => {
    // Get the current data and chart config
    const cellValue = data[row]?.[col];
    if (!cellValue || !cellValue.startsWith('CHART:') || !cellValue.includes(':START')) {
      console.log("Cannot update chart size - not a chart cell");
      return;
    }
    
    try {
      // Extract the chart configuration
      const parts = cellValue.split(':');
      const chartConfigStr = parts.slice(1, -1).join(':');
      const chartConfig = JSON.parse(chartConfigStr);
      
      // Update the size in the config
      chartConfig.size = newSize;
      
      // Create a new grid with the updated chart
      const newData = [...data];
      
      // Clear the old chart area first (any cells marked as CHART:OCCUPIED)
      for (let i = 0; i < data.length; i++) {
        for (let j = 0; j < (data[i] || []).length; j++) {
          if (data[i][j] === 'CHART:OCCUPIED') {
            newData[i][j] = '';
          }
        }
      }
      
      // Mark the chart area with new size
      for (let i = 0; i < newSize.height; i++) {
        for (let j = 0; j < newSize.width; j++) {
          if (!newData[row + i]) {
            newData[row + i] = [];
          }
          if (i === 0 && j === 0) {
            // Update the chart configuration in the cell
            newData[row][col] = `CHART:${JSON.stringify(chartConfig)}:START`;
          } else {
            newData[row + i][col + j] = 'CHART:OCCUPIED';
          }
        }
      }
      
      setData(newData);
    } catch (error) {
      console.error("Error updating chart size:", error);
    }
  },

  // Move chart from one position to another
  moveChart: (fromRow, fromCol, toRow, toCol, data, setData) => {
    console.log("MOVE CHART:", { fromRow, fromCol, toRow, toCol });
    
    if (fromRow === toRow && fromCol === toCol) {
      console.log("No change in position, skipping move");
      return null;
    }
    
    // Get the current chart configuration
    const sourceCell = data[fromRow]?.[fromCol];
    console.log("Source cell value:", sourceCell);
    
    if (!sourceCell || !sourceCell.startsWith('CHART:') || !sourceCell.includes(':START')) {
      console.error('No chart at source position');
      return null;
    }
    
    try {
      // Extract chart config
      const chartConfigStr = sourceCell.split(':').slice(1, -1).join(':');
      const chartConfig = JSON.parse(chartConfigStr);
      const chartSize = chartConfig.size || DEFAULT_CHART_SIZE;
      console.log("Chart size for move:", chartSize);
      
      // Create new data with the chart moved
      const newData = [...data];
      
      // Clear the current chart area
      for (let i = 0; i < data.length; i++) {
        for (let j = 0; j < (data[i] || []).length; j++) {
          if (data[i][j] === 'CHART:OCCUPIED' || 
              (i === fromRow && j === fromCol && data[i][j].startsWith('CHART:'))) {
            newData[i][j] = '';
          }
        }
      }
      
      // Ensure target location has enough rows/cols
      while (newData.length <= toRow + chartSize.height) {
        newData.push([]);
      }
      
      // Mark the new chart area
      for (let i = 0; i < chartSize.height; i++) {
        for (let j = 0; j < chartSize.width; j++) {
          if (!newData[toRow + i]) {
            newData[toRow + i] = [];
          }
          // Ensure we have enough columns
          while (newData[toRow + i].length <= toCol + j) {
            newData[toRow + i].push('');
          }
          
          if (i === 0 && j === 0) {
            // Start of chart
            newData[toRow][toCol] = sourceCell;
          } else {
            newData[toRow + i][toCol + j] = 'CHART:OCCUPIED';
          }
        }
      }
      
      console.log("Setting new data with moved chart");
      setData(newData);
      return { row: toRow, col: toCol }; // Return new position
    } catch (error) {
      console.error('Error moving chart:', error);
      return null;
    }
  },

  // Chart creation
  createChart: (type = 'bar', startCell, chartConfig = null, data, setData, chartSizes) => {
    if (!startCell) return;
    
    console.log("Creating chart with config:", chartConfig);
    console.log("Chart data length:", chartConfig?.data?.length || 0);
    
    const newData = [...data];
    
    // Get chart size (use custom size or default)
    const chartKey = `${startCell.row}-${startCell.col}`;
    const chartSize = chartSizes[chartKey] || DEFAULT_CHART_SIZE;
    
    // Ensure we have enough rows and columns for the chart
    while (newData.length <= startCell.row + chartSize.height) {
      newData.push(Array(newData[0]?.length || 1).fill(''));
    }
  
    // Make a deep copy of the chart config
    const chartConfigCopy = JSON.parse(JSON.stringify(chartConfig || {}));
    
    // Store the chart size in the config
    chartConfigCopy.size = chartSize;
    
    // Mark the chart area
    for (let i = 0; i < chartSize.height; i++) {
      for (let j = 0; j < chartSize.width; j++) {
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
  },

  // Chart rendering component
  renderChart: (type, startCell, chartConfig, chartSizes, selectedChart, handleResizeStart, handleChartDragStart) => {
    // Get chart size (use custom size or size from config or default)
    const chartKey = `${startCell.row}-${startCell.col}`;
    const chartSize = chartSizes[chartKey] || chartConfig?.size || DEFAULT_CHART_SIZE;
    
    // Create default style for the chart container
    const chartStyle = {
      width: `${chartSize.width * CELL_WIDTH}px`,
      height: `${chartSize.height * CELL_HEIGHT}px`,
      position: 'absolute',
      backgroundColor: 'white',
      border: '1px solid #ddd',
      borderRadius: '4px',
      overflow: 'hidden',
      zIndex: 10
    };
  
    // Check if this chart is currently selected
    const isSelected = selectedChart && 
      selectedChart.row === startCell.row && 
      selectedChart.col === startCell.col;
    
    // Validate chart config
    if (!chartConfig || !chartConfig.data || !chartConfig.type) {
      console.error("Invalid chart configuration:", chartConfig);
      return (
        <div 
          style={chartStyle} 
          className="p-4"
          draggable={isSelected}
          onDragStart={(e) => {
            e.stopPropagation();
            console.log("Starting drag from invalid chart");
            
            if (handleChartDragStart) {
              handleChartDragStart(e, startCell.row, startCell.col);
            }
          }}
        >
          Invalid chart configuration
          {isSelected && (
            <>
              <div 
                className="chart-resize-handle"
                style={{
                  position: 'absolute',
                  right: 0,
                  bottom: 0,
                  width: '20px',
                  height: '20px',
                  background: 'rgba(0, 120, 215, 0.9)',
                  cursor: 'nwse-resize',
                  borderTop: '3px solid white',
                  borderLeft: '3px solid white',
                  borderTopLeftRadius: '5px',
                  zIndex: 100
                }}
                onMouseDown={(e) => {
                  e.stopPropagation();
                  handleResizeStart(e);
                }}
              />
              <div 
                className="chart-selection-border"
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  border: '2px solid #0078d7',
                  pointerEvents: 'none',
                  zIndex: 50
                }}
              />
            </>
          )}
        </div>
      );
    }
    
    // Validate chart data
    if (!Array.isArray(chartConfig.data) || chartConfig.data.length === 0) {
      console.error("Chart data is missing or empty:", chartConfig.data);
      return (
        <div 
          style={chartStyle} 
          className="p-4"
          draggable={isSelected}
          onDragStart={(e) => {
            e.stopPropagation();
            console.log("Starting drag from empty chart");
            
            if (handleChartDragStart) {
              handleChartDragStart(e, startCell.row, startCell.col);
            }
          }}
        >
          Chart data is missing or empty
          {isSelected && (
            <>
              <div 
                className="chart-resize-handle"
                style={{
                  position: 'absolute',
                  right: 0,
                  bottom: 0,
                  width: '20px',
                  height: '20px',
                  background: 'rgba(0, 120, 215, 0.9)',
                  cursor: 'nwse-resize',
                  borderTop: '3px solid white',
                  borderLeft: '3px solid white',
                  borderTopLeftRadius: '5px',
                  zIndex: 100
                }}
                onMouseDown={(e) => {
                  e.stopPropagation();
                  handleResizeStart(e);
                }}
              />
              <div 
                className="chart-selection-border"
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  border: '2px solid #0078d7',
                  pointerEvents: 'none',
                  zIndex: 50
                }}
              />
            </>
          )}
        </div>
      );
    }
    
    // Extract data and settings from the chart config
    const chartData = chartConfig.data;
    const chartTitle = chartConfig.title || 'Chart';
    const chartColors = chartConfig.colors || ['#8884d8', '#82ca9d', '#ffc658', '#ff8042'];
    
    // Get data keys (excluding 'name')
    const dataKeys = Object.keys(chartData[0] || {}).filter(key => key !== 'name');
    
    if (dataKeys.length === 0) {
      console.error("No data keys found in chart data");
      return (
        <div 
          style={chartStyle} 
          className="p-4"
          draggable={isSelected}
          onDragStart={(e) => {
            e.stopPropagation();
            console.log("Starting drag from no-keys chart");
            
            if (handleChartDragStart) {
              handleChartDragStart(e, startCell.row, startCell.col);
            }
          }}
        >
          No data values found for chart
          {isSelected && (
            <>
              <div 
                className="chart-resize-handle"
                style={{
                  position: 'absolute',
                  right: 0,
                  bottom: 0,
                  width: '20px',
                  height: '20px',
                  background: 'rgba(0, 120, 215, 0.9)',
                  cursor: 'nwse-resize',
                  borderTop: '3px solid white',
                  borderLeft: '3px solid white',
                  borderTopLeftRadius: '5px',
                  zIndex: 100
                }}
                onMouseDown={(e) => {
                  e.stopPropagation();
                  handleResizeStart(e);
                }}
              />
              <div 
                className="chart-selection-border"
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  border: '2px solid #0078d7',
                  pointerEvents: 'none',
                  zIndex: 50
                }}
              />
            </>
          )}
        </div>
      );
    }
    
    // Render the appropriate chart type based on the configuration
    let chartContent;
    switch (chartConfig.type.toLowerCase()) {
      case 'bar':
        chartContent = (
          <>
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
          </>
        );
        break;
        
      case 'column':
        chartContent = (
          <>
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
          </>
        );
        break;

      case 'line':
        chartContent = (
          <>
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
          </>
        );
        break;
        
      case 'pie':
        chartContent = (
          <>
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
          </>
        );
        break;
        
      case 'area':
        chartContent = (
          <>
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
          </>
        );
        break;
        
      case 'radar':
        chartContent = (
          <>
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
          </>
        );
        break;
        
      // Default to bar chart if type is not recognized
      default:
        chartContent = (
          <>
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
          </>
        );
    }
  
    // Return the chart with resize handle if selected
    return (
      <div 
        style={chartStyle} 
        className="chart-container"
        draggable={isSelected}
        onDragStart={(e) => {
          e.stopPropagation();
          console.log("CHART DRAG START", startCell.row, startCell.col);
          
          // Set data for drag
          e.dataTransfer.setData("text/plain", `${startCell.row},${startCell.col}`);
          e.dataTransfer.effectAllowed = "move";
          
          // Call parent handler
          if (handleChartDragStart) {
            handleChartDragStart(e, startCell.row, startCell.col);
          }
          
          // Create ghost image for dragging
          try {
            const ghostElement = document.createElement('div');
            ghostElement.style.width = `${chartSize.width * CELL_WIDTH}px`;
            ghostElement.style.height = `${chartSize.height * CELL_HEIGHT}px`;
            ghostElement.style.background = 'rgba(0, 120, 215, 0.2)';
            ghostElement.style.border = '2px dashed #0078d7';
            document.body.appendChild(ghostElement);
            e.dataTransfer.setDragImage(ghostElement, 10, 10);
            
            // Clean up the ghost element
            setTimeout(() => {
              document.body.removeChild(ghostElement);
            }, 0);
          } catch (error) {
            console.error("Error with drag image:", error);
          }
        }}
        onClick={(e) => {
          e.stopPropagation();
          // Click handling would be in main component
        }}
      >
        {chartContent}
        
        {/* Add resize handle if chart is selected */}
        {isSelected && (
          <div 
            className="chart-resize-handle"
            style={{
              position: 'absolute',
              right: 0,
              bottom: 0,
              width: '20px',
              height: '20px',
              background: 'rgba(0, 120, 215, 0.9)',
              cursor: 'nwse-resize',
              borderTop: '3px solid white',
              borderLeft: '3px solid white',
              borderTopLeftRadius: '5px',
              zIndex: 100
            }}
            onMouseDown={(e) => {
              e.stopPropagation();
              handleResizeStart(e);
            }}
          />
        )}
        
        {/* Add selection border if chart is selected */}
        {isSelected && (
          <div 
            className="chart-selection-border"
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              border: '2px solid #0078d7',
              pointerEvents: 'none',
              zIndex: 50
            }}
          />
        )}
      </div>
    );
  },

  // Chart controls component
  renderChartControls: (selectedChart, data, chartSizes, setChartSizes, updateChartSize) => {
    if (!selectedChart) return null;
    
    // Find the chart configuration in the selected cell
    const cellValue = data[selectedChart.row]?.[selectedChart.col];
    if (!cellValue || !cellValue.startsWith('CHART:') || !cellValue.includes(':START')) {
      return null;
    }
    
    try {
      // Extract and parse the chart configuration
      const chartConfigStr = cellValue.split(':').slice(1, -1).join(':');
      const chartConfig = JSON.parse(chartConfigStr);
      const chartKey = `${selectedChart.row}-${selectedChart.col}`;
      const chartSize = chartSizes[chartKey] || chartConfig.size || DEFAULT_CHART_SIZE;
      
      return (
        <div className="absolute bottom-16 right-8 bg-white border border-gray-300 rounded-md p-2 shadow-lg">
          <div className="text-sm font-semibold mb-2">Chart Size</div>
          <div className="flex items-center mb-1">
            <span className="mr-2 text-sm">Width:</span>
            <button 
              className="bg-gray-200 hover:bg-gray-300 rounded px-2 py-1 text-sm mr-1"
              onClick={() => {
                const newSize = { ...chartSize, width: Math.max(3, chartSize.width - 1) };
                setChartSizes({ ...chartSizes, [chartKey]: newSize });
                updateChartSize(selectedChart.row, selectedChart.col, newSize);
              }}
            >
              -
            </button>
            <span className="mx-1">{chartSize.width}</span>
            <button 
              className="bg-gray-200 hover:bg-gray-300 rounded px-2 py-1 text-sm ml-1"
              onClick={() => {
                const newSize = { ...chartSize, width: Math.min(15, chartSize.width + 1) };
                setChartSizes({ ...chartSizes, [chartKey]: newSize });
                updateChartSize(selectedChart.row, selectedChart.col, newSize);
              }}
            >
              +
            </button>
          </div>
          <div className="flex items-center">
            <span className="mr-2 text-sm">Height:</span>
            <button 
              className="bg-gray-200 hover:bg-gray-300 rounded px-2 py-1 text-sm mr-1"
              onClick={() => {
                const newSize = { ...chartSize, height: Math.max(3, chartSize.height - 1) };
                setChartSizes({ ...chartSizes, [chartKey]: newSize });
                updateChartSize(selectedChart.row, selectedChart.col, newSize);
              }}
            >
              -
            </button>
            <span className="mx-1">{chartSize.height}</span>
            <button 
              className="bg-gray-200 hover:bg-gray-300 rounded px-2 py-1 text-sm ml-1"
              onClick={() => {
                const newSize = { ...chartSize, height: Math.min(30, chartSize.height + 1) };
                setChartSizes({ ...chartSizes, [chartKey]: newSize });
                updateChartSize(selectedChart.row, selectedChart.col, newSize);
              }}
            >
              +
            </button>
          </div>
          <div className="text-xs mt-2 text-gray-500">
            Drag chart to move it to a new location
          </div>
        </div>
      );
    } catch (error) {
      console.error("Error rendering chart controls:", error);
      return null;
    }
  }
};

export default ChartManager;