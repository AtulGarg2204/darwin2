import React from 'react';
import Plot from 'react-plotly.js';

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

  // Creates Plotly data and layout configuration
  createPlotlyConfig: (chartConfig) => {
    if (!chartConfig || !chartConfig.data || chartConfig.data.length === 0) {
      return { data: [], layout: {} };
    }
    
    const chartData = chartConfig.data;
    const chartTitle = chartConfig.title || 'Chart';
    const chartColors = chartConfig.colors || ['#8884d8', '#82ca9d', '#ffc658', '#ff8042'];
    
    // Filter out non-name keys and ensure they exist in the data
    const dataKeys = Object.keys(chartData[0] || {})
      .filter(key => key !== 'name' && key !== 'group');
    
    if (dataKeys.length === 0) {
      console.error("No valid data keys found in chart data:", chartData);
      return { data: [], layout: {} };
    }
    
    // Validate data - ensure all items have data for every key
    const validatedData = chartData.map(item => {
      const newItem = { ...item };
      dataKeys.forEach(key => {
        // If the value is not defined or is not a number, set it to null
        if (newItem[key] === undefined || newItem[key] === '' || isNaN(parseFloat(newItem[key]))) {
          newItem[key] = null;
        } else if (typeof newItem[key] !== 'number') {
          // Try to convert string values to numbers
          newItem[key] = parseFloat(newItem[key]);
        }
      });
      return newItem;
    });
    
    const type = chartConfig.type.toLowerCase();
    const data = [];
    const layout = {
      autosize: true,
      title: chartTitle,
      margin: { l: 50, r: 30, b: 50, t: 50, pad: 4 },
      paper_bgcolor: 'white',
      plot_bgcolor: 'white',
      font: { size: 10 },
      showlegend: true,
      colorway: chartColors
    };
    
    // Helper function to safely format values for display
    const formatValue = (value) => {
      if (value === null || value === undefined || isNaN(value)) {
        return '';
      }
      // Try to format with 1 decimal place
      try {
        return value.toFixed(1);
      } catch (e) {
        return String(value);
      }
    };
    
    switch (type) {
      case 'bar':
        // Check if data has group information
        const hasGroups = validatedData.some(item => item.group !== undefined);
        
        if (hasGroups) {
          // Get unique groups
          const groupSet = new Set();
          validatedData.forEach(item => {
            if (item.group) groupSet.add(item.group);
          });
          const uniqueGroups = Array.from(groupSet);
          
          // Create bar traces grouped by the group attribute (typically Category)
          dataKeys.forEach((key, keyIndex) => {
            uniqueGroups.forEach((groupVal, groupIndex) => {
              // Filter data for this group
              const groupData = validatedData.filter(item => item.group === groupVal);
              
              // Skip if no data for this group
              if (groupData.length === 0) return;
              
              // Add a trace for this group
              data.push({
                x: groupData.map(item => item.name),
                y: groupData.map(item => item[key]),
                type: 'bar',
                name: `${groupVal} - ${key}`,
                marker: {
                  color: chartColors[groupIndex % chartColors.length]
                },
                text: groupData.map(item => formatValue(item[key])),
                textposition: 'auto'
              });
            });
          });
        } else {
          // Original logic for non-grouped data
          dataKeys.forEach((key, index) => {
            data.push({
              x: validatedData.map(item => item.name),
              y: validatedData.map(item => item[key]),
              type: 'bar',
              name: key,
              marker: {
                color: chartColors[index % chartColors.length]
              },
              text: validatedData.map(item => formatValue(item[key])),
              textposition: 'auto'
            });
          });
        }
        break;
        
      case 'column':
        dataKeys.forEach((key, index) => {
          data.push({
            y: validatedData.map(item => item.name),
            x: validatedData.map(item => item[key]),
            type: 'bar',
            name: key,
            orientation: 'h',
            marker: {
              color: chartColors[index % chartColors.length]
            },
            text: validatedData.map(item => formatValue(item[key])),
            textposition: 'auto'
          });
        });
        break;
        
      case 'line':
        dataKeys.forEach((key, index) => {
          data.push({
            x: validatedData.map(item => item.name),
            y: validatedData.map(item => item[key]),
            type: 'scatter',
            mode: 'lines+markers+text',
            name: key,
            line: {
              color: chartColors[index % chartColors.length]
            },
            text: validatedData.map(item => formatValue(item[key])),
            textposition: 'top'
          });
        });
        break;
        
      case 'pie':
        data.push({
          labels: validatedData.map(item => item.name),
          values: validatedData.map(item => item[dataKeys[0]]),
          type: 'pie',
          marker: {
            colors: chartColors
          },
          textinfo: 'label+percent',
          insidetextorientation: 'radial'
        });
        layout.showlegend = true;
        break;
        
      case 'area':
        dataKeys.forEach((key, index) => {
          data.push({
            x: validatedData.map(item => item.name),
            y: validatedData.map(item => item[key]),
            type: 'scatter',
            mode: 'lines',
            name: key,
            fill: 'tozeroy',
            line: {
              color: chartColors[index % chartColors.length]
            }
          });
        });
        break;
        
      case 'radar':
        data.push({
          type: 'scatterpolar',
          r: validatedData.map(item => item[dataKeys[0]]),
          theta: validatedData.map(item => item.name),
          fill: 'toself',
          name: dataKeys[0]
        });
        
        if (dataKeys.length > 1) {
          dataKeys.slice(1).forEach((key, index) => {
            data.push({
              type: 'scatterpolar',
              r: validatedData.map(item => item[key]),
              theta: validatedData.map(item => item.name),
              fill: 'toself',
              name: key,
              marker: {
                color: chartColors[(index + 1) % chartColors.length]
              }
            });
          });
        }
        
        layout.polar = {
          radialaxis: {
            visible: true,
            range: [0, Math.max(...validatedData.flatMap(item => dataKeys.map(key => item[key] || 0))) * 1.2]
          }
        };
        break;
        
      case 'scatter':
        // Check if data has group information
        const hasGroupsScatter = validatedData.some(item => item.group !== undefined);
        
        // Check data format - scatter plots from backend may use x,y properties directly
        const usesDirectXY = validatedData.some(item => item.x !== undefined && item.y !== undefined);
        
        if (hasGroupsScatter) {
          // Get unique groups
          const groupSet = new Set();
          validatedData.forEach(item => {
            if (item.group) groupSet.add(item.group);
          });
          const uniqueGroups = Array.from(groupSet);
          
          // Create scatter traces grouped by the group attribute
          uniqueGroups.forEach((groupVal, groupIndex) => {
            // Filter data for this group
            const groupData = validatedData.filter(item => item.group === groupVal);
            
            // Skip if no data for this group
            if (groupData.length === 0) return;
            
            // Add a trace for this group
            if (usesDirectXY) {
              // Use x,y properties directly (backend format)
              data.push({
                x: groupData.map(item => item.x),
                y: groupData.map(item => item.y),
                mode: 'markers',
                type: 'scatter',
                name: groupVal,
                marker: {
                  color: chartColors[groupIndex % chartColors.length],
                  size: 10
                },
                text: groupData.map(item => item.name),
                hoverinfo: 'text+x+y'
              });
            } else {
              // Use dataKeys (standard format)
              data.push({
                x: groupData.map(item => item[dataKeys[0]]),
                y: groupData.map(item => item[dataKeys[1] || dataKeys[0]]),
                mode: 'markers',
                type: 'scatter',
                name: groupVal,
                marker: {
                  color: chartColors[groupIndex % chartColors.length],
                  size: 10
                },
                text: groupData.map(item => item.name),
                hoverinfo: 'text+x+y'
              });
            }
          });
        } else {
          // Original logic for non-grouped data
          if (usesDirectXY) {
            // Use x,y properties directly (backend format)
            data.push({
              x: validatedData.map(item => item.x),
              y: validatedData.map(item => item.y),
              mode: 'markers',
              type: 'scatter',
              marker: {
                color: chartColors[0],
                size: 10
              },
              text: validatedData.map(item => item.name),
              hoverinfo: 'text+x+y'
            });
          } else {
            // Use dataKeys (standard format)
            data.push({
              x: validatedData.map(item => item[dataKeys[0]]),
              y: validatedData.map(item => item[dataKeys[1] || dataKeys[0]]),
              mode: 'markers',
              type: 'scatter',
              marker: {
                color: chartColors[0],
                size: 10
              },
              text: validatedData.map(item => item.name),
              hoverinfo: 'text+x+y'
            });
          }
        }
        break;
        
      case 'funnel':
        data.push({
          type: 'funnel',
          y: validatedData.map(item => item.name),
          x: validatedData.map(item => item[dataKeys[0]]),
          textinfo: 'value+percent initial',
          marker: {
            color: chartColors
          }
        });
        layout.funnelmode = 'stack';
        break;
        
      case 'radialbar':
        // Using Plotly's polar chart as an alternative to RadialBar
        const values = validatedData.map(item => item[dataKeys[0]]);
        const maxValue = Math.max(...values) * 1.2;
        
        validatedData.forEach((item, index) => {
          data.push({
            type: 'scatterpolar',
            r: [item[dataKeys[0]], item[dataKeys[0]]],
            theta: [0, 90], // Partial circle for each item
            name: item.name,
            marker: {
              color: chartColors[index % chartColors.length]
            },
            fill: 'toself'
          });
        });
        
        layout.polar = {
          radialaxis: {
            visible: true,
            range: [0, maxValue]
          }
        };
        break;
        
      case 'treemap':
        data.push({
          type: 'treemap',
          labels: validatedData.map(item => item.name),
          parents: validatedData.map(() => ''),
          values: validatedData.map(item => item[dataKeys[0]]),
          textinfo: 'label+value+percent',
          marker: {
            colorway: chartColors
          }
        });
        break;
        
      case 'composed':
        // Implement mixed chart types (bar for first data key, line for second)
        if (dataKeys.length > 0) {
          data.push({
            x: validatedData.map(item => item.name),
            y: validatedData.map(item => item[dataKeys[0]]),
            type: 'bar',
            name: dataKeys[0],
            marker: {
              color: chartColors[0]
            }
          });
        }
        
        if (dataKeys.length > 1) {
          data.push({
            x: validatedData.map(item => item.name),
            y: validatedData.map(item => item[dataKeys[1]]),
            type: 'scatter',
            mode: 'lines+markers',
            name: dataKeys[1],
            yaxis: 'y2',
            line: {
              color: chartColors[1]
            }
          });
          
          // Setup secondary y-axis
          layout.yaxis2 = {
            title: dataKeys[1],
            overlaying: 'y',
            side: 'right'
          };
        }
        
        if (dataKeys.length > 2) {
          data.push({
            x: validatedData.map(item => item.name),
            y: validatedData.map(item => item[dataKeys[2]]),
            type: 'scatter',
            mode: 'lines',
            fill: 'tozeroy',
            name: dataKeys[2],
            line: {
              color: chartColors[2]
            }
          });
        }
        break;
        
      default:
        // Default to a bar chart
        dataKeys.forEach((key, index) => {
          data.push({
            x: validatedData.map(item => item.name),
            y: validatedData.map(item => item[key]),
            type: 'bar',
            name: key,
            marker: {
              color: chartColors[index % chartColors.length]
            }
          });
        });
    }
    
    return { data, layout };
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
    
    if (isSelected) {
      chartStyle.border = '2px solid #3b82f6';
      chartStyle.zIndex = 100;
      chartStyle.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.1)';
    }
    
    // Default resize handle component for reuse
    const resizeHandle = isSelected && (
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
          if (handleResizeStart) {
            handleResizeStart(e);
          }
        }}
      />
    );
    
    // Error container for displaying chart errors
    const ErrorContainer = ({ message, details }) => (
      <div 
        style={chartStyle} 
        className="p-4 flex flex-col"
        draggable={isSelected}
        onDragStart={(e) => {
          e.stopPropagation();
          if (handleChartDragStart) {
            handleChartDragStart(e, startCell.row, startCell.col);
          }
        }}
      >
        <div className="p-2 border-b bg-gray-50 flex justify-between items-center">
          <h3 className="text-sm font-semibold text-red-600">Chart Error</h3>
        </div>
        <div className="flex-1 p-2 overflow-auto bg-red-50 text-red-800 text-sm">
          <p className="font-semibold mb-2">{message}</p>
          {details && <p className="text-xs">{details}</p>}
        </div>
        {resizeHandle}
      </div>
    );
    
    // Validate chart config
    if (!chartConfig) {
      return <ErrorContainer message="Invalid chart configuration" details="Chart configuration is missing or invalid." />;
    }
    
    // Validate chart type
    if (!chartConfig.type) {
      return <ErrorContainer message="Missing chart type" details="The chart configuration does not specify a chart type." />;
    }
    
    // Validate chart data
    if (!chartConfig.data) {
      return <ErrorContainer message="Missing chart data" details="The chart data is missing from the configuration." />;
    }
    
    if (!Array.isArray(chartConfig.data)) {
      return <ErrorContainer 
        message="Invalid chart data format" 
        details={`Expected an array of data objects, but got: ${typeof chartConfig.data}`} 
      />;
    }
    
    if (chartConfig.data.length === 0) {
      return <ErrorContainer message="Empty chart data" details="The chart data array is empty." />;
    }
    
    // Check if we have valid data points
    const firstItem = chartConfig.data[0];
    const dataKeys = Object.keys(firstItem || {}).filter(key => key !== 'name' && key !== 'group');
    
    if (dataKeys.length === 0) {
      return <ErrorContainer 
        message="No valid data values" 
        details="The chart data doesn't contain any data fields to plot." 
      />;
    }
    
    // Get Plotly configuration
    try {
      const { data, layout } = ChartManager.createPlotlyConfig(chartConfig);
      
      if (data.length === 0) {
        return <ErrorContainer 
          message="Failed to create chart" 
          details="Could not create plot data from the configuration." 
        />;
      }
      
      // Configure Plotly options
      const plotConfig = {
        displayModeBar: false, // Hide the modebar
        responsive: true
      };
      
      // Adjust layout dimensions to fit the container
      const adjustedLayout = {
        ...layout,
        width: chartSize.width * CELL_WIDTH - 2,  // Account for borders
        height: chartSize.height * CELL_HEIGHT - 40,  // Account for header height
        autosize: true
      };

      return (
        <div 
          style={chartStyle}
          className="chart-container"
          draggable={isSelected}
          onDragStart={(e) => {
            e.stopPropagation();
            if (handleChartDragStart) {
              handleChartDragStart(e, startCell.row, startCell.col);
            }
          }}
        >
          <div className="p-2 border-b bg-gray-50 flex justify-between items-center">
            <h3 className="text-sm font-semibold">{chartConfig.title || 'Chart'}</h3>
          </div>
          <div style={{ height: 'calc(100% - 40px)' }}>
            <Plot
              data={data}
              layout={adjustedLayout}
              config={plotConfig}
              style={{ width: '100%', height: '100%' }}
            />
          </div>
          {resizeHandle}
        </div>
      );
    } catch (error) {
      console.error("Error rendering chart:", error);
      return <ErrorContainer 
        message="Error rendering chart" 
        details={error.message || "An unexpected error occurred while rendering the chart."} 
      />;
    }
  },

  // Render chart controls (for selected chart)
  renderChartControls: (selectedChart, data, chartSizes, setChartSizes, updateChartSize) => {
    if (!selectedChart) return null;
    
    const { row, col } = selectedChart;
    const chartConfig = ChartManager.getChartConfig(row, col, data);
    
    if (!chartConfig) return null;
    
    const chartKey = `${row}-${col}`;
    const size = chartSizes[chartKey] || chartConfig.size || DEFAULT_CHART_SIZE;
    
    const handleSizeChange = (e, dimension) => {
      const newSize = { ...size };
      const value = parseInt(e.target.value);
      if (!isNaN(value) && value > 0) {
        newSize[dimension] = value;
        
        // Update the chart sizes state
        const newChartSizes = { ...chartSizes };
        newChartSizes[chartKey] = newSize;
        setChartSizes(newChartSizes);
        
        // Actually resize the chart in the data grid
        updateChartSize(row, col, newSize);
      }
    };
    
    return (
      <div className="absolute bottom-4 right-4 bg-white rounded-lg shadow-lg p-3 z-50 border border-gray-200 text-sm">
        <h3 className="font-semibold mb-2 text-gray-700">Chart Options</h3>
        <div className="flex flex-col space-y-2">
          <div className="flex items-center">
            <label className="mr-2 w-16 text-gray-600">Width:</label>
            <input 
              type="number" 
              min="1" 
              max="20"
              value={size.width}
              onChange={(e) => handleSizeChange(e, 'width')}
              className="border border-gray-300 rounded px-2 py-1 w-16"
            />
            <span className="ml-1 text-gray-500 text-xs">cells</span>
          </div>
          <div className="flex items-center">
            <label className="mr-2 w-16 text-gray-600">Height:</label>
            <input 
              type="number" 
              min="1" 
              max="40"
              value={size.height}
              onChange={(e) => handleSizeChange(e, 'height')}
              className="border border-gray-300 rounded px-2 py-1 w-16"
            />
            <span className="ml-1 text-gray-500 text-xs">cells</span>
          </div>
        </div>
      </div>
    );
  }
};

export default ChartManager;