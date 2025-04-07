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
try:
    import statsmodels.api as sm
except ImportError:
    sm = None

class StatisticalAgent:
    def __init__(self):
        """Initialize the EnhancedStatisticalAgent with the OpenAI client."""
        self.openai_client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
    
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

        Create a comprehensive statistical analysis package with these components:

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

            IMPORTANT SAFETY CHECKS:
            - ALWAYS check if a function return value is None before using it
            - Especially for safe_groupby_agg function which may return None
            - Example: result = safe_groupby_agg(...); if result is not None: # then use result
        
        4. visualizations(must be included): Array of visualization specifications, each with:
           - type: Chart type (bar, line, scatter, pie, heatmap)
           - title: Chart title
           - x_axis: Column for x-axis
           - y_axis: Column(s) for y-axis (can be an array for multiple series)
           - description: What this visualization shows
        
        5. interpretation_guide: Guidelines on how to interpret the results

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

        Return your response as a JSON object, with the implementation code as a plain string without any markdown formatting characters.
        """

        # Get analysis package from OpenAI
        response = self.openai_client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {"role": "system", "content": "You are a statistical analysis API that returns robust, executable Python code without markdown formatting."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.4,
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
                
                # If result is empty or None, provide a basic result
                if result is None or (isinstance(result, dict) and not result):
                    # Generate basic analysis as fallback
                    result = {"basic_analysis": self._generate_basic_result(working_df)}
                
                # Convert to JSON-serializable format
                return self._make_serializable(result)
            else:
                # Generate basic analysis as fallback
                basic_result = {"basic_analysis": self._generate_basic_result(working_df)}
                return self._make_serializable(basic_result)
            
        except Exception as e:
            error_message = str(e)
            traceback_str = traceback.format_exc()
            print(f"Error executing analysis: {error_message}")
            print(traceback_str)
            
            # Return error information along with basic analysis
            basic_result = self._generate_basic_result(df)
            return {
                "error": error_message,
                "traceback": traceback_str,
                "basic_analysis": basic_result
            }
    
    def _generate_basic_result(self, df: pd.DataFrame) -> Dict[str, Any]:
        """Generate basic analysis result when main analysis fails."""
        result = {}
        
        try:
            # Get numeric columns
            numeric_cols = df.select_dtypes(include=['number']).columns.tolist()
            
            # Basic statistics for numeric columns
            if numeric_cols:
                result["numeric_stats"] = df[numeric_cols].describe().to_dict()
            
            # If we have categorical and numeric columns, do a basic group by
            categorical_cols = [col for col in df.columns 
                               if not pd.api.types.is_numeric_dtype(df[col]) 
                               and not pd.api.types.is_datetime64_any_dtype(df[col])]
            
            if categorical_cols and numeric_cols:
                # Take first categorical column and first numeric column
                cat_col = categorical_cols[0]
                num_col = numeric_cols[0]
                
                # Group by categorical and get mean of numeric
                try:
                    grouped = df.groupby(cat_col)[num_col].mean().reset_index()
                    result[f"{num_col}_by_{cat_col}"] = grouped.to_dict('records')
                except:
                    pass
            
            return result
        except Exception as e:
            print(f"Error in _generate_basic_result: {str(e)}")
            return {"error": str(e)}
    
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
    
    def _generate_chart_configs(self, analysis_result: Dict[str, Any], visualization_specs: List[Dict[str, Any]], 
                              df: pd.DataFrame, source_sheet_id: str, target_sheet_id: str) -> List[Dict[str, Any]]:
        """Generate chart configurations from visualization specs."""
        chart_configs = []
        
        for viz_spec in visualization_specs:
            viz_type = viz_spec.get("type", "bar")
            x_axis = viz_spec.get("x_axis")
            y_axis = viz_spec.get("y_axis", [])
            title = viz_spec.get("title", "Data Visualization")
            
            # Normalize y_axis to always be a list
            if not isinstance(y_axis, list):
                y_axis = [y_axis]
            
            # Create base chart config
            chart_config = {
                "type": viz_type,
                "title": title,
                "subtitle": viz_spec.get("description", ""),
                "sourceSheetId": source_sheet_id,
                "targetSheetId": target_sheet_id,
                "colors": ["#4e79a7", "#f28e2b", "#59a14f", "#76b7b2", "#edc949"],
                "stacked": viz_spec.get("stacked", False)
            }
            
            # Generate chart data based on chart type
            chart_data = []
            
            try:
                if viz_type in ["bar", "line", "area"]:
                    # Check if custom data is provided in the analysis result
                    result_key = viz_spec.get("data_key")
                    if result_key and result_key in analysis_result:
                        # Use pre-calculated data from analysis result
                        chart_data = analysis_result[result_key]
                    elif x_axis and y_axis and x_axis in df.columns:
                        # Generate data from the DataFrame
                        categories = df[x_axis].dropna().unique()
                        
                        for category in categories[:20]:  # Limit to first 20 categories
                            filtered_df = df[df[x_axis] == category]
                            if not filtered_df.empty:
                                data_point = {"name": str(category)}
                                
                                for y_col in y_axis:
                                    if y_col in filtered_df.columns:
                                        if pd.api.types.is_numeric_dtype(filtered_df[y_col]):
                                            data_point[y_col] = float(filtered_df[y_col].mean())
                                
                                # Only add non-empty data points
                                if len(data_point) > 1:
                                    chart_data.append(data_point)
                
                elif viz_type == "scatter":
                    # Check if custom data is provided
                    result_key = viz_spec.get("data_key")
                    if result_key and result_key in analysis_result:
                        chart_data = analysis_result[result_key]
                    elif x_axis and y_axis and len(y_axis) > 0:
                        if x_axis in df.columns and y_axis[0] in df.columns:
                            for idx, row in df.iterrows():
                                if pd.notna(row[x_axis]) and pd.notna(row[y_axis[0]]):
                                    try:
                                        data_point = {
                                            "x": float(row[x_axis]),
                                            "y": float(row[y_axis[0]]),
                                            "name": str(idx)
                                        }
                                        chart_data.append(data_point)
                                    except:
                                        pass
                
                elif viz_type == "pie":
                    # Check if custom data is provided
                    result_key = viz_spec.get("data_key")
                    if result_key and result_key in analysis_result:
                        chart_data = analysis_result[result_key]
                    elif x_axis and y_axis and len(y_axis) > 0:
                        if x_axis in df.columns and y_axis[0] in df.columns:
                            grouped = df.groupby(x_axis)[y_axis[0]].sum().reset_index()
                            
                            for _, row in grouped.iterrows():
                                if pd.notna(row[y_axis[0]]):
                                    chart_data.append({
                                        "name": str(row[x_axis]),
                                        "value": float(row[y_axis[0]])
                                    })
                
                elif viz_type == "heatmap":
                    # Check if custom data is provided
                    result_key = viz_spec.get("data_key")
                    if result_key and result_key in analysis_result:
                        chart_data = analysis_result[result_key]
                    elif "correlation_data" in analysis_result:
                        # Use pre-calculated correlation data
                        chart_data = analysis_result["correlation_data"]
                    elif x_axis and y_axis and len(y_axis) > 1:
                        # Try to create a cross-tabulation
                        pivot = pd.pivot_table(
                            df, 
                            values=y_axis[0], 
                            index=x_axis, 
                            columns=y_axis[1],
                            aggfunc='mean'
                        ).fillna(0)
                        
                        # Convert to format needed for heatmap
                        for idx_val in pivot.index:
                            for col_val in pivot.columns:
                                chart_data.append({
                                    "x": str(idx_val),
                                    "y": str(col_val),
                                    "value": float(pivot.loc[idx_val, col_val])
                                })
            
            except Exception as e:
                print(f"Error generating chart data for {title}: {str(e)}")
                continue
            
            # Only add charts with data
            if chart_data:
                chart_config["data"] = chart_data
                chart_configs.append(chart_config)
        
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
        response = self.openai_client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {"role": "system", "content": "You are a statistical interpreter who explains results clearly to non-experts."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.3,
            max_tokens=800
        )
        
        return response.choices[0].message.content
    
    async def _generate_basic_analysis(self, df: pd.DataFrame, user_message: str, 
                                    source_sheet_id: str, target_sheet_id: str) -> Dict[str, Any]:
        """Generate a basic analysis when detailed analysis is not possible."""
        # Create a basic profile of the DataFrame
        numeric_cols = df.select_dtypes(include=['number']).columns.tolist()
        categorical_cols = [col for col in df.columns if col not in numeric_cols]
        
        # Basic stats for numeric columns
        numeric_stats = {}
        for col in numeric_cols[:5]:  # Limit to first 5 columns
            try:
                numeric_stats[col] = {
                    "mean": float(df[col].mean()) if not pd.isna(df[col].mean()) else None,
                    "min": float(df[col].min()) if not pd.isna(df[col].min()) else None,
                    "max": float(df[col].max()) if not pd.isna(df[col].max()) else None
                }
            except:
                pass
        
        # Value counts for categorical columns
        categorical_stats = {}
        for col in categorical_cols[:3]:  # Limit to first 3 columns
            try:
                top_values = df[col].value_counts().head(3).to_dict()
                categorical_stats[col] = {str(k): int(v) for k, v in top_values.items()}
            except:
                pass
        
        # Create prompt for basic analysis
        prompt = f"""
        The user asked: "{user_message}"
        
        I need to provide a helpful response based on some basic data analysis. 
        
        DATA SUMMARY:
        - {len(df)} rows of data
        - Numeric columns: {numeric_cols}
        - Categorical columns: {categorical_cols}
        
        BASIC STATS:
        {json.dumps(numeric_stats, indent=2)}
        
        CATEGORICAL DISTRIBUTIONS:
        {json.dumps(categorical_stats, indent=2)}
        
        Please provide a friendly, helpful response that:
        1. Focuses on sharing basic insights from the data
        2. Acknowledges we're providing a general overview
        3. Makes relevant observations about patterns, ranges, or distributions
        4. DOES NOT mention any errors or technical issues
        5. Suggests what might be interesting to further explore in the data
        
        Keep your response conversational and helpful.
        """
        
        # Get basic analysis from OpenAI
        response = self.openai_client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {"role": "system", "content": "You are a helpful data analysis assistant that provides useful insights from basic data."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.4,
            max_tokens=800
        )
        
        # Generate a simple chart if possible
        chart_configs = []
        if numeric_cols and categorical_cols:
            # Create a simple bar chart of a numeric column by a categorical column
            y_col = numeric_cols[0]
            x_col = categorical_cols[0]
            
            try:
                # Get top categories
                top_categories = df[x_col].value_counts().head(10).index.tolist()
                
                # Prepare chart data
                chart_data = []
                for category in top_categories:
                    filtered_df = df[df[x_col] == category]
                    if not filtered_df.empty:
                        chart_data.append({
                            "name": str(category),
                            y_col: float(filtered_df[y_col].mean())
                        })
                
                if chart_data:
                    chart_configs.append({
                        "type": "bar",
                        "title": f"Average {y_col} by {x_col}",
                        "subtitle": "Data Overview",
                        "sourceSheetId": source_sheet_id,
                        "targetSheetId": target_sheet_id,
                        "colors": ["#4e79a7", "#f28e2b", "#59a14f"],
                        "data": chart_data
                    })
            except Exception as e:
                print(f"Error creating basic chart: {str(e)}")
        
        # Return the basic analysis
        return {
            "text": response.choices[0].message.content,
            "analysisType": "Statistical Overview",
            "chartConfigs": chart_configs,
            "sourceSheetId": source_sheet_id,
            "operation": "statistical",
            "metadata": {
                "rows_analyzed": len(df),
                "columns_analyzed": len(df.columns),
                "basic_analysis": True
            }
        }
    
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
                return {
                    "text": "I couldn't perform statistical analysis because the data appears to be empty or invalid.",
                    "analysisType": "Statistical Analysis",
                    "sourceSheetId": primary_sheet_id,
                    "operation": "statistical"
                }
            
            # Generate comprehensive data profile
            data_profile = self._generate_data_profile(df)
            
            # Create and execute statistical analysis
            analysis_package = await self._create_statistical_analysis(request.message, df, data_profile)
            
            # Check for analysis type
            if analysis_package.get("analysis_type") == "none":
                # Fall back to basic analysis
                return await self._generate_basic_analysis(df, request.message, primary_sheet_id, target_sheet_id)
            
            # Execute the analysis code
            analysis_result = self._execute_analysis(analysis_package["implementation"], df)
            
            # Check if analysis was successful
            if "error" in analysis_result and not any(k for k in analysis_result.keys() if k != "error" and k != "traceback"):
                # Analysis failed completely, use basic analysis
                print(f"Analysis failed: {analysis_result.get('error')}")
                return await self._generate_basic_analysis(df, request.message, primary_sheet_id, target_sheet_id)
            
            # Generate chart configurations
            chart_configs = self._generate_chart_configs(
                analysis_result,
                analysis_package.get("visualizations", []),
                df,
                primary_sheet_id,
                target_sheet_id
            )
            
            # Generate interpretation
            interpretation = await self._generate_interpretation(
                request.message,
                analysis_package.get("analysis_type", "Statistical Analysis"),
                analysis_result,
                analysis_package.get("interpretation_guide", "")
            )
            
            # Return the final response
            print(f"Chart configs: {len(chart_configs)}")
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
            
            # Get a basic analysis as fallback
            try:
                return await self._generate_basic_analysis(
                    df if 'df' in locals() and not df.empty else pd.DataFrame(),
                    request.message,
                    primary_sheet_id,
                    request.explicitTargetSheetId or request.activeSheetId
                )
            except Exception as fallback_error:
                print(f"Error generating fallback response: {str(fallback_error)}")
                
                # Last resort fallback
                return {
                    "text": "I've looked at your data but encountered some challenges with the analysis. Could you provide more specific details about what statistical information you'd like to learn from this dataset?",
                    "analysisType": "Statistical Analysis",
                    "sourceSheetId": primary_sheet_id,
                    "operation": "statistical",
                    "metadata": {
                        "error": True,
                        "error_message": str(e)
                    }
                }