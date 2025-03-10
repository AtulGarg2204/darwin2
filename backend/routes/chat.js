const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Record = require('../models/Record');
const OpenAI = require('openai');

// Initialize OpenAI client
const openai = new OpenAI({
 apiKey: process.env.OPENAI_API_KEY
});

// @route   POST api/chat/analyze
// @desc    Analyze data using OpenAI API
router.post('/analyze', auth, async (req, res) => {
  try {
    const { message, recordId, includeChartSuggestion, data } = req.body;
    
    let dataContext = '';
    let chartPrompt = '';
    let analysisData = data;  // Use provided data if available
    
    if (recordId) {
      const record = await Record.findById(recordId);
      if (!record) {
        return res.status(404).json({ msg: 'Record not found' });
      }
      analysisData = record.data;
    }
    
    if (analysisData && analysisData.length > 0) {
      dataContext = 'Here is the data to analyze:\n';
      const headers = Object.keys(analysisData[0]);
      dataContext += headers.join(', ') + '\n';
      
      analysisData.slice(0, 5).forEach(row => {
        dataContext += headers.map(header => row[header]).join(', ') + '\n';
      });
    }

    if (includeChartSuggestion) {
      chartPrompt = `
Based on the data and user's request, generate a chart configuration in the following format:

\`\`\`json
{
  "type": "line",
  "data": {
    "labels": ["label1", "label2", "label3"],
    "datasets": [{
      "label": "Dataset Label",
      "data": [value1, value2, value3],
      "borderColor": "color_name_or_hex",
      "fill": boolean
    }]
  },
  "options": {
    "scales": {
      "x": {
        "title": {
          "display": true,
          "text": "X-Axis Label"
        }
      },
      "y": {
        "title": {
          "display": true,
          "text": "Y-Axis Label"
        }
      }
    }
  }
}
\`\`\`

Important:
1. Choose appropriate values from the data for labels and datasets
2. Select a suitable chart type (line, bar, pie, area)
3. Use meaningful axis labels based on the data columns
4. Include proper dataset labels
5. Choose appropriate colors
6. The configuration must be valid JSON and match this exact format
`;
    }
    
    const systemMessage = `
You are a data visualization expert. Your task is to:
1. Analyze the provided data
2. Answer questions about it clearly and concisely
3. When asked about visualizations, ALWAYS provide a chart configuration in the exact JSON format specified
4. Make sure the chart configuration uses actual values from the provided data
5. Choose appropriate chart types and colors based on the data type and user's request
6. Ensure all JSON is properly formatted and valid
`;
    
    const completion = await openai.chat.completions.create({
      model: "gpt-4-turbo-preview",
      messages: [
        { role: "system", content: systemMessage },
        { role: "user", content: `${dataContext}\n\nUser Request: ${message}\n\n${chartPrompt}` }
      ],
      temperature: 0.7,
      max_tokens: 1500,
      response_format: { type: "text" }
    });
    
    // Extract the chart configuration if present
    let chartConfig = null;
    const response = completion.choices[0].message.content;
    
    try {
      const jsonMatch = response.match(/```json\n([\s\S]*?)\n```/);
      if (jsonMatch) {
        chartConfig = JSON.parse(jsonMatch[1]);
      }
    } catch (error) {
      console.error('Error parsing chart config:', error);
    }
    
    res.json({ 
      answer: response,
      chartConfig,
      data: analysisData
    });
    
  } catch (err) {
    console.error('Chat API Error:', err);
    res.status(500).json({ 
      error: 'Server Error',
      details: err.message 
    });
  }
});

// @route   POST api/chat/visualize
// @desc    Generate visualization suggestions for data
router.post('/visualize', auth, async (req, res) => {
  try {
    const { recordId } = req.body;
    
    const record = await Record.findById(recordId);
    if (!record) {
      return res.status(404).json({ msg: 'Record not found' });
    }
    
    // Format the data for visualization analysis
    let dataDescription = 'Here is the data structure:\n';
    if (record.data && record.data.length > 0) {
      const headers = Object.keys(record.data[0]);
      dataDescription += `Columns: ${headers.join(', ')}\n`;
      dataDescription += `Number of rows: ${record.data.length}\n`;
      
      // Add sample data
      dataDescription += '\nSample data (first 3 rows):\n';
      record.data.slice(0, 3).forEach(row => {
        dataDescription += JSON.stringify(row) + '\n';
      });
    }
    
    const prompt = `Based on this data structure, suggest appropriate visualization types and analysis methods. ${dataDescription}`;
    
    const completion = await openai.chat.completions.create({
      model: "gpt-4-turbo-preview",
      messages: [
        { 
          role: "system", 
          content: "You are a data visualization expert. Suggest appropriate charts and visualizations based on the data structure provided." 
        },
        { role: "user", content: prompt }
      ],
      temperature: 0.7,
      max_tokens: 1000
    });
    
    res.json({ 
      suggestions: completion.choices[0].message.content,
      recordId
    });
    
  } catch (err) {
    console.error('Visualization API Error:', err);
    res.status(500).json({ 
      error: 'Server Error',
      details: err.message 
    });
  }
});

module.exports = router; 