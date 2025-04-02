import React, { useState, useRef, useEffect } from 'react';
import {
    LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
    XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, AreaChart, Area,
    RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
    ScatterChart, Scatter, RadialBarChart, RadialBar,
    ComposedChart, Treemap
} from 'recharts';

// Custom component for Treemap to display labels inside
const CustomizedTreemapContent = (props) => {
    const { depth, x, y, width, height, name, value } = props;
  
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
    
    // Render the appropriate chart type
    const renderChart = () => {
        switch (chartConfig.type.toLowerCase()) {
            case 'bar':
                return (
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
                );
            case 'column':
                return (
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
                );
            case 'line':
                return (
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
                );
            case 'pie':
                return (
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
                );
            // Include all other chart types from your original implementation
            case 'area':
                return (
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
                );
            case 'radar':
                return (
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
                );
                
            case 'scatter':
                return (
                    <ResponsiveContainer width="100%" height="90%">
                        <ScatterChart>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis 
                                type="number"
                                dataKey={dataKeys[0]}
                                name={dataKeys[0]}
                            />
                            <YAxis 
                                type="number" 
                                dataKey={dataKeys[1] || dataKeys[0]}
                                name={dataKeys[1] || dataKeys[0]}
                            />
                            <Tooltip 
                                cursor={{ strokeDasharray: '3 3' }}
                                formatter={(value) => [value.toFixed(2), '']}
                            />
                            <Legend />
                            <Scatter
                                name={dataKeys[0]}
                                data={chartData}
                                fill={chartColors[0]}
                            />
                        </ScatterChart>
                    </ResponsiveContainer>
                );
                
            case 'funnel':
                // For funnel charts, we'll use a simple Bar chart with some styling
                return (
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
                );
                
            case 'radialbar':
                return (
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
                );
                
            case 'composed':
                return (
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
                );
                
            case 'treemap':
                return (
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
                );
            default:
                return (
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
                );
        }
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
            {renderChart()}
            
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