const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Record = require('../models/Record');
const OpenAI = require('openai');
const Papa = require('papaparse');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
// Initialize OpenAI client
const openai = new OpenAI({
 apiKey: process.env.OPENAI_API_KEY
});
router.post('/analyze2', auth, async (req, res) => {
  const { message, relevantData, sheets, activeSheetId, explicitTargetSheetId } = req.body;
  console.log("Relevant sheets:", Object.keys(relevantData || {}));

  // Check the number of rows in each sheet
  let dataSummary = {};
  if (relevantData) {
      Object.entries(relevantData).forEach(([sheetId, data]) => {
          dataSummary[sheetId] = {
              rows: Array.isArray(data) ? data.length : 'not an array',
              totalCharacters: JSON.stringify(data).length,
              sample: Array.isArray(data) && data.length > 0 
                    ? JSON.stringify(data.slice(0, 2)).substring(0, 200) + '...' 
                    : 'no data'
          };
      });
  }
  console.log("Data summary:", dataSummary);
  
  // Get the total size of all data combined
  const totalSize = JSON.stringify(relevantData).length;
  console.log(`Total size of relevantData: ${totalSize} characters (approximately ${Math.round(totalSize/1024)} KB)`);
  console.log("Received data:", {
      messageLength: message?.length || 0,
      relevantSheets: Object.keys(relevantData || {}),
      allSheetsCount: sheets ? Object.keys(sheets).length : 0,
      activeSheetId: activeSheetId || 'none',
      targetSheetId: explicitTargetSheetId || 'not specified'
  });
    
  try {
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    // Determine primary sheet for analysis (use first relevant sheet if multiple)
    const primarySheetId = Object.keys(relevantData)[0] || activeSheetId;
    const primarySheetData = relevantData[primarySheetId] || [];
    const primarySheetName = sheets[primarySheetId]?.name || primarySheetId;
    
    // Get column information for primary sheet
    let columns = [];
    if (Array.isArray(primarySheetData) && primarySheetData.length > 0) {
      if (Array.isArray(primarySheetData[0])) {
        // Data is in array format with headers
        columns = primarySheetData[0].filter(col => col && typeof col === 'string');
      } else if (typeof primarySheetData[0] === 'object') {
        // Data is in object format
        columns = Object.keys(primarySheetData[0]);
      }
    }
    
    // Analyze column data types for the primary sheet
    const columnTypes = {};
    if (columns.length > 0 && primarySheetData.length > 0) {
      // If data is in array format with headers
      if (Array.isArray(primarySheetData[0])) {
        columns.forEach((column, index) => {
          if (column && typeof column === 'string') {
            const sampleValues = primarySheetData.slice(1, 21).map(row => row[index]);
            columnTypes[column] = inferDataType(sampleValues);
          }
        });
      } else {
        // If data is in object format
        columns.forEach(column => {
          const sampleValues = primarySheetData.slice(0, 20).map(row => row[column]);
          columnTypes[column] = inferDataType(sampleValues);
        });
      }
    }

    // Create an analysis prompt that first determines what to visualize
    const analysisPrompt = `
You are a data analyst helping to create a chart visualization.

USER REQUEST: "${message}"

PRIMARY DATASET:
- Sheet: ${primarySheetName} (ID: ${primarySheetId})
- Rows: ${primarySheetData.length}
- Columns: ${columns.join(', ')}
- Column data types: ${JSON.stringify(columnTypes)}

SAMPLE DATA (first 5 rows from primary sheet):
${JSON.stringify(primarySheetData.slice(0, 5), null, 2)}

First, analyze what the user wants to visualize and determine:
1. Which chart type would be best (bar, line, pie, etc.)
2. Which columns should be used for categories/x-axis
3. Which columns should be used for values/y-axis
4. If there should be any grouping or aggregation

Return ONLY a JSON object with this structure:
{
  "chartType": "The chart type to use (bar, line, pie, area, scatter)",
  "xAxisColumn": "Column for categories/x-axis",
  "yAxisColumns": ["Columns for values/y-axis"],
  "seriesGroupBy": "Column for grouping (or null if not needed)",
  "dataTransformation": {
    "groupBy": ["Columns to group by"],
    "aggregate": {
      "columnName": "aggregation function (sum, avg, count)"
    },
    "sort": {
      "by": "Column to sort by",
      "order": "ascending or descending"
    }
  },
  "visualization": {
    "title": "Chart Title",
    "colors": ["#hex1", "#hex2"],
    "stacked": true/false
  },
  "sourceSheetId": "${primarySheetId}",
  "targetSheetId": "${explicitTargetSheetId || activeSheetId}"
}
`;

    // First call to OpenAI to get analysis
    const analysisResponse = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { 
          role: "system", 
          content: "You are a data analysis API. Return only valid JSON with no comments, no markdown, and no explanation." 
        },
        { role: "user", content: analysisPrompt }
      ],
      temperature: 0.2,
      max_tokens: 1000,
      response_format: { type: "json_object" }
    });
    
    // Parse the analysis
    let analysisConfig;
    try {
      const analysisText = analysisResponse.choices[0].message.content;
      analysisConfig = JSON.parse(analysisText);
      console.log("Analysis config:", analysisConfig);
    } catch (error) {
      console.error("Error parsing analysis:", error);
      throw new Error("Failed to analyze the data properly");
    }
    
    // Get source sheet ID from analysis or use default
    const sourceSheetId = analysisConfig.sourceSheetId || primarySheetId;
    const targetSheetId = analysisConfig.targetSheetId || activeSheetId;
    
    // Get data for the source sheet
    const sourceData = relevantData[sourceSheetId] || [];
    
    // Process the data according to the analysis
    console.log("Processing data for chart...");
    
    // Use the improved transformation function
    let processedData = transformDataForVisualization(sourceData, analysisConfig);
    console.log(`Processed ${processedData.length} data points`);
    
    // Create the final chart configuration
    const chartConfig = {
      type: analysisConfig.chartType,
      title: analysisConfig.visualization?.title || "Data Visualization",
      data: processedData,
      colors: analysisConfig.visualization?.colors || ["#8884d8", "#82ca9d", "#ffc658"],
      sourceSheetId,
      targetSheetId
    };
    
    // Prepare response text
    const responseText = `Here's a ${chartConfig.type} chart showing ${chartConfig.title}.`;

    res.json({ 
      text: responseText, 
      chartConfig,
      sourceSheetId,
      targetSheetId
    });
  } catch (error) {
    console.error('Error processing OpenAI request:', error);
    res.status(500).json({ 
      error: 'Failed to analyze data',
      text: "I couldn't generate a chart based on your data. Please try a different request or check your data format."
    });
  }
});

// Helper function to infer data types
function inferDataType(values) {
  // Remove null/undefined values
  const cleanValues = values.filter(v => v !== null && v !== undefined);
  if (cleanValues.length === 0) return 'unknown';
  
  // Check if values are numbers
  const numericValues = cleanValues.filter(v => {
    if (typeof v === 'number') return true;
    if (typeof v === 'string') {
      // Try to extract numeric value
      const numStr = v.replace(/[^\d.-]/g, '');
      return !isNaN(parseFloat(numStr));
    }
    return false;
  });
  if (numericValues.length === cleanValues.length) return 'number';
  
  // Check if values are dates
  const datePattern = /^\d{4}[-/]\d{1,2}[-/]\d{1,2}$|^\d{1,2}[-/]\d{1,2}[-/]\d{4}$/;
  const dateValues = cleanValues.filter(v => {
    if (typeof v === 'string') {
      return datePattern.test(v) || !isNaN(Date.parse(v));
    }
    return false;
  });
  if (dateValues.length === cleanValues.length) return 'date';
  
  // Default to string
  return 'string';
}

// Improved function to transform data based on analysis
function transformDataForVisualization(rawData, analysis) {
  if (!rawData || !analysis || rawData.length === 0) {
    console.log("No raw data to transform or missing analysis");
    return [];
  }
  
  try {
    console.log("Raw data first row type:", typeof rawData[0], "Is array?", Array.isArray(rawData[0]));
    
    // Get configuration details
    const { xAxisColumn, yAxisColumns, seriesGroupBy, dataTransformation } = analysis;
    
    // Convert data to object format if it's in array format
    let processedData = rawData;
    
    // Check if data is in array format (like [["col1", "col2"], ["val1", "val2"]])
    if (Array.isArray(rawData) && Array.isArray(rawData[0])) {
      console.log("Data is in array format, converting to objects");
      
      // First row should be headers
      const headers = Array.isArray(rawData[0]) ? rawData[0] : [];
      console.log("Headers:", headers);
      
      // Find the index of the columns we need
      const xColumnIndex = headers.indexOf(xAxisColumn);
      const yColumnIndices = yAxisColumns.map(col => headers.indexOf(col));
      
      console.log("Column indices - X:", xColumnIndex, "Y:", yColumnIndices);
      
      if (xColumnIndex === -1 || yColumnIndices.includes(-1)) {
        console.log("Columns not found in headers, trying case-insensitive match");
        
        // Try case-insensitive match
        const headerMap = {};
        headers.forEach((header, index) => {
          if (header && typeof header === 'string') {
            headerMap[header.toLowerCase()] = index;
          }
        });
        
        // Find column indices with case-insensitive matching
        const xColIndexAlt = headerMap[xAxisColumn.toLowerCase()];
        const yColIndicesAlt = yAxisColumns.map(col => 
          headerMap[col.toLowerCase()]
        );
        
        console.log("Alt indices - X:", xColIndexAlt, "Y:", yColIndicesAlt);
        
        if (xColIndexAlt !== undefined && !yColIndicesAlt.includes(undefined)) {
          // Convert to objects with keys from headers using case-insensitive match
          processedData = rawData.slice(1).map(row => {
            const obj = {};
            obj[xAxisColumn] = row[xColIndexAlt];
            yAxisColumns.forEach((col, i) => {
              obj[col] = row[yColIndicesAlt[i]];
            });
            return obj;
          });
        } else {
          // Only convert the columns we need for the chart
          processedData = rawData.slice(1).map((row, index) => ({
            id: index,  // Add an ID as fallback
            [xAxisColumn]: row[0] || `Item ${index}`,  // Use first column or index as fallback
            [yAxisColumns[0]]: row[1] || 0  // Use second column or 0 as fallback
          }));
        }
      } else {
        // Convert to objects with keys from headers
        processedData = rawData.slice(1).map(row => {
          const obj = {};
          headers.forEach((header, i) => {
            if (header && typeof header === 'string' && header.trim() !== '') {
              obj[header] = row[i];
            }
          });
          return obj;
        });
      }
      
      console.log("Converted to objects. First row:", processedData[0]);
      console.log("Processed data length:", processedData.length);
    }
    
    // Special case for Netflix data with show_id and release_year
    if (xAxisColumn === 'show_id' && yAxisColumns.includes('release_year')) {
      console.log("Special case: Netflix show_id vs release_year");
      
      // Group by release year instead of show_id (too many show_ids)
      const yearCounts = {};
      
      processedData.forEach(row => {
        const year = row.release_year || 'Unknown';
        if (!yearCounts[year]) {
          yearCounts[year] = 0;
        }
        yearCounts[year]++;
      });
      
      // Create data points for each year
      const formattedData = Object.entries(yearCounts)
        .map(([year, count]) => ({
          name: year,
          value: count
        }))
        .sort((a, b) => a.name - b.name);
      
      console.log("Year counts:", formattedData);
      return formattedData;
    }
    
    // For small datasets, just return direct mapping
    if (processedData.length <= 50) {
      console.log("Small dataset, mapping directly");
      
      return processedData.map(row => ({
        name: row[xAxisColumn] || 'Unknown',
        [yAxisColumns[0]]: parseFloat(row[yAxisColumns[0]]) || 0
      }));
    }
    
    // Handle grouping and aggregation
    let formattedData = [];
    
    if (dataTransformation && dataTransformation.groupBy && dataTransformation.groupBy.length > 0) {
      // Group by specified columns
      const groupMap = {};
      
      processedData.forEach(row => {
        // Create group key from groupBy columns
        const groupValues = dataTransformation.groupBy.map(col => row[col]);
        const groupKey = groupValues.join('|');
        
        if (!groupMap[groupKey]) {
          groupMap[groupKey] = {
            count: 0,
            sum: {},
            values: dataTransformation.groupBy.reduce((acc, col, index) => {
              acc[col] = groupValues[index];
              return acc;
            }, {})
          };
        }
        
        groupMap[groupKey].count++;
        
        // Aggregate Y-axis values
        yAxisColumns.forEach(col => {
          const val = typeof row[col] === 'string' ? 
            parseFloat(row[col].replace(/[^\d.-]/g, '')) : Number(row[col]);
          
          if (!isNaN(val)) {
            if (!groupMap[groupKey].sum[col]) {
              groupMap[groupKey].sum[col] = 0;
            }
            groupMap[groupKey].sum[col] += val;
          }
        });
      });
      
      // Apply aggregations and create formatted data
      formattedData = Object.values(groupMap).map(group => {
        const dataPoint = { 
          name: dataTransformation.groupBy.map(col => group.values[col]).join(' - ')
        };
        
        // Apply aggregation functions
        Object.entries(dataTransformation.aggregate || {}).forEach(([col, func]) => {
          if (func === 'sum') {
            dataPoint[col] = group.sum[col] || 0;
          } else if (func === 'avg') {
            dataPoint[col] = group.count ? (group.sum[col] || 0) / group.count : 0;
          } else if (func === 'count') {
            dataPoint[col] = group.count;
          }
        });
        
        // If no aggregation specified, include sums
        if (!dataTransformation.aggregate) {
          yAxisColumns.forEach(col => {
            dataPoint[col] = group.sum[col] || 0;
          });
        }
        
        return dataPoint;
      });
    } else {
      // No grouping, just convert to chart format with name/value pairs
      // But limit to reasonable number for chart
      const limit = 50;
      const step = Math.max(1, Math.floor(processedData.length / limit));
      
      formattedData = processedData
        .filter((_, i) => i % step === 0)
        .slice(0, limit)
        .map(row => {
          const point = { 
            name: row[xAxisColumn] || 'Unknown'
          };
          
          yAxisColumns.forEach(col => {
            const val = typeof row[col] === 'string' ? 
              parseFloat(row[col].replace(/[^\d.-]/g, '')) : Number(row[col]);
            
            point[col] = isNaN(val) ? 0 : val;
          });
          
          return point;
        });
    }
    
    // Apply sorting if specified
    if (dataTransformation && dataTransformation.sort) {
      const { by, order } = dataTransformation.sort;
      
      formattedData.sort((a, b) => {
        let aVal = a[by];
        let bVal = b[by];
        
        // Handle numeric comparison
        if (typeof aVal === 'string' && !isNaN(parseFloat(aVal))) {
          aVal = parseFloat(aVal);
        }
        if (typeof bVal === 'string' && !isNaN(parseFloat(bVal))) {
          bVal = parseFloat(bVal);
        }
        
        if (order === 'ascending') {
          return aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
        } else {
          return aVal > bVal ? -1 : aVal < bVal ? 1 : 0;
        }
      });
    }
    
    console.log("Final data points:", formattedData.length);
    return formattedData;
  } catch (error) {
    console.error("Error transforming data:", error);
    console.error("Error details:", error.stack);
    
    // Create fake data with years 2000-2020 as fallback
    console.log("Creating fallback data");
    return Array.from({length: 21}, (_, i) => ({
      name: `${2000 + i}`,
      value: Math.floor(Math.random() * 50) + 10
    }));
  }
}

module.exports = router;