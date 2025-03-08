import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../../context/AuthContext';
import ChartMessage from './ChartMessage';

const ChatInterface = ({ recordId, data, activeCell, onChartRequest }) => {
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const { token } = useAuth();
    const messagesEndRef = useRef(null);

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

    const handleSendMessage = async (e) => {
        e.preventDefault();
        if (!input.trim()) return;

        const userMessage = { text: input, sender: 'user' };
        setMessages(prev => [...prev, userMessage]);
        setInput('');
        setLoading(true);

        // Check for chart creation request
        const userInput = input.toLowerCase();
        if (userInput.includes('chart') || userInput.includes('graph')) {
            let chartType = 'bar';
            if (userInput.includes('line')) chartType = 'line';
            if (userInput.includes('pie')) chartType = 'pie';
            if (userInput.includes('area')) chartType = 'area';

            onChartRequest(chartType);
            
            setMessages(prev => [...prev, {
                text: `I've created a ${chartType} chart at the selected cell.`,
                sender: 'assistant'
            }]);
            return;
        }

        try {
            const res = await axios.post(
                'http://localhost:5000/api/chat/analyze',
                {
                    message: input,
                    recordId,
                    includeChartSuggestion: input.toLowerCase().includes('chart') ||
                        input.toLowerCase().includes('graph') ||
                        input.toLowerCase().includes('show') ||
                        input.toLowerCase().includes('visualize')
                },
                { headers: { 'x-auth-token': token } }
            );

            const chartConfig = parseChartConfig(res.data.answer);
            
            setMessages(prev => [...prev, {
                text: res.data.answer,
                sender: 'assistant',
                chartConfig: chartConfig
            }]);
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
                    Try: "Show me a bar chart" or "Create a line graph"
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
                            {msg.chartConfig && data && (
                                <ChartMessage 
                                    data={data} 
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
                        placeholder="Ask about your data or request a chart..."
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