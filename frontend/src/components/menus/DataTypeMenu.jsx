import React from 'react';
import { DatabaseIcon } from 'lucide-react';

const DataTypeMenu = ({ currentData, activeSheetId, sheets, onSelectColumn }) => {
  // Extract column headers from the first row of the current sheet
  const columnHeaders = [];
  
  if (sheets && activeSheetId && sheets[activeSheetId]) {
    const sheetData = sheets[activeSheetId].data;
    
    if (sheetData && sheetData.length > 0) {
      const firstRow = sheetData[0];
      
      // Loop through the first row to get non-empty headers
      firstRow.forEach((cell, index) => {
        if (cell && cell !== '') {
          columnHeaders.push({
            label: cell,
            index: index
          });
        }
      });
    }
  }

  // Handle column selection
  const handleSelectColumn = (columnIndex) => {
    if (onSelectColumn) {
      onSelectColumn(columnIndex);
    }
  };

  return (
    <div className="relative group">
      <button className="flex items-center text-sm text-gray-700 hover:bg-gray-100 px-3 py-1 rounded">
        <DatabaseIcon className="w-4 h-4 mr-1" />
        <span>Data Type</span>
      </button>

      {/* Dropdown menu */}
      <div className="absolute hidden group-hover:block left-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 min-w-[200px]">
        <div className="py-1">
          {columnHeaders.length > 0 ? (
            columnHeaders.map((header, index) => (
              <button
                key={index}
                onClick={() => handleSelectColumn(header.index)}
                className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
              >
                {header.label}
              </button>
            ))
          ) : (
            <div className="px-4 py-2 text-sm text-gray-500">No column headers found</div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DataTypeMenu;