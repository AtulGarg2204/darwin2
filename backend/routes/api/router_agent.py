# classifier/request_classifier.py
from typing import Dict, Any
from openai import OpenAI
import os
import json

class RequestClassifier:
    def __init__(self):
        self.client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
        
    async def classify(self, request_data: Dict[str, Any]) -> str:
        """
        Classify incoming spreadsheet operation requests into categories
        
        Categories:
        - visualization: charts, graphs, plots
        - transformation: data manipulation, filtering, sorting
        - statistical: analysis, correlations, regressions
        - cleaning: data cleaning, missing values, formatting
        - forecast: predictions, time series analysis
        """
        # Extract user message
        user_message = request_data.get("message", "")
        
        # Create classification prompt
        """Determine whether the prompt is requesting data transformation, visualization, or statistical analysis."""
        response_format = {
            "intent": "statistical",
            "reason": "Prompt requests statistical analysis",
            "visualization_type": None,
            "transformation_type": None,
            "statistical_type": "correlation"
        }

        classification_prompt = f"""Analyze the following prompt and determine if it's requesting data transformation, visualization, or statistical analysis:

        Prompt: {user_message}

        Provide a JSON response with:
        1. intent: Either 'visualization', 'transformation', or 'statistical'
        2. reason: Brief explanation of why this classification was chosen
        3. visualization_type: If intent is 'visualization', specify the chart type ('bar', 'line', 'pie', 'scatter', 'area'),
        4. transformation_type: If intent is 'transformation', specify the operation type ('aggregate', 'filter', 'join', 'compute'),
        5. statistical_type: If intent is 'statistical', specify the test type ('correlation', 'ttest', 'ztest', 'chi_square'), 

        Example response format:
        {json.dumps(response_format)}"""
        
        # Get classification from OpenAI
        response = await self.client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {"role": "system", "content": "You are a classification API. Return only a single word category."},
                {"role": "user", "content": classification_prompt}
            ],
            temperature=0.4,
            max_tokens=20
        )
        
        # Extract category
        category = response.choices[0].message.content.strip().lower()
        
        # Validate category
        valid_categories = ["visualization", "transformation", "statistical", "cleaning", "forecast"]
        if category not in valid_categories:
            # Default to transformation if invalid category
            return "transformation"
            
        return category