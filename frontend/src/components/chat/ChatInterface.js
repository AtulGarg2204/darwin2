import React, { useState } from 'react';
import axios from 'axios';
import { useAuth } from '../../context/AuthContext';
import ChartMessage from './ChartMessage';

const ChatInterface = ({ recordId, data, activeCell, onChartRequest }) => {
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const { token } = useAuth();

    const handleSendMessage = async (e) => {
        e.preventDefault();
        if (!input.trim()) return;

        const userMessage = { text: input, sender: 'user' };
        setMessages(prev => [...prev, userMessage]);
        setInput('');
        setLoading(true);

        const userInput = input.toLowerCase();
        const isChartRequest = userInput.includes('chart') || 
                               userInput.includes('graph') || 
                               userInput.includes('plot') || 
                               userInput.includes('visualize') || 
                               userInput.includes('show');

        try {
            // Ensure we have valid data to send
            const processedData = Array.isArray(data) ? data : [];
            
            // Log the current state of data and recordId
            console.log('Current state:', {
                recordId,
                dataLength: processedData.length,
                sampleData: processedData.slice(0, 2),
                isChartRequest
            });

            const requestPayload = {
                message: input,
                recordId: recordId || null,
                includeChartSuggestion: isChartRequest,
                data: processedData
            };

            console.log('Sending request payload:', requestPayload);

            const res = await axios.post(
                `${process.env.REACT_APP_API_URL}/api/chat/analyze`,
                requestPayload,
                { headers: { 'x-auth-token': token } }
            );

            console.log('Received response:', res.data);

            let assistantMessage = {
                text: res.data.answer,
                sender: 'assistant'
            };

            // Add a note if the data was sampled
            if (res.data.data.length < processedData.length) {
                assistantMessage.text = `Note: Analysis is based on a sample of ${res.data.data.length} rows from the total ${processedData.length} rows.\n\n${assistantMessage.text}`;
            }

            if (res.data.chartConfig) {
                console.log('Processing chart configuration...');
                
                // Create a properly structured chart config
                const chartConfig = {
                    type: res.data.chartConfig.type || 'bar',
                    data: {
                        labels: res.data.chartConfig.data?.labels || [],
                        datasets: res.data.chartConfig.data?.datasets?.map(dataset => {
                            // Ensure dataset has all required properties
                            const processedData = Array.isArray(dataset.data) ? 
                                dataset.data.map(val => !isNaN(val) ? Number(val) : 0) : [];
                            
                            return {
                                label: dataset.label || 'Value',
                                data: processedData,
                                borderColor: dataset.borderColor || '#8884d8',
                                fill: dataset.fill || false,
                                tension: 0.4
                            };
                        }) || []
                    },
                    options: {
                        ...res.data.chartConfig.options,
                        responsive: true,
                        scales: {
                            x: {
                                title: {
                                    display: true,
                                    text: 'Row ID'
                                }
                            },
                            y: {
                                title: {
                                    display: true,
                                    text: 'Value'
                                }
                            }
                        }
                    }
                };
                
                console.log('Processed chart config:', {
                    type: chartConfig.type,
                    labelsCount: chartConfig.data.labels.length,
                    datasetsCount: chartConfig.data.datasets.length,
                    sampleDataset: chartConfig.data.datasets[0]
                });

                if (activeCell && typeof onChartRequest === 'function') {
                    console.log('Creating chart in grid at cell:', activeCell);
                    onChartRequest(chartConfig.type, activeCell, chartConfig);
                    assistantMessage.text += "\n\nI've created the chart at the selected cell.";
                    if (res.data.data.length < processedData.length) {
                        assistantMessage.text += "\nNote: The chart is based on sampled data for better visualization.";
                    }
                } else {
                    console.log('Showing chart in chat');
                    assistantMessage.chartConfig = chartConfig;
                    assistantMessage.chartData = res.data.data; // Use the sampled data
                    assistantMessage.text += "\n\nPlease select a cell in the grid where you'd like me to create this chart.";
                }
            }

            setMessages(prev => [...prev, assistantMessage]);
        } catch (err) {
            console.error('Chat error:', err);
            console.error('Error details:', {
                response: err.response?.data,
                message: err.message,
                status: err.response?.status
            });
            setMessages(prev => [...prev, {
                text: 'Sorry, I encountered an error processing your request. ' + 
                      (err.response?.data?.error || err.message),
                sender: 'assistant'
            }]);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex flex-col h-[600px] border rounded-lg shadow-md bg-white">
            <div className="p-4 border-b bg-indigo-600 text-white rounded-t-lg">
                <h2 className="text-xl font-semibold">Data Analysis Chat</h2>
                <p className="text-sm opacity-80">
                    Try: "Show me a bar chart of name and interviews" or "Create a line graph"
                </p>
            </div>

            <div className="flex-1 p-4 overflow-y-auto bg-gray-50">
                {messages.map((msg, index) => (
                    <div key={index} className={`mb-4 ${msg.sender === 'user' ? 'text-right' : 'text-left'}`}>
                        <div className={`inline-block p-3 rounded-lg max-w-[80%] ${
                            msg.sender === 'user' 
                                ? 'bg-indigo-500 text-white rounded-br-none' 
                                : 'bg-white border border-gray-200 rounded-bl-none'
                        }`}>
                            <p className="whitespace-pre-wrap">{msg.text}</p>
                            {msg.chartConfig && (
                                <ChartMessage 
                                    data={msg.chartData || data} 
                                    chartConfig={msg.chartConfig} 
                                />
                            )}
                        </div>
                    </div>
                ))}
                {loading && (
                    <div className="text-center">
                        <div className="inline-block p-3 rounded-lg bg-gray-100">
                            Loading...
                        </div>
                    </div>
                )}
            </div>

            <form onSubmit={handleSendMessage} className="p-4 border-t">
                <div className="flex space-x-2">
                    <input
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder="Ask about your data or request a chart... (e.g., 'Show chart of name and interviews')"
                        className="flex-1 p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        disabled={loading}
                    />
                    <button
                        type="submit"
                        className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 disabled:opacity-50"
                        disabled={loading || !input.trim()}
                    >
                        Send
                    </button>
                </div>
            </form>
        </div>
    );
};

export default ChatInterface;