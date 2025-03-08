import React, { useState } from 'react';
import {
    Bold,
    Italic,
    Underline,
    Strikethrough,
    AlignLeft,
    AlignCenter,
    AlignRight,
    Palette,
    PaintBucket,
    Percent,
    DollarSign,
    Type,
    MinusCircle,
    PlusCircle
} from 'lucide-react';

const Toolbar = ({ onFormatChange, activeCell, currentFormat }) => {
    const [showTextColorPicker, setShowTextColorPicker] = useState(false);
    const [showFillColorPicker, setShowFillColorPicker] = useState(false);

    const handleNumberFormat = (type) => {
        if (!activeCell) return;
        onFormatChange(type);
    };

    return (
        <div className="flex items-center h-10 px-2 space-x-1 border-b border-gray-200">
            {/* Number formatting */}
            <div className="flex items-center space-x-1 border-r border-gray-200 pr-2">
                <button 
                    className="p-1.5 hover:bg-gray-100 rounded text-sm font-medium"
                    onClick={() => handleNumberFormat('toggleCommas')}
                    title="Toggle Commas"
                >
                    99
                </button>
                <button 
                    className="p-1.5 hover:bg-gray-100 rounded"
                    onClick={() => handleNumberFormat('decreaseDecimals')}
                    title="Decrease Decimal Places"
                >
                    <MinusCircle className="w-4 h-4" />
                </button>
                <button 
                    className="p-1.5 hover:bg-gray-100 rounded"
                    onClick={() => handleNumberFormat('increaseDecimals')}
                    title="Increase Decimal Places"
                >
                    <PlusCircle className="w-4 h-4" />
                </button>
                <button 
                    className="p-1.5 hover:bg-gray-100 rounded"
                    onClick={() => handleNumberFormat('currency')}
                    title="Currency Format"
                >
                    <DollarSign className="w-4 h-4" />
                </button>
                <button 
                    className="p-1.5 hover:bg-gray-100 rounded"
                    onClick={() => handleNumberFormat('percentage')}
                    title="Percentage"
                >
                    <Percent className="w-4 h-4" />
                </button>
            </div>

            {/* Text formatting */}
            <div className="flex items-center space-x-1 border-r border-gray-200 pr-2">
                <button 
                    className={`p-1.5 hover:bg-gray-100 rounded ${currentFormat?.bold ? 'bg-gray-200' : ''}`}
                    onClick={() => onFormatChange('bold')}
                    title="Bold"
                >
                    <Bold className="w-4 h-4" />
                </button>
                <button 
                    className={`p-1.5 hover:bg-gray-100 rounded ${currentFormat?.italic ? 'bg-gray-200' : ''}`}
                    onClick={() => onFormatChange('italic')}
                    title="Italic"
                >
                    <Italic className="w-4 h-4" />
                </button>
                <button 
                    className={`p-1.5 hover:bg-gray-100 rounded ${currentFormat?.underline ? 'bg-gray-200' : ''}`}
                    onClick={() => onFormatChange('underline')}
                    title="Underline"
                >
                    <Underline className="w-4 h-4" />
                </button>
                <button 
                    className={`p-1.5 hover:bg-gray-100 rounded ${currentFormat?.strikethrough ? 'bg-gray-200' : ''}`}
                    onClick={() => onFormatChange('strikethrough')}
                    title="Strikethrough"
                >
                    <Strikethrough className="w-4 h-4" />
                </button>
            </div>

            {/* Color formatting */}
            <div className="flex items-center space-x-1 border-r border-gray-200 pr-2">
                <div className="relative">
                    <button 
                        className="p-1.5 hover:bg-gray-100 rounded"
                        onClick={() => setShowTextColorPicker(!showTextColorPicker)}
                        title="Text Color"
                    >
                        <Palette className="w-4 h-4" />
                    </button>
                    {showTextColorPicker && (
                        <div className="absolute top-full left-0 mt-1 bg-white shadow-lg rounded p-2 z-50 grid grid-cols-8 gap-1">
                            {['#000000', '#FF0000', '#00FF00', '#0000FF', '#FFFF00', '#FF00FF', '#00FFFF', '#808080'].map((color) => (
                                <button
                                    key={color}
                                    className="w-6 h-6 rounded"
                                    style={{ backgroundColor: color }}
                                    onClick={() => {
                                        onFormatChange('textColor', color);
                                        setShowTextColorPicker(false);
                                    }}
                                />
                            ))}
                        </div>
                    )}
                </div>
                <div className="relative">
                    <button 
                        className="p-1.5 hover:bg-gray-100 rounded"
                        onClick={() => setShowFillColorPicker(!showFillColorPicker)}
                        title="Fill Color"
                    >
                        <PaintBucket className="w-4 h-4" />
                    </button>
                    {showFillColorPicker && (
                        <div className="absolute top-full left-0 mt-1 bg-white shadow-lg rounded p-2 z-50 grid grid-cols-8 gap-1">
                            {['#FFFFFF', '#FFCDD2', '#C8E6C9', '#BBDEFB', '#FFECB3', '#E1BEE7', '#B2EBF2', '#F5F5F5'].map((color) => (
                                <button
                                    key={color}
                                    className="w-6 h-6 rounded border border-gray-200"
                                    style={{ backgroundColor: color }}
                                    onClick={() => {
                                        onFormatChange('fillColor', color);
                                        setShowFillColorPicker(false);
                                    }}
                                />
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Alignment */}
            <div className="flex items-center space-x-1">
                <button 
                    className={`p-1.5 hover:bg-gray-100 rounded ${currentFormat?.align === 'left' ? 'bg-gray-200' : ''}`}
                    onClick={() => onFormatChange('align', 'left')}
                    title="Align Left"
                >
                    <AlignLeft className="w-4 h-4" />
                </button>
                <button 
                    className={`p-1.5 hover:bg-gray-100 rounded ${currentFormat?.align === 'center' ? 'bg-gray-200' : ''}`}
                    onClick={() => onFormatChange('align', 'center')}
                    title="Align Center"
                >
                    <AlignCenter className="w-4 h-4" />
                </button>
                <button 
                    className={`p-1.5 hover:bg-gray-100 rounded ${currentFormat?.align === 'right' ? 'bg-gray-200' : ''}`}
                    onClick={() => onFormatChange('align', 'right')}
                    title="Align Right"
                >
                    <AlignRight className="w-4 h-4" />
                </button>
            </div>
        </div>
    );
};

export default Toolbar; 