# classifier/request_classifier.py
from typing import Dict, Any, List, Optional
from openai import OpenAI
import os
import json
from fastapi import HTTPException, Depends
import pandas as pd
from together import Together

class RequestClassifier:
    def __init__(self):
        if os.getenv("MODEL") == "TOGETHER":
            print("Using Together API...")
            try:
                self.client = Together(api_key=os.getenv("TOGETHER_API_KEY"))
                self.model = "meta-llama/Llama-4-Maverick-17B-128E-Instruct-FP8"
            except Exception as e:
                print(f"Error loading Together API: {str(e)}")
                raise HTTPException(status_code=500, detail="Failed to load Together API.")
        else:
            try:
                self.client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
                self.model = "gpt-4o"
            except Exception as e:
                print(f"Error loading OpenAI API: {str(e)}")
                raise HTTPException(status_code=500, detail="Failed to load OpenAI API.")
        
        
    async def classify(self, request_data: Dict[str, Any]) -> str:
        """
        Classify incoming spreadsheet operation requests into categories
        
        Categories:
        - visualization: charts, graphs, plots
        - transformation: data manipulation, filtering, sorting
        - statistical: analysis, correlations, regressions, hypothesis testing
        - query: ONLY conversational questions that require no data analysis
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

        classification_prompt = f"""
        Analyze the following prompt and determine if it's requesting data transformation, visualization, statistical analysis, or simply asking a question about the data.
        
        IMPORTANT: The "query" category should ONLY be used when the request requires NO analysis, transformation, or visualization whatsoever.
        If the request involves ANY data processing, calculations, summarization, or insights, it should be classified as one of the other categories.

        Prompt: {user_message}

        For statistical analysis,
        User's query requires ANY kind of interpretation of data, statistical tests, or analysis. 
        Even simple requests for summaries, averages, counts, or insights count as statistical analysis.
        Possible keywords related to statistical analysis are:
        - "analyze", "statistical", "statistics", "test", "hypothesis", "significance", "p-value"
        - "calculate", "compute", "find the average/mean/median/mode", "summarize", "total"
        - "best", "worst", "highest", "lowest", "max", "min", "top", "bottom"
        - "how many", "count", "sum", "percentage", "proportion", "rate"
        - Specific analysis types like "correlation", "regression", "t-test", "chi-square", "ANOVA"
        - Statistical concepts like "distribution", "normality", "variance", "standard deviation"
        - "find relationships", "compare groups", "determine if significant"
        - Time series analysis, "trend analysis", "seasonality", "forecasting"
        - Comparative analysis, "compare", "contrast", "differences between groups"
        - Exploratory data analysis, "explore", "discover patterns", "identify anomalies"
        - ANY request asking for insights or conclusions from the data

        For transformation:
        User asks for data manipulation or transformation without visualization.
        Possible keywords related to transformation are:
        - Filtering (e.g., "filter", "where", "only show", "find", "exclude")
        - Sorting (e.g., "sort", "order", "arrange", "rank")
        - Aggregation (e.g., "group", "sum", "average", "count", "total", "by")
        - Column operations (e.g., "create column", "new column", "calculate", "rename", "drop column")

        For visualization:
        User asks for visualization of data.
        Possible keywords related to visualization are:
        - "show me a chart/graph", "plot", "visualize", "create a chart", "graph this data"
        - "display", "draw", "illustrate", "visual representation"
        - Specific chart types like "bar chart", "pie chart", "line graph", "scatter plot"

        For query (conversational questions):
        ONLY use this category when the request:
        - Requires absolutely NO analysis or calculation
        - Can be answered with direct lookup or simple description of what's in the data
        - Examples of true queries: "What columns are in this dataset?", "How many rows are there?", "What's this dataset about?"
        - If the user asks for ANY insights, calculations, or information derived from the data, it should be statistical analysis instead

        Provide a JSON response with:
        1. intent: Either 'visualization', 'transformation', 'statistical', or 'query'
        2. reason: Brief explanation of why this classification was chosen
        3. visualization_type: If intent is 'visualization', specify the chart type ('bar', 'line', 'pie', 'scatter', 'area')
        4. transformation_type: If intent is 'transformation', specify the operation type ('filter', 'sort', 'aggregate', 'column_op')
        5. statistical_type: If intent is 'statistical', specify the test type ('correlation', 'ttest', 'chi_square', 'anova', 'regression', 'distribution', 'descriptive', 'summary')
        6. query_type: If intent is 'query', specify the question type ('informational', 'comparative', 'exploratory')

        Example response format for each category:

        1. Visualization example:
        {json.dumps({
            "intent": "visualization",
            "reason": "User is asking for a visual representation of the data with a specific chart type",
            "visualization_type": "bar",
            "transformation_type": None,
            "statistical_type": None,
            "query_type": None
        }, indent=2)}

        2. Transformation example:
        {json.dumps({
            "intent": "transformation",
            "reason": "User is asking for data to be filtered based on specific criteria",
            "visualization_type": None,
            "transformation_type": "filter",
            "statistical_type": None,
            "query_type": None
        }, indent=2)}

        3. Statistical example:
        {json.dumps({
            "intent": "statistical",
            "reason": "User is asking for a correlation analysis between two variables",
            "visualization_type": None,
            "transformation_type": None,
            "statistical_type": "correlation",
            "query_type": None
        }, indent=2)}

        4. Query example (ONLY for questions requiring NO analysis):
        {json.dumps({
            "intent": "query",
            "reason": "User is asking about the structure of the dataset without requiring any analysis",
            "visualization_type": None,
            "transformation_type": None,
            "statistical_type": None,
            "query_type": "informational"
        }, indent=2)}"""
        
        # Get classification from OpenAI
        response = self.client.chat.completions.create(
            model=self.model,
            messages=[
                {"role": "system", "content": "You are a classification API that prioritizes statistical analysis, transformation, and visualization over query. Only classify as 'query' when the request requires ABSOLUTELY NO analysis or data processing. Return only the JSON response as specified in the example response format. Do not include markdown formatting or code blocks."},
                {"role": "user", "content": classification_prompt}
            ],
            temperature=0.1,
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
            category = response_data.get("intent", "statistical").lower()  # Default to statistical on missing intent
            
            print(f"Parsed category: {category}")
            
            # Get additional details about the operation type
            if category == "transformation":
                transformation_type = response_data.get("transformation_type")
                print(f"Transformation type: {transformation_type}")
            elif category == "visualization":
                visualization_type = response_data.get("visualization_type")
                print(f"Visualization type: {visualization_type}")
            elif category == "statistical":
                statistical_type = response_data.get("statistical_type", "descriptive")
                print(f"Statistical type: {statistical_type}")
            elif category == "query":
                query_type = response_data.get("query_type")
                print(f"Query type: {query_type}")
                
        except (json.JSONDecodeError, AttributeError) as e:
            print(f"Error parsing OpenAI response: {str(e)}")
            print(f"Raw response: {response.choices[0].message.content}")
            category = "statistical"  # Default to statistical on error
        
        # Validate category
        valid_categories = ["visualization", "transformation", "statistical", "query"]
        if category not in valid_categories:
            print(f"Invalid category: {category}. Defaulting to statistical.")
            category = "statistical"
            
        return category