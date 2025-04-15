// StatisticsPanel.js
import React, { useEffect, useState } from 'react';

const StatisticsPanel = ({ 
  visibleRows, 
  selectedRange,
  data,
  filters
}) => {
  const [stats, setStats] = useState({
    count: 0,
    hasNumericValues: false,
    sum: 0,
    average: 0,
    min: null,
    max: null
  });
  
  // Recalculate stats whenever inputs change
  useEffect(() => {
    calculateStats();
  }, [visibleRows, selectedRange, data, filters]);
  
  // Calculate statistics based on visible rows and selection
  const calculateStats = () => {
    // Default stats
    const newStats = {
      count: 0,
      hasNumericValues: false,
      sum: 0,
      average: 0,
      min: null,
      max: null
    };
    
    // If no data or no visible rows, just return default stats
    if (!data || !visibleRows || visibleRows.length === 0) {
      setStats(newStats);
      return;
    }
    
    // If no selection, just return the row count
    if (!selectedRange || !selectedRange.start) {
      newStats.count = visibleRows.length;
      setStats(newStats);
      return;
    }
    
    // Get the selected range
    const startRow = Math.min(selectedRange.start.row, selectedRange.end.row);
    const endRow = Math.max(selectedRange.start.row, selectedRange.end.row);
    const startCol = Math.min(selectedRange.start.col, selectedRange.end.col);
    const endCol = Math.max(selectedRange.start.col, selectedRange.end.col);
    
    // Collect values from the selection that are also in visibleRows
    const values = [];
    const numericValues = [];
    
    for (const rowIndex of visibleRows) {
      // Skip if row is outside selection
      if (rowIndex < startRow || rowIndex > endRow) continue;
      
      // Add values from selected columns in this row
      for (let colIndex = startCol; colIndex <= endCol; colIndex++) {
        if (!data[rowIndex] || colIndex >= data[rowIndex].length) continue;
        
        let cellValue = data[rowIndex][colIndex];
        
        // Handle complex cell objects (like dates)
        if (cellValue && typeof cellValue === 'object' && cellValue.value !== undefined) {
          cellValue = cellValue.value;
        }
        
        // Skip empty cells
        if (cellValue === undefined || cellValue === null || cellValue === '') continue;
        
        // Add to all values
        values.push(cellValue);
        
        // Try to convert to number and add to numeric values if successful
        const numValue = Number(cellValue);
        if (!isNaN(numValue)) {
          numericValues.push(numValue);
        }
      }
    }
    
    // Calculate statistics
    newStats.count = values.length;
    
    if (numericValues.length > 0) {
      newStats.hasNumericValues = true;
      newStats.sum = numericValues.reduce((sum, val) => sum + val, 0);
      newStats.average = newStats.sum / numericValues.length;
      newStats.min = Math.min(...numericValues);
      newStats.max = Math.max(...numericValues);
    }
    
    setStats(newStats);
  };
  
  return (
    <div className="flex items-center justify-end space-x-6 px-4 h-6 text-sm text-gray-600 bg-gray-100 border-t border-gray-300">
      <div>Count: {stats.count}</div>
      
      {stats.hasNumericValues && (
        <>
          <div>Sum: {stats.sum.toLocaleString()}</div>
          <div>Average: {stats.average.toLocaleString(undefined, { maximumFractionDigits: 2 })}</div>
          <div>Min: {stats.min.toLocaleString()}</div>
          <div>Max: {stats.max.toLocaleString()}</div>
        </>
      )}
    </div>
  );
};

export default StatisticsPanel;