import React, { useState, useCallback, useRef, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../../context/AuthContext';
import ChartMessage from './ChartMessage';

const ChatInterface = ({ recordId, data, activeCell, onChartRequest, sheets, activeSheetId }) => {
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const { token } = useAuth();
    const chatContainerRef = useRef(null);
    const inputRef = useRef(null);
    
    // Track focus and selection state
    const [isInputFocused, setIsInputFocused] = useState(false);
    const [messageSelection, setMessageSelection] = useState('');
    
    // Debug logging
    const log = (message, ...args) => {
        console.log(`[ChatInterface] ${message}`, ...args);
    };
    
    // IMPORTANT: Define global flags for chat component state
    useEffect(() => {
        if (messageSelection) {
            window.CHAT_SELECTION_ACTIVE = true;
            log('Set global chat selection flag to TRUE');
        } else {
            window.CHAT_SELECTION_ACTIVE = false;
            log('Set global chat selection flag to FALSE');
        }
        
        return () => {
            window.CHAT_SELECTION_ACTIVE = false;
            log('Cleared global chat selection flag on unmount');
        };
    }, [messageSelection]);
    
    // Track input focus with global flag
    useEffect(() => {
        if (isInputFocused) {
            window.CHAT_INPUT_FOCUSED = true;
            log('Set global chat input focus flag to TRUE');
        } else {
            window.CHAT_INPUT_FOCUSED = false;
            log('Set global chat input focus flag to FALSE');
        }
        
        return () => {
            window.CHAT_INPUT_FOCUSED = false;
            log('Cleared global chat input focus flag on unmount');
        };
    }, [isInputFocused]);
    
    // Focus tracking
    const handleInputFocus = useCallback(() => {
        setIsInputFocused(true);
        log('Input focused');
    }, []);
    
    const handleInputBlur = useCallback(() => {
        setIsInputFocused(false);
        log('Input blurred');
    }, []);
    
    // Monitor text selection in messages
    const handleSelectionChange = useCallback(() => {
        if (!chatContainerRef.current) return;
        
        const selection = window.getSelection();
        if (!selection || selection.rangeCount === 0) return;
        
        const range = selection.getRangeAt(0);
        const selectedText = selection.toString();
        
        if (selectedText) {
            // Check if selection is within our chat messages
            const msgContainer = chatContainerRef.current.querySelector('.message-container');
            
            if (msgContainer && msgContainer.contains(range.commonAncestorContainer)) {
                setMessageSelection(selectedText);
                log('Text selected in chat message:', selectedText);
            } else {
                // Clear selection if it's outside our messages
                setMessageSelection('');
            }
        } else {
            setMessageSelection('');
        }
    }, []);
    
    // Add listener for selection changes
    useEffect(() => {
        document.addEventListener('selectionchange', handleSelectionChange);
        return () => {
            document.removeEventListener('selectionchange', handleSelectionChange);
        };
    }, [handleSelectionChange]);
    
    // DIRECT METHOD: Inject a global copy event handler at document level
    useEffect(() => {
        // Capture keypresses at the document level (before they reach any components)
        const handleKeyDown = (e) => {
            // Handle Ctrl+C / Cmd+C
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c') {
                log('Ctrl+C detected globally');
                
                // If we have a selection in the chat messages, immediately copy it
                if (messageSelection) {
                    log('Chat message selected, handling copy directly');
                    
                    // Use direct methods to copy to clipboard
                    if (navigator.clipboard && navigator.clipboard.writeText) {
                        navigator.clipboard.writeText(messageSelection)
                            .then(() => log('Copied to clipboard via API:', messageSelection))
                            .catch(err => log('Clipboard API failed:', err));
                    }
                    
                    // Create a temporary element as fallback
                    const tempElem = document.createElement('textarea');
                    tempElem.value = messageSelection;
                    tempElem.setAttribute('readonly', '');
                    tempElem.style.position = 'absolute';
                    tempElem.style.left = '-9999px';
                    
                    // Add to document, select text, copy, then remove
                    document.body.appendChild(tempElem);
                    tempElem.select();
                    
                    try {
                        document.execCommand('copy');
                        log('Copied to clipboard via execCommand');
                        
                        // Stop event propagation to prevent other handlers
                        e.preventDefault();
                        e.stopPropagation();
                    } catch (err) {
                        log('execCommand failed:', err);
                    }
                    
                    document.body.removeChild(tempElem);
                    
                    // Flash selected message for feedback
                    const selection = window.getSelection();
                    if (selection && selection.rangeCount > 0) {
                        const range = selection.getRangeAt(0);
                        const msgElement = range.commonAncestorContainer.parentElement?.closest('.chat-message');
                        
                        if (msgElement) {
                            const originalBg = msgElement.style.backgroundColor;
                            msgElement.style.backgroundColor = 'rgba(79, 70, 229, 0.2)';
                            setTimeout(() => {
                                msgElement.style.backgroundColor = originalBg;
                            }, 200);
                        }
                    }
                    
                    return false;
                }
            }
            
            // Handle Ctrl+V / Cmd+V - CRITICAL FIX FOR PASTE
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'v') {
                log('Ctrl+V detected globally - input focused:', isInputFocused);
                
                // Only handle if chat input is focused
                if (isInputFocused && inputRef.current) {
                    log('Intercepting paste for chat input');
                    
                    // Stop event propagation immediately to prevent DataGrid from handling it
                    e.stopPropagation();
                    e.preventDefault();
                    
                    // Get data from clipboard
                    navigator.clipboard.readText()
                        .then(text => {
                            log('Read from clipboard API:', text);
                            
                            // Insert at cursor position
                            const cursorPos = inputRef.current.selectionStart;
                            const newText = input.substring(0, cursorPos) + 
                                            text + 
                                            input.substring(inputRef.current.selectionEnd);
                            
                            setInput(newText);
                            
                            // Update cursor position
                            setTimeout(() => {
                                const newPos = cursorPos + text.length;
                                inputRef.current.selectionStart = newPos;
                                inputRef.current.selectionEnd = newPos;
                                inputRef.current.focus();
                                
                                // Visual feedback
                                inputRef.current.style.backgroundColor = 'rgba(79, 70, 229, 0.1)';
                                setTimeout(() => {
                                    inputRef.current.style.backgroundColor = '';
                                }, 200);
                            }, 0);
                        })
                        .catch(err => {
                            log('Clipboard API failed:', err);
                            
                            // Try execCommand as fallback (rarely works for paste)
                            try {
                                // Focus input
                                inputRef.current.focus();
                                
                                // Let browser handle native paste
                                const successful = document.execCommand('paste');
                                log('Fallback paste via execCommand:', successful);
                            } catch (err) {
                                log('execCommand paste failed:', err);
                            }
                        });
                        
                    return false;
                }
            }
        };
        
        // Add keyboard listener with capture phase to catch it early
        document.addEventListener('keydown', handleKeyDown, true);
        
        return () => {
            document.removeEventListener('keydown', handleKeyDown, true);
        };
    }, [messageSelection, isInputFocused, input]);
    
    // Also handle the copy event itself as backup
    useEffect(() => {
        const handleCopyEvent = (e) => {
            log('Copy event detected');
            
            if (messageSelection) {
                const selection = window.getSelection();
                const range = selection?.getRangeAt(0);
                
                // Double-check if selection is within our messages
                const msgContainer = chatContainerRef.current?.querySelector('.message-container');
                
                if (msgContainer && range && msgContainer.contains(range.commonAncestorContainer)) {
                    log('Intercepting copy event for message text');
                    
                    // Stop event propagation and prevent default
                    e.stopPropagation();
                    e.preventDefault();
                    
                    // Set clipboard data
                    e.clipboardData.setData('text/plain', messageSelection);
                    
                    log('Set clipboard to:', messageSelection);
                    return false;
                }
            }
        };
        
        // Add with capture phase to get it before other handlers
        document.addEventListener('copy', handleCopyEvent, true);
        
        return () => {
            document.removeEventListener('copy', handleCopyEvent, true);
        };
    }, [messageSelection]);
    
    // Handle paste events directly
    useEffect(() => {
        const handlePasteEvent = (e) => {
            log('Paste event detected - input focused:', isInputFocused);
            
            // Only intercept if chat input is focused
            if (isInputFocused && inputRef.current) {
                // Skip if the event is directly on our input (let browser handle it)
                if (e.target === inputRef.current) {
                    log('Native paste on input, letting browser handle it');
                    return;
                }
                
                log('Intercepting paste event for chat input');
                
                // Stop event propagation
                e.stopPropagation();
                e.preventDefault();
                
                // Get clipboard content
                const pasteText = e.clipboardData.getData('text/plain');
                if (!pasteText) {
                    log('No text in clipboard');
                    return;
                }
                
                log('Clipboard text:', pasteText);
                
                // Insert at cursor position
                const cursorPos = inputRef.current.selectionStart;
                const newText = input.substring(0, cursorPos) + 
                                pasteText + 
                                input.substring(inputRef.current.selectionEnd);
                
                setInput(newText);
                
                // Update cursor position
                setTimeout(() => {
                    const newPos = cursorPos + pasteText.length;
                    inputRef.current.selectionStart = newPos;
                    inputRef.current.selectionEnd = newPos;
                    inputRef.current.focus();
                    
                    // Visual feedback
                    inputRef.current.style.backgroundColor = 'rgba(79, 70, 229, 0.1)';
                    setTimeout(() => {
                        inputRef.current.style.backgroundColor = '';
                    }, 200);
                }, 0);
                
                return false;
            }
        };
        
        // Add with capture phase to intercept before other handlers
        document.addEventListener('paste', handlePasteEvent, true);
        
        return () => {
            document.removeEventListener('paste', handlePasteEvent, true);
        };
    }, [isInputFocused, input]);
    
    // Context menu for right-click options
    const [contextMenu, setContextMenu] = useState({ visible: false, x: 0, y: 0 });
    
    const handleContextMenu = useCallback((e) => {
        // Only show context menu if in chat container or text selected
        if (messageSelection || isInputFocused) {
            e.preventDefault();
            setContextMenu({
                visible: true,
                x: e.clientX,
                y: e.clientY
            });
        }
    }, [messageSelection, isInputFocused]);
    
    // Handle manual copy from context menu
    const handleManualCopy = useCallback(() => {
        log('Manual copy from context menu');
        
        const textToCopy = messageSelection || 
                          (isInputFocused && inputRef.current ? 
                           input.substring(inputRef.current.selectionStart, inputRef.current.selectionEnd) : 
                           '');
        
        if (textToCopy) {
            // Multiple methods for maximum compatibility
            
            // Method 1: Clipboard API
            if (navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText(textToCopy)
                    .then(() => log('Copied to clipboard via API'))
                    .catch(err => log('API copy failed:', err));
            }
            
            // Method 2: execCommand with temp element
            const tempElem = document.createElement('textarea');
            tempElem.value = textToCopy;
            tempElem.style.position = 'absolute';
            tempElem.style.left = '-9999px';
            document.body.appendChild(tempElem);
            
            tempElem.select();
            document.execCommand('copy');
            document.body.removeChild(tempElem);
            
            log('Copied text:', textToCopy);
        }
    }, [messageSelection, isInputFocused, input]);
    
    // Handle manual paste from context menu 
    const handleManualPaste = useCallback(() => {
        log('Manual paste from context menu');
        
        if (isInputFocused && inputRef.current) {
            navigator.clipboard.readText()
                .then(text => {
                    // Insert at cursor
                    const cursorPos = inputRef.current.selectionStart;
                    const newText = input.substring(0, cursorPos) + 
                                    text + 
                                    input.substring(inputRef.current.selectionEnd);
                    
                    setInput(newText);
                    
                    // Update cursor position
                    setTimeout(() => {
                        const newPos = cursorPos + text.length;
                        inputRef.current.selectionStart = newPos;
                        inputRef.current.selectionEnd = newPos;
                        inputRef.current.focus();
                        
                        // Visual feedback
                        inputRef.current.style.backgroundColor = 'rgba(79, 70, 229, 0.1)';
                        setTimeout(() => {
                            inputRef.current.style.backgroundColor = '';
                        }, 200);
                    }, 0);
                })
                .catch(err => log('Clipboard read failed:', err));
        }
    }, [isInputFocused, input]);
    
    // Close context menu on click outside
    useEffect(() => {
        const hideContextMenu = () => {
            setContextMenu({ visible: false, x: 0, y: 0 });
        };
        
        if (contextMenu.visible) {
            document.addEventListener('mousedown', hideContextMenu);
            return () => {
                document.removeEventListener('mousedown', hideContextMenu);
            };
        }
    }, [contextMenu.visible]);
    
    // Force input focus when clicked on the chat container (better UX)
    const handleContainerClick = useCallback((e) => {
        // Don't interfere with selection
        if (window.getSelection().toString()) return;
        
        // If clicked directly on the container (not a button or input), focus input
        if (e.target === chatContainerRef.current || 
            e.target.classList.contains('message-container')) {
            inputRef.current?.focus();
        }
    }, []);
    
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
            
            // Find all referenced sheets
            for (const mention of sheetMentions) {
                const mentionLower = mention.toLowerCase();
                
                // Find matching sheet by name or ID
                for (const [id, sheet] of Object.entries(sheets)) {
                    const sheetName = (sheet.name || '').toLowerCase();
                    
                    // Check if the mention matches sheet name or ID
                    if (sheetName.includes(mentionLower) || 
                        id.toLowerCase().includes(mentionLower)) {
                        sheetsToInclude.add(id);
                        break;
                    }
                }
            }
            
            // If no specific sheets mentioned, use active sheet
            if (sheetsToInclude.size === 0) {
                sheetsToInclude.add(activeSheetId);
            }
            
            // Gather data from all mentioned sheets
            const relevantData = {};
            sheetsToInclude.forEach(sheetId => {
                if (sheets[sheetId] && sheets[sheetId].data) {
                    relevantData[sheetId] = sheets[sheetId].data;
                }
            });
            
            const response = await axios.post(`${process.env.REACT_APP_API_URL}/api/chat/analyze2`, {
                message: input,
                relevantData,
                sheets,
                activeSheetId,
                explicitTargetSheetId: null,
            }, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            const { data: responseData } = response;
            const { text, chartConfig, sourceSheetId, targetSheetId, transformedData } = responseData;
            
            const newMessages = [
                ...messages,
                { sender: 'user', text: input },
                { sender: 'assistant', text, chartConfig }
            ];
            setMessages(newMessages);
            
            if (chartConfig && onChartRequest) {
                onChartRequest(chartConfig, sourceSheetId, targetSheetId);
            } else if (transformedData && onChartRequest) {
                const emptySheetId = findFirstEmptySheet();
                
                const parsedFile = {
                    name: "Transformed Data",
                    parsedData: transformedData,
                    type: 'application/json'
                };
                
                onChartRequest(null, null, emptySheetId || null, parsedFile);
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

    // Helper functions for sheets
    const findFirstEmptySheet = () => {
        for (const [sheetId, sheet] of Object.entries(sheets)) {
            if (isSheetEmpty(sheet)) {
                return sheetId;
            }
        }
        return null;
    };

    const isSheetEmpty = (sheet) => {
        if (!sheet || !sheet.data) return true;
        
        return sheet.data.every(row => 
            !row || row.length === 0 || row.every(cell => 
                cell === '' || cell === null || cell === undefined
            )
        );
    };

    return (
        <div 
            className="flex flex-col h-[600px] border rounded-lg shadow-md bg-white chat-container"
            ref={chatContainerRef}
            onContextMenu={handleContextMenu}
            onClick={handleContainerClick}
        >
            <div className="p-4 border-b bg-indigo-600 text-white rounded-t-lg">
                <h2 className="text-xl font-semibold">Data Analysis Chat</h2>
                <p className="text-sm opacity-80">
                    Try: "Show me a bar chart of name and interviews" or "Create a line graph"
                </p>
            </div>

            <div className="flex-1 p-4 overflow-y-auto bg-gray-50 message-container">
                {messages.map((msg, index) => (
                    <div key={index} className={`mb-4 ${msg.sender === 'user' ? 'text-right' : 'text-left'}`}>
                        <div className={`inline-block p-3 rounded-lg max-w-[80%] ${
                            msg.sender === 'user' 
                                ? 'bg-indigo-500 text-white rounded-br-none' 
                                : 'bg-white border border-gray-200 rounded-bl-none'
                        }`}>
                            <p className="whitespace-pre-wrap chat-message selectable">{msg.text}</p>
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
                        ref={inputRef}
                        onFocus={handleInputFocus}
                        onBlur={handleInputBlur}
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
            
            {/* Context menu */}
            {contextMenu.visible && (
                <div 
                    className="fixed z-50 bg-white shadow-lg border rounded overflow-hidden"
                    style={{ 
                        top: contextMenu.y,
                        left: contextMenu.x
                    }}
                >
                    <button 
                        className="px-4 py-2 w-full text-left hover:bg-gray-100 flex items-center"
                        onClick={() => {
                            handleManualCopy();
                            setContextMenu({ visible: false, x: 0, y: 0 });
                        }}
                    >
                        <span className="mr-2">📋</span> Copy
                    </button>
                    
                    {isInputFocused && (
                        <button 
                            className="px-4 py-2 w-full text-left hover:bg-gray-100 flex items-center"
                            onClick={() => {
                                handleManualPaste();
                                setContextMenu({ visible: false, x: 0, y: 0 });
                            }}
                        >
                            <span className="mr-2">📋</span> Paste
                        </button>
                    )}
                </div>
            )}
        </div>
    );
};

// Add styles for selectable text
const style = document.createElement('style');
style.textContent = `
    .chat-message.selectable {
        user-select: text !important;
        -webkit-user-select: text !important;
        -moz-user-select: text !important;
        -ms-user-select: text !important;
        cursor: text;
    }
    
    .chat-container {
        position: relative;
    }
    
    /* Visual highlight for selected text */
    ::selection {
        background: rgba(79, 70, 229, 0.3) !important;
        color: inherit !important;
    }
    
    ::-moz-selection {
        background: rgba(79, 70, 229, 0.3) !important;
        color: inherit !important;
    }
`;
document.head.appendChild(style);

// Monkey patch EditMenu and DataGrid clipboard handlers
const monkeyPatchAppClipboard = () => {
    try {
        console.log('[ChatInterface] Setting up global clipboard interceptors');
        
        // For paste operations, patch the document handler
        const originalDocumentPaste = document.onpaste;
        document.onpaste = function(e) {
            console.log('[ChatInterface] Document paste, input focused:', window.CHAT_INPUT_FOCUSED);
            
            // If chat input is focused, don't let other handlers process it
            if (window.CHAT_INPUT_FOCUSED) {
                console.log('[ChatInterface] Blocking document paste handler due to chat input focus');
                e.stopPropagation();
                return false;
            }
            
            // Use original handler if exists
            if (originalDocumentPaste) return originalDocumentPaste.call(document, e);
        };
        
        // Watch for addition of paste handlers on document
        const originalAddEventListener = document.addEventListener;
        document.addEventListener = function(type, listener, options) {
            if (type === 'paste' || type === 'copy') {
                console.log(`[ChatInterface] Detected document.addEventListener for ${type}`);
                
                // Wrap the listener to check for chat input focus/selection
                const wrappedListener = function(e) {
                    if ((type === 'paste' && window.CHAT_INPUT_FOCUSED) ||
                        (type === 'copy' && window.CHAT_SELECTION_ACTIVE)) {
                        console.log(`[ChatInterface] Blocking ${type} handler due to chat state`);
                        e.stopPropagation();
                        return false;
                    }
                    
                    return listener.call(this, e);
                };
                
                // Call original addEventListener with wrapped listener
                return originalAddEventListener.call(this, type, wrappedListener, options);
            }
            
            // Call original for other event types
            return originalAddEventListener.call(this, type, listener, options);
        };
        
        // Find DataGrid components and patch their paste handlers
        setTimeout(() => {
            const dataGrids = document.querySelectorAll('.DataGrid');
            if (dataGrids.length > 0) {
                console.log(`[ChatInterface] Found ${dataGrids.length} DataGrid elements to patch`);
                
                // Create a MutationObserver to watch for focus changes
                const observer = new MutationObserver((mutations) => {
                    mutations.forEach((mutation) => {
                        if (mutation.attributeName === 'class' || 
                            mutation.attributeName === 'style') {
                            // If chat input is focused, add a special attribute to body
                            if (window.CHAT_INPUT_FOCUSED) {
                                document.body.setAttribute('data-chat-focused', 'true');
                            } else {
                                document.body.removeAttribute('data-chat-focused');
                            }
                        }
                    });
                });
                
                // Observe each DataGrid
                dataGrids.forEach(grid => {
                    observer.observe(grid, { attributes: true, subtree: true });
                });
            }
        }, 1000);
        
        // Add global style to prevent DataGrid from receiving paste events when chat is focused
        const styleEl = document.createElement('style');
        styleEl.textContent = `
            body[data-chat-focused="true"] .DataGrid input,
            body[data-chat-focused="true"] .DataGrid {
                pointer-events: none !important;
            }
        `;
        document.head.appendChild(styleEl);
        
    } catch (err) {
        console.error('[ChatInterface] Error setting up clipboard interceptors:', err);
    }
};

// Run the patch on mount
setTimeout(monkeyPatchAppClipboard, 500);

export default ChatInterface;