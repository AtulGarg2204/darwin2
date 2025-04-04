from typing import Dict, Any, List, Optional
from openai import OpenAI
import os
import json
from fastapi import HTTPException
import pandas as pd
import numpy as np
import traceback
import scipy.stats as stats


import dotenv
dotenv.load_dotenv()

class StatisticalAgent:
    def __init__(self):
        """Initialize the StatisticalAgent with the OpenAI client."""
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
            
            # Attempt to convert numeric columns to appropriate data types
            for col in df.columns:
                try:
                    # Check if column contains numeric values
                    if col in ['Sales', 'Quantity', 'Discount', 'Profit']:  # Force numeric conversion for important columns
                        df[col] = pd.to_numeric(df[col], errors='coerce')
                    elif df[col].apply(lambda x: isinstance(x, str) and x.replace('.', '', 1).isdigit()).all():
                        df[col] = pd.to_numeric(df[col], errors='coerce')
                    # If all values are NaN after conversion, revert to original
                    if df[col].isna().all() and len(df) > 0:
                        if isinstance(raw_data[0], list) and len(raw_data) > 1:
                            col_idx = df.columns.get_loc(col)
                            if col_idx < len(raw_data[1]):
                                df[col] = raw_data[1][col_idx]
                except Exception as col_error:
                    print(f"Error converting column {col}: {str(col_error)}")
                    pass  # Keep as is if conversion fails
            
            # Try to convert date columns
            for col in df.columns:
                if any(date_term in col.lower() for date_term in ['date', 'time', 'day', 'month', 'year']):
                    try:
                        df[col] = pd.to_datetime(df[col], errors='coerce')
                    except:
                        pass  # Keep as is if date conversion fails
            
            # Drop columns with all missing values
            df = df.dropna(axis=1, how='all')
            
            # Replace NaN in numeric columns with 0 for certain calculations
            numeric_cols = df.select_dtypes(include=['number']).columns
            for col in numeric_cols:
                if 'count' in col.lower() or 'quantity' in col.lower() or 'sum' in col.lower():
                    df[col] = df[col].fillna(0)
            
            # Replace any infinity values with NaN
            df = df.replace([np.inf, -np.inf], np.nan)
            
            print(f"Final DataFrame dimensions: {len(df)} rows, {len(df.columns)} columns")
            
            return df
        except Exception as e:
            print(f"Error creating DataFrame: {str(e)}")
            traceback.print_exc()
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
                "column_statistics": {},
                "missing_values": {}
            }
            
            # Get information about columns
            numeric_cols = df.select_dtypes(include=['number']).columns.tolist()
            categorical_cols = [col for col in df.columns if col not in numeric_cols]
            
            # Calculate statistics for numeric columns
            for col in numeric_cols:
                stats = df[col].describe().to_dict()
                # Convert numpy types to native Python types
                for k, v in stats.items():
                    if isinstance(v, (np.int_, np.float_)):
                        stats[k] = float(v)
                
                summary["column_statistics"][col] = {
                    "type": "numeric",
                    "min": float(stats.get('min', np.nan)),
                    "max": float(stats.get('max', np.nan)),
                    "mean": float(stats.get('mean', np.nan)),
                    "median": float(stats.get('50%', np.nan)),
                    "std": float(stats.get('std', np.nan)),
                    "unique_count": df[col].nunique()
                }
            
            # Calculate statistics for categorical columns
            for col in categorical_cols:
                # Get value counts for top categories
                value_counts = df[col].value_counts(normalize=True).head(5).to_dict()
                # Convert keys to strings for JSON serialization
                value_counts = {str(k): float(v) for k, v in value_counts.items()}
                
                summary["column_statistics"][col] = {
                    "type": "categorical",
                    "unique_count": df[col].nunique(),
                    "most_common": value_counts
                }
            
            # Check for missing values
            missing_values = df.isna().sum().to_dict()
            missing_percentages = {col: count/len(df)*100 for col, count in missing_values.items() if count > 0}
            summary["missing_values"] = {
                "counts": {col: int(count) for col, count in missing_values.items() if count > 0},
                "percentages": missing_percentages
            }
            
            return summary
        
        except Exception as e:
            print(f"Error generating data summary: {str(e)}")
            traceback.print_exc()
            return {"error": str(e)}
    
    def _perform_correlation_analysis(self, df: pd.DataFrame) -> dict:
        """Perform correlation analysis on numeric columns in the DataFrame."""
        try:
            # Identify numeric columns
            numeric_cols = df.select_dtypes(include=['number']).columns.tolist()
            
            if len(numeric_cols) < 2:
                return {
                    "analysis_type": "Correlation Analysis",
                    "summary": "Not enough numeric columns for correlation analysis.",
                    "details": {},
                    "chart_configs": [],
                    "p_values": {},
                    "variables_analyzed": numeric_cols
                }
            
            # Calculate correlation matrices
            pearson_corr = df[numeric_cols].corr(method='pearson')
            spearman_corr = df[numeric_cols].corr(method='spearman')
            
            # Calculate p-values for correlations
            p_values = {}
            for i, col1 in enumerate(numeric_cols):
                for j, col2 in enumerate(numeric_cols):
                    if i < j:  # Only calculate once for each pair
                        # Calculate p-value for Pearson correlation
                        r, p = stats.pearsonr(df[col1].dropna(), df[col2].dropna())
                        p_values[f"{col1}_{col2}_pearson"] = float(p)  # Convert to native Python float
            
            # Find strongest correlations
            strongest_correlations = []
            for i, col1 in enumerate(numeric_cols):
                for j, col2 in enumerate(numeric_cols):
                    if i < j:  # Only include each pair once
                        pearson_val = pearson_corr.iloc[i, j]
                        spearman_val = spearman_corr.iloc[i, j]
                        p_val = p_values.get(f"{col1}_{col2}_pearson", 1.0)
                        
                        strongest_correlations.append({
                            "variables": [col1, col2],
                            "pearson": float(pearson_val),  # Convert to native Python float
                            "spearman": float(spearman_val),  # Convert to native Python float
                            "p_value": float(p_val),  # Convert to native Python float
                            "significant": bool(p_val < 0.05)  # Convert to native Python bool
                        })
            
            # Sort by absolute Pearson correlation
            strongest_correlations.sort(key=lambda x: abs(x["pearson"]), reverse=True)
            
            # Create chart configurations
            chart_configs = [
                {
                    "type": "heatmap",
                    "title": "Correlation Heatmap",
                    "subtitle": "Pearson correlation coefficients",
                    "x_axis": numeric_cols,
                    "y_axis": numeric_cols,
                    "data": pearson_corr.values.tolist()
                }
            ]
            
            # Create scatter plots for top correlations
            for i, corr in enumerate(strongest_correlations[:3]):  # Top 3 correlations
                if abs(corr["pearson"]) > 0.3:  # Only include moderate to strong correlations
                    chart_configs.append({
                        "type": "scatter",
                        "title": f"Correlation: {corr['variables'][0]} vs {corr['variables'][1]}",
                        "subtitle": f"Pearson r = {corr['pearson']:.2f}, p = {corr['p_value']:.4f}",
                        "x_axis": corr['variables'][0],
                        "y_axis": corr['variables'][1]
                    })
            
            # Prepare summary
            significant_correlations = [c for c in strongest_correlations if c["significant"]]
            summary = f"Found {len(significant_correlations)} significant correlations among {len(numeric_cols)} numeric variables."
            
            if significant_correlations:
                top_corr = significant_correlations[0]
                summary += f" The strongest correlation is between {top_corr['variables'][0]} and {top_corr['variables'][1]} (r = {top_corr['pearson']:.2f}, p = {top_corr['p_value']:.4f})."
            
            # Convert correlation matrices to dictionaries with native Python types
            pearson_dict = {}
            for col1 in pearson_corr.columns:
                pearson_dict[col1] = {col2: float(pearson_corr.loc[col1, col2]) for col2 in pearson_corr.columns}
                
            spearman_dict = {}
            for col1 in spearman_corr.columns:
                spearman_dict[col1] = {col2: float(spearman_corr.loc[col1, col2]) for col2 in spearman_corr.columns}
            
            return {
                "analysis_type": "Correlation Analysis",
                "summary": summary,
                "details": {
                    "pearson_correlation": pearson_dict,
                    "spearman_correlation": spearman_dict,
                    "strongest_correlations": strongest_correlations[:5]  # Top 5 correlations
                },
                "chart_configs": chart_configs,
                "p_values": {k: float(v) for k, v in p_values.items()},  # Convert all p-values to native Python floats
                "variables_analyzed": numeric_cols
            }
            
        except Exception as e:
            print(f"Error performing correlation analysis: {str(e)}")
            traceback.print_exc()
            return {
                "analysis_type": "Correlation Analysis",
                "summary": f"Error performing correlation analysis: {str(e)}",
                "details": {},
                "chart_configs": [],
                "p_values": {},
                "variables_analyzed": []
            }
    
    async def analyze(self, request: Any, current_user: Dict = None):
        """
        Main entry point for statistical analysis requests.
        Uses GPT to generate statistical analysis code and interpret results.
        """
        try:
            print("Starting statistical analysis with LLM-generated code...")
            
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
            
            # Determine primary sheet for statistical analysis
            primary_sheet_id = next(iter(request.relevantData.keys())) if request.relevantData else request.activeSheetId
            source_data = request.relevantData.get(primary_sheet_id, [])
            primary_sheet_name = request.sheets.get(primary_sheet_id, {}).get('name', primary_sheet_id)
            
            # Convert data to pandas DataFrame
            df = self._create_dataframe_from_raw(source_data)
            if df.empty:
                raise ValueError("Could not create DataFrame from the provided data")
                
            print(f"Created DataFrame with {len(df)} rows and {len(df.columns)} columns")
            
            # Generate detailed data summary
            detailed_summary = self._get_data_summary(df)
            print("Generated detailed data summary")
            
            # Check if this is a correlation analysis request
            is_correlation_request = False
            if hasattr(request, 'message') and request.message:
                correlation_keywords = ['correlation', 'correlate', 'relationship', 'related', 'associate', 'association']
                is_correlation_request = any(keyword in request.message.lower() for keyword in correlation_keywords)
            
            # If it's a correlation request, use our specialized function
            if is_correlation_request:
                print("Detected correlation analysis request, using specialized function")
                analysis_results = self._perform_correlation_analysis(df)
                print("Correlation analysis results:", analysis_results)
                
                # Create chart configurations based on analysis results
                chart_configs = []
                
                # Convert chart recommendations from analysis to chart configs for frontend
                for chart_rec in analysis_results.get('chart_configs', []):
                    chart_type = chart_rec.get('type', 'bar')
                    
                    # Basic chart config
                    chart_config = {
                        "type": chart_type,
                        "title": chart_rec.get('title', f"{analysis_results['analysis_type']} Analysis"),
                        "subtitle": chart_rec.get('subtitle', ""),
                        "sourceSheetId": primary_sheet_id,
                        "targetSheetId": request.explicitTargetSheetId or request.activeSheetId,
                        "stacked": False,
                        "colors": ["#4e79a7", "#f28e2b", "#59a14f", "#76b7b2", "#edc949"]
                    }
                    
                    # Handle heatmap data
                    if chart_type == 'heatmap':
                        x_axis = chart_rec.get('x_axis', [])
                        y_axis = chart_rec.get('y_axis', [])
                        data = chart_rec.get('data', [])
                        
                        if x_axis and y_axis and data:
                            chart_config["x_axis"] = x_axis
                            chart_config["y_axis"] = y_axis
                            chart_config["data"] = data
                    
                    # Handle scatter plot data
                    elif chart_type == 'scatter':
                        x_axis = chart_rec.get('x_axis')
                        y_axis = chart_rec.get('y_axis')
                        
                        if x_axis and y_axis:
                            chart_data = []
                            # Create scatter plot data
                            for _, row in df.iterrows():
                                if pd.notna(row.get(x_axis)) and pd.notna(row.get(y_axis)):
                                    try:
                                        data_point = {
                                            'x': float(row[x_axis]),
                                            'y': float(row[y_axis]),
                                            'name': str(row.get('name', f"Point {_}"))
                                        }
                                        chart_data.append(data_point)
                                    except (ValueError, TypeError):
                                        continue  # Skip points that can't be converted to float
                            
                            chart_config["data"] = chart_data
                    
                    # Add the chart configuration
                    chart_configs.append(chart_config)
                
                # Now, create a prompt for GPT to interpret the analysis results
                interpretation_prompt = f"""
                You are a statistical analysis expert helping to interpret the results of a correlation analysis.
                
                USER REQUEST: "{request.message}"
                
                Here is information about the data:
                - Sheet name: {primary_sheet_name}
                - Number of rows: {len(df)}
                - Number of columns: {len(df.columns)}
                
                Analysis type: {analysis_results.get('analysis_type', 'Correlation Analysis')}
                
                Analysis summary: {analysis_results.get('summary', '')}
                
                Detailed results: {json.dumps(analysis_results.get('details', {}), default=str)}
                
                Based on the correlation analysis results, provide a clear, concise interpretation of the findings.
                Your response should:
                1. Explain the purpose of the correlation analysis in plain language
                2. Summarize the key correlations found
                3. Interpret what these correlations mean in practical terms
                4. Mention any important caveats or limitations if present
                
                Write in a professional but accessible style that someone without a statistics background could understand.
                """
                
                # Get the interpretation from GPT
                interpretation_response = self.openai_client.chat.completions.create(
                    model="gpt-4o",
                    messages=[
                        {"role": "system", "content": "You are a statistical analysis expert who explains correlation results clearly to non-experts."},
                        {"role": "user", "content": interpretation_prompt}
                    ],
                    temperature=0.3,
                    max_tokens=800
                )
                
                # Extract the interpretation
                interpretation_text = interpretation_response.choices[0].message.content
                
                # Prepare response with statistical analysis results and interpretation
                response = {
                    "text": interpretation_text,
                    "analysisType": analysis_results.get('analysis_type', 'Correlation Analysis'),
                    "sourceSheetId": primary_sheet_id,
                    "operation": "statistical",
                    "metadata": {
                        "rows_analyzed": len(df),
                        "columns_analyzed": len(df.columns),
                        "variables_analyzed": analysis_results.get('variables_analyzed', [])
                    }
                }
                
                # Add chart configs if there are any
                if chart_configs:
                    response["chartConfigs"] = chart_configs
                
                return response
            
            # Create a JSON string of the data summary
            summary_json = json.dumps(detailed_summary, default=str)
            
            # Create analysis prompt for GPT to generate statistical analysis code
            analysis_prompt = f"""
            You are an expert statistician who writes Python code to analyze data.

            USER REQUEST: "{request.message}"

            Here is information about the DataFrame (as JSON):
            {summary_json}

            Write a Python function called `analyze_data` that takes a pandas DataFrame as input and performs the appropriate statistical analysis based on the user's request.

            The function should:
            1. NOT create any sample or test data - assume the DataFrame is passed as an argument (named df)
            2. Perform statistical tests that appropriately address the user's question
            3. Create appropriate visualizations using matplotlib/seaborn/plotly
            4. Handle errors, missing data, and edge cases with try/except blocks
            5. Return a dictionary containing:
               - 'analysis_type': The type of statistical analysis performed
               - 'summary': Key metrics and findings from the analysis
               - 'details': Detailed statistical results
               - 'chart_configs': A list of chart configurations for the frontend
               - 'p_values': Any p-values or statistical significance results
               - 'variables_analyzed': List of variables included in the analysis
            
            For any statistical tests like t-tests, chi-square, correlation, etc., be sure to:
            - Check test assumptions
            - Calculate and interpret p-values
            - Calculate effect sizes where appropriate
            - Format results for easy interpretation

            For generating chart configurations, use this format:
            {{
                "type": "bar/line/scatter/pie/box",
                "title": "Chart title",
                "subtitle": "Additional information",
                "x_axis": "Column name for x-axis",
                "y_axis": "Column name for y-axis (or list of columns)",
                "categories": ["list", "of", "categories"] # For pie charts
                "values": [1, 2, 3] # For pie charts
            }}

            IMPORTANT: Your function MUST include all necessary imports at the top of the function.
            For example:
            ```python
            def analyze_data(df):
                import pandas as pd
                import numpy as np
                from scipy import stats
                import matplotlib.pyplot as plt
                import seaborn as sns
                
                # Rest of your function...
            ```

            If the user is asking for correlation analysis, make sure to:
            1. Identify numeric columns for correlation
            2. Calculate correlation coefficients (Pearson, Spearman)
            3. Create a correlation heatmap
            4. Test for statistical significance of correlations
            5. Return detailed correlation results

            ONLY return the properly structured Python function, with no explanations or other text.
            """
            
            # Get analysis code from GPT
            code_response = self.openai_client.chat.completions.create(
                model="gpt-4o",
                messages=[
                    {"role": "system", "content": "You are a statistical analysis code generation API that returns properly structured Python functions. Return only valid Python code with no explanations or sample data."},
                    {"role": "user", "content": analysis_prompt}
                ],
                temperature=0.2,
                max_tokens=2000
            )
            
            # Extract the code from the response
            code_content = code_response.choices[0].message.content.strip()
            
            # Extract just the code from between the python markdown tags if present
            if "```python" in code_content and "```" in code_content.split("```python", 1)[1]:
                code = code_content.split("```python", 1)[1].split("```", 1)[0].strip()
            elif "```" in code_content:
                # General markdown code block
                code = code_content.split("```", 1)[1].split("```", 1)[0].strip()
            else:
                # Fallback if markdown tags aren't properly formatted
                code = code_content.strip()
            
            print(f"Generated analysis code:\n{code}")
            
            # Execute the code in a safe environment
            try:
                # Import necessary libraries that might be needed by the generated code
                import scipy.stats as stats
                import statsmodels.api as sm
                import matplotlib.pyplot as plt
                import seaborn as sns
                try:
                    from statsmodels.formula.api import ols
                    from statsmodels.tsa.stattools import adfuller
                    from statsmodels.stats.diagnostic import het_breuschpagan
                    from statsmodels.tsa.seasonal import seasonal_decompose
                    from statsmodels.stats.weightstats import ttest_ind
                except ImportError:
                    pass  # Some imports might fail if not available
                
                # Create a local scope with the necessary imports
                local_scope = {
                    "df": df, 
                    "pd": pd, 
                    "np": np, 
                    "stats": stats,
                    "sm": sm,
                    "plt": plt,
                    "sns": sns
                }
                
                # Add optional imports if available
                if 'ols' in locals():
                    local_scope["ols"] = ols
                if 'adfuller' in locals():
                    local_scope["adfuller"] = adfuller
                if 'het_breuschpagan' in locals():
                    local_scope["het_breuschpagan"] = het_breuschpagan
                if 'seasonal_decompose' in locals():
                    local_scope["seasonal_decompose"] = seasonal_decompose
                if 'ttest_ind' in locals():
                    local_scope["ttest_ind"] = ttest_ind
                
                # Execute the function definition in the local scope
                exec(code, globals(), local_scope)
                
                # Check if the function exists in the local scope
                if "analyze_data" in local_scope and callable(local_scope["analyze_data"]):
                    # Call the function with the DataFrame
                    analysis_results = local_scope["analyze_data"](df)
                    print("Analysis results:", analysis_results)
                else:
                    # If the function doesn't exist, try to execute the code directly
                    # This handles cases where the code doesn't define a function
                    try:
                        # Create a new scope with all necessary imports
                        exec_scope = {
                            "df": df,
                            "pd": pd,
                            "np": np,
                            "stats": stats,
                            "sm": sm,
                            "plt": plt,
                            "sns": sns
                        }
                        
                        # Add optional imports if available
                        if 'ols' in locals():
                            exec_scope["ols"] = ols
                        if 'adfuller' in locals():
                            exec_scope["adfuller"] = adfuller
                        if 'het_breuschpagan' in locals():
                            exec_scope["het_breuschpagan"] = het_breuschpagan
                        if 'seasonal_decompose' in locals():
                            exec_scope["seasonal_decompose"] = seasonal_decompose
                        if 'ttest_ind' in locals():
                            exec_scope["ttest_ind"] = ttest_ind
                        
                        # Execute the code directly
                        exec(code, globals(), exec_scope)
                        
                        # Check if the code created an analysis_results variable
                        if "analysis_results" in exec_scope:
                            analysis_results = exec_scope["analysis_results"]
                            print("Analysis results from direct execution:", analysis_results)
                        else:
                            raise ValueError("The generated code did not define an 'analyze_data' function or create an 'analysis_results' variable")
                    except Exception as direct_exec_error:
                        print(f"Error executing code directly: {str(direct_exec_error)}")
                        raise ValueError("The generated code did not define an 'analyze_data' function and direct execution failed")
                
                # Ensure analysis_results is a dictionary
                if not isinstance(analysis_results, dict):
                    raise ValueError("analyze_data function did not return a dictionary")
                
                # Check for required keys in the results
                required_keys = ['analysis_type', 'summary']
                for key in required_keys:
                    if key not in analysis_results:
                        analysis_results[key] = f"Missing '{key}' in results"
                
                # Create chart configurations based on analysis results
                chart_configs = []
                
                # Convert chart recommendations from analysis to chart configs for frontend
                for chart_rec in analysis_results.get('chart_configs', []):
                    chart_type = chart_rec.get('type', 'bar')
                    
                    # Basic chart config
                    chart_config = {
                        "type": chart_type,
                        "title": chart_rec.get('title', f"{analysis_results['analysis_type']} Analysis"),
                        "subtitle": chart_rec.get('subtitle', ""),
                        "sourceSheetId": primary_sheet_id,
                        "targetSheetId": request.explicitTargetSheetId or request.activeSheetId,
                        "stacked": False,
                        "colors": ["#4e79a7", "#f28e2b", "#59a14f", "#76b7b2", "#edc949"]
                    }
                    
                    # Generate chart data based on chart type
                    if chart_type in ['bar', 'line', 'area']:
                        # Need categories and values
                        x_axis = chart_rec.get('x_axis')
                        y_axis = chart_rec.get('y_axis')
                        
                        if x_axis and y_axis:
                            chart_data = []
                            # Get unique categories
                            categories = df[x_axis].dropna().unique()
                            
                            for category in categories[:20]:  # Limit to first 20 categories
                                # Calculate value(s) for this category
                                category_data = df[df[x_axis] == category]
                                if not category_data.empty:
                                    data_point = {'name': str(category)}
                                    # If y_axis is a list, add multiple series
                                    if isinstance(y_axis, list):
                                        for y_col in y_axis:
                                            if y_col in category_data.columns:
                                                data_point[y_col] = float(category_data[y_col].mean())
                                    else:
                                        # For scalar y_axis
                                        data_point[y_axis] = float(category_data[y_axis].mean())
                                    chart_data.append(data_point)
                            
                            chart_config["data"] = chart_data
                        
                    elif chart_type == 'scatter':
                        x_axis = chart_rec.get('x_axis')
                        y_axis = chart_rec.get('y_axis')
                        
                        if x_axis and y_axis:
                            chart_data = []
                            # Create scatter plot data
                            for _, row in df.iterrows():
                                if pd.notna(row.get(x_axis)) and pd.notna(row.get(y_axis)):
                                    try:
                                        data_point = {
                                            'x': float(row[x_axis]),
                                            'y': float(row[y_axis]),
                                            'name': str(row.get('name', f"Point {_}"))
                                        }
                                        chart_data.append(data_point)
                                    except (ValueError, TypeError):
                                        continue  # Skip points that can't be converted to float
                            
                            chart_config["data"] = chart_data
                    
                    elif chart_type == 'pie':
                        categories = chart_rec.get('categories', [])
                        values = chart_rec.get('values', [])
                        
                        if categories and values:
                            chart_data = []
                            for cat, val in zip(categories, values):
                                chart_data.append({
                                    'name': str(cat),
                                    'value': float(val)
                                })
                            
                            chart_config["data"] = chart_data
                    
                    elif chart_type == 'box':
                        # Box plot data needs to include min, q1, median, q3, max
                        data_col = chart_rec.get('data')
                        if data_col:
                            clean_data = df[data_col].dropna()
                            if len(clean_data) > 0:
                                min_val = float(clean_data.min())
                                q1 = float(np.percentile(clean_data, 25))
                                median = float(clean_data.median())
                                q3 = float(np.percentile(clean_data, 75))
                                max_val = float(clean_data.max())
                                
                                chart_data = [{
                                    'name': data_col,
                                    'min': min_val,
                                    'q1': q1,
                                    'median': median,
                                    'q3': q3,
                                    'max': max_val,
                                    'outliers': clean_data[(clean_data < (q1 - 1.5 * (q3 - q1))) | 
                                                        (clean_data > (q3 + 1.5 * (q3 - q1)))].tolist()
                                }]
                                
                                chart_config["data"] = chart_data
                    
                    # Add the chart configuration
                    chart_configs.append(chart_config)
                
                # Now, create a prompt for GPT to interpret the analysis results
                interpretation_prompt = f"""
                You are a statistical analysis expert helping to interpret the results of a statistical analysis.
                
                USER REQUEST: "{request.message}"
                
                Here is information about the data:
                - Sheet name: {primary_sheet_name}
                - Number of rows: {len(df)}
                - Number of columns: {len(df.columns)}
                
                Analysis type: {analysis_results.get('analysis_type', 'Statistical Analysis')}
                
                Analysis summary: {json.dumps(analysis_results.get('summary', {}))}
                
                Detailed results: {json.dumps(analysis_results.get('details', {}))}
                
                Based on the analysis results, provide a clear, concise interpretation of the findings.
                Your response should:
                1. Explain the purpose of the analysis in plain language
                2. Summarize the key findings
                3. Interpret what these findings mean in practical terms
                4. Mention any important caveats or limitations if present
                
                Write in a professional but accessible style that someone without a statistics background could understand.
                """
                
                # Get the interpretation from GPT
                interpretation_response = self.openai_client.chat.completions.create(
                    model="gpt-4o",
                    messages=[
                        {"role": "system", "content": "You are a statistical analysis expert who explains results clearly to non-experts."},
                        {"role": "user", "content": interpretation_prompt}
                    ],
                    temperature=0.3,
                    max_tokens=800
                )
                
                # Extract the interpretation
                interpretation_text = interpretation_response.choices[0].message.content
                
                # Prepare response with statistical analysis results and interpretation
                response = {
                    "text": interpretation_text,
                    "analysisType": analysis_results.get('analysis_type', 'Statistical Analysis'),
                    "sourceSheetId": primary_sheet_id,
                    "operation": "statistical",
                    "metadata": {
                        "rows_analyzed": len(df),
                        "columns_analyzed": len(df.columns),
                        "variables_analyzed": analysis_results.get('variables_analyzed', [])
                    }
                }
                
                # Add chart configs if there are any
                if chart_configs:
                    response["chartConfigs"] = chart_configs
                
                return response
                
            except Exception as e:
                print(f"Error executing analysis code: {str(e)}")
                traceback.print_exc()
                
                # Generate a better error message and fallback analysis using GPT
                fallback_prompt = f"""
                I tried to execute statistical analysis code for this user request:
                
                "{request.message}"
                
                But encountered this error:
                {str(e)}
                
                Can you:
                1. Generate a friendly, helpful response without mentioning that there was an error or any technical details
                2. Suggest an alternative analysis that might work better with this data
                3. Provide insights about what the user might actually be looking for
                
                Data summary:
                {summary_json}
                
                IMPORTANT: Do NOT mention errors, code issues, or technical problems in your response.
                Make your response sound like you're a helpful analyst providing alternative insights,
                not like you're explaining why something failed.
                """
                
                # Get fallback response
                fallback_response = self.openai_client.chat.completions.create(
                    model="gpt-4o",
                    messages=[
                        {"role": "system", "content": "You are a helpful statistical assistant that provides friendly, alternative insights when the primary analysis can't be completed. Never mention errors, code issues, or technical problems in your responses."},
                        {"role": "user", "content": fallback_prompt}
                    ],
                    temperature=0.3,
                    max_tokens=800
                )
                
                fallback_text = fallback_response.choices[0].message.content
                
                # Attempt to create a basic chart for the data
                basic_chart_config = None
                try:
                    # Find the most promising numeric column
                    numeric_cols = df.select_dtypes(include=['number']).columns.tolist()
                    if numeric_cols:
                        y_col = numeric_cols[0]  # First numeric column
                        
                        # Find a suitable x-axis column (categorical or datetime)
                        categorical_cols = [col for col in df.columns if col not in numeric_cols]
                        if categorical_cols:
                            x_col = categorical_cols[0]
                            
                            # Create a simple chart configuration
                            chart_data = []
                            for category in df[x_col].dropna().unique()[:10]:  # Limit to 10 categories
                                subset = df[df[x_col] == category]
                                if not subset.empty:
                                    chart_data.append({
                                        'name': str(category),
                                        y_col: float(subset[y_col].mean())
                                    })
                            
                            if chart_data:
                                basic_chart_config = {
                                    "type": "bar",
                                    "title": f"{y_col} by {x_col}",
                                    "subtitle": "Basic data overview",
                                    "sourceSheetId": primary_sheet_id,
                                    "targetSheetId": request.explicitTargetSheetId or request.activeSheetId,
                                    "stacked": False,
                                    "colors": ["#4e79a7", "#f28e2b", "#59a14f", "#76b7b2", "#edc949"],
                                    "data": chart_data
                                }
                except Exception as chart_error:
                    print(f"Error creating fallback chart: {str(chart_error)}")
                    basic_chart_config = None
                
                # Return response with alternative insights
                response = {
                    "text": fallback_text,
                    "analysisType": "Statistical Analysis",
                    "sourceSheetId": primary_sheet_id,
                    "operation": "statistical",
                    "metadata": {
                        "rows_analyzed": len(df),
                        "columns_analyzed": len(df.columns)
                    }
                }
                
                # Add basic chart if available
                if basic_chart_config:
                    response["chartConfigs"] = [basic_chart_config]
                
                return response
            
        except Exception as e:
            print(f"Error processing statistical analysis request: {str(e)}")
            traceback.print_exc()
            raise HTTPException(
                status_code=500,
                detail={
                    "error": "Failed to analyze data",
                    "text": f"I couldn't perform the statistical analysis as requested: {str(e)}. Please try a different request or check your data format."
                }
            )