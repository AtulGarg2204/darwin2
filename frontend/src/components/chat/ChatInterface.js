import React, { useState } from 'react';
import axios from 'axios';
import { useAuth } from '../../context/AuthContext';
import ChartMessage from './ChartMessage';

const ChatInterface = ({ recordId, data, activeCell, onChartRequest,sheets,  
    activeSheetId  }) => {
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const { token } = useAuth();
    
    // const handleSendMessage = async (e) => {
    //     e.preventDefault();
    //     if (!input.trim()) return;

    //     setLoading(true);
    //     setMessages([...messages, { sender: 'user', text: input }]);

    //     try {
    //         console.log("Sending data to API:", {
    //             message: input,
    //             dataLength: data?.length || 0,
    //             sampleData: data?.slice(0, 2) || []
    //         });

    //         const response = await axios.post(`${process.env.REACT_APP_API_URL}/api/chat/analyze2`, {
    //             message: input,
    //             data
    //         }, {
    //             headers: {
    //                 'x-auth-token': token
    //             }
    //         });

    //         const { data: { text, chartConfig } } = response;
    //         console.log("Received response from API:", {
    //             text,
    //             chartConfig
    //         });
            
    //         // Create a new messages array with the response
    //         const newMessages = [
    //             ...messages, 
    //             { sender: 'user', text: input }, 
    //             { sender: 'assistant', text, chartConfig }
    //         ];
    //         setMessages(newMessages);
            
    //         // If we have a chart config and an onChartRequest function, create the chart
    //         if (chartConfig && onChartRequest && activeCell) {
    //             console.log("Passing chart config to parent component:", chartConfig);
    //             onChartRequest(chartConfig);
    //         }
    //     } catch (error) {
    //         console.error('Error sending message:', error);
    //         setMessages([...messages, { sender: 'user', text: input }, { sender: 'assistant', text: 'Sorry, something went wrong.' }]);
    //     } finally {
    //         setLoading(false);
    //         setInput('');
    //     }
    // };
    const handleSendMessage = async (e) => {
        e.preventDefault();
        if (!input.trim()) return;

        setLoading(true);
        setMessages([...messages, { sender: 'user', text: input }]);

        try {
            const response = await axios.post(`${process.env.REACT_APP_API_URL}/api/chat/analyze2`, {
                message: input,
                data,           // Current sheet data
                sheets,         // All sheets
                activeSheetId   // Current sheet ID
            }, {
                headers: {
                    'x-auth-token': token
                }
            });

            const { data: { text, chartConfig, sourceSheetId, targetSheetId } } = response;
            
            const newMessages = [
                ...messages, 
                { sender: 'user', text: input }, 
                { sender: 'assistant', text, chartConfig }
            ];
            setMessages(newMessages);
            
            if (chartConfig && onChartRequest) {
                console.log("Passing chart config to parent component:", chartConfig);
                // Pass source and target sheet IDs
                onChartRequest(chartConfig, sourceSheetId, targetSheetId);
            }
        } catch (error) {
            console.error('Error sending message:', error);
            setMessages([...messages, { sender: 'user', text: input }, { sender: 'assistant', text: 'Sorry, something went wrong.' }]);
        } finally {
            setLoading(false);
            setInput('');
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
