import React from 'react';
import {
    LineChart, Line, BarChart, Bar, PieChart, Pie,Cell,
    XAxis, YAxis, CartesianGrid, Tooltip, Legend,
    ResponsiveContainer, AreaChart, Area
} from 'recharts';

const ChartMessage = ({ data, chartConfig }) => {
    if (!data || !chartConfig) return null;

    // Transform data to the format Recharts expects
    const transformData = () => {
        // If the data is already in array format
        if (Array.isArray(data)) {
            // If we have received Chart.js format JSON
            if (chartConfig.data && chartConfig.data.labels) {
                const { labels, datasets } = chartConfig.data;
                return labels.map((label, index) => {
                    const item = { name: label };
                    datasets.forEach((dataset) => {
                        item[dataset.label || 'Value'] = dataset.data[index];
                    });
                    return item;
                });
            }
            
            // If we have backend format with xAxis and yAxis properties
            if (chartConfig.xAxis && chartConfig.yAxis) {
                return data.map(item => {
                    const result = { name: item[chartConfig.xAxis] };
                    
                    // Support for multiple y-axes if provided as array
                    if (Array.isArray(chartConfig.yAxis)) {
                        chartConfig.yAxis.forEach(y => {
                            result[y] = item[y];
                        });
                    } else {
                        result[chartConfig.yAxis] = item[chartConfig.yAxis];
                    }
                    
                    return result;
                });
            }
            
            // If data is already formatted correctly, return as is
            if (data.length > 0 && 'name' in data[0]) {
                return data;
            }
            
            // As a last resort, use the first property as name and second as value
            const keys = data.length > 0 ? Object.keys(data[0]) : [];
            if (keys.length >= 2) {
                return data.map(item => ({
                    name: item[keys[0]],
                    value: item[keys[1]]
                }));
            }
        }
        
        // Return empty array if data is not in expected format
        console.error("Data format not recognized:", data);
        return [];
    };

    const chartData = transformData();
    
    // Determine what data keys to use for the chart
    const getDataKeys = () => {
        // If chartConfig specifies yAxis, use it
        if (chartConfig.yAxis) {
            return Array.isArray(chartConfig.yAxis) ? chartConfig.yAxis : [chartConfig.yAxis];
        }
        
        // If using Chart.js format
        if (chartConfig.data && chartConfig.data.datasets) {
            return chartConfig.data.datasets.map(ds => ds.label || 'Value');
        }
        
        // Otherwise, get all keys except 'name'
        if (chartData.length > 0) {
            return Object.keys(chartData[0]).filter(key => key !== 'name');
        }
        
        return ['value'];
    };
    
    const dataKeys = getDataKeys();
    
    // Function to generate consistent colors
    const getColor = (index) => {
        const colors = ['#8884d8', '#82ca9d', '#ffc658', '#ff8042', '#0088FE', '#00C49F', '#FFBB28', '#FF8042'];
        return colors[index % colors.length];
    };

    const renderChart = () => {
        const chartType = chartConfig.type ? chartConfig.type.toLowerCase() : 'bar';
        
        switch (chartType) {
            case 'bar':
                return (
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
                                fill={getColor(index)} 
                                name={key}
                            />
                        ))}
                    </BarChart>
                );

            case 'line':
                return (
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
                                stroke={getColor(index)} 
                                name={key}
                            />
                        ))}
                    </LineChart>
                );

            case 'pie':
                // For pie charts with multiple data keys, we need to restructure the data
                if (dataKeys.length > 1) {
                    // Create a flattened structure for multiple series
                    const pieData = dataKeys.flatMap((key, keyIndex) => 
                        chartData.map((item, itemIndex) => ({
                            name: `${item.name} (${key})`,
                            value: Number(item[key]) || 0,
                            fill: getColor(keyIndex * chartData.length + itemIndex)
                        }))
                    );
                    
                    return (
                        <PieChart>
                            <Pie
                                data={pieData}
                                dataKey="value"
                                nameKey="name"
                                cx="50%"
                                cy="50%"
                                outerRadius={80}
                                fill="#8884d8"
                                label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                            >
                                {pieData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={entry.fill || getColor(index)} />
                                ))}
                            </Pie>
                            <Tooltip />
                            <Legend />
                        </PieChart>
                    );
                }
                
                // For single data key pie charts
                return (
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
                                <Cell key={`cell-${index}`} fill={getColor(index)} />
                            ))}
                        </Pie>
                        <Tooltip />
                        <Legend />
                    </PieChart>
                );

            case 'area':
                return (
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
                                fill={getColor(index)} 
                                stroke={getColor(index)} 
                                fillOpacity={0.6}
                                name={key}
                            />
                        ))}
                    </AreaChart>
                );

            default:
                return <div>Unsupported chart type: {chartType}</div>;
        }
    };

    // Extract chart title from config
    const chartTitle = chartConfig.title || 
                       (chartConfig.options && chartConfig.options.title ? 
                        chartConfig.options.title.text : 
                        `${chartConfig.type || 'Bar'} Chart`);

    return (
        <div className="mt-4 bg-white rounded-lg p-4 shadow-lg">
            <h3 className="text-sm font-semibold mb-2">{chartTitle}</h3>
            <div className="w-full h-64">
                <ResponsiveContainer>
                    {renderChart()}
                </ResponsiveContainer>
            </div>
        </div>
    );
};

export default ChartMessage;