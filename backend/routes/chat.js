const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Record = require('../models/Record');
const OpenAI = require('openai');

// Initialize OpenAI client
const openai = new OpenAI({
 apiKey: process.env.OPENAI_API_KEY
});
router.post('/analyze2', auth, async (req, res) => {
  const { message, relevantData, sheets, activeSheetId, explicitTargetSheetId } = req.body;
    
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

        // Keep the original prompt but add source and target sheet information
        const systemPrompt = `You are a helpful data analyst assistant. Analyze the provided data and answer questions about it clearly and concisely.

When asked to create or show a chart:
1. Analyze the provided data structure carefully
2. Return a JSON response with the following structure:
IMPORTANT: Do not include any comments inside the JSON response. Do not use // or /* */ style comments in the JSON data. Make sure the JSON is valid and complete.
{
  "type": "bar", // The chart type: "bar", "line", "pie", "area", etc.
  "title": "Chart Title",
  "data": [
    { "name": "Category1", "value1": 10, "value2": 20 },
    { "name": "Category2", "value1": 15, "value2": 25 }
  ],
  "colors": ["#8884d8", "#82ca9d"], // Color scheme for the chart
  "sourceSheetId": "sheet1", // The sheet ID where data comes from (optional)
  "targetSheetId": "sheet2" // The sheet ID where chart should be created (optional)
}
3. Ensure the "data" property contains properly formatted objects that Recharts can directly use
4. Always include a "name" property for each data point, which will be used for the X-axis or labels
5. Include numeric values with appropriate keys (avoid using spaces or special characters in keys)
6. Do NOT return JSX or React component code
7. If user requests data from one sheet to create a chart in another, specify both sourceSheetId and targetSheetId

Examples of valid JSON responses:
For a bar chart:
{
  "type": "bar",
  "title": "Monthly Sales",
  "data": [
    { "name": "Jan", "sales": 4000, "revenue": 2400 },
    { "name": "Feb", "sales": 3000, "revenue": 1398 }
  ],
  "colors": ["#8884d8", "#82ca9d"],
  "sourceSheetId": "sheet1",
  "targetSheetId": "sheet1"
}

For a pie chart:
{
  "type": "pie",
  "title": "Revenue Distribution",
  "data": [
    { "name": "Product A", "value": 400 },
    { "name": "Product B", "value": 300 }
  ],
  "colors": ["#0088FE", "#00C49F", "#FFBB28", "#FF8042"],
  "sourceSheetId": "sheet1",
  "targetSheetId": "sheet2"
}

For a column chart:
{
  "type": "column",
  "title": "Product Performance",
  "data": [
    { "name": "Product A", "revenue": 4000, "profit": 2400 },
    { "name": "Product B", "revenue": 3000, "profit": 1398 }
  ],
  "colors": ["#8884d8", "#82ca9d"],
  "sourceSheetId": "sheet2",
  "targetSheetId": "sheet3"
}

For a radar chart:
{
  "type": "radar",
  "title": "Feature Comparison",
  "data": [
    { "name": "Feature A", "product1": 120, "product2": 110, "product3": 140 },
    { "name": "Feature B", "product1": 98, "product2": 130, "product3": 150 },
    { "name": "Feature C", "product1": 86, "product2": 130, "product3": 130 }
  ],
  "colors": ["#8884d8", "#82ca9d", "#ffc658"],
  "sourceSheetId": "sheet1",
  "targetSheetId": "sheet1"
}

For a scatter chart:
{
  "type": "scatter",
  "title": "Height vs Weight Correlation",
  "data": [
    { "name": "Person A", "height": 170, "weight": 67 },
    { "name": "Person B", "height": 178, "weight": 80 },
    { "name": "Person C", "height": 175, "weight": 73 }
  ],
  "colors": ["#8884d8", "#82ca9d"],
  "sourceSheetId": "sheet2",
  "targetSheetId": "sheet2"
}

For a funnel chart:
{
  "type": "funnel",
  "title": "Sales Funnel",
  "data": [
    { "name": "Website Visits", "value": 5000 },
    { "name": "Downloads", "value": 3500 },
    { "name": "Prospects", "value": 2500 },
    { "name": "Customers", "value": 1200 }
  ],
  "colors": ["#8884d8", "#82ca9d", "#ffc658", "#ff8042"],
  "sourceSheetId": "sheet1",
  "targetSheetId": "sheet3"
}

For a radial bar chart:
{
  "type": "radialBar",
  "title": "Achievement Progress",
  "data": [
    { "name": "Goal 1", "value": 70 },
    { "name": "Goal 2", "value": 95 },
    { "name": "Goal 3", "value": 53 },
    { "name": "Goal 4", "value": 85 }
  ],
  "colors": ["#0088FE", "#00C49F", "#FFBB28", "#FF8042"],
  "sourceSheetId": "sheet2",
  "targetSheetId": "sheet1"
}

For a composed chart (combining bar, line, and area):
{
  "type": "composed",
  "title": "Business Performance",
  "data": [
    { "name": "Q1", "revenue": 4000, "profit": 2400, "forecast": 3000 },
    { "name": "Q2", "revenue": 3000, "profit": 1398, "forecast": 2000 },
    { "name": "Q3", "revenue": 2000, "profit": 9800, "forecast": 2780 },
    { "name": "Q4", "revenue": 2780, "profit": 3908, "forecast": 2500 }
  ],
  "colors": ["#8884d8", "#82ca9d", "#ffc658"],
  "sourceSheetId": "sheet1",
  "targetSheetId": "sheet2"
}

For a treemap chart:
{
  "type": "treemap",
  "title": "Market Share Distribution",
  "data": [
    { "name": "Company A", "value": 4000 },
    { "name": "Company B", "value": 3000 },
    { "name": "Company C", "value": 2000 },
    { "name": "Company D", "value": 1000 }
  ],
  "colors": ["#8884d8", "#82ca9d", "#ffc658", "#ff8042"],
  "sourceSheetId": "sheet3",
  "targetSheetId": "sheet3"
}
  
Always make sure the structure of your response is clean, consistent, and directly usable by Recharts.

If the user mentions creating a chart in a specific sheet using data from another sheet, make sure to set the sourceSheetId and targetSheetId appropriately. If not specified, assume both are the active sheet.`;

        // Prepare a message object that includes all sheets if available
        let messageContent = `I want to create a chart based on the following data:\n\n`;
        
        // Include full data from all relevant sheets
        Object.entries(relevantData || {}).forEach(([sheetId, sheetData]) => {
            const sheetName = sheets[sheetId]?.name || sheetId;
            messageContent += `Data from sheet ${sheetName} (ID: ${sheetId}):\n`;
            messageContent += `${JSON.stringify(sheetData)}\n\n`;
        });
        
        // Add information about all available sheets
        messageContent += `All available sheets:\n`;
        Object.entries(sheets).forEach(([sheetId, sheetData]) => {
            const sheetName = sheetData.name || sheetId;
            const isActive = sheetId === activeSheetId ? ' (active)' : '';
            const isTarget = sheetId === explicitTargetSheetId ? ' (target)' : '';
            const isRelevant = relevantData && relevantData[sheetId] ? ' (data provided)' : '';
            
            messageContent += `- ${sheetName}${isActive}${isTarget}${isRelevant} (ID: ${sheetId})\n`;
            messageContent += `  Rows: ${sheetData.data?.length || 0}\n`;
            
            // Add a sample for sheets where full data wasn't provided
            if (!relevantData || !relevantData[sheetId]) {
                if (sheetData.data && sheetData.data.length > 0) {
                    messageContent += `  Sample: ${JSON.stringify(sheetData.data.slice(0, 2))}\n`;
                }
            }
        });
        
        // Add the user's question and explicit instructions
        messageContent += `\nActive sheet: ${activeSheetId}\n`;
        messageContent += `Target sheet for chart: ${explicitTargetSheetId || activeSheetId}\n\n`;
        messageContent += `User question: ${message}\n\n`;
        messageContent += `Based on the data provided and the user's question, create a chart. If the user mentioned specific sheets for data or for displaying the chart, make sure to respect that in your response.`;


        const openaiResponse = await openai.chat.completions.create({
            model: "gpt-4o",
            messages: [
                {
                    "role": "system",
                    "content": systemPrompt
                },
                {
                    "role": "user",
                    "content": messageContent
                }
            ],
            temperature: 0.7,
            max_tokens: 2048,
            top_p: 1
        });
       
        console.log("OpenAI response:", {
            status: openaiResponse.choices[0].finish_reason,
            responseLength: openaiResponse.choices[0].message.content.length,
        });
        
        // Extract the assistant's response
        const assistantResponse = openaiResponse.choices[0].message.content;
        console.log("Assistant response:", assistantResponse);
        
        // Parse out the chart config
       // Parse out the chart config
let chartConfig = null;
let sourceSheetId = null;
let targetSheetId = null;

try {
    // Look for JSON in the response
    const jsonMatch = assistantResponse.match(/```json\s*([\s\S]*?)\s*```/);
    if (jsonMatch && jsonMatch[1]) {
        // Clean up any comments in the JSON before parsing
        let jsonString = jsonMatch[1].trim();
        // Remove any lines with comments (starting with //)
        jsonString = jsonString.replace(/\/\/.*$/gm, "");
        // Remove any trailing commas before ] or }
        jsonString = jsonString.replace(/,(\s*[\]}])/g, "$1");
        
        try {
            chartConfig = JSON.parse(jsonString);
            console.log("Extracted chart config from code block:", chartConfig);
        } catch (jsonError) {
            console.error('Error parsing JSON from code block:', jsonError);
            console.log('Problematic JSON string:', jsonString);
        }
    } else {
        // Try to find JSON without code blocks
        const jsonRegex = /\{[\s\S]*"type"[\s\S]*"data"[\s\S]*\}/g;
        const possibleJson = assistantResponse.match(jsonRegex);
        if (possibleJson) {
            try {
                // Clean up any comments in the JSON before parsing
                let jsonString = possibleJson[0];
                // Remove any lines with comments (starting with //)
                jsonString = jsonString.replace(/\/\/.*$/gm, "");
                // Remove any trailing commas before ] or }
                jsonString = jsonString.replace(/,(\s*[\]}])/g, "$1");
                
                chartConfig = JSON.parse(jsonString);
                console.log("Extracted chart config from text:", chartConfig);
            } catch (e) {
                console.error("Failed to parse JSON from text:", e);
                console.log('Problematic JSON string:', possibleJson[0]);
            }
        }
    }
    
    // Extract source and target sheet IDs if present
    if (chartConfig) {
        sourceSheetId = chartConfig.sourceSheetId || activeSheetId;
        targetSheetId = chartConfig.targetSheetId || activeSheetId;
        
        // Remove these from the chart config as they'll be handled separately
        delete chartConfig.sourceSheetId;
        delete chartConfig.targetSheetId;
    }
} catch (parseError) {
    console.error('Error parsing chart config:', parseError);
}

        // Clean up the response by removing the code block for display
        let cleanResponse = assistantResponse;
        if (chartConfig) {
            // Remove the code block from the response text to avoid duplication
            cleanResponse = assistantResponse.replace(/```json[\s\S]*?```/g, '')
                           .replace(/```[\s\S]*?```/g, '')
                           .trim();
            
            // If the response is now empty, add a simple message
            if (!cleanResponse) {
                cleanResponse = "Here's your chart based on the data:";
            }
        }

        res.json({ 
          text: cleanResponse, 
          chartConfig,
          sourceSheetId,
          targetSheetId
      });
    } catch (error) {
        console.error('Error processing OpenAI request:', error);
        res.status(500).json({ error: 'Failed to analyze data' });
    }
});

module.exports = router; 