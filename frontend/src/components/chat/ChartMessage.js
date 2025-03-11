import React from 'react';
import {
    LineChart, Line, BarChart, Bar, PieChart, Pie,Cell,
    XAxis, YAxis, CartesianGrid, Tooltip, Legend,
    ResponsiveContainer, AreaChart, Area
} from 'recharts';

const ChartMessage = ({ data, chartConfig }) => {
    console.log('ChartMessage received data:', {
        dataPresent: !!data,
        dataLength: Array.isArray(data) ? data.length : 0,
        sampleData: Array.isArray(data) ? data.slice(0, 2) : null
    });
    console.log('ChartMessage received config:', {
        configPresent: !!chartConfig,
        type: chartConfig?.type,
        hasDatasets: !!chartConfig?.data?.datasets,
        datasetsLength: chartConfig?.data?.datasets?.length || 0
    });

    if (!data || !chartConfig) {
        console.error('Missing required props:', { 
            hasData: !!data, 
            hasConfig: !!chartConfig 
        });
        return <div>Missing required data for chart visualization</div>;
    }

    // Transform data to the format Recharts expects
    const transformData = () => {
        console.log('ChartMessage: Starting data transformation');
        
        try {
            // If we have Chart.js format JSON
            if (chartConfig.data?.labels && chartConfig.data?.datasets) {
                console.log('ChartMessage: Processing Chart.js format data', {
                    labels: chartConfig.data.labels,
                    datasetsCount: chartConfig.data.datasets.length,
                    firstDataset: chartConfig.data.datasets[0]
                });
                
                const { labels, datasets } = chartConfig.data;
                
                if (!Array.isArray(labels) || !Array.isArray(datasets)) {
                    console.error('Invalid labels or datasets:', { labels, datasets });
                    return [];
                }
                
                // Transform the data into the format Recharts expects
                const transformed = labels.map((label, index) => {
                    const item = { name: String(label || '') }; // Ensure label is a string
                    datasets.forEach((dataset, datasetIndex) => {
                        if (dataset && Array.isArray(dataset.data)) {
                            // Handle case where data array might be shorter than labels
                            let value = 0;
                            if (index < dataset.data.length) {
                                value = !isNaN(dataset.data[index]) ? Number(dataset.data[index]) : 0;
                            }
                            const key = dataset.label || `Value ${datasetIndex + 1}`;
                            item[key] = value;
                        }
                    });
                    return item;
                });
                
                console.log('ChartMessage: Transformed data:', {
                    count: transformed.length,
                    sample: transformed.slice(0, 2),
                    fullData: transformed // Log full data for debugging
                });
                return transformed;
            }
            
            // If we have array data
            if (Array.isArray(data)) {
                console.log('ChartMessage: Processing array data', {
                    length: data.length,
                    sample: data.slice(0, 2)
                });
                
                if (data.length === 0) {
                    console.error('Empty data array');
                    return [];
                }
                
                // If data is already formatted correctly, return as is
                if ('name' in data[0]) {
                    console.log('ChartMessage: Data already in correct format');
                    return data;
                }
                
                // For line charts, try to use Row ID or index as name if available
                const keys = Object.keys(data[0]);
                const nameKey = keys.find(k => k.toLowerCase().includes('row') || k.toLowerCase().includes('id')) || keys[0];
                const valueKey = keys.find(k => k.toLowerCase().includes('profit')) || keys[1];
                
                const transformed = data.map((item, index) => ({
                    name: String(item[nameKey] || (index + 1)),
                    [valueKey]: Number(item[valueKey]) || 0
                }));

                console.log('ChartMessage: Transformed array data:', {
                    count: transformed.length,
                    sample: transformed.slice(0, 2),
                    fullData: transformed // Log full data for debugging
                });
                return transformed;
            }
            
            console.error('Data format not recognized');
            return [];
        } catch (error) {
            console.error('Error transforming data:', error);
            return [];
        }
    };

    const chartData = transformData();
    console.log('ChartMessage: Final chart data:', {
        count: chartData.length,
        sample: chartData.slice(0, 2),
        keys: chartData.length > 0 ? Object.keys(chartData[0]) : []
    });
    
    if (chartData.length === 0) {
        return <div>No data available for chart visualization</div>;
    }
    
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
            const keys = Object.keys(chartData[0]).filter(key => key !== 'name');
            console.log('ChartMessage: Extracted data keys:', keys);
            return keys;
        }
        
        return ['value'];
    };
    
    const dataKeys = getDataKeys();
    console.log('ChartMessage: Using data keys:', dataKeys);
    
    // Function to generate consistent colors
    const getColor = (index) => {
        const colors = ['#8884d8', '#82ca9d', '#ffc658', '#ff8042', '#0088FE', '#00C49F', '#FFBB28', '#FF8042'];
        return colors[index % colors.length];
    };

    const renderChart = () => {
        const chartType = chartConfig.type ? chartConfig.type.toLowerCase() : 'bar';
        
        // Ensure we have valid data
        if (!chartData || chartData.length === 0) {
            console.error('No valid chart data available');
            return <div>No data available for chart</div>;
        }

        console.log('Rendering chart with type:', chartType);
        console.log('Using chart data:', chartData);
        console.log('Using data keys:', dataKeys);
        
        // Special handling for line charts
        if (chartType === 'line') {
            return (
                <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                        dataKey="name"
                        label={{ value: 'Row ID', position: 'bottom' }}
                    />
                    <YAxis 
                        label={{ value: 'Profit', angle: -90, position: 'left' }}
                    />
                    <Tooltip />
                    <Legend />
                    {dataKeys.map((key, index) => (
                        <Line 
                            key={key} 
                            type="monotone" 
                            dataKey={key} 
                            stroke={chartConfig.data?.datasets?.[index]?.borderColor || getColor(index)}
                            name={key}
                            dot={{ stroke: chartConfig.data?.datasets?.[index]?.borderColor || getColor(index), strokeWidth: 2, fill: 'white' }}
                            connectNulls={true}
                        />
                    ))}
                </LineChart>
            );
        }
        
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
            <div style={{ width: '100%', height: '400px', minHeight: '300px' }}>
                <ResponsiveContainer width="100%" height="100%">
                    {renderChart()}
                </ResponsiveContainer>
            </div>
        </div>
    );
};

export default ChartMessage;