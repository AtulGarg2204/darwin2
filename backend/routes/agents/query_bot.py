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

class QueryBot:
    def __init__(self):
        """Initialize the QueryBot with the OpenAI client."""
        self.openai_client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
    
    def _create_dataframe_from_raw(self, raw_data: List[Any]) -> pd.DataFrame:
        """Convert raw data to a pandas DataFrame and clean it by removing empty rows and columns."""
        if not raw_data:
            return pd.DataFrame()
        
        try:
            if isinstance(raw_data[0], list):
                # If data is in array format with headers
                headers = raw_data[0]
                
                # Filter out empty header columns
                valid_headers = []
                valid_indices = []
                for i, header in enumerate(headers):
                    if header is not None and str(header).strip() != '':
                        valid_headers.append(header)
                        valid_indices.append(i)
                
                # Filter data rows to only include columns with valid headers
                # AND filter out completely empty rows
                cleaned_data = []
                for row in raw_data[1:]:
                    if len(row) >= len(headers):  # Ensure row has enough elements
                        # Extract only valid columns
                        filtered_row = [row[i] for i in valid_indices]
                        
                        # Check if row contains any non-empty values
                        has_data = False
                        for val in filtered_row:
                            if val is not None and str(val).strip() != '':
                                has_data = True
                                break
                        
                        # Only add rows with actual data
                        if has_data:
                            cleaned_data.append(filtered_row)
                    
                df = pd.DataFrame(cleaned_data, columns=valid_headers)
                print(f"Created DataFrame from array format. Valid columns: {df.columns.tolist()}, Raw rows: {len(raw_data)-1}, Clean rows: {len(df)}")
            else:
                # If data is in object format
                # First, create a list of dictionaries, filtering out empty rows
                filtered_data = []
                for item in raw_data:
                    # Check if the item has any non-empty values
                    has_data = False
                    for key, val in item.items():
                        if val is not None and str(val).strip() != '':
                            has_data = True
                            break
                    
                    if has_data:
                        filtered_data.append(item)
                
                df = pd.DataFrame(filtered_data)
                print(f"Created DataFrame from object format. Columns: {df.columns.tolist()}, Raw rows: {len(raw_data)}, Clean rows: {len(df)}")
            
            # Additional cleaning for any remaining empty values
            # Convert empty strings to NaN
            df = df.replace('', pd.NA)
            
            # Final check for any completely empty rows
            df = df.dropna(how='all')
            
            print(f"Final DataFrame dimensions: {len(df)} rows, {len(df.columns)} columns")
            
            return df
        except Exception as e:
            print(f"Error creating DataFrame: {str(e)}")
            traceback.print_exc()
            return pd.DataFrame()
        except Exception as e:
            print(f"Error creating DataFrame: {str(e)}")
            traceback.print_exc()
            return pd.DataFrame()
        except Exception as e:
            print(f"Error creating DataFrame: {str(e)}")
            return pd.DataFrame()
    
    def _get_data_summary(self, df: pd.DataFrame) -> dict:
        """Generate a comprehensive summary of the DataFrame."""
        if df.empty:
            return {"error": "Empty DataFrame"}
        
        try:
            # Basic info
            summary = {
                "row_count": len(df),
                "column_count": len(df.columns),
                "columns": df.columns.tolist(),
                "data_types": {col: str(dtype) for col, dtype in df.dtypes.items()},
                "samples": {},
                "column_statistics": {},
                "potential_insights": []
            }
            
            # Generate samples and statistics for each column
            for col in df.columns:
                # Skip if column contains sensitive data (inferred by column name)
                if any(term in col.lower() for term in ["password", "secret", "token", "key", "ssn", "social"]):
                    summary["samples"][col] = ["[REDACTED]"]
                    continue
                
                # Get sample values and statistics
                try:
                    # Handle different data types appropriately
                    if df[col].dtype == 'object' or pd.api.types.is_string_dtype(df[col]):
                        # For string columns, get unique values and frequency
                        unique_vals = df[col].dropna().unique()
                        samples = unique_vals[:5].tolist() if len(unique_vals) > 0 else []
                        summary["samples"][col] = samples
                        
                        # String column statistics
                        value_counts = df[col].value_counts(normalize=True).head(3).to_dict()
                        summary["column_statistics"][col] = {
                            "type": "categorical",
                            "unique_count": len(unique_vals),
                            "most_common": value_counts
                        }
                        
                    elif pd.api.types.is_numeric_dtype(df[col]):
                        # For numeric columns, get detailed statistics
                        numeric_stats = df[col].describe().to_dict()
                        
                        # Convert numpy types to Python native types for JSON serialization
                        for k, v in numeric_stats.items():
                            if isinstance(v, (np.int_, np.float_)):
                                numeric_stats[k] = float(v)
                        
                        # Add samples
                        samples = df[col].dropna().sample(min(5, len(df[col].dropna()))).tolist()
                        summary["samples"][col] = samples
                        
                        # Store numeric statistics
                        summary["column_statistics"][col] = {
                            "type": "numeric",
                            "statistics": numeric_stats
                        }
                        
                    elif pd.api.types.is_datetime64_any_dtype(df[col]):
                        # For datetime columns
                        summary["samples"][col] = df[col].dropna().head(5).astype(str).tolist()
                        
                        # Datetime statistics
                        summary["column_statistics"][col] = {
                            "type": "datetime",
                            "min": str(df[col].min()) if not pd.isna(df[col].min()) else None,
                            "max": str(df[col].max()) if not pd.isna(df[col].max()) else None,
                            "range_days": (df[col].max() - df[col].min()).days if not pd.isna(df[col].min()) and not pd.isna(df[col].max()) else None
                        }
                    else:
                        # For other column types
                        summary["samples"][col] = df[col].dropna().head(5).astype(str).tolist()
                        summary["column_statistics"][col] = {"type": "other"}
                        
                except Exception as col_error:
                    print(f"Error analyzing column {col}: {str(col_error)}")
                    # If error, just get raw sample
                    summary["samples"][col] = df[col].dropna().head(3).astype(str).tolist()
                    summary["column_statistics"][col] = {"type": "error", "error": str(col_error)}
            
            # Check for missing values
            missing_values = df.isna().sum().to_dict()
            missing_percentages = {col: count/len(df)*100 for col, count in missing_values.items() if count > 0}
            summary["missing_values"] = {
                "counts": {col: count for col, count in missing_values.items() if count > 0},
                "percentages": missing_percentages
            }
            
            # Generate potential insights about the data
            insights = []
            
            # Check for date/time columns to suggest time series analysis
            time_cols = [col for col in df.columns if pd.api.types.is_datetime64_any_dtype(df[col]) or 
                         any(term in col.lower() for term in ["date", "time", "year", "month", "day"])]
            if time_cols:
                insights.append(f"Time-based data detected in column(s): {', '.join(time_cols)}. Consider time series analysis.")
            
            # Check for high correlation between numeric columns
            try:
                numeric_cols = df.select_dtypes(include=['number']).columns
                if len(numeric_cols) >= 2:
                    corr_matrix = df[numeric_cols].corr().abs()
                    # Get pairs with correlation > 0.7 (excluding self-correlation)
                    high_corr = []
                    for i in range(len(corr_matrix.columns)):
                        for j in range(i+1, len(corr_matrix.columns)):
                            if corr_matrix.iloc[i, j] > 0.7:
                                col1 = corr_matrix.columns[i]
                                col2 = corr_matrix.columns[j]
                                high_corr.append((col1, col2, corr_matrix.iloc[i, j]))
                    
                    for col1, col2, corr in high_corr:
                        insights.append(f"Strong correlation ({corr:.2f}) detected between {col1} and {col2}.")
            except:
                # Correlation analysis failed, skip
                pass
                
            # Check for potential categorical columns with low cardinality
            for col in df.columns:
                if col in summary["column_statistics"] and summary["column_statistics"][col]["type"] == "categorical":
                    if summary["column_statistics"][col]["unique_count"] <= 10 and summary["column_statistics"][col]["unique_count"] > 1:
                        insights.append(f"Column '{col}' may be a good candidate for categorical analysis with {summary['column_statistics'][col]['unique_count']} unique values.")
            
            # Check for highly skewed numeric columns
            for col in df.columns:
                if col in summary["column_statistics"] and summary["column_statistics"][col]["type"] == "numeric":
                    stats = summary["column_statistics"][col]["statistics"]
                    if "mean" in stats and "50%" in stats and "max" in stats:
                        mean = stats["mean"]
                        median = stats["50%"]
                        max_val = stats["max"]
                        # Check for skewed distribution
                        if mean / median > 1.5 or median / mean > 1.5:
                            insights.append(f"Column '{col}' appears to be skewed (mean: {mean:.2f}, median: {median:.2f}).")
            
            summary["potential_insights"] = insights
            
            return summary
        
        except Exception as e:
            print(f"Error generating data summary: {str(e)}")
            traceback.print_exc()
            return {"error": str(e)}
    
    async def analyze(self, request: Any, current_user: Dict = None):
        """
        Main entry point for conversational query requests.
        Uses GPT to answer questions about the data.
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
                # Instead of raising an error, provide a helpful response
                return {
                    "text": "I couldn't analyze your data because the spreadsheet appears to be empty or contains only header rows. Please make sure your spreadsheet has data in it.",
                    "sourceSheetId": primary_sheet_id,
                    "operation": "query",
                    "metadata": {
                        "rows_analyzed": 0,
                        "columns_analyzed": 0,
                        "executed_code": False,
                        "error": "Empty DataFrame"
                    }
                }
            
            # Get detailed data summary
            detailed_summary = self._get_data_summary(df)
            
            # Create a JSON string of the data summary
            summary_json = json.dumps(detailed_summary, default=str)
            
            # Determine if code execution is needed using the LLM
            code_decision_prompt = f"""
            I have a DataFrame with this structure:
            {summary_json}
            
            User question: "{request.message}"
            
            Would this question require executing pandas code to answer accurately, or can it be answered
            directly from looking at the data summary statistics?
            
            Consider:
            1. Simple questions about column names, row counts, or data types can be answered directly
            2. Questions requiring calculations, aggregations, filtering, or transformations require code
            3. Questions about patterns, trends, correlations, or rankings usually require code
            4. Questions asking for specific records or examples might require code
            
            Answer with ONLY "needs_code" or "no_code" based on your assessment.
            """
            
            code_decision_response = self.openai_client.chat.completions.create(
                model="gpt-4o",
                messages=[
                    {"role": "system", "content": "You are a data analysis assistant that determines if Python code is needed to answer a question."},
                    {"role": "user", "content": code_decision_prompt}
                ],
                temperature=0.1,
                max_tokens=10
            )
            
            decision = code_decision_response.choices[0].message.content.strip().lower()
            should_execute_code = "needs_code" in decision or "code" in decision
            
            # Create analysis prompt based on whether code execution is needed
            if should_execute_code:
                # Complex query requires code execution
                analysis_prompt = f"""
                As a data expert, I need to answer this question about the data:
                
                USER QUESTION: "{request.message}"
                
                Here is information about the DataFrame (as JSON):
                {summary_json}
                
                Write a function called `analyze_data` that takes a pandas DataFrame as input and returns a dictionary with the analysis results.
                
                The function should:
                1. NOT create any sample or test data - assume the DataFrame is passed as an argument
                2. Return a dictionary containing the analysis results needed to answer the question
                3. Handle errors, missing data, and edge cases with try/except blocks
                4. Be concise and efficient
                
                ONLY return a properly structured Python function as shown in the example below, with no explanations or other text.
                
                Example return format:
                ```python
                def analyze_data(df):
                    try:
                        # Your analysis code here
                        result = df['column'].mean()
                        return {{"average": result}}
                    except Exception as e:
                        return {{"error": str(e)}}
                ```
                """
                
                # Get OpenAI analysis code
                code_response = self.openai_client.chat.completions.create(
                    model="gpt-4o",
                    messages=[
                        {"role": "system", "content": "You are a data analysis code generation API that returns properly structured Python functions. Return only valid Python code with no explanations or sample data."},
                        {"role": "user", "content": analysis_prompt}
                    ],
                    temperature=0.2,
                    max_tokens=1000
                )
                
                # Extract the code from the response
                code_content = code_response.choices[0].message.content.strip()
                
                # Extract just the code from between the python markdown tags
                if "```python" in code_content and "```" in code_content.split("```python", 1)[1]:
                    code = code_content.split("```python", 1)[1].split("```", 1)[0].strip()
                else:
                    # Fallback if markdown tags aren't properly formatted
                    code = code_content.replace("```python", "").replace("```", "").strip()
                
                print(f"Generated analysis code:\n{code}")
                
                # Execute the code in a safe environment
                try:
                    # Create a local scope with the necessary imports
                    local_scope = {"pd": pd, "np": np}
                    
                    # Execute the function definition
                    exec(code, {"pd": pd, "np": np}, local_scope)
                    
                    # Check if the function exists in the local scope
                    if "analyze_data" in local_scope and callable(local_scope["analyze_data"]):
                        # Call the function with the DataFrame
                        analysis_result = local_scope["analyze_data"](df)
                        print("Analysis result:", analysis_result)
                    else:
                        raise ValueError("The generated code did not define an 'analyze_data' function")
                    
                except Exception as code_error:
                    print(f"Error executing analysis code: {str(code_error)}")
                    traceback.print_exc()
                    analysis_result = {"error": f"Error during analysis: {str(code_error)}"}
                
                # Execute the code in a safe environment
                try:
                    # Create a local scope with the DataFrame
                    local_scope = {"df": df, "pd": pd, "np": np}
                    
                    # Execute the code
                    exec(code, {"pd": pd, "np": np}, local_scope)
                    
                    # Get the response data
                    if "response_data" in local_scope:
                        analysis_result = local_scope["response_data"]
                        print("Analysis result:", analysis_result)
                    else:
                        analysis_result = "Analysis completed, but no specific results were returned."
                    
                except Exception as code_error:
                    print(f"Error executing analysis code: {str(code_error)}")
                    traceback.print_exc()
                    analysis_result = f"Error during analysis: {str(code_error)}"
                
                # Now we'll formulate a natural language response
                response_prompt = f"""
                USER QUESTION: "{request.message}"
                
                Data summary:
                {summary_json}
                
                Analysis result:
                {analysis_result}
                
                Please provide a clear, concise answer to the user's question based on the analysis results.
                Make the answer conversational and easy to understand, avoiding technical jargon.
                Include specific numbers and insights from the analysis result.
                If the analysis encountered errors, provide a helpful response that explains what might have gone wrong.
                
                Do NOT mention the code that was used to analyze the data or reference 'analysis results' directly.
                Instead, present the information as if you discovered these insights yourself.
                """
                
                response = self.openai_client.chat.completions.create(
                    model="gpt-4o",
                    messages=[
                        {"role": "system", "content": "You are a helpful data assistant that explains insights in plain language."},
                        {"role": "user", "content": response_prompt}
                    ],
                    temperature=0.5,
                    max_tokens=800
                )
                
                answer = response.choices[0].message.content
                
            else:
                # Simple query can be directly answered without code execution
                query_prompt = f"""
                As a data expert, I need to answer this question about the data:
                
                USER QUESTION: "{request.message}"
                
                Here is information about the DataFrame (as JSON):
                {summary_json}
                
                Please provide a clear, concise answer to the user's question based on the data summary.
                Make the answer conversational and easy to understand, avoiding technical jargon.
                Include specific numbers and insights from the data summary if relevant.
                """
                
                response = self.openai_client.chat.completions.create(
                    model="gpt-4o",
                    messages=[
                        {"role": "system", "content": "You are a helpful data assistant that explains insights in plain language."},
                        {"role": "user", "content": query_prompt}
                    ],
                    temperature=0.5,
                    max_tokens=800
                )
                
                answer = response.choices[0].message.content
            
            return {
                "text": answer,
                "sourceSheetId": primary_sheet_id,
                "operation": "query",
                "metadata": {
                    "rows_analyzed": len(df),
                    "columns_analyzed": len(df.columns),
                    "executed_code": should_execute_code
                }
            }
            
        except Exception as e:
            print(f"Error processing query request: {str(e)}")
            traceback.print_exc()
            raise HTTPException(
                status_code=500,
                detail={
                    "error": "Failed to analyze data",
                    "text": f"I couldn't answer your question about the data: {str(e)}. Please try rephrasing your question or check if the data contains the information you're looking for."
                }
            )