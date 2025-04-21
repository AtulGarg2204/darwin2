import React, { useState, useRef, useEffect } from 'react';
import Plot from 'react-plotly.js';

const DraggableChartComponent = ({ 
    chartConfig, 
    initialPosition,
    initialSize,
    onPositionChange,
    onSizeChange,
    onSelect,
    isSelected,
    gridRef,
    cellWidth,
    cellHeight,
    rowHeaderWidth
}) => {
    const [position, setPosition] = useState(initialPosition || { top: 0, left: 0 });
    const [size, setSize] = useState(initialSize || { width: 600, height: 400 });
    const [isDragging, setIsDragging] = useState(false);
    const [resizeMode, setResizeMode] = useState(null); // null, 'n', 'ne', 'e', 'se', 's', 'sw', 'w', 'nw'
    const chartRef = useRef(null);
    const dragOffset = useRef({ x: 0, y: 0 });
    
    // Handle selection
    const handleSelect = (e) => {
        e.stopPropagation();
        if (onSelect) {
            onSelect();
        }
    };
    
    // Drag handlers
    const handleDragStart = (e) => {
        e.stopPropagation();
        if (e.button !== 0) return; // Only left mouse button
        setIsDragging(true);
        
        // Calculate offset relative to chart position
        const rect = chartRef.current.getBoundingClientRect();
        dragOffset.current = {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
        };
        
        // Add temporary event listeners to window
        window.addEventListener('mousemove', handleDragMove);
        window.addEventListener('mouseup', handleDragEnd);
    };
    
    const handleDragMove = (e) => {
        if (!isDragging) return;
        
        // Get grid bounds if grid reference is provided
        let gridBounds = null;
        if (gridRef && gridRef.current) {
            gridBounds = gridRef.current.getBoundingClientRect();
        }
        
        // Calculate new position
        let newLeft = e.clientX - dragOffset.current.x;
        let newTop = e.clientY - dragOffset.current.y;
        
        // Constrain to grid if bounds are available
        if (gridBounds) {
            newLeft = Math.max(rowHeaderWidth, Math.min(newLeft, gridBounds.width - size.width));
            newTop = Math.max(cellHeight, Math.min(newTop, gridBounds.height - size.height));
            
            // Snap to cell grid
            newLeft = Math.round((newLeft - rowHeaderWidth) / cellWidth) * cellWidth + rowHeaderWidth;
            newTop = Math.round((newTop - cellHeight) / cellHeight) * cellHeight + cellHeight;
        }
        
        setPosition({
            left: newLeft,
            top: newTop
        });
    };
    
    const handleDragEnd = () => {
        setIsDragging(false);
        window.removeEventListener('mousemove', handleDragMove);
        window.removeEventListener('mouseup', handleDragEnd);
        
        // Notify parent of position change
        if (onPositionChange) {
            onPositionChange(position);
        }
    };
    
    // Resize handlers
    const handleResizeStart = (e, mode) => {
        e.stopPropagation();
        if (e.button !== 0) return; // Only left mouse button
        setResizeMode(mode);
        
        // Add temporary event listeners to window
        window.addEventListener('mousemove', handleResizeMove);
        window.addEventListener('mouseup', handleResizeEnd);
    };
    
    const handleResizeMove = (e) => {
        if (!resizeMode) return;
        
        const rect = chartRef.current.getBoundingClientRect();
        let newWidth = size.width;
        let newHeight = size.height;
        let newLeft = position.left;
        let newTop = position.top;
        
        // Handle width changes
        if (resizeMode.includes('e')) {
            newWidth = Math.max(200, e.clientX - rect.left + (rect.right - e.clientX));
            // Snap to grid
            newWidth = Math.round(newWidth / cellWidth) * cellWidth;
        } else if (resizeMode.includes('w')) {
            const widthChange = rect.left - e.clientX;
            newWidth = Math.max(200, size.width + widthChange);
            // Snap to grid
            newWidth = Math.round(newWidth / cellWidth) * cellWidth;
            newLeft = position.left - (newWidth - size.width);
        }
        
        // Handle height changes
        if (resizeMode.includes('s')) {
            newHeight = Math.max(150, e.clientY - rect.top + (rect.bottom - e.clientY));
            // Snap to grid
            newHeight = Math.round(newHeight / cellHeight) * cellHeight;
        } else if (resizeMode.includes('n')) {
            const heightChange = rect.top - e.clientY;
            newHeight = Math.max(150, size.height + heightChange);
            // Snap to grid
            newHeight = Math.round(newHeight / cellHeight) * cellHeight;
            newTop = position.top - (newHeight - size.height);
        }
        
        setSize({ width: newWidth, height: newHeight });
        setPosition({ left: newLeft, top: newTop });
    };
    
    const handleResizeEnd = () => {
        setResizeMode(null);
        window.removeEventListener('mousemove', handleResizeMove);
        window.removeEventListener('mouseup', handleResizeEnd);
        
        // Notify parent of size change
        if (onSizeChange) {
            onSizeChange(size);
        }
    };
    
    // Clean up event listeners when unmounting
    useEffect(() => {
        return () => {
            window.removeEventListener('mousemove', handleDragMove);
            window.removeEventListener('mouseup', handleDragEnd);
            window.removeEventListener('mousemove', handleResizeMove);
            window.removeEventListener('mouseup', handleResizeEnd);
        };
    }, []);
    
    // Extract chart data and settings
    const chartData = chartConfig.data || [];
    const chartTitle = chartConfig.title || 'Chart';
    const chartColors = chartConfig.colors || ['#8884d8', '#82ca9d', '#ffc658', '#ff8042'];
    const dataKeys = Object.keys(chartData[0] || {}).filter(key => key !== 'name');
    
    if (dataKeys.length === 0) {
        return <div>No data keys found in chart data</div>;
    }
    
    // Styles for the chart container
    const chartStyle = {
        position: 'absolute',
        left: `${position.left}px`,
        top: `${position.top}px`,
        width: `${size.width}px`,
        height: `${size.height}px`,
        backgroundColor: 'white',
        border: isSelected ? '2px solid #3b82f6' : '1px solid #ddd',
        borderRadius: '4px',
        overflow: 'hidden',
        zIndex: isSelected ? 100 : 10,
        boxShadow: isSelected ? '0 4px 12px rgba(0, 0, 0, 0.1)' : 'none',
        cursor: isDragging ? 'grabbing' : 'grab'
    };
    
    // Styles for resize handles
    const getResizeHandleStyle = (position) => ({
        position: 'absolute',
        width: '10px',
        height: '10px',
        backgroundColor: isSelected ? '#3b82f6' : 'transparent',
        border: isSelected ? '1px solid white' : 'none',
        borderRadius: '50%',
        cursor: `${position}-resize`,
        zIndex: 15,
        ...(position === 'n' && { top: '-5px', left: '50%', transform: 'translateX(-50%)' }),
        ...(position === 'ne' && { top: '-5px', right: '-5px' }),
        ...(position === 'e' && { top: '50%', right: '-5px', transform: 'translateY(-50%)' }),
        ...(position === 'se' && { bottom: '-5px', right: '-5px' }),
        ...(position === 's' && { bottom: '-5px', left: '50%', transform: 'translateX(-50%)' }),
        ...(position === 'sw' && { bottom: '-5px', left: '-5px' }),
        ...(position === 'w' && { top: '50%', left: '-5px', transform: 'translateY(-50%)' }),
        ...(position === 'nw' && { top: '-5px', left: '-5px' })
    });
    
    // Create Plotly data and layout configuration
    const createPlotlyConfig = () => {
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
        
        switch (type) {
            case 'bar':
                // Check if data has group information
                const hasGroups = chartData.some(item => item.group !== undefined);
                
                if (hasGroups) {
                    // Get unique groups
                    const groupSet = new Set();
                    chartData.forEach(item => {
                        if (item.group) groupSet.add(item.group);
                    });
                    const uniqueGroups = Array.from(groupSet);
                    
                    // Create bar traces grouped by the group attribute (typically Category)
                    dataKeys.forEach((key, keyIndex) => {
                        uniqueGroups.forEach((groupVal, groupIndex) => {
                            // Filter data for this group
                            const groupData = chartData.filter(item => item.group === groupVal);
                            
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
                                text: groupData.map(item => item[key]?.toFixed(1)),
                                textposition: 'auto'
                            });
                        });
                    });
                } else {
                    // Original logic for non-grouped data
                    dataKeys.forEach((key, index) => {
                        data.push({
                            x: chartData.map(item => item.name),
                            y: chartData.map(item => item[key]),
                            type: 'bar',
                            name: key,
                            marker: {
                                color: chartColors[index % chartColors.length]
                            },
                            text: chartData.map(item => item[key]?.toFixed(1)),
                            textposition: 'auto'
                        });
                    });
                }
                break;
                
            case 'column':
                dataKeys.forEach((key, index) => {
                    data.push({
                        y: chartData.map(item => item.name),
                        x: chartData.map(item => item[key]),
                        type: 'bar',
                        name: key,
                        orientation: 'h',
                        marker: {
                            color: chartColors[index % chartColors.length]
                        },
                        text: chartData.map(item => item[key]?.toFixed(1)),
                        textposition: 'auto'
                    });
                });
                break;
                
            case 'line':
                dataKeys.forEach((key, index) => {
                    data.push({
                        x: chartData.map(item => item.name),
                        y: chartData.map(item => item[key]),
                        type: 'scatter',
                        mode: 'lines+markers+text',
                        name: key,
                        line: {
                            color: chartColors[index % chartColors.length]
                        },
                        text: chartData.map(item => item[key]?.toFixed(1)),
                        textposition: 'top'
                    });
                });
                break;
                
            case 'pie':
                data.push({
                    labels: chartData.map(item => item.name),
                    values: chartData.map(item => item[dataKeys[0]]),
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
                        x: chartData.map(item => item.name),
                        y: chartData.map(item => item[key]),
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
                    r: chartData.map(item => item[dataKeys[0]]),
                    theta: chartData.map(item => item.name),
                    fill: 'toself',
                    name: dataKeys[0]
                });
                
                if (dataKeys.length > 1) {
                    dataKeys.slice(1).forEach((key, index) => {
                        data.push({
                            type: 'scatterpolar',
                            r: chartData.map(item => item[key]),
                            theta: chartData.map(item => item.name),
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
                        range: [0, Math.max(...chartData.flatMap(item => dataKeys.map(key => item[key] || 0))) * 1.2]
                    }
                };
                break;
                
            case 'scatter':
                // Check if data has group information
                const hasGroupsScatter = chartData.some(item => item.group !== undefined);
                
                // Check data format - scatter plots from backend may use x,y properties directly
                const usesDirectXY = chartData.some(item => item.x !== undefined && item.y !== undefined);
                
                if (hasGroupsScatter) {
                    // Get unique groups
                    const groupSet = new Set();
                    chartData.forEach(item => {
                        if (item.group) groupSet.add(item.group);
                    });
                    const uniqueGroups = Array.from(groupSet);
                    
                    // Create scatter traces grouped by the group attribute
                    uniqueGroups.forEach((groupVal, groupIndex) => {
                        // Filter data for this group
                        const groupData = chartData.filter(item => item.group === groupVal);
                        
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
                            x: chartData.map(item => item.x),
                            y: chartData.map(item => item.y),
                            mode: 'markers',
                            type: 'scatter',
                            marker: {
                                color: chartColors[0],
                                size: 10
                            },
                            text: chartData.map(item => item.name),
                            hoverinfo: 'text+x+y'
                        });
                    } else {
                        // Use dataKeys (standard format)
                        data.push({
                            x: chartData.map(item => item[dataKeys[0]]),
                            y: chartData.map(item => item[dataKeys[1] || dataKeys[0]]),
                            mode: 'markers',
                            type: 'scatter',
                            marker: {
                                color: chartColors[0],
                                size: 10
                            },
                            text: chartData.map(item => item.name),
                            hoverinfo: 'text+x+y'
                        });
                    }
                }
                break;
                
            case 'funnel':
                data.push({
                    type: 'funnel',
                    y: chartData.map(item => item.name),
                    x: chartData.map(item => item[dataKeys[0]]),
                    textinfo: 'value+percent initial',
                    marker: {
                        color: chartColors
                    }
                });
                layout.funnelmode = 'stack';
                break;
                
            case 'radialbar':
                // Using Plotly's polar chart as an alternative to RadialBar
                const values = chartData.map(item => item[dataKeys[0]]);
                const maxValue = Math.max(...values) * 1.2;
                
                chartData.forEach((item, index) => {
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
                    labels: chartData.map(item => item.name),
                    parents: chartData.map(() => ''),
                    values: chartData.map(item => item[dataKeys[0]]),
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
                        x: chartData.map(item => item.name),
                        y: chartData.map(item => item[dataKeys[0]]),
                        type: 'bar',
                        name: dataKeys[0],
                        marker: {
                            color: chartColors[0]
                        }
                    });
                }
                
                if (dataKeys.length > 1) {
                    data.push({
                        x: chartData.map(item => item.name),
                        y: chartData.map(item => item[dataKeys[1]]),
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
                        x: chartData.map(item => item.name),
                        y: chartData.map(item => item[dataKeys[2]]),
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
                        x: chartData.map(item => item.name),
                        y: chartData.map(item => item[key]),
                        type: 'bar',
                        name: key,
                        marker: {
                            color: chartColors[index % chartColors.length]
                        }
                    });
                });
        }
        
        return { data, layout };
    };
    
    const { data, layout } = createPlotlyConfig();
    
    // Configure plot options for the Plotly component
    const plotConfig = {
        displayModeBar: false, // Hide the modebar
        responsive: true
    };
    
    return (
        <div 
            ref={chartRef}
            style={chartStyle}
            onClick={handleSelect}
            onMouseDown={handleDragStart}
            className="chart-container"
        >
            <div className="p-2 border-b bg-gray-50 flex justify-between items-center">
                <h3 className="text-sm font-semibold">{chartTitle}</h3>
                {isSelected && (
                    <div className="flex space-x-1">
                        <button 
                            className="text-xs bg-gray-200 hover:bg-gray-300 rounded px-2 py-1"
                            onClick={(e) => {
                                e.stopPropagation();
                                // Additional chart options could go here
                            }}
                        >
                            Edit
                        </button>
                    </div>
                )}
            </div>
            <div style={{ height: 'calc(100% - 40px)' }}>
                <Plot
                    data={data}
                    layout={{
                        ...layout,
                        width: size.width - 2, // Account for borders
                        height: size.height - 40, // Account for header
                        autosize: true
                    }}
                    config={plotConfig}
                    style={{ width: '100%', height: '100%' }}
                />
            </div>
            
            {/* Resize handles (only visible when selected) */}
            {isSelected && (
                <>
                    <div style={getResizeHandleStyle('n')} onMouseDown={(e) => handleResizeStart(e, 'n')}></div>
                    <div style={getResizeHandleStyle('ne')} onMouseDown={(e) => handleResizeStart(e, 'ne')}></div>
                    <div style={getResizeHandleStyle('e')} onMouseDown={(e) => handleResizeStart(e, 'e')}></div>
                    <div style={getResizeHandleStyle('se')} onMouseDown={(e) => handleResizeStart(e, 'se')}></div>
                    <div style={getResizeHandleStyle('s')} onMouseDown={(e) => handleResizeStart(e, 's')}></div>
                    <div style={getResizeHandleStyle('sw')} onMouseDown={(e) => handleResizeStart(e, 'sw')}></div>
                    <div style={getResizeHandleStyle('w')} onMouseDown={(e) => handleResizeStart(e, 'w')}></div>
                    <div style={getResizeHandleStyle('nw')} onMouseDown={(e) => handleResizeStart(e, 'nw')}></div>
                </>
            )}
        </div>
    );
};

export default DraggableChartComponent;