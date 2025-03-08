import React from 'react';
import {
    LineChart, Line, BarChart, Bar, PieChart, Pie,
    XAxis, YAxis, CartesianGrid, Tooltip, Legend,
    ResponsiveContainer, AreaChart, Area
} from 'recharts';

const ChartMessage = ({ data, chartConfig }) => {
    if (!data || !chartConfig) return null;

    const renderChart = () => {
        switch (chartConfig.type.toLowerCase()) {
            case 'bar':
                return (
                    <BarChart data={data}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey={chartConfig.xAxis} />
                        <YAxis />
                        <Tooltip />
                        <Legend />
                        <Bar dataKey={chartConfig.yAxis} fill="#8884d8" />
                    </BarChart>
                );

            case 'line':
                return (
                    <LineChart data={data}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey={chartConfig.xAxis} />
                        <YAxis />
                        <Tooltip />
                        <Legend />
                        <Line type="monotone" dataKey={chartConfig.yAxis} stroke="#8884d8" />
                    </LineChart>
                );

            case 'pie':
                return (
                    <PieChart>
                        <Pie
                            data={data}
                            dataKey={chartConfig.yAxis}
                            nameKey={chartConfig.xAxis}
                            cx="50%"
                            cy="50%"
                            outerRadius={80}
                            fill="#8884d8"
                            label
                        />
                        <Tooltip />
                        <Legend />
                    </PieChart>
                );

            case 'area':
                return (
                    <AreaChart data={data}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey={chartConfig.xAxis} />
                        <YAxis />
                        <Tooltip />
                        <Legend />
                        <Area type="monotone" dataKey={chartConfig.yAxis} fill="#8884d8" />
                    </AreaChart>
                );

            default:
                return <div>Unsupported chart type</div>;
        }
    };

    return (
        <div className="mt-4 bg-white rounded-lg p-4 shadow-lg">
            <h3 className="text-sm font-semibold mb-2">
                {chartConfig.title || `${chartConfig.type} Chart`}
            </h3>
            <div className="w-full h-[300px]">
                <ResponsiveContainer>
                    {renderChart()}
                </ResponsiveContainer>
            </div>
        </div>
    );
};

export default ChartMessage; 