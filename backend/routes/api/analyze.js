import { OpenAI } from 'openai';
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

router.post('/analyze-data', async (req, res) => {
    try {
        const { data, range } = req.body;

        // Analyze data using OpenAI
        const analysis = await openai.chat.completions.create({
            model: "gpt-4",
            messages: [
                {
                    role: "system",
                    content: "You are a data analysis expert. Analyze the given data and suggest the best visualization type along with specific configuration details."
                },
                {
                    role: "user",
                    content: `Analyze this data and suggest a visualization: ${JSON.stringify(data)}. 
                             Provide the response in JSON format with plotly.js configuration including data array, 
                             layout object, and chart type recommendation.`
                }
            ]
        });

        // Parse the OpenAI response and create visualization config
        const visualizationConfig = JSON.parse(analysis.choices[0].message.content);

        res.json(visualizationConfig);
    } catch (error) {
        console.error('Error analyzing data:', error);
        res.status(500).json({ error: 'Error analyzing data' });
    }
}); 