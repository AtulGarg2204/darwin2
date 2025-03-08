import React, { useRef } from 'react';
import { FileSpreadsheet, ChevronRight } from 'lucide-react';

const InsertMenu = ({ onDataLoad }) => {
    const fileInputRef = useRef(null);

    const handleFileSelect = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                // Pass the file to parent component for handling
                onDataLoad(file);
            } catch (error) {
                console.error('Error reading file:', error);
                alert('Error reading file. Please make sure it\'s a valid CSV or Excel file.');
            }
        };

        if (file.name.endsWith('.csv')) {
            reader.readAsText(file);
        } else {
            reader.readAsBinaryString(file);
        }
    };

    return (
        <div className="relative group">
            <button className="px-3 py-1 hover:bg-gray-100 rounded">
                Insert
            </button>

            {/* Dropdown menu */}
            <div className="absolute hidden group-hover:block left-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 min-w-[200px]">
                {/* Data submenu */}
                <div className="relative group/sub">
                    <button className="w-full px-4 py-2 text-left hover:bg-gray-100 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <FileSpreadsheet className="w-4 h-4" />
                            <span>Data</span>
                        </div>
                        <ChevronRight className="w-4 h-4" />
                    </button>

                    {/* Data submenu items */}
                    <div className="absolute hidden group-hover/sub:block left-full top-0 bg-white border border-gray-200 rounded-lg shadow-lg min-w-[200px]">
                        <input
                            type="file"
                            ref={fileInputRef}
                            onChange={handleFileSelect}
                            accept=".csv,.xlsx,.xls"
                            className="hidden"
                        />
                        <button 
                            onClick={() => fileInputRef.current?.click()}
                            className="w-full px-4 py-2 text-left hover:bg-gray-100"
                        >
                            Upload Spreadsheet
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default InsertMenu; 