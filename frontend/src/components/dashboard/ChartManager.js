import React, { useState, useEffect, useRef } from 'react';
import DraggableChartComponent from './DraggableChartComponent';

// Constants
const CELL_WIDTH = 120; // Should match DataGrid
const CELL_HEIGHT = 32; // Should match DataGrid
const ROW_HEADER_WIDTH = 50; // Should match DataGrid
const DEFAULT_CHART_SIZE = { width: CELL_WIDTH * 5, height: CELL_HEIGHT * 10 };

const ChartManager = ({ 
    data, 
    setData, 
    gridRef,
    activeCell 
}) => {
    const [charts, setCharts] = useState([]);
    const [selectedChartIndex, setSelectedChartIndex] = useState(null);
    
    // Extract charts from data on mount or when data changes
    useEffect(() => {
        if (!data || data.length === 0) return;
        
        const extractedCharts = [];
        
        // Scan the data grid for chart cells
        for (let rowIndex = 0; rowIndex < data.length; rowIndex++) {
            const row = data[rowIndex];
            if (!row) continue;
            
            for (let colIndex = 0; colIndex < row.length; colIndex++) {
                const cellValue = row[colIndex];
                
                if (typeof cellValue === 'string' && cellValue.startsWith('CHART:') && cellValue.includes(':START')) {
                    try {
                        // Extract the chart configuration
                        const parts = cellValue.split(':');
                        const chartConfigStr = parts.slice(1, -1).join(':');
                        const chartConfig = JSON.parse(chartConfigStr);
                        
                        // Calculate initial position based on cell coordinates
                        const initialPosition = {
                            left: colIndex * CELL_WIDTH + ROW_HEADER_WIDTH,
                            top: rowIndex * CELL_HEIGHT + CELL_HEIGHT // Add header height
                        };
                        
                        extractedCharts.push({
                            id: `chart-${rowIndex}-${colIndex}`,
                            position: initialPosition,
                            size: DEFAULT_CHART_SIZE,
                            chartConfig,
                            gridPosition: { row: rowIndex, col: colIndex }
                        });
                    } catch (error) {
                        console.error("Error parsing chart from data:", error);
                    }
                }
            }
        }
        
        setCharts(extractedCharts);
    }, [data]);
    
    // Update chart position in state
    const handleChartPositionChange = (index, newPosition) => {
        setCharts(prev => {
            const updated = [...prev];
            updated[index] = {
                ...updated[index],
                position: newPosition
            };
            return updated;
        });
        
        // Calculate new grid position
        const rowIndex = Math.floor((newPosition.top - CELL_HEIGHT) / CELL_HEIGHT);
        const colIndex = Math.floor((newPosition.left - ROW_HEADER_WIDTH) / CELL_WIDTH);
        
        updateChartInData(index, rowIndex, colIndex);
    };
    
    // Update chart size in state
    const handleChartSizeChange = (index, newSize) => {
        setCharts(prev => {
            const updated = [...prev];
            updated[index] = {
                ...updated[index],
                size: newSize
            };
            return updated;
        });
    };
    
    // Select a chart
    const handleChartSelect = (index) => {
        setSelectedChartIndex(index);
    };
    
    // Update the chart position in the data grid
    const updateChartInData = (chartIndex, newRowIndex, newColIndex) => {
        const chart = charts[chartIndex];
        if (!chart) return;
        
        const oldRowIndex = chart.gridPosition.row;
        const oldColIndex = chart.gridPosition.col;
        
        // Create a deep copy of the data
        const newData = JSON.parse(JSON.stringify(data));
        
        // Clear old chart cells
        const CHART_SIZE = { width: 12, height: 25 }; // Should match the size in DataGrid
        for (let i = 0; i < CHART_SIZE.height; i++) {
            for (let j = 0; j < CHART_SIZE.width; j++) {
                if (newData[oldRowIndex + i] && newData[oldRowIndex + i][oldColIndex + j]) {
                    newData[oldRowIndex + i][oldColIndex + j] = '';
                }
            }
        }
        
        // Place chart at new position
        // Ensure we have enough rows and columns
        while (newData.length <= newRowIndex + CHART_SIZE.height) {
            newData.push(Array(newData[0]?.length || 1).fill(''));
        }
        
        // Mark the chart area
        for (let i = 0; i < CHART_SIZE.height; i++) {
            for (let j = 0; j < CHART_SIZE.width; j++) {
                if (!newData[newRowIndex + i]) {
                    newData[newRowIndex + i] = [];
                }
                
                if (i === 0 && j === 0) {
                    // Store chart configuration in the cell
                    newData[newRowIndex][newColIndex] = `CHART:${JSON.stringify(chart.chartConfig)}:START`;
                } else {
                    newData[newRowIndex + i][newColIndex + j] = 'CHART:OCCUPIED';
                }
            }
        }
        
        // Update the chart's grid position
        setCharts(prev => {
            const updated = [...prev];
            updated[chartIndex] = {
                ...updated[chartIndex],
                gridPosition: { row: newRowIndex, col: newColIndex }
            };
            return updated;
        });
        
        // Update the data
        setData(newData);
    };
    
    // Handle click outside charts to deselect
    useEffect(() => {
        const handleOutsideClick = (e) => {
            if (!e.target.closest('.chart-container')) {
                setSelectedChartIndex(null);
            }
        };
        
        document.addEventListener('mousedown', handleOutsideClick);
        return () => document.removeEventListener('mousedown', handleOutsideClick);
    }, []);
    
    return (
        <div className="absolute top-0 left-0 right-0 bottom-0 pointer-events-none">
            {charts.map((chart, index) => (
                <DraggableChartComponent
                    key={chart.id}
                    chartConfig={chart.chartConfig}
                    initialPosition={chart.position}
                    initialSize={chart.size}
                    onPositionChange={(newPosition) => handleChartPositionChange(index, newPosition)}
                    onSizeChange={(newSize) => handleChartSizeChange(index, newSize)}
                    onSelect={() => handleChartSelect(index)}
                    isSelected={selectedChartIndex === index}
                    gridRef={gridRef}
                    cellWidth={CELL_WIDTH}
                    cellHeight={CELL_HEIGHT}
                    rowHeaderWidth={ROW_HEADER_WIDTH}
                />
            ))}
        </div>
    );
};

export default ChartManager;