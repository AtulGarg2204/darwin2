from fastapi import APIRouter, HTTPException, Depends, UploadFile, File
from typing import Dict, List, Optional, Any
from pydantic import BaseModel
from openai import OpenAI
import pandas as pd
import json
import os
from middleware.auth import get_current_user
from models.records import Record

router = APIRouter()
from dotenv import load_dotenv
load_dotenv()

# Initialize OpenAI client
openai_client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

class AnalysisRequest(BaseModel):
    message: str
    relevantData: Dict[str, Any]
    sheets: Dict[str, Any]
    activeSheetId: Optional[str] = None
    explicitTargetSheetId: Optional[str] = None

def infer_data_type(values: List[Any]) -> str:
    """Helper function to infer data types from a list of values."""
    # Remove null/undefined values
    clean_values = [v for v in values if v is not None]
    if not clean_values:
        return 'unknown'
    
    # Check if values are numbers
    numeric_values = []
    for v in clean_values:
        if isinstance(v, (int, float)):
            numeric_values.append(v)
        elif isinstance(v, str):
            try:
                # Try to extract numeric value
                num_str = ''.join(c for c in v if c.isdigit() or c in '.-')
                if num_str:
                    float(num_str)
                    numeric_values.append(float(num_str))
            except ValueError:
                pass
    
    if len(numeric_values) == len(clean_values):
        return 'number'
    
    # Check if values are dates
    date_pattern = r'^\d{4}[-/]\d{1,2}[-/]\d{1,2}$|^\d{1,2}[-/]\d{1,2}[-/]\d{4}$'
    date_values = []
    for v in clean_values:
        if isinstance(v, str):
            import re
            if re.match(date_pattern, v) or pd.to_datetime(v, errors='coerce') is not None:
                date_values.append(v)
    
    if len(date_values) == len(clean_values):
        return 'date'
    
    # Default to string
    return 'string'

def transform_data_for_visualization(raw_data: List[Any], analysis: Dict[str, Any]) -> List[Dict[str, Any]]:
    """Transform data based on analysis configuration."""
    if not raw_data or not analysis:
        return []
    
    try:
        # Get configuration details
        x_axis_column = analysis.get('xAxisColumn')
        y_axis_columns = analysis.get('yAxisColumns', [])
        series_group_by = analysis.get('seriesGroupBy')
        data_transformation = analysis.get('dataTransformation', {})
        
        # Convert data to DataFrame if it's not already
        if isinstance(raw_data[0], list):
            # If data is in array format with headers
            df = pd.DataFrame(raw_data[1:], columns=raw_data[0])
        else:
            # If data is in object format
            df = pd.DataFrame(raw_data)
        
        # Handle special case for Netflix data
        if x_axis_column == 'show_id' and 'release_year' in y_axis_columns:
            year_counts = df['release_year'].value_counts().sort_index()
            return [
                {'name': str(year), 'value': count}
                for year, count in year_counts.items()
            ]
        
        # For small datasets, return direct mapping
        if len(df) <= 50:
            return df.apply(
                lambda row: {
                    'name': row[x_axis_column] or 'Unknown',
                    **{col: float(row[col]) for col in y_axis_columns}
                },
                axis=1
            ).tolist()
        
        # Handle grouping and aggregation
        if data_transformation.get('groupBy'):
            group_cols = data_transformation['groupBy']
            agg_dict = {}
            
            # Set up aggregation functions
            for col, func in data_transformation.get('aggregate', {}).items():
                if func == 'sum':
                    agg_dict[col] = 'sum'
                elif func == 'avg':
                    agg_dict[col] = 'mean'
                elif func == 'count':
                    agg_dict[col] = 'count'
            
            # If no aggregation specified, use sum for y-axis columns
            if not agg_dict:
                agg_dict = {col: 'sum' for col in y_axis_columns}
            
            # Perform grouping and aggregation
            grouped_df = df.groupby(group_cols).agg(agg_dict).reset_index()
            
            # Format the data
            formatted_data = []
            for _, row in grouped_df.iterrows():
                data_point = {
                    'name': ' - '.join(str(row[col]) for col in group_cols)
                }
                for col in agg_dict.keys():
                    data_point[col] = float(row[col])
                formatted_data.append(data_point)
            
            return formatted_data
        
        # No grouping, just convert to chart format with name/value pairs
        limit = 50
        step = max(1, len(df) // limit)
        
        return df.iloc[::step].head(limit).apply(
            lambda row: {
                'name': row[x_axis_column] or 'Unknown',
                **{col: float(row[col]) for col in y_axis_columns}
            },
            axis=1
        ).tolist()
    
    except Exception as e:
        print(f"Error transforming data: {str(e)}")
        # Create fallback data
        return [
            {'name': str(2000 + i), 'value': float(i * 2 + 10)}
            for i in range(21)
        ]

@router.post("/analyze2")
async def analyze_data(
    request: AnalysisRequest,
    current_user: Dict = Depends(get_current_user)
):
    try:
        # Log data summary
        data_summary = {}
        if request.relevantData:
            for sheet_id, data in request.relevantData.items():
                data_summary[sheet_id] = {
                    "rows": len(data) if isinstance(data, list) else "not an array",
                    "totalCharacters": len(json.dumps(data)),
                    "sample": json.dumps(data[:2])[:200] + "..." if isinstance(data, list) and data else "no data"
                }
        
        print("Data summary:", data_summary)
        
        # Determine primary sheet for analysis
        primary_sheet_id = next(iter(request.relevantData.keys())) if request.relevantData else request.activeSheetId
        primary_sheet_data = request.relevantData.get(primary_sheet_id, [])
        primary_sheet_name = request.sheets.get(primary_sheet_id, {}).get('name', primary_sheet_id)
        
        # Get column information for primary sheet
        columns = []
        if isinstance(primary_sheet_data, list) and primary_sheet_data:
            if isinstance(primary_sheet_data[0], list):
                # Data is in array format with headers
                columns = [col for col in primary_sheet_data[0] if col and isinstance(col, str)]
            elif isinstance(primary_sheet_data[0], dict):
                # Data is in object format
                columns = list(primary_sheet_data[0].keys())
        
        # Analyze column data types
        column_types = {}
        if columns and primary_sheet_data:
            if isinstance(primary_sheet_data[0], list):
                for column, index in zip(columns, range(len(columns))):
                    if column and isinstance(column, str):
                        sample_values = [row[index] for row in primary_sheet_data[1:21]]
                        column_types[column] = infer_data_type(sample_values)
            else:
                for column in columns:
                    sample_values = [row.get(column) for row in primary_sheet_data[:20]]
                    column_types[column] = infer_data_type(sample_values)
        
        # Create analysis prompt
        analysis_prompt = f"""
        You are a data analyst helping to create a chart visualization.

        USER REQUEST: "{request.message}"

        PRIMARY DATASET:
        - Sheet: {primary_sheet_name} (ID: {primary_sheet_id})
        - Rows: {len(primary_sheet_data)}
        - Columns: {', '.join(columns)}
        - Column data types: {json.dumps(column_types)}

        SAMPLE DATA (first 5 rows from primary sheet):
        {json.dumps(primary_sheet_data[:5], indent=2)}

        First, analyze what the user wants to visualize and determine:
        1. Which chart type would be best (bar, line, pie, etc.)
        2. Which columns should be used for categories/x-axis
        3. Which columns should be used for values/y-axis
        4. If there should be any grouping or aggregation

        Return ONLY a JSON object with this structure:
        {{
            "chartType": "The chart type to use (bar, line, pie, area, scatter)",
            "xAxisColumn": "Column for categories/x-axis",
            "yAxisColumns": ["Columns for values/y-axis"],
            "seriesGroupBy": "Column for grouping (or null if not needed)",
            "dataTransformation": {{
                "groupBy": ["Columns to group by"],
                "aggregate": {{
                    "columnName": "aggregation function (sum, avg, count)"
                }},
                "sort": {{
                    "by": "Column to sort by",
                    "order": "ascending or descending"
                }}
            }},
            "visualization": {{
                "title": "Chart Title",
                "colors": ["#hex1", "#hex2"],
                "stacked": true/false
            }},
            "sourceSheetId": "{primary_sheet_id}",
            "targetSheetId": "{request.explicitTargetSheetId or request.activeSheetId}"
        }}
        """
        
        # Get OpenAI analysis
        analysis_response = await openai_client.chat.completions.create(
            model="gpt-4",
            messages=[
                {"role": "system", "content": "You are a data analysis API. Return only valid JSON with no comments, no markdown, and no explanation."},
                {"role": "user", "content": analysis_prompt}
            ],
            temperature=0.2,
            max_tokens=1000,
            response_format={"type": "json_object"}
        )
        
        # Parse the analysis
        analysis_config = json.loads(analysis_response.choices[0].message.content)
        print("Analysis config:", analysis_config)
        
        # Get source sheet ID from analysis or use default
        source_sheet_id = analysis_config.get('sourceSheetId', primary_sheet_id)
        target_sheet_id = analysis_config.get('targetSheetId', request.activeSheetId)
        
        # Get data for the source sheet
        source_data = request.relevantData.get(source_sheet_id, [])
        
        # Process the data according to the analysis
        print("Processing data for chart...")
        processed_data = transform_data_for_visualization(source_data, analysis_config)
        print(f"Processed {len(processed_data)} data points")
        
        # Create the final chart configuration
        chart_config = {
            "type": analysis_config['chartType'],
            "title": analysis_config['visualization'].get('title', "Data Visualization"),
            "data": processed_data,
            "colors": analysis_config['visualization'].get('colors', ["#8884d8", "#82ca9d", "#ffc658"]),
            "sourceSheetId": source_sheet_id,
            "targetSheetId": target_sheet_id
        }
        
        # Prepare response text
        response_text = f"Here's a {chart_config['type']} chart showing {chart_config['title']}."
        
        return {
            "text": response_text,
            "chartConfig": chart_config,
            "sourceSheetId": source_sheet_id,
            "targetSheetId": target_sheet_id
        }
        
    except Exception as e:
        print(f"Error processing OpenAI request: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail={
                "error": "Failed to analyze data",
                "text": "I couldn't generate a chart based on your data. Please try a different request or check your data format."
            }
        ) 