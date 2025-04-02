# classifier/request_classifier.py
from typing import Dict, Any, List, Optional
from openai import OpenAI
import os
import json
from fastapi import HTTPException, Depends
import pandas as pd
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
        - query: conversational questions about the data
        """
        # Extract user message
        user_message = request_data.message
        
        # Create classification prompt
        response_format = {
            "intent": "query",
            "reason": "Prompt is asking a question about the data",
            "visualization_type": None,
            "transformation_type": None,
            "statistical_type": None,
            "query_type": "informational"
        }

        classification_prompt = f"""Analyze the following prompt and determine if it's requesting data transformation, visualization, statistical analysis, or simply asking a question about the data:

        Prompt: {user_message}

        For transformation, look for keywords related to:
        - Filtering (e.g., "filter", "where", "only show", "find", "exclude")
        - Sorting (e.g., "sort", "order", "arrange", "rank")
        - Aggregation (e.g., "group", "sum", "average", "count", "total", "by")
        - Column operations (e.g., "create column", "new column", "calculate", "rename", "drop column")

        For visualization, look for keywords related to charts or graphs like:
        - "show me a chart/graph", "plot", "visualize", "create a chart", "graph this data"

        For statistical analysis, look for keywords related to:
        - Statistical tests, correlations, regressions, or predictions
        - "analyze", "correlation between", "relationship between", "significant difference", "hypothesis test"

        For query (conversational questions), look for:
        - Simple questions about the data that don't require transformation or visualization
        - "what is", "how many", "tell me about", "describe", "explain"
        - Questions that seek information rather than specific operations
        - Conversational language without explicit operation requests

        Provide a JSON response with:
        1. intent: Either 'visualization', 'transformation', 'statistical', or 'query'
        2. reason: Brief explanation of why this classification was chosen
        3. visualization_type: If intent is 'visualization', specify the chart type ('bar', 'line', 'pie', 'scatter', 'area')
        4. transformation_type: If intent is 'transformation', specify the operation type ('filter', 'sort', 'aggregate', 'column_op')
        5. statistical_type: If intent is 'statistical', specify the test type ('correlation', 'ttest', 'ztest', 'chi_square')
        6. query_type: If intent is 'query', specify the question type ('informational', 'comparative', 'exploratory')

        Example response format:
        {json.dumps(response_format)}"""
        
        # Get classification from OpenAI
        response = self.client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {"role": "system", "content": "You are a classification API. Return only the JSON response as specified in the example response format. Do not include markdown formatting or code blocks."},
                {"role": "user", "content": classification_prompt}
            ],
            temperature=0.4,
            max_tokens=200
        )
        
        # Extract and parse the response
        try:
            # Clean the response content by removing any markdown formatting
            content = response.choices[0].message.content.strip()
            if content.startswith('```json'):
                content = content[7:]
            if content.endswith('```'):
                content = content[:-3]
            content = content.strip()
            
            # Parse the JSON response
            response_data = json.loads(content)
            category = response_data.get("intent", "query").lower()
            
            print(f"Parsed category: {category}")
            
            # Get additional details about the operation type
            if category == "transformation":
                transformation_type = response_data.get("transformation_type")
                print(f"Transformation type: {transformation_type}")
            elif category == "visualization":
                visualization_type = response_data.get("visualization_type")
                print(f"Visualization type: {visualization_type}")
            elif category == "statistical":
                statistical_type = response_data.get("statistical_type")
                print(f"Statistical type: {statistical_type}")
            elif category == "query":
                query_type = response_data.get("query_type")
                print(f"Query type: {query_type}")
                
        except (json.JSONDecodeError, AttributeError) as e:
            print(f"Error parsing OpenAI response: {str(e)}")
            print(f"Raw response: {response.choices[0].message.content}")
            category = "query"  # Default to query on error
        
        # Validate category
        valid_categories = ["visualization", "transformation", "statistical", "cleaning", "forecast", "query"]
        if category not in valid_categories:
            print(f"Invalid category: {category}. Defaulting to query.")
            category = "query"
            
        return category