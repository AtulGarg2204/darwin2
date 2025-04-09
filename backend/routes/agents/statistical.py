from typing import Dict, Any, List, Optional, Union
from openai import OpenAI
import os
import json
from fastapi import HTTPException
import pandas as pd
import numpy as np
import traceback
import scipy.stats as stats
import matplotlib.pyplot as plt
import seaborn as sns
from together import Together

try:
    import statsmodels.api as sm
except ImportError:
    sm = None

class StatisticalAgent:
    def __init__(self):
        """Initialize the EnhancedStatisticalAgent with the OpenAI client."""
        if os.getenv("USE_TOGETHER"):
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
    
    def _create_dataframe_from_raw(self, raw_data: List[Any]) -> pd.DataFrame:
        """Convert raw data to a pandas DataFrame with thorough cleaning."""
        if not raw_data:
            return pd.DataFrame()
        
        try:
            # Handle different input formats
            if isinstance(raw_data[0], list):
                # Array format with headers
                headers = raw_data[0]
                
                # Filter valid headers
                valid_headers = []
                valid_indices = []
                for i, header in enumerate(headers):
                    if header is not None and str(header).strip() != '':
                        valid_headers.append(header)
                        valid_indices.append(i)
                
                # Filter data rows to include only valid columns and non-empty rows
                cleaned_data = []
                for row in raw_data[1:]:
                    if len(row) >= len(headers):
                        filtered_row = [row[i] for i in valid_indices]
                        if any(val is not None and str(val).strip() != '' for val in filtered_row):
                            cleaned_data.append(filtered_row)
                
                df = pd.DataFrame(cleaned_data, columns=valid_headers)
                
            else:
                # Object format
                filtered_data = []
                for item in raw_data:
                    # Keep only rows with at least one non-empty value
                    if any(val is not None and str(val).strip() != '' for val in item.values()):
                        filtered_data.append(item)
                
                df = pd.DataFrame(filtered_data)
            
            # Additional data cleaning
            if not df.empty:
                # Replace empty strings with NaN
                df = df.replace('', pd.NA)
                
                # Drop completely empty rows and columns
                df = df.dropna(how='all')
                df = df.dropna(axis=1, how='all')
                
                # Convert column names to be more analysis-friendly
                df.columns = df.columns.str.strip().str.replace(' ', '_')
                
                # Convert numeric columns to appropriate data types
                for col in df.columns:
                    # Force numeric conversion for columns that look like numbers
                    if df[col].apply(lambda x: isinstance(x, (int, float)) or
                                   (isinstance(x, str) and x.replace('.', '', 1).isdigit())).all():
                        df[col] = pd.to_numeric(df[col], errors='coerce')
                    
                    # Try to convert date columns
                    elif any(date_term in col.lower() for date_term in ['date', 'time', 'day', 'month', 'year']):
                        try:
                            df[col] = pd.to_datetime(df[col], errors='coerce')
                        except:
                            pass
                
                # Replace any infinity values with NaN
                df = df.replace([np.inf, -np.inf], np.nan)
                
                print(f"Created DataFrame with {len(df)} rows and {len(df.columns)} columns")
            
            return df
            
        except Exception as e:
            print(f"Error creating DataFrame: {str(e)}")
            traceback.print_exc()
            return pd.DataFrame()
    
    def _generate_data_profile(self, df: pd.DataFrame) -> Dict[str, Any]:
        """Generate a comprehensive data profile for analysis planning."""
        if df.empty:
            return {"empty": True}
        
        profile = {
            "dimensions": {"rows": len(df), "columns": len(df.columns)},
            "columns": {},
            "numeric_columns": [],
            "categorical_columns": [],
            "datetime_columns": [],
            "correlation_data": None,
            "basic_stats": {}
        }
        
        # Process each column
        for col in df.columns:
            col_type = str(df[col].dtype)
            non_null_count = df[col].count()
            null_pct = (len(df) - non_null_count) / len(df) * 100 if len(df) > 0 else 0
            
            col_info = {
                "type": col_type,
                "non_null_count": int(non_null_count),
                "null_percent": float(null_pct)
            }
            
            # Add type-specific information
            if pd.api.types.is_numeric_dtype(df[col]):
                profile["numeric_columns"].append(col)
                stats_dict = df[col].describe().to_dict()
                # Convert numpy types to Python types
                col_stats = {k: float(v) if isinstance(v, (np.int64, np.float64)) else v 
                             for k, v in stats_dict.items()}
                
                col_info.update(col_stats)
                
                # Add to basic stats
                profile["basic_stats"][col] = {
                    "mean": float(df[col].mean()) if not pd.isna(df[col].mean()) else None,
                    "median": float(df[col].median()) if not pd.isna(df[col].median()) else None,
                    "std": float(df[col].std()) if not pd.isna(df[col].std()) else None
                }
                
            elif pd.api.types.is_datetime64_any_dtype(df[col]):
                profile["datetime_columns"].append(col)
                min_val = df[col].min()
                max_val = df[col].max()
                col_info.update({
                    "min": min_val.isoformat() if min_val is not pd.NaT else None,
                    "max": max_val.isoformat() if max_val is not pd.NaT else None,
                    "range_days": (max_val - min_val).days if min_val is not pd.NaT and max_val is not pd.NaT else None
                })
            else:
                # Treat as categorical
                profile["categorical_columns"].append(col)
                value_counts = df[col].value_counts()
                top_categories = value_counts.head(5).to_dict()
                # Convert keys to strings for JSON serialization
                top_categories = {str(k): int(v) for k, v in top_categories.items()}
                
                col_info.update({
                    "unique_count": int(df[col].nunique()),
                    "top_categories": top_categories
                })
            
            profile["columns"][col] = col_info
        
        # Add correlation matrix for numeric columns if there are at least 2
        if len(profile["numeric_columns"]) >= 2:
            try:
                corr_matrix = df[profile["numeric_columns"]].corr().round(3)
                
                # Convert to a list of correlation data points for visualization
                corr_data = []
                for i, col1 in enumerate(corr_matrix.columns):
                    for j, col2 in enumerate(corr_matrix.columns):
                        corr_data.append({
                            "x": col1,
                            "y": col2,
                            "value": float(corr_matrix.iloc[i, j])
                        })
                
                profile["correlation_data"] = corr_data
            except Exception as e:
                print(f"Error generating correlation matrix: {str(e)}")
        
        # Add data patterns and insights
        profile["insights"] = self._generate_data_insights(df, profile)
        
        return profile
    
    def _generate_data_insights(self, df: pd.DataFrame, profile: Dict[str, Any]) -> List[str]:
        """Generate insights about the data for better analysis planning."""
        insights = []
        
        # Check for highly correlated variables
        if "correlation_data" in profile and profile["correlation_data"]:
            high_corr_pairs = []
            for item in profile["correlation_data"]:
                if item["x"] != item["y"] and abs(item["value"]) > 0.7:
                    high_corr_pairs.append((item["x"], item["y"], item["value"]))
            
            if high_corr_pairs:
                for x, y, val in high_corr_pairs[:3]:  # Limit to top 3
                    insights.append(f"Strong {'positive' if val > 0 else 'negative'} correlation ({val:.2f}) between {x} and {y}")
        
        # Check for potential outliers in numeric columns
        for col in profile["numeric_columns"]:
            if "mean" in profile["basic_stats"][col] and "std" in profile["basic_stats"][col]:
                mean = profile["basic_stats"][col]["mean"]
                std = profile["basic_stats"][col]["std"]
                
                if mean is not None and std is not None and std > 0:
                    try:
                        # Check if there are values more than 3 standard deviations from mean
                        outliers = df[(df[col] > mean + 3*std) | (df[col] < mean - 3*std)]
                        if len(outliers) > 0:
                            outlier_pct = len(outliers) / len(df) * 100
                            insights.append(f"Potential outliers detected in {col}: {len(outliers)} rows ({outlier_pct:.1f}%)")
                    except:
                        pass
        
        # Check for skewed distributions
        for col in profile["numeric_columns"]:
            try:
                if "mean" in profile["basic_stats"][col] and "median" in profile["basic_stats"][col]:
                    mean = profile["basic_stats"][col]["mean"]
                    median = profile["basic_stats"][col]["median"]
                    
                    if mean is not None and median is not None and median != 0:
                        # Calculate skewness indicator
                        skew_ratio = mean / median
                        if skew_ratio > 1.5 or skew_ratio < 0.67:
                            insights.append(f"Column {col} shows a skewed distribution (mean/median ratio: {skew_ratio:.2f})")
            except:
                pass
        
        # Check for columns with high percentage of missing values
        for col, info in profile["columns"].items():
            if info.get("null_percent", 0) > 20:
                insights.append(f"Column {col} has {info['null_percent']:.1f}% missing values")
        
        # Check for datetime columns for potential time series analysis
        if profile["datetime_columns"]:
            date_col = profile["datetime_columns"][0]
            insights.append(f"Datetime column {date_col} detected - consider time series analysis")
        
        return insights
    
    async def _create_statistical_analysis(self, user_message: str, df: pd.DataFrame, data_profile: Dict[str, Any]) -> Dict[str, Any]:
        """Create a complete statistical analysis based on user request and data profile."""
        # Skip if DataFrame is empty
        if df.empty or data_profile.get("empty", False):
            return {
                "analysis_type": "none",
                "error": "Empty dataset"
            }
        
        # Create comprehensive analysis prompt
        prompt = f"""
        You are an expert statistical analyst. Based on the user's request, create a robust statistical analysis.

        USER REQUEST: "{user_message}"

        DATA PROFILE:
        ```json
        {json.dumps(data_profile, indent=2)}
        ```

        Create a comprehensive statistical analysis package including visualization with these components:

        1. analysis_type: The main type of statistical analysis needed (e.g., 'descriptive', 'correlation', 'hypothesis_testing', 'regression', 'time_series')
        
        2. analysis_plan: A detailed description of what you'll analyze and how you'll approach it
        
        3. implementation: Python code that performs the analysis using pandas, numpy, scipy, etc.
           - Handle missing values, outliers, and other data issues
           - Create a dictionary called 'analysis_result' with all findings
           - Include comprehensive error handling
           - IMPORTANT: When working with date/datetime columns:
              - Don't use them directly in aggregation functions (sum, mean, etc.)
              - For time-based analysis, use the derived columns (e.g., Date_year, Date_month) that are automatically created
              - Use appropriate datetime methods like df['Date'].dt.month when needed
           - IMPORTANT: For safety, use the provided safe_groupby_agg function for any groupby operations:
              safe_groupby_agg(df, ['groupby_column'], {{'value_column': 'mean'}})
           - DO NOT include markdown formatting (```python) in your code
        
        4. interpretation_guide: Guidelines on how to interpret the results

        Here's an example implementation for calculating profit margin by region:
        
        # Ensure numeric columns
        df['Revenue'] = pd.to_numeric(df['Revenue'], errors='coerce')
        df['Profit'] = pd.to_numeric(df['Profit'], errors='coerce')
        
        # Calculate profit margin by region
        region_performance = safe_groupby_agg(df, ['Region'], {{
            'Revenue': 'sum',
            'Profit': 'sum'
        }})
        
        if region_performance is not None:
            # Calculate profit margin
            region_performance['Profit_Margin'] = (region_performance['Profit'] / region_performance['Revenue'] * 100).round(2)
            
            # Sort by profit margin
            region_performance = region_performance.sort_values('Profit_Margin', ascending=False)
            
            # Get highest profit margin region
            highest_margin_region = region_performance.iloc[0]['Region']
            highest_margin_value = region_performance.iloc[0]['Profit_Margin']
            
            # Prepare data for visualization
            chart_data = region_performance.to_dict('records')
            
            analysis_result = {{
                'profit_margin_by_region': chart_data,
                'highest_margin_region': highest_margin_region,
                'highest_margin_value': highest_margin_value
            }}
        else:
            analysis_result = {{'profit_margin_by_region': None}}

        IMPORTANT SAFETY CHECKS:
            - ALWAYS check if a function return value is None before using it
            - Especially for safe_groupby_agg function which may return None
            - Example: result = safe_groupby_agg(...); if result is not None: # then use result

        Return your response as a JSON object, with the implementation code as a plain string without any markdown formatting characters.
        """

        # Get analysis package from OpenAI
        response = self.client.chat.completions.create(
            model=self.model,
            messages=[
                {"role": "system", "content": "You are a statistical analysis API that returns robust, executable Python code without markdown formatting."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.2,
            response_format={"type": "json_object"}
        )
        
        # Parse the analysis package
        try:
            analysis_package = json.loads(response.choices[0].message.content)
            
            # Clean the implementation code to remove any markdown formatting
            if "implementation" in analysis_package:
                code = analysis_package["implementation"]
                
                # Remove markdown code block formatting if present
                if code.startswith("```python"):
                    code = code.replace("```python", "", 1)
                elif code.startswith("```"):
                    code = code.replace("```", "", 1)
                
                if code.endswith("```"):
                    code = code[:-3]
                
                # Strip any leading/trailing whitespace
                code = code.strip()
                
                # Update the package with cleaned code
                analysis_package["implementation"] = code
            
            return analysis_package
        except json.JSONDecodeError:
            # Handle invalid JSON response
            print("Error: OpenAI returned invalid JSON")
            # Create a basic fallback package
            return {
                "analysis_type": "descriptive",
                "analysis_plan": "Basic descriptive analysis of the dataset",
                "implementation": "analysis_result = df.describe().to_dict()",
                "visualizations": [],
                "interpretation_guide": "Review the basic statistics to understand the data distribution."
            }
    
    def _execute_analysis(self, implementation_code: str, df: pd.DataFrame) -> Dict[str, Any]:
        """Execute the statistical analysis code and return the results."""
        try:
            # Make a copy of the DataFrame to avoid modifying the original
            working_df = df.copy()
            
            # Check for datetime columns and create additional features
            for col in working_df.columns:
                if pd.api.types.is_datetime64_any_dtype(working_df[col]):
                    # Create year, month, and day columns that can be used in aggregations
                    working_df[f'{col}_year'] = working_df[col].dt.year
                    working_df[f'{col}_month'] = working_df[col].dt.month
                    working_df[f'{col}_day'] = working_df[col].dt.day
                    print(f"Created date components for {col}")
            
            # Set up execution environment
            execution_env = {
                "df": working_df,
                "pd": pd, 
                "np": np, 
                "stats": stats
            }
            
            # Add optional libraries if available
            if sm:
                execution_env["sm"] = sm
            execution_env["plt"] = plt
            execution_env["sns"] = sns
            
            # Add a safe aggregation function
            def safe_groupby_agg(dataframe, group_cols, agg_dict):
                """Safely perform groupby aggregation, skipping datetime columns."""
                try:
                    # Filter agg_dict to only include columns that support the operations
                    safe_agg_dict = {}
                    for col, ops in agg_dict.items():
                        if col in dataframe.columns and not pd.api.types.is_datetime64_any_dtype(dataframe[col]):
                            safe_agg_dict[col] = ops
                    
                    if not safe_agg_dict:
                        print(f"Warning: No aggregatable columns found for {group_cols}")
                        return None
                    
                    result = dataframe.groupby(group_cols).agg(safe_agg_dict).reset_index()
                    return result
                except Exception as e:
                    print(f"Error in safe_groupby_agg: {str(e)}")
                    return None
            
            execution_env["safe_groupby_agg"] = safe_groupby_agg
            
            # Execute the implementation code
            exec(implementation_code, execution_env)
            
            # Extract the analysis result
            if "analysis_result" in execution_env:
                result = execution_env["analysis_result"]
                
                # Convert to JSON-serializable format
                return self._make_serializable(result)
            else:
                raise ValueError("No analysis_result found in execution environment")
            
        except Exception as e:
            error_message = str(e)
            traceback_str = traceback.format_exc()
            print(f"Error executing analysis: {error_message}")
            print(traceback_str)
            raise HTTPException(
                status_code=500,
                detail={
                    "error": error_message,
                    "traceback": traceback_str
                }
            )
    
    def _make_serializable(self, obj: Any) -> Any:
        """Convert Python objects to JSON-serializable format."""
        if isinstance(obj, (pd.DataFrame, pd.Series)):
            return obj.to_dict()
        elif isinstance(obj, np.ndarray):
            return obj.tolist()
        elif isinstance(obj, (np.int64, np.float64)):
            return float(obj)
        elif isinstance(obj, dict):
            return {k: self._make_serializable(v) for k, v in obj.items()}
        elif isinstance(obj, list):
            return [self._make_serializable(v) for v in obj]
        elif isinstance(obj, tuple):
            return [self._make_serializable(v) for v in obj]
        elif pd.isna(obj):
            return None
        else:
            # Try to convert to primitive type, or use string representation
            try:
                return float(obj) if isinstance(obj, (int, float, np.number)) else str(obj)
            except:
                return str(obj)
    
    async def _generate_visualizations(self, analysis_result: Dict[str, Any], df: pd.DataFrame, 
                                    source_sheet_id: str, target_sheet_id: str) -> List[Dict[str, Any]]:
        """Generate visualizations based on analysis results."""
        # Create visualization prompt
        prompt = f"""
        You are a data visualization expert. Based on the following analysis results, create appropriate visualizations.

        ANALYSIS RESULTS:
        ```json
        {json.dumps(analysis_result, default=str, indent=2)}
        ```

        DATAFRAME INFO:
        - Columns: {df.columns.tolist()}
        - Sample data: {df.head().to_dict()}

        Create a JSON array of visualization configurations. Each configuration should have:
        {{
            "type": "chart type (bar, line, scatter, pie, heatmap)",
            "title": "Chart title",
            "xAxisColumn": "Column for x-axis",
            "yAxisColumns": ["Columns for y-axis"],
            "dataTransformationCode": "Python code to transform data for visualization",
            "visualization": {{
                "colors": ["#hex1", "#hex2"],
                "stacked": true/false
            }}
        }}

        The dataTransformationCode should transform the DataFrame (named df) and assign the result to result_df.
        Include any necessary aggregations, sorting, filtering, or calculations.
        """

        # Get visualization recommendations from OpenAI
        response = self.client.chat.completions.create(
            model=self.model,
            messages=[
                {"role": "system", "content": "You are a data visualization API. Return only valid JSON with no comments, no markdown, and no explanation."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.2,
            max_tokens=1000,
            response_format={"type": "json_object"}
        )

        print("VISUALIZATION CONFIGS:")
        print(response.choices[0].message.content)

        # Parse the visualization configurations
        viz_configs_response = json.loads(response.choices[0].message.content)
        viz_configs = viz_configs_response.get("visualizations", [])
        if not isinstance(viz_configs, list):
            viz_configs = [viz_configs]

        chart_configs = []
        for viz_config in viz_configs:
            try:
                # Execute the data transformation code
                local_scope = {"df": df, "pd": pd, "np": np}
                exec(viz_config["dataTransformationCode"], local_scope)
                result_df = local_scope.get("result_df")

                if result_df is None:
                    continue

                # Convert DataFrame to chart data format
                chart_data = []
                if viz_config["type"] in ["bar", "line", "area"]:
                    for _, row in result_df.iterrows():
                        data_point = {"name": str(row[viz_config["xAxisColumn"]])}
                        for y_col in viz_config["yAxisColumns"]:
                            if y_col in result_df.columns:
                                data_point[y_col] = float(row[y_col])
                        chart_data.append(data_point)
                elif viz_config["type"] == "scatter":
                    for _, row in result_df.iterrows():
                        chart_data.append({
                            "x": float(row[viz_config["xAxisColumn"]]),
                            "y": float(row[viz_config["yAxisColumns"][0]]),
                            "name": str(row[viz_config["xAxisColumn"]])
                        })
                elif viz_config["type"] == "pie":
                    for _, row in result_df.iterrows():
                        chart_data.append({
                            "name": str(row[viz_config["xAxisColumn"]]),
                            "value": float(row[viz_config["yAxisColumns"][0]])
                        })
                elif viz_config["type"] == "heatmap":
                    # Create a pivot table for heatmap
                    pivot = pd.pivot_table(
                        result_df,
                        values=viz_config["yAxisColumns"][0],
                        index=viz_config["xAxisColumn"],
                        columns=viz_config["yAxisColumns"][1],
                        aggfunc='mean'
                    ).fillna(0)

                    for idx_val in pivot.index:
                        for col_val in pivot.columns:
                            chart_data.append({
                                "x": str(idx_val),
                                "y": str(col_val),
                                "value": float(pivot.loc[idx_val, col_val])
                            })

                if chart_data:
                    chart_config = {
                        "type": viz_config["type"],
                        "title": viz_config["title"],
                        "data": chart_data,
                        "colors": viz_config["visualization"].get("colors", ["#4e79a7", "#f28e2b", "#59a14f"]),
                        "stacked": viz_config["visualization"].get("stacked", False),
                        "sourceSheetId": source_sheet_id,
                        "targetSheetId": target_sheet_id
                    }
                    chart_configs.append(chart_config)

            except Exception as e:
                print(f"Error generating chart for {viz_config.get('title', 'unknown')}: {str(e)}")
                continue

        return chart_configs
    
    async def _generate_interpretation(self, user_message: str, analysis_type: str, 
                                   analysis_result: Dict[str, Any], 
                                   interpretation_guide: str) -> str:
        """Generate user-friendly interpretation of analysis results."""
        # Clean up the result for presentation
        cleaned_result = {}
        for key, value in analysis_result.items():
            # Skip very large dictionary values and error information
            if key not in ["error", "traceback"] and not (isinstance(value, dict) and len(value) > 20):
                cleaned_result[key] = value
        
        # Create interpretation prompt
        prompt = f"""
        USER QUESTION: "{user_message}"
        
        ANALYSIS TYPE: {analysis_type}
        
        ANALYSIS RESULTS:
        ```json
        {json.dumps(cleaned_result, default=str, indent=2)}
        ```
        
        INTERPRETATION GUIDE:
        {interpretation_guide}
        
        Based on the above, provide a clear, concise interpretation of the findings that directly addresses the user's question.
        Your response should be conversational and avoid technical jargon while still conveying the statistical insights accurately.
        Include specific numbers and patterns found in the data.
        
        If the results include error information, do NOT mention technical errors. Instead, focus on what insights can still be drawn
        from any partial results or basic data properties.
        """
        
        # Get interpretation from OpenAI
        response = self.client.chat.completions.create(
            model=self.model,
            messages=[
                {"role": "system", "content": "You are a statistical interpreter who explains results clearly to non-experts."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.2,
            max_tokens=800
        )
        
        return response.choices[0].message.content
    
    async def analyze(self, request: Any, current_user: Dict = None) -> Dict[str, Any]:
        """
        Main entry point for statistical analysis requests.
        Provides comprehensive statistical analysis based on user request.
        """
        try:
            # Extract relevant information
            primary_sheet_id = next(iter(request.relevantData.keys())) if request.relevantData else request.activeSheetId
            source_data = request.relevantData.get(primary_sheet_id, [])
            target_sheet_id = request.explicitTargetSheetId or request.activeSheetId
            
            # Convert raw data to DataFrame with thorough cleaning
            df = self._create_dataframe_from_raw(source_data)
            
            # Handle empty DataFrame
            if df.empty:
                raise HTTPException(
                    status_code=400,
                    detail="Empty dataset provided for analysis"
                )
            
            # Generate comprehensive data profile
            data_profile = self._generate_data_profile(df)
            
            # Create and execute statistical analysis
            analysis_package = await self._create_statistical_analysis(request.message, df, data_profile)
            
            # Execute the analysis code
            print("CODE GENERATED:")
            print(analysis_package["implementation"])
            analysis_result = self._execute_analysis(analysis_package["implementation"], df)

            print("ANALYSIS RESULT:")
            print(json.dumps(analysis_result, indent=2))
            
            # Generate visualizations
            chart_configs = await self._generate_visualizations(analysis_result, df, primary_sheet_id, target_sheet_id)
            
            # Generate interpretation
            interpretation = await self._generate_interpretation(
                request.message,
                analysis_package.get("analysis_type", "Statistical Analysis"),
                analysis_result,
                analysis_package.get("interpretation_guide", "")
            )
            
            # Return the final response
            return {
                "text": interpretation,
                "analysisType": analysis_package.get("analysis_type", "Statistical Analysis"),
                "chartConfig": chart_configs,
                "sourceSheetId": primary_sheet_id,
                "targetSheetId": target_sheet_id,
                "operation": "statistical",
                "metadata": {
                    "rows_analyzed": len(df),
                    "columns_analyzed": len(df.columns),
                    "analysis_type": analysis_package.get("analysis_type"),
                    "visualization_count": len(chart_configs)
                }
            }
            
        except Exception as e:
            print(f"Error processing statistical analysis request: {str(e)}")
            traceback.print_exc()
            raise HTTPException(
                status_code=500,
                detail={
                    "error": str(e),
                    "traceback": traceback.format_exc()
                }
            )