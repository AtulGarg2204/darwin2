
// ColumnFilterDropdown.js
import React, { useState } from 'react';

const ColumnFilterDropdown = ({ 
  columnIndex, 
  columnLabel,
  data, 
  onApplyFilter, 
  onCancel,
  existingFilter
}) => {
  // Extract all unique values from the column
  const getUniqueValues = () => {
    const uniqueValues = new Set();
    
    data.forEach(row => {
      if (row[columnIndex] !== undefined && row[columnIndex] !== '') {
        let value = row[columnIndex];
        // Handle complex cell objects (for dates)
        if (value && typeof value === 'object' && value.value !== undefined) {
          value = value.value;
        }
        uniqueValues.add(String(value));
      }
    });
    
    return Array.from(uniqueValues).sort();
  };

  const uniqueValues = getUniqueValues();
  
  // Initialize selected values
  const [selectedValues, setSelectedValues] = useState(
    existingFilter?.values || uniqueValues.map(val => val)
  );
  const [selectAll, setSelectAll] = useState(
    existingFilter ? 
      (existingFilter.values.length === uniqueValues.length) : 
      true
  );

  // Handle "Select All" checkbox
  const handleSelectAll = () => {
    const newSelectAll = !selectAll;
    setSelectAll(newSelectAll);
    if (newSelectAll) {
      setSelectedValues(uniqueValues);
    } else {
      setSelectedValues([]);
    }
  };

  // Handle individual checkbox selection
  const handleValueSelect = (value) => {
    const newSelectedValues = [...selectedValues];
    
    if (newSelectedValues.includes(value)) {
      // Remove value
      const index = newSelectedValues.indexOf(value);
      newSelectedValues.splice(index, 1);
    } else {
      // Add value
      newSelectedValues.push(value);
    }
    
    setSelectedValues(newSelectedValues);
    setSelectAll(newSelectedValues.length === uniqueValues.length);
  };

  // Handle Apply button
  const handleApply = () => {
    onApplyFilter(columnIndex, selectedValues);
  };

  return (
    <div className="absolute z-50 bg-white border border-gray-300 shadow-lg rounded-md mt-1 max-h-80 overflow-auto min-w-60">
      <div className="p-3 border-b border-gray-200">
        <div className="mb-2 font-semibold">
          Filter {columnLabel}
        </div>
        <input
          type="text"
          placeholder="Search"
          className="w-full p-2 border border-gray-300 rounded"
        />
      </div>
      <div className="max-h-48 overflow-y-auto p-2">
        <div className="flex items-center p-1">
          <input
            type="checkbox"
            id="select-all"
            checked={selectAll}
            onChange={handleSelectAll}
            className="mr-2"
          />
          <label htmlFor="select-all" className="text-sm font-medium">(Select All)</label>
        </div>
        {uniqueValues.map((value, index) => (
          <div key={index} className="flex items-center p-1">
            <input
              type="checkbox"
              id={`value-${index}`}
              checked={selectedValues.includes(value)}
              onChange={() => handleValueSelect(value)}
              className="mr-2"
            />
            <label htmlFor={`value-${index}`} className="text-sm truncate">{value}</label>
          </div>
        ))}
      </div>
      <div className="p-3 border-t border-gray-200 flex justify-end space-x-2">
        <button
          onClick={onCancel}
          className="px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300"
        >
          Cancel
        </button>
        <button
          onClick={handleApply}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          OK
        </button>
      </div>
    </div>
  );
};

export default ColumnFilterDropdown;