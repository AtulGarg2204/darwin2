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
            console.log(response,"Response from API");

            const { data: responseData } = response;
            const { text, chartConfig, sourceSheetId, targetSheetId, transformedData } = responseData;
            
            const newMessages = [
                ...messages, 
                { sender: 'user', text: input }, 
                { 
                    sender: 'assistant', 
                    text, 
                    chartConfig,
                    transformedData: transformedData || null
                }
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

    // Function to handle copying data to clipboard
    const handleCopyData = (data) => {
        if (!data) return;
        
        // Convert data to CSV format
        let csvContent = '';
        
        // Process each row
        data.forEach((row, index) => {
            // Join array elements with commas for CSV format
            const rowStr = Array.isArray(row) ? row.join(',') : JSON.stringify(row);
            csvContent += rowStr + '\n';
        });
        
        // Copy to clipboard
        navigator.clipboard.writeText(csvContent)
            .then(() => {
                alert('Data copied to clipboard!');
            })
            .catch((err) => {
                console.error('Failed to copy data: ', err);
                alert('Failed to copy data to clipboard.');
            });
    };

    // Function to handle inserting data into a sheet
    const handleInsertData = (data) => {
        if (!data || !Array.isArray(data)) {
            alert('Invalid data format');
            return;
        }
        
        try {
            // Find first empty sheet, if any exists
            const emptySheetId = findFirstEmptySheet();
            
            if (emptySheetId) {
                // Use existing empty sheet
                insertDataToSheet(emptySheetId, data);
            } else {
                // Create a new sheet
                createNewSheetWithData(data);
            }
        } catch (error) {
            console.error('Error inserting data:', error);
            alert('Failed to insert data into sheet.');
        }
    };

    // Helper function to find the first empty sheet
    const findFirstEmptySheet = () => {
        for (const [sheetId, sheet] of Object.entries(sheets)) {
            if (isSheetEmpty(sheet)) {
                return sheetId;
            }
        }
        return null; // No empty sheet found
    };

    // Helper function to check if a sheet is empty
    const isSheetEmpty = (sheet) => {
        if (!sheet || !sheet.data) return true;
        
        // A sheet is considered empty if it has no data or all cells are empty/blank
        return sheet.data.every(row => 
            !row || row.length === 0 || row.every(cell => 
                cell === '' || cell === null || cell === undefined
            )
        );
    };

    // Function to insert data into a specific sheet
    const insertDataToSheet = (sheetId, data) => {
        // Create a parsedFile with the transformed data
        const parsedFile = {
            name: "Transformed Data",
            parsedData: data,
            type: 'application/json'
        };
        
        // Call onChartRequest with the new data (it will update the sheet)
        onChartRequest(null, null, sheetId, parsedFile);
        alert(`Data inserted into ${sheets[sheetId].name}`);
    };

    // Function to create a new sheet with the data
    const createNewSheetWithData = (data) => {
        // Create a parsedFile with the transformed data
        const parsedFile = {
            name: "Transformed Data",
            parsedData: data,
            type: 'application/json'
        };
        
        // Call onChartRequest with null target to create a new sheet
        onChartRequest(null, null, null, parsedFile);
        alert('Data inserted into a new sheet');
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
                            {/* Display data action buttons when transformedData is present */}
                            {msg.transformedData && (
                                <div className="mt-3 flex space-x-2">
                                    <button 
                                        onClick={() => handleCopyData(msg.transformedData)}
                                        className="bg-gray-200 hover:bg-gray-300 text-gray-800 px-3 py-1 rounded text-sm transition-colors"
                                    >
                                        Copy Data
                                    </button>
                                    <button 
                                        onClick={() => handleInsertData(msg.transformedData)}
                                        className="bg-indigo-500 hover:bg-indigo-600 text-white px-3 py-1 rounded text-sm transition-colors"
                                    >
                                        Insert Data
                                    </button>
                                </div>
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