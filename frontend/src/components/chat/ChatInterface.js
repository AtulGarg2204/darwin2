import React, { useState } from 'react';
import axios from 'axios';
import { useAuth } from '../../context/AuthContext';
import ChartMessage from './ChartMessage';

const ChatInterface = ({ recordId, data, activeCell, onChartRequest }) => {
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const { token } = useAuth();
   
    const parseChartConfig = (text) => {
        try {
            const jsonMatch = text.match(/```json\n([\s\S]*?)\n```/);
            if (jsonMatch) {
                return JSON.parse(jsonMatch[1]);
            }
            return null;
        } catch (error) {
            console.error('Error parsing chart config:', error);
            return null;
        }
    };

    // Helper function to extract column names from user message
    const extractColumns = (userInput, availableColumns) => {
        const words = userInput.toLowerCase().split(/\s+/);
        const mentionedColumns = [];
        
        // First pass: look for exact column matches
        for (const col of availableColumns) {
            const colLower = col.toLowerCase();
            if (words.includes(colLower)) {
                mentionedColumns.push(col);
            }
        }
        
        // If we couldn't find exact matches, look for partial matches
        if (mentionedColumns.length < 2) {
            for (const col of availableColumns) {
                const colLower = col.toLowerCase();
                if (!mentionedColumns.includes(col) && 
                    words.some(word => word.includes(colLower) || colLower.includes(word))) {
                    mentionedColumns.push(col);
                }
                
                if (mentionedColumns.length >= 2) break;
            }
        }
        
        // Return default if we still don't have enough
        if (mentionedColumns.length < 2 && availableColumns.length >= 2) {
            return { x: availableColumns[0], y: availableColumns[1] };
        }
        
        return { 
            x: mentionedColumns[0] || availableColumns[0] || 'name', 
            y: mentionedColumns[1] || availableColumns[1] || 'value' 
        };
    };

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
            const res = await axios.post(
                'http://localhost:5000/api/chat/analyze',
                {
                    message: input,
                    recordId,
                    includeChartSuggestion: isChartRequest,
                    data // Pass the current data to the API
                },
                { headers: { 'x-auth-token': token } }
            );

            const assistantMessage = {
                text: res.data.answer,
                sender: 'assistant'
            };

            // If we have chart configuration and active cell, create the chart in the grid
            if (res.data.chartConfig && activeCell && typeof onChartRequest === 'function') {
                // Call the createChart function with the AI response
                onChartRequest(res.data.chartConfig.type, activeCell, res.data.chartConfig);
                assistantMessage.text += "\n\nI've created the chart at the selected cell.";
            } 
            // If we have chart config but no active cell, show it in the chat
            else if (res.data.chartConfig) {
                assistantMessage.chartConfig = res.data.chartConfig;
                assistantMessage.chartData = res.data.data;
                assistantMessage.text += "\n\nPlease select a cell in the grid where you'd like me to create this chart.";
            }

            setMessages(prev => [...prev, assistantMessage]);
        } catch (err) {
            console.error('Chat error:', err);
            setMessages(prev => [...prev, {
                text: 'Sorry, I encountered an error processing your request.',
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