from typing import Dict, Any, List, Optional, Union
from openai import OpenAI
import os
import json
import pandas as pd
from fastapi import HTTPException
import traceback
from together import Together

class DataTransformationAgent:
    def __init__(self):
        """Initialize the DataTransformationAgent with the OpenAI client."""
        if os.getenv("MODEL") == "TOGETHER":
            try:
                api_key = os.getenv("TOGETHER_API_KEY")
                # export together api key to environment variable
                os.environ["TOGETHER_API_KEY"] = api_key
                self.client = Together()
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

    def _convert_dataframe_to_list(self, df: pd.DataFrame) -> List:
        """Convert DataFrame back to list format for response."""
        if df.empty:
            return []
        
        # Replace NaN, Infinity, -Infinity with None (which becomes null in JSON)
        # to avoid JSON serialization issues
        import numpy as np
        df_clean = df.copy()
        
        # Handle numeric columns that might have special values
        for col in df_clean.select_dtypes(include=['float', 'int']).columns:
            # Replace inf/-inf with NaN
            df_clean[col] = df_clean[col].replace([float('inf'), float('-inf')], np.nan)
            # Replace NaN with None using mask
            df_clean[col] = df_clean[col].mask(pd.isna(df_clean[col]), None)
        
        # Final cleanup: Remove rows where the first column is empty or just whitespace
        first_col = df_clean.columns[0]
        df_clean = df_clean[
            df_clean[first_col].notna() & 
            (df_clean[first_col].astype(str).str.strip() != '')
        ]
        
        # Include column headers as the first row
        headers = df_clean.columns.tolist()
        
        # Convert to list of lists, handling potential special values
        data_rows = []
        for _, row in df_clean.iterrows():
            data_row = []
            for val in row:
                # Additional safety check for any special values that might remain
                if isinstance(val, float) and (pd.isna(val) or np.isinf(val)):
                    data_row.append(None)
                elif isinstance(val, str):
                    # Strip whitespace from string values
                    data_row.append(val.strip())
                else:
                    data_row.append(val)
            data_rows.append(data_row)
        
        result_data = [headers] + data_rows
        
        return result_data

    async def analyze(self, request: Any, current_user: Dict = None):
        """
        Main entry point for data transformation requests.
        Uses GPT to generate pandas code to transform the data.
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
            
            # Determine primary sheet for transformation
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
            
            # Create pandas-gpt prompt
            transformation_prompt = f"""
            You are a pandas expert that translates natural language requests into pandas code.

            USER REQUEST: "{request.message}"

            Here is information about the DataFrame:
            - DataFrame name: df
            - Number of rows: {len(df)}
            - Columns: {columns}
            - Column data types: {column_types}
            
            Sample of the DataFrame:
            {sample_rows}

            Analyze the user's request and write Python code using pandas to transform the DataFrame accordingly.
            The code should start with `result_df = ` and transform the original DataFrame (df) based on the user's request.
            
            Important guidelines:
            1. ONLY include the actual Python code, no explanations or comments
            2. Do not use any functions that require imports other than pandas and numpy
            3. Make sure to handle potential errors (like missing columns, invalid operations, etc.)
            4. If the user's request is ambiguous, make a reasonable assumption
            5. Always assign the result to result_df
            6. Make sure to handle NaN values, infinities or other problematic values - replace them with None where appropriate
            7. Cast string columns to numeric when performing calculations
            8. Always use reset_index() after groupby operations
            
            For example, if the user asks "Filter rows where Sales is greater than 500", your response should be:
            ```
            df['Sales'] = pd.to_numeric(df['Sales'], errors='coerce')
            result_df = df[df['Sales'] > 500]
            ```
            
            Or if they ask "Group by Region and sum the Sales", your response should be:
            ```
            df['Sales'] = pd.to_numeric(df['Sales'], errors='coerce')
            result_df = df.groupby('Region')['Sales'].sum().reset_index()
            ```
            
            When handling calculations with potential division by zero or other operations that might produce NaN or infinite values, use:
            ```
            # For division operations (prevents division by zero issues)
            df['Ratio'] = np.where(df['Denominator'] != 0, df['Numerator'] / df['Denominator'], None)
            
            # Replace infinities
            df = df.replace([np.inf, -np.inf], None)
            ```
            
            Do not include any other text or explanations, ONLY the Python code that performs the transformation.
            """
            
            # Get GPT-generated pandas code
            code_response = self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": "You are a pandas code generation API. Return only valid Python code with no comments, no markdown formatting, and no explanation."},
                    {"role": "user", "content": transformation_prompt}
                ],
                temperature=0.1,
                max_tokens=1000
            )
            
            # Extract the code from the response
            code = code_response.choices[0].message.content.strip()
            
            # Remove any markdown code blocks if present
            if code.startswith("```python"):
                code = code.replace("```python", "", 1)
            elif code.startswith("```"):
                code = code.replace("```", "", 1)
            
            if code.endswith("```"):
                code = code[:-3]
            
            code = code.strip()
            print(f"Generated pandas code:\n{code}")
            
            # Execute the code in a safe environment
            try:
                # Create a local scope with the DataFrame
                import numpy as np
                local_scope = {"df": df, "pd": pd, "np": np}
                
                # Execute the code
                exec(code, {"pd": pd, "np": np}, local_scope)
                
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
                        # Use mask() instead of fillna() to replace NaN with None
                        result_df[col] = result_df[col].mask(pd.isna(result_df[col]), None)
                else:
                    raise ValueError("Code execution did not produce result_df")
                
                # Convert result back to list format for response
                transformed_data = self._convert_dataframe_to_list(result_df)
                
                # Create a description of the transformation
                transformation_description = f"I transformed your data based on your request: \"{request.message}\". The result contains {len(result_df)} rows and {len(result_df.columns)} columns."
                
                # Determine operation type from request (simplified)
                operation_type = "transformation"
                if "filter" in request.message.lower() or "where" in request.message.lower():
                    operation_type = "filter"
                elif "group" in request.message.lower() or "aggregate" in request.message.lower():
                    operation_type = "aggregate"
                elif "sort" in request.message.lower() or "order" in request.message.lower():
                    operation_type = "sort"
                
                # Prepare the response
                return {
                    "text": transformation_description,
                    "transformedData": transformed_data,
                    "operationType": operation_type,
                    "sourceSheetId": primary_sheet_id,
                    "targetSheetId": request.explicitTargetSheetId or request.activeSheetId
                }
                
            except Exception as code_error:
                print(f"Error executing pandas code: {str(code_error)}")
                traceback.print_exc()
                
                # Generate a better error message using GPT
                error_prompt = f"""
                I tried to execute this pandas code:
                
                {code}
                
                But encountered this error:
                {str(code_error)}
                
                Can you generate correct pandas code that will avoid this error? 
                Return ONLY the fixed Python code without any explanation or markdown.
                """
                
                # Get improved code
                improved_code_response = self.openai_client.chat.completions.create(
                    model="gpt-4o",
                    messages=[
                        {"role": "system", "content": "You are a pandas code debugging API. Return only valid Python code with no comments, no markdown formatting, and no explanation."},
                        {"role": "user", "content": error_prompt}
                    ],
                    temperature=0.1,
                    max_tokens=1000
                )
                
                improved_code = improved_code_response.choices[0].message.content.strip()
                # Remove any markdown code blocks if present
                if improved_code.startswith("```python"):
                    improved_code = improved_code.replace("```python", "", 1)
                elif improved_code.startswith("```"):
                    improved_code = improved_code.replace("```", "", 1)
                
                if improved_code.endswith("```"):
                    improved_code = improved_code[:-3]
                
                improved_code = improved_code.strip()
                print(f"Improved pandas code:\n{improved_code}")
                
                # Try executing the improved code
                try:
                    # Create a local scope with the DataFrame
                    import numpy as np
                    local_scope = {"df": df, "pd": pd, "np": np}
                    
                    # Execute the improved code
                    exec(improved_code, {"pd": pd, "np": np}, local_scope)
                    
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
                            # Use mask() instead of fillna() to replace NaN with None
                            result_df[col] = result_df[col].mask(pd.isna(result_df[col]), None)
                    else:
                        raise ValueError("Code execution did not produce result_df")
                    
                    # Convert result back to list format for response
                    transformed_data = self._convert_dataframe_to_list(result_df)
                    
                    # Create a description of the transformation
                    transformation_description = f"I transformed your data based on your request: \"{request.message}\". The result contains {len(result_df)} rows and {len(result_df.columns)} columns."
                    
                    # Prepare the response
                    return {
                        "text": transformation_description,
                        "transformedData": transformed_data,
                        "operationType": "transformation",
                        "sourceSheetId": primary_sheet_id,
                        "targetSheetId": request.explicitTargetSheetId or request.activeSheetId
                    }
                    
                except Exception as retry_error:
                    print(f"Error executing improved pandas code: {str(retry_error)}")
                    traceback.print_exc()
                    raise ValueError(f"Failed to transform data: {str(retry_error)}")
            
        except Exception as e:
            print(f"Error processing transformation request: {str(e)}")
            traceback.print_exc()
            raise HTTPException(
                status_code=500,
                detail={
                    "error": "Failed to transform data",
                    "text": f"I couldn't transform your data as requested: {str(e)}. Please try a different request or check your data format."
                }
            )