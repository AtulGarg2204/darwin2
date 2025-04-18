import React from 'react';
import { 
    AlignLeft, 
    AlignCenter, 
    AlignRight,
    Bold,
    Italic,
    Underline,
    Type,
    Calendar,
    Grid,
    PaintBucket,
    Trash2,
    Hash
} from 'lucide-react';

const FormatMenu = ({ onFormatChange }) => {
    const borderStyles = [
        { id: 'all', icon: '■', label: 'All borders' },
        { id: 'outside', icon: '□', label: 'Outside borders' },
        { id: 'none', icon: '▢', label: 'No borders' },
        { id: 'top', icon: '▔', label: 'Top border' },
        { id: 'bottom', icon: '▁', label: 'Bottom border' },
        { id: 'left', icon: '▏', label: 'Left border' },
        { id: 'right', icon: '▕', label: 'Right border' }
    ];

    // Handler for number formatting options
    const handleNumberFormat = (format) => {
        if (!onFormatChange) return;
        
        switch (format) {
            case 'general':
                // Reset to general format
                onFormatChange('numberFormat', 'general');
                break;
            case 'number':
                // Apply standard number format
                onFormatChange('toggleCommas');
                break;
            case 'currency':
                // Apply currency format
                onFormatChange('currency');
                break;
            case 'percentage':
                // Apply percentage format
                onFormatChange('percentage');
                break;
            default:
                break;
        }
    };

    // Handler for date formatting
    const handleDateFormat = (format) => {
        if (!onFormatChange) return;
        onFormatChange('dateFormat', format);
    };

    // Handler for text formatting
    const handleTextFormat = (format) => {
        if (!onFormatChange) return;
        onFormatChange(format);
    };

    // Handler for alignment
    const handleAlignment = (alignment) => {
        if (!onFormatChange) return;
        onFormatChange('align', alignment);
    };

    // Handler for border styles
    const handleBorder = (borderStyle) => {
        if (!onFormatChange) return;
        onFormatChange('border', borderStyle);
    };

    // Handler for fill color
    const handleFillColor = (color) => {
        if (!onFormatChange) return;
        onFormatChange('fillColor', color);
    };

    // Handler for clearing all formatting
    const handleClearFormatting = () => {
        if (!onFormatChange) return;
        onFormatChange('clear');
    };

    return (
        <div className="relative group">
            <button className="px-3 py-1 hover:bg-gray-100 rounded">
                Format
            </button>

            <div className="absolute hidden group-hover:block left-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 min-w-[200px]">
                {/* Number formatting */}
                <div className="relative group/sub">
                    <button className="w-full px-4 py-2 text-left hover:bg-gray-100 flex items-center gap-2">
                        <Hash className="w-4 h-4" />
                        <span>Number</span>
                    </button>
                    <div className="absolute hidden group-hover/sub:block left-full top-0 bg-white border border-gray-200 rounded-lg shadow-lg min-w-[200px]">
                        <button onClick={() => handleNumberFormat('general')} className="w-full px-4 py-2 text-left hover:bg-gray-100">General</button>
                        <button onClick={() => handleNumberFormat('number')} className="w-full px-4 py-2 text-left hover:bg-gray-100">Number</button>
                        <button onClick={() => handleNumberFormat('currency')} className="w-full px-4 py-2 text-left hover:bg-gray-100">Currency</button>
                        <button onClick={() => handleNumberFormat('percentage')} className="w-full px-4 py-2 text-left hover:bg-gray-100">Percentage</button>
                    </div>
                </div>

                {/* Date and Time */}
               
<div className="relative group/sub">
  <button className="w-full px-4 py-2 text-left hover:bg-gray-100 flex items-center gap-2">
    <Calendar className="w-4 h-4" />
    <span>Date and time</span>
  </button>
  <div className="absolute hidden group-hover/sub:block left-full top-0 bg-white border border-gray-200 rounded-lg shadow-lg min-w-[200px]">
    <button onClick={() => handleDateFormat('short')} className="w-full px-4 py-2 text-left hover:bg-gray-100">Short Date (MM/DD/YYYY)</button>
    <button onClick={() => handleDateFormat('long')} className="w-full px-4 py-2 text-left hover:bg-gray-100">Long Date (Month DD, YYYY)</button>
    <button onClick={() => handleDateFormat('dd-mm-yyyy')} className="w-full px-4 py-2 text-left hover:bg-gray-100">DD-MM-YYYY</button>
    <button onClick={() => handleDateFormat('dd.mm.yyyy')} className="w-full px-4 py-2 text-left hover:bg-gray-100">DD.MM.YYYY</button>
    <button onClick={() => handleDateFormat('yyyy-mm-dd')} className="w-full px-4 py-2 text-left hover:bg-gray-100">YYYY-MM-DD (ISO)</button>
    <button onClick={() => handleDateFormat('d-mmm-yy')} className="w-full px-4 py-2 text-left hover:bg-gray-100">D-MMM-YY (1-Jan-23)</button>
    <button onClick={() => handleDateFormat('time')} className="w-full px-4 py-2 text-left hover:bg-gray-100">Time</button>
  </div>
</div>

                {/* Text formatting */}
                <div className="relative group/sub">
                    <button className="w-full px-4 py-2 text-left hover:bg-gray-100 flex items-center gap-2">
                        <Type className="w-4 h-4" />
                        <span>Text</span>
                    </button>
                    <div className="absolute hidden group-hover/sub:block left-full top-0 bg-white border border-gray-200 rounded-lg shadow-lg min-w-[200px]">
                        <button onClick={() => handleTextFormat('bold')} className="w-full px-4 py-2 text-left hover:bg-gray-100 flex items-center gap-2">
                            <Bold className="w-4 h-4" />
                            <span>Bold</span>
                        </button>
                        <button onClick={() => handleTextFormat('italic')} className="w-full px-4 py-2 text-left hover:bg-gray-100 flex items-center gap-2">
                            <Italic className="w-4 h-4" />
                            <span>Italic</span>
                        </button>
                        <button onClick={() => handleTextFormat('underline')} className="w-full px-4 py-2 text-left hover:bg-gray-100 flex items-center gap-2">
                            <Underline className="w-4 h-4" />
                            <span>Underline</span>
                        </button>
                    </div>
                </div>

                {/* Alignment */}
                <div className="relative group/sub">
                    <button className="w-full px-4 py-2 text-left hover:bg-gray-100 flex items-center gap-2">
                        <AlignLeft className="w-4 h-4" />
                        <span>Alignment</span>
                    </button>
                    <div className="absolute hidden group-hover/sub:block left-full top-0 bg-white border border-gray-200 rounded-lg shadow-lg min-w-[200px]">
                        <button onClick={() => handleAlignment('left')} className="w-full px-4 py-2 text-left hover:bg-gray-100 flex items-center gap-2">
                            <AlignLeft className="w-4 h-4" />
                            <span>Left</span>
                        </button>
                        <button onClick={() => handleAlignment('center')} className="w-full px-4 py-2 text-left hover:bg-gray-100 flex items-center gap-2">
                            <AlignCenter className="w-4 h-4" />
                            <span>Center</span>
                        </button>
                        <button onClick={() => handleAlignment('right')} className="w-full px-4 py-2 text-left hover:bg-gray-100 flex items-center gap-2">
                            <AlignRight className="w-4 h-4" />
                            <span>Right</span>
                        </button>
                    </div>
                </div>

                {/* Borders */}
                <div className="relative group/sub">
                    <button className="w-full px-4 py-2 text-left hover:bg-gray-100 flex items-center gap-2">
                        <Grid className="w-4 h-4" />
                        <span>Borders</span>
                    </button>
                    <div className="absolute hidden group-hover/sub:block left-full top-0 bg-white border border-gray-200 rounded-lg shadow-lg min-w-[200px]">
                        {borderStyles.map(style => (
                            <button 
                                key={style.id}
                                onClick={() => handleBorder(style.id)}
                                className="w-full px-4 py-2 text-left hover:bg-gray-100 flex items-center gap-2"
                            >
                                <span className="font-mono">{style.icon}</span>
                                <span>{style.label}</span>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Fill color */}
                <div className="relative group/sub">
                    <button className="w-full px-4 py-2 text-left hover:bg-gray-100 flex items-center gap-2">
                        <PaintBucket className="w-4 h-4" />
                        <span>Fill color</span>
                    </button>
                    <div className="absolute hidden group-hover/sub:block left-full top-0 bg-white border border-gray-200 rounded-lg shadow-lg p-2">
                        <div className="grid grid-cols-7 gap-1">
                            {['#FFFFFF', '#F44336', '#4CAF50', '#2196F3', '#FFEB3B', '#9C27B0', '#FF9800', 
                              '#E91E63', '#8BC34A', '#03A9F4', '#FFC107', '#673AB7', '#FF5722', '#795548']
                                .map(color => (
                                    <button
                                        key={color}
                                        onClick={() => handleFillColor(color)}
                                        className="w-6 h-6 rounded border border-gray-200"
                                        style={{ backgroundColor: color }}
                                        title={color}
                                    />
                            ))}
                        </div>
                    </div>
                </div>

                {/* Clear formatting */}
                <button 
                    onClick={handleClearFormatting}
                    className="w-full px-4 py-2 text-left hover:bg-gray-100 flex items-center gap-2 border-t border-gray-200"
                >
                    <Trash2 className="w-4 h-4" />
                    <span>Clear formatting</span>
                </button>
            </div>
        </div>
    );
};

export default FormatMenu;