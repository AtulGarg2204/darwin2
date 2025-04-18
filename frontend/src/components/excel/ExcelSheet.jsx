import { useEffect, useRef } from 'react';
import { HotTable } from '@handsontable/react';
import { registerAllModules } from 'handsontable/registry';
import 'handsontable/dist/handsontable.full.min.css';
import { useAuth } from '../../context/AuthContext';

// Register all Handsontable modules
registerAllModules();

const ExcelSheet = ({ onDataChange }) => {
    const hotRef = useRef(null);
    const { token } = useAuth();

    const toolbarItems = [
        {
            key: 'bold',
            name: 'Bold',
            icon: 'B'
        },
        {
            key: 'italic',
            name: 'Italic',
            icon: 'I'
        },
        // Add more toolbar items as needed
    ];

    const initialData = [
        ['', '', '', '', '', '', '', '', '', ''],
        ['', '', '', '', '', '', '', '', '', ''],
        ['', '', '', '', '', '', '', '', '', ''],
        ['', '', '', '', '', '', '', '', '', ''],
        ['', '', '', '', '', '', '', '', '', ''],
    ];

    const hotSettings = {
        data: initialData,
        rowHeaders: true,
        colHeaders: true,
        height: 'calc(100vh - 200px)',
        width: '100%',
        licenseKey: 'non-commercial-and-evaluation',
        contextMenu: true,
        mergeCells: true,
        comments: true,
        formulas: true,
        dropdownMenu: true,
        filters: true,
        columnSorting: true,
        manualColumnResize: true,
        manualRowResize: true,
        cell: [
            {
                row: 0,
                col: 0,
                className: 'custom-cell'
            }
        ],
        className: 'custom-table',
        afterChange: (changes) => {
            if (changes) {
                onDataChange(hotRef.current.hotInstance.getData());
            }
        }
    };

    return (
        <div className="excel-container">
            {/* Excel-like toolbar */}
            <div className="excel-toolbar bg-gray-100 border-b border-gray-300 p-2 flex items-center space-x-2">
                <div className="flex space-x-2 border-r pr-2">
                    <button className="p-1.5 hover:bg-gray-200 rounded">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                        </svg>
                    </button>
                    <button className="p-1.5 hover:bg-gray-200 rounded">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                    </button>
                </div>
                <div className="flex space-x-2 border-r pr-2">
                    <button className="font-bold p-1.5 hover:bg-gray-200 rounded">B</button>
                    <button className="italic p-1.5 hover:bg-gray-200 rounded">I</button>
                    <button className="underline p-1.5 hover:bg-gray-200 rounded">U</button>
                </div>
                <div className="flex space-x-2">
                    <select className="text-sm border rounded px-2 py-1">
                        <option>Arial</option>
                        <option>Times New Roman</option>
                        <option>Calibri</option>
                    </select>
                    <select className="text-sm border rounded px-2 py-1">
                        <option>10</option>
                        <option>12</option>
                        <option>14</option>
                        <option>16</option>
                    </select>
                </div>
            </div>

            {/* Excel grid */}
            <HotTable ref={hotRef} settings={hotSettings} />
        </div>
    );
};

export default ExcelSheet; 