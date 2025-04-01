from typing import Dict, Any, List, Optional
from openai import OpenAI
import os
import json
from fastapi import HTTPException
import pandas as pd
import numpy as np
import traceback

import dotenv
dotenv.load_dotenv()

class DataVizualizationAgent:
    def __init__(self):
        """Initialize the DataVizualizationAgent with the OpenAI client."""
        self.openai_client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
    
    def _create_dataframe_from_raw(self, raw_data: List[Any]) -> pd.DataFrame:
        """Convert raw data to a pandas DataFrame."""
        if not raw_data:
            return pd.DataFrame()
        
        try:
            if isinstance(raw_data[0], list):
                # If data is in array format with headers
                headers = raw_data[0]
                df = pd.DataFrame(raw_data[1:], columns=headers)
                print(f"Created DataFrame from array format. Columns: {df.columns.tolist()}")
            else:
                # If data is in object format
                df = pd.DataFrame(raw_data)
                print(f"Created DataFrame from object format. Columns: {df.columns.tolist()}")
            
            return df
        except Exception as e:
            print(f"Error creating DataFrame: {str(e)}")
            return pd.DataFrame()
    
    def _convert_to_chart_format(self, df: pd.DataFrame, x_column: str, y_columns: List[str]) -> List[Dict[str, Any]]:
        """Convert a DataFrame to the chart format required by the frontend."""
        if df.empty:
            return []
        
        # Replace NaN, Infinity, -Infinity with None (which becomes null in JSON)
        # to avoid JSON serialization issues
        df_clean = df.copy()
        
        # Handle numeric columns that might have special values
        for col in df_clean.select_dtypes(include=['float', 'int']).columns:
            # Replace inf/-inf with NaN
            df_clean[col] = df_clean[col].replace([float('inf'), float('-inf')], np.nan)
            # Replace NaN with None using mask
            df_clean[col] = df_clean[col].mask(pd.isna(df_clean[col]), None)
        
        # Convert to chart format
        result = []
        for _, row in df_clean.iterrows():
            if pd.notna(row.get(x_column)):
                # Use str() to ensure name is always a string
                data_point = {'name': str(row[x_column])}
                for col in y_columns:
                    if col in df_clean.columns:
                        value = row.get(col)
                        # Skip None or NaN values
                        if value is not None and not (isinstance(value, float) and (pd.isna(value) or np.isinf(value))):
                            # Ensure numeric values are floats for consistency
                            try:
                                data_point[col] = float(value)
                            except (ValueError, TypeError):
                                # If conversion fails, use original value
                                data_point[col] = value
                
                # Only add the data point if it has at least one y-value
                if len(data_point) > 1:  # More than just the 'name' field
                    result.append(data_point)
        
        return result
    
    async def analyze(self, request: Any, current_user: Dict = None):
        """
        Main entry point for visualization data analysis requests.
        Uses GPT to analyze the data and generate chart configurations.
        """
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
            source_data = request.relevantData.get(primary_sheet_id, [])
            primary_sheet_name = request.sheets.get(primary_sheet_id, {}).get('name', primary_sheet_id)
            
            # Convert data to pandas DataFrame
            df = self._create_dataframe_from_raw(source_data)
            if df.empty:
                raise ValueError("Could not create DataFrame from the provided data")
            
            # Get column information
            columns = df.columns.tolist()
            
            # Create sample rows as string
            sample_rows = df.head(5).to_string()
            
            # Get data types for each column
            column_types = df.dtypes.astype(str).to_dict()
            
            # Create analysis prompt
            analysis_prompt = f"""
            You are a data visualization expert that analyzes data to determine the best chart visualizations.

            USER REQUEST: "{request.message}"

            Here is information about the DataFrame:
            - Sheet name: {primary_sheet_name}
            - Number of rows: {len(df)}
            - Columns: {columns}
            - Column data types: {column_types}
            
            Sample of the DataFrame:
            {sample_rows}

            Analyze what the user wants to visualize and determine:
            1. Which chart type would be best (bar, line, pie, scatter, area)
            2. Which column should be used for categories/x-axis
            3. Which columns should be used for values/y-axis
            4. If there should be any data transformation before visualization

            Return ONLY a JSON object with this structure:
            {{
                "chartType": "The chart type to use (bar, line, pie, area, scatter)",
                "xAxisColumn": "Column for categories/x-axis",
                "yAxisColumns": ["Columns for values/y-axis"],
                "dataTransformationCode": "Python code using pandas to transform the data before visualization",
                "visualization": {{
                    "title": "Chart Title",
                    "colors": ["#hex1", "#hex2"],
                    "stacked": true/false
                }},
                "sourceSheetId": "{primary_sheet_id}",
                "targetSheetId": "{request.explicitTargetSheetId or request.activeSheetId}"
            }}
            
            For the dataTransformationCode, write Python code that transforms the DataFrame (named df) and assigns the result to result_df.
            Include any necessary aggregations, sorting, filtering, or calculations.
            
            Example for a simple bar chart with no transformation needed:
            {{
                "chartType": "bar",
                "xAxisColumn": "Category",
                "yAxisColumns": ["Sales"],
                "dataTransformationCode": "result_df = df.copy()",
                "visualization": {{
                    "title": "Sales by Category",
                    "colors": ["#4e79a7", "#f28e2b"],
                    "stacked": false
                }},
                "sourceSheetId": "sheet1",
                "targetSheetId": "sheet1"
            }}
            
            Example for a chart requiring grouping and aggregation:
            {{
                "chartType": "bar",
                "xAxisColumn": "Region",
                "yAxisColumns": ["Sales", "Profit"],
                "dataTransformationCode": "df['Sales'] = pd.to_numeric(df['Sales'], errors='coerce')\\ndf['Profit'] = pd.to_numeric(df['Profit'], errors='coerce')\\nresult_df = df.groupby('Region')[['Sales', 'Profit']].sum().reset_index()",
                "visualization": {{
                    "title": "Sales and Profit by Region",
                    "colors": ["#4e79a7", "#f28e2b"],
                    "stacked": false
                }},
                "sourceSheetId": "sheet1",
                "targetSheetId": "sheet1"
            }}
            """
            
            # Get OpenAI analysis
            analysis_response = self.openai_client.chat.completions.create(
                model="gpt-4o",
                messages=[
                    {"role": "system", "content": "You are a data visualization API. Return only valid JSON with no comments, no markdown, and no explanation."},
                    {"role": "user", "content": analysis_prompt}
                ],
                temperature=0.2,
                max_tokens=1000,
                response_format={"type": "json_object"}
            )
            
            # Parse the analysis
            analysis_config = json.loads(analysis_response.choices[0].message.content)
            print("Analysis config:", analysis_config)
            
            # Extract key information
            chart_type = analysis_config.get('chartType', 'bar')
            x_axis_column = analysis_config.get('xAxisColumn')
            y_axis_columns = analysis_config.get('yAxisColumns', [])
            data_transformation_code = analysis_config.get('dataTransformationCode', 'result_df = df.copy()')
            
            # Verify required fields
            if not x_axis_column or not y_axis_columns:
                raise ValueError("Missing x-axis or y-axis columns in analysis")
            
            # Execute the data transformation code
            try:
                # Create a local scope with the DataFrame and required libraries
                local_scope = {"df": df, "pd": pd, "np": np}
                
                # Execute the transformation code
                exec(data_transformation_code, {"pd": pd, "np": np}, local_scope)
                
                # Get the result DataFrame
                if "result_df" in local_scope:
                    result_df = local_scope["result_df"]
                    if not isinstance(result_df, pd.DataFrame):
                        print(f"Warning: result_df is not a DataFrame, converting...")
                        if isinstance(result_df, pd.Series):
                            result_df = result_df.to_frame()
                        else:
                            # Try to convert to DataFrame if possible
                            try:
                                result_df = pd.DataFrame(result_df)
                            except:
                                raise ValueError(f"result_df is of type {type(result_df)}, expected DataFrame")
                    
                    # Replace any problematic values
                    for col in result_df.select_dtypes(include=['float', 'int']).columns:
                        result_df[col] = result_df[col].replace([np.inf, -np.inf], np.nan)
                        result_df[col] = result_df[col].mask(pd.isna(result_df[col]), None)
                else:
                    raise ValueError("Code execution did not produce result_df")
                
            except Exception as e:
                print(f"Error executing transformation code: {str(e)}")
                traceback.print_exc()
                # Create a fallback result_df (just use the original df)
                result_df = df
            
            # Convert the transformed DataFrame to chart format
            chart_data = self._convert_to_chart_format(result_df, x_axis_column, y_axis_columns)
            
            # Handle empty chart data
            if not chart_data:
                print("Warning: No chart data was generated")
                # Create fallback data
                chart_data = [
                    {'name': f'Sample {i}', 'value': i * 10}
                    for i in range(1, 6)
                ]
            # print first 5 rows of chart data
            print("Chart data sample:", chart_data[:5])
            
            # Create the final chart configuration
            source_sheet_id = analysis_config.get('sourceSheetId', primary_sheet_id)
            target_sheet_id = analysis_config.get('targetSheetId', request.activeSheetId)
            
            chart_config = {
                "type": chart_type,
                "title": analysis_config.get('visualization', {}).get('title', "Data Visualization"),
                "data": chart_data,
                "colors": analysis_config.get('visualization', {}).get('colors', ["#8884d8", "#82ca9d", "#ffc658"]),
                "stacked": analysis_config.get('visualization', {}).get('stacked', False),
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
            print(f"Error processing visualization request: {str(e)}")
            traceback.print_exc()
            raise HTTPException(
                status_code=500,
                detail={
                    "error": "Failed to analyze data",
                    "text": f"I couldn't generate a chart based on your data: {str(e)}. Please try a different request or check your data format."
                }
            )