import { useEffect, useRef } from 'react';
import { Spreadsheet } from '@dhx/trial-spreadsheet';
import '@dhx/trial-spreadsheet/codebase/spreadsheet.min.css';

const ExcelInterface = ({ onDataChange }) => {
    const containerRef = useRef(null);
    const spreadsheetRef = useRef(null);

    useEffect(() => {
        // Initialize spreadsheet
        spreadsheetRef.current = new Spreadsheet(containerRef.current, {
            menu: true, // Enable top menu (File, Edit, View, etc.)
            toolbar: true, // Enable toolbar with formatting options
            rowsCount: 100,
            colsCount: 20,
            multiSheets: true, // Enable multiple sheets like Excel
            formats: [
                "common",
                "number",
                "currency",
                "percent",
                "date",
                "time"
            ],
            topbar: {
                menu: true,
                toolbar: true,
                search: true
            },
            menu: {
                file: true,
                edit: true,
                view: true,
                insert: true,
                format: true,
                help: true
            },
            toolbarBlocks: [
                "undo", "styles", "font", "align", "format", "rows", "columns", "insert", "clear"
            ]
        });

        // Add event listeners
        spreadsheetRef.current.events.on("Change", (cell, value) => {
            if (onDataChange) {
                const data = spreadsheetRef.current.serialize();
                onDataChange(data);
            }
        });

        return () => {
            if (spreadsheetRef.current) {
                spreadsheetRef.current.destructor();
            }
        };
    }, []);

    return (
        <div className="excel-wrapper h-full">
            {/* Excel Menu Bar */}
            <div className="excel-menubar bg-white border-b border-gray-200">
                <div className="flex items-center h-8 px-2 space-x-4">
                    <div className="flex items-center space-x-3">
                        <button className="px-2 py-1 text-sm hover:bg-gray-100 rounded">File</button>
                        <button className="px-2 py-1 text-sm hover:bg-gray-100 rounded">Edit</button>
                        <button className="px-2 py-1 text-sm hover:bg-gray-100 rounded">View</button>
                        <button className="px-2 py-1 text-sm hover:bg-gray-100 rounded">Insert</button>
                        <button className="px-2 py-1 text-sm hover:bg-gray-100 rounded">Format</button>
                        <button className="px-2 py-1 text-sm hover:bg-gray-100 rounded">Help</button>
                    </div>
                </div>
            </div>

            {/* Formula Bar */}
            <div className="excel-formula-bar flex items-center h-8 border-b border-gray-200 bg-white px-2">
                <div className="flex items-center space-x-2">
                    <span className="text-sm font-medium">fx</span>
                    <input 
                        type="text" 
                        className="flex-1 px-2 py-1 border rounded text-sm"
                        placeholder="Formula"
                    />
                </div>
            </div>

            {/* Spreadsheet Container */}
            <div 
                ref={containerRef} 
                className="spreadsheet-container"
                style={{ height: 'calc(100% - 80px)' }}
            ></div>
        </div>
    );
};

export default ExcelInterface; 