import React, { useState } from 'react';
import axios from 'axios';
import { useAuth } from '../../context/AuthContext';
import ChartMessage from './ChartMessage';

const ChatInterface = ({ recordId, data, activeCell, onChartRequest, sheets, activeSheetId }) => {
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const { token } = useAuth();
    
    const handleSendMessage = async (e) => {
        e.preventDefault();
        if (!input.trim()) return;
    
        setLoading(true);
        setMessages([...messages, { sender: 'user', text: input }]);
    
        try {
            // Parse message to identify mentioned sheets
            const sheetsToInclude = new Set();
        
            // Check for mentions of specific sheets by name or ID
            const sheetMentions = input.match(/\b\w+\s*sheet\b|\bsheet\s*\d+\b|\b\w+\.xlsx\b|\b\w+\.csv\b/gi) || [];
            console.log("Detected sheet mentions:", sheetMentions);
            
            // Find all referenced sheets
            for (const mention of sheetMentions) {
                const mentionLower = mention.toLowerCase();
                
                // Find matching sheet by name or ID
                for (const [id, sheet] of Object.entries(sheets)) {
                    const sheetName = (sheet.name || '').toLowerCase();
                    
                    // Check if the mention matches sheet name or ID
                    if (sheetName.includes(mentionLower) || 
                        id.toLowerCase().includes(mentionLower)) {
                        console.log(`Found sheet "${sheet.name}" (${id}) matching mention "${mention}"`);
                        sheetsToInclude.add(id);
                        break;
                    }
                }
            }
            
            // If no specific sheets mentioned, use active sheet
            if (sheetsToInclude.size === 0) {
                sheetsToInclude.add(activeSheetId);
                console.log(`No sheets mentioned, using active sheet: ${activeSheetId}`);
            }
            
            // Gather data from all mentioned sheets
            const relevantData = {};
            sheetsToInclude.forEach(sheetId => {
                if (sheets[sheetId] && sheets[sheetId].data) {
                    relevantData[sheetId] = sheets[sheetId].data;
                    console.log(`Including data from sheet ${sheetId} (${sheets[sheetId].data.length} rows)`);
                }
            });
            console.log('Relevant data from chatinterface:', relevantData);
            const response = await axios.post(`${process.env.REACT_APP_API_URL}/api/chat/analyze2`, {
                message: input,
                relevantData,       // Send data from all mentioned sheets
                sheets,             // Send all sheet metadata 
                activeSheetId,      // Current active sheet
                explicitTargetSheetId: null, // No explicit target sheet unless specified
            }, {
                headers: {
                    'Authorization': `Bearer ${token}`
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
                onChartRequest(chartConfig, sourceSheetId, targetSheetId);
            }
        } catch (error) {
            console.error('Error sending message:', error);
            setMessages([
                ...messages, 
                { sender: 'user', text: input }, 
                { sender: 'assistant', text: 'Sorry, something went wrong.' }
            ]);
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
                            <div className="flex items-center space-x-2">
                                <div className="animate-spin h-4 w-4 border-2 border-indigo-500 rounded-full border-t-transparent"></div>
                                <span>Analyzing your data...</span>
                            </div>
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