import { useState, useEffect, useCallback } from 'react';

const ViewMenu = ({ 
    showHeaders, 
    setShowHeaders, 
    showGridLines, 
    setShowGridLines,
    zoomLevel,
    setZoomLevel
}) => {
    const [showViewMenu, setShowViewMenu] = useState(false);
    const [isFullScreen, setIsFullScreen] = useState(false);
   console.log(isFullScreen);
    // Handle zoom controls
    const handleZoomIn = useCallback(() => {
        setZoomLevel(prev => Math.min(prev + 25, 200));
    }, [setZoomLevel]);

    const handleZoomOut = useCallback(() => {
        setZoomLevel(prev => Math.max(prev - 25, 25));
    }, [setZoomLevel]);

    const handleZoomLevel = useCallback((level) => {
        setZoomLevel(level);
    }, [setZoomLevel]);

    // Handle presentation mode
    const handlePresentationMode = useCallback(() => {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen();
            setIsFullScreen(true);
        } else {
            document.exitFullscreen();
            setIsFullScreen(false);
        }
    }, []);

    // Keyboard shortcuts for zoom
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.ctrlKey) {
                switch (e.key) {
                    case '+':
                    case '=':
                        e.preventDefault();
                        handleZoomIn();
                        break;
                    case '-':
                        e.preventDefault();
                        handleZoomOut();
                        break;
                    default:
                        break;
                }
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [handleZoomIn, handleZoomOut]);

    const menuItems = [
        {
            label: 'Show row and column headings',
            checked: showHeaders,
            onClick: () => setShowHeaders(!showHeaders),
            icon: '📊'
        },
        {
            label: 'Show grid lines',
            checked: showGridLines,
            onClick: () => setShowGridLines(!showGridLines),
            icon: '⌗'
        },
        { type: 'divider' },
        {
            label: 'Zoom',
            submenu: true,
            icon: '🔍',
            items: [
                {
                    label: 'Zoom in',
                    shortcut: 'Ctrl+Plus',
                    onClick: handleZoomIn
                },
                {
                    label: 'Zoom out',
                    shortcut: 'Ctrl+Minus',
                    onClick: handleZoomOut
                },
                { type: 'divider' },
                {
                    label: '50%',
                    onClick: () => handleZoomLevel(50),
                    checked: zoomLevel === 50
                },
                {
                    label: '75%',
                    onClick: () => handleZoomLevel(75),
                    checked: zoomLevel === 75
                },
                {
                    label: '100%',
                    onClick: () => handleZoomLevel(100),
                    checked: zoomLevel === 100
                },
                {
                    label: '150%',
                    onClick: () => handleZoomLevel(150),
                    checked: zoomLevel === 150
                },
                {
                    label: '200%',
                    onClick: () => handleZoomLevel(200),
                    checked: zoomLevel === 200
                }
            ]
        },
        {
            label: 'Presentation mode',
            onClick: handlePresentationMode,
            icon: '🖥️',
            shortcut: 'F11'
        }
    ];

    return (
        <div className="relative">
            <button 
                className="flex items-center text-sm text-gray-700 hover:bg-gray-100 px-3 py-1 rounded"
                onClick={() => setShowViewMenu(!showViewMenu)}
            >
                <span className="mr-1">View</span>
            </button>
            
            {showViewMenu && (
                <div className="absolute left-0 top-full mt-1 w-64 bg-white rounded-md shadow-lg border border-gray-200 z-50">
                    <div className="py-1">
                        {menuItems.map((item, index) => (
                            item.type === 'divider' ? (
                                <hr key={index} className="my-1 border-gray-200" />
                            ) : item.submenu ? (
                                <div key={index} className="relative group">
                                    <button
                                        className="flex items-center justify-between w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                                    >
                                        <div className="flex items-center">
                                            <span className="w-5">{item.icon}</span>
                                            <span className="ml-2">{item.label}</span>
                                        </div>
                                        <span>▶</span>
                                    </button>
                                    <div className="absolute left-full top-0 w-48 bg-white rounded-md shadow-lg border border-gray-200 hidden group-hover:block">
                                        {item.items.map((subItem, subIndex) => (
                                            subItem.type === 'divider' ? (
                                                <hr key={subIndex} className="my-1 border-gray-200" />
                                            ) : (
                                                <button
                                                    key={subIndex}
                                                    onClick={subItem.onClick}
                                                    className="flex items-center justify-between w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                                                >
                                                    <span>{subItem.label}</span>
                                                    {subItem.shortcut && (
                                                        <span className="text-gray-400 text-xs">{subItem.shortcut}</span>
                                                    )}
                                                    {subItem.checked && (
                                                        <span className="text-blue-500">✓</span>
                                                    )}
                                                </button>
                                            )
                                        ))}
                                    </div>
                                </div>
                            ) : (
                                <button
                                    key={index}
                                    onClick={() => {
                                        item.onClick();
                                        setShowViewMenu(false);
                                    }}
                                    className="flex items-center justify-between w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                                >
                                    <div className="flex items-center">
                                        <span className="w-5">{item.icon}</span>
                                        <span className="ml-2">{item.label}</span>
                                    </div>
                                    <div className="flex items-center">
                                        {item.shortcut && (
                                            <span className="text-gray-400 text-xs mr-2">{item.shortcut}</span>
                                        )}
                                        {item.checked && (
                                            <span className="text-blue-500">✓</span>
                                        )}
                                    </div>
                                </button>
                            )
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default ViewMenu; 