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

        1. analysis_type: The main type of statistical analysis needed (e.g., 'descriptive', 'correlation', 'hypothesis_testing', 'regression', 'time_series', 'comparative')
        
        2. analysis_plan: A detailed description of what you'll analyze and how you'll approach it
        
        3. implementation: Python code that performs the analysis using pandas, numpy, scipy, etc.
        - Handle missing values, outliers, and other data issues
        - Create a dictionary called 'analysis_result' with ALL findings
        - Include comprehensive error handling
        - IMPORTANT: When working with date/datetime columns:
            - Don't use them directly in aggregation functions (sum, mean, etc.)
            - For time-based analysis, use the derived columns (e.g., Date_year, Date_month) that are automatically created
            - Use appropriate datetime methods like df['Date'].dt.month when needed
        - IMPORTANT: For safety, use the provided safe_groupby_agg function for any groupby operations:
            safe_groupby_agg(df, ['groupby_column'], {{'value_column': 'mean'}})
        - IMPORTANT: When the user asks for "best" or "worst" statistics, ALWAYS include:
            - The complete dataset with all values (e.g., all regions, all products, etc.)
            - The top/bottom N items (at least 3-5) with their values
            - Overall statistics (mean, median, etc.) for comparison
            - Context for why these are considered "best" or "worst"
        - CRITICAL: ALWAYS provide comprehensive result sets, not just single data points
        - DO NOT include markdown formatting (```python) in your code
        
        4. interpretation_guide: Guidelines on how to interpret the results, including:
        - How to understand comparative metrics (what makes a value "good" or "bad")
        - How to interpret trends, patterns, or anomalies
        - Key relationships to look for in the data
        - Potential business or practical implications

        Here's an example implementation for a comprehensive analysis of sales performance:
        
        # Ensure numeric columns
        df['Revenue'] = pd.to_numeric(df['Revenue'], errors='coerce')
        df['Profit'] = pd.to_numeric(df['Profit'], errors='coerce')
        df['Units'] = pd.to_numeric(df['Units'], errors='coerce')
        
        # Calculate key metrics by region
        region_performance = safe_groupby_agg(df, ['Region'], {{
            'Revenue': 'sum',
            'Profit': 'sum',
            'Units': 'sum'
        }})
        
        # Calculate key metrics by product
        product_performance = safe_groupby_agg(df, ['Product'], {{
            'Revenue': 'sum',
            'Profit': 'sum',
            'Units': 'sum'
        }})
        
        # Initialize the result dictionary
        analysis_result = {{
            'summary_statistics': {{}},
            'regional_analysis': None,
            'product_analysis': None,
            'top_performers': {{}},
            'bottom_performers': {{}},
            'overall_metrics': {{}}
        }}
        
        # Process region performance data
        if region_performance is not None:
            # Calculate profit margin
            region_performance['Profit_Margin'] = (region_performance['Profit'] / region_performance['Revenue'] * 100).round(2)
            region_performance['Revenue_per_Unit'] = (region_performance['Revenue'] / region_performance['Units']).round(2)
            
            # Sort by profit margin
            region_by_margin = region_performance.sort_values('Profit_Margin', ascending=False)
            
            # Get top and bottom regions by margin
            top_margin_regions = region_by_margin.head(3).to_dict('records')
            bottom_margin_regions = region_by_margin.tail(3).to_dict('records')
            
            # Store in result
            analysis_result['regional_analysis'] = region_performance.to_dict('records')
            analysis_result['top_performers']['by_profit_margin'] = top_margin_regions
            analysis_result['bottom_performers']['by_profit_margin'] = bottom_margin_regions
            
            # Calculate overall metrics
            analysis_result['overall_metrics']['avg_profit_margin'] = region_performance['Profit_Margin'].mean()
            analysis_result['overall_metrics']['total_revenue'] = region_performance['Revenue'].sum()
            analysis_result['overall_metrics']['total_profit'] = region_performance['Profit'].sum()
            
            # Add highest and lowest values for quick reference
            analysis_result['top_performers']['highest_margin_region'] = top_margin_regions[0]['Region']
            analysis_result['top_performers']['highest_margin_value'] = top_margin_regions[0]['Profit_Margin']
            analysis_result['bottom_performers']['lowest_margin_region'] = bottom_margin_regions[0]['Region']
            analysis_result['bottom_performers']['lowest_margin_value'] = bottom_margin_regions[0]['Profit_Margin']
        
        # Process product performance data
        if product_performance is not None:
            # Calculate metrics
            product_performance['Profit_per_Unit'] = (product_performance['Profit'] / product_performance['Units']).round(2)
            
            # Sort by profit per unit
            product_by_profit = product_performance.sort_values('Profit_per_Unit', ascending=False)
            
            # Get top and bottom products
            top_profit_products = product_by_profit.head(3).to_dict('records')
            bottom_profit_products = product_by_profit.tail(3).to_dict('records')
            
            # Store in result
            analysis_result['product_analysis'] = product_performance.to_dict('records')
            analysis_result['top_performers']['by_profit_per_unit'] = top_profit_products
            analysis_result['bottom_performers']['by_profit_per_unit'] = bottom_profit_products
        
        # Process region-product performance data
        if region_product_performance is not None:
            analysis_result['regional_product_analysis'] = region_product_performance.to_dict('records')
            
            # Get top products per region
            for region in df['Region'].unique():
                # Filter the grouped data for the current region using regular column access
                region_data = region_product_performance[region_product_performance['Region'] == region]
                region_data = region_data.sort_values('Profit', ascending=False)
                top_products = region_data.head(3)
                analysis_result['top_products_per_region'][region] = top_products[['Product', 'Revenue', 'Profit', 'Units']].to_dict('records')

        # Add basic statistics for numeric columns
        numeric_columns = ['Revenue', 'Profit', 'Units']
        for col in numeric_columns:
            if col in df.columns:
                analysis_result['summary_statistics'][col] = {{
                    'mean': df[col].mean(),
                    'median': df[col].median(),
                    'std': df[col].std(),
                    'min': df[col].min(),
                    'max': df[col].max(),
                    'q1': df[col].quantile(0.25),
                    'q3': df[col].quantile(0.75)
                }}

        IMPORTANT SAFETY CHECKS:
            - ALWAYS check if a function return value is None before using it
            - Especially for safe_groupby_agg function which may return None
            - Example: result = safe_groupby_agg(...); if result is not None: # then use result
            - Always provide complete result sets, not just single values
            - Include both summary metrics AND detailed records for complete analysis
            - When asked for "best" or "worst", include BOTH the extreme values AND the full dataset

        REMEMBER: The data is already loaded as a DataFrame named 'df'. DO NOT attempt to load or create a new DataFrame.

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
            # Handle invalid JSON response (this is a basic error handler, not a fallback)
            print("Error: OpenAI returned invalid JSON")
            return {
                "analysis_type": "error",
                "error": "Failed to parse API response"
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
                                source_sheet_id: str, target_sheet_id: str, original_request: str) -> List[Dict[str, Any]]:
        """Generate visualizations based on analysis results as Plotly HTML instead of chart configs."""
        
        # Get a sample of the dataframe and column types for context
        df_sample = df.head(3).to_dict('records')
        column_types = {col: str(df[col].dtype) for col in df.columns}
        
        # Columns categorized by type for better prompting
        numeric_columns = df.select_dtypes(include=['number']).columns.tolist()
        categorical_columns = df.select_dtypes(include=['object', 'category']).columns.tolist()
        date_columns = df.select_dtypes(include=['datetime']).columns.tolist()
        
        # Create visualization prompt with rich examples
        prompt = f"""
        You are a data visualization expert. I need you to create visualization recommendations based on this dataset.

        USER REQUEST: "{original_request}"

        DATASET INFORMATION:
        - Numeric columns: {numeric_columns}
        - Categorical columns: {categorical_columns}
        - Date/time columns: {date_columns}
        - Sample rows: {df_sample}
        - Total rows: {len(df)}
        
        ANALYSIS RESULTS:
        ```json
        {json.dumps(analysis_result, default=str, indent=2)}
        ```

        Create 2-3 visualizations that best answer the user's request. Each visualization should focus on ONE clear insight.

        # VISUALIZATION GUIDELINES:
        1. Choose appropriate chart types:
        - Use BAR charts for comparing categories
        - Use LINE charts for trends over time
        - Use SCATTER charts for relationships between variables
        - Use PIE charts only for parts of a whole (limit to max 6-7 slices)
        - Use HORIZONTAL BAR charts when dealing with long category names
        
        2. Data transformations:
        - For category comparisons: Group and aggregate data properly
        - For "top N" analysis: Sort and slice the data
        - For complex comparisons: Create new calculated columns if needed
        
        3. For each visualization provide:
        - A clear, insight-focused title (e.g., "Revenue Increased 25% in Q4 2023" NOT "Revenue by Quarter")
        - A description of what insight the chart reveals
        - Which chart type to use and why
        - Complete Python code for data transformation that outputs a DataFrame named 'result_df'
        
        # EXAMPLES OF GOOD VISUALIZATIONS:
        
        Example 1 (Top categories):
        ```
        {
        "title": "Chairs Generate 3x More Profit than Other Furniture Items",
        "description": "Shows that chairs are the dominant profit generator in the Furniture category",
        "chartType": "bar",
        "dataFields": {
            "x": "Sub-Category",
            "y": "Profit",
            "color": "Category"
        },
        "dataTransformationCode": "# Get top sub-category by profit for each category\\ncategory_subcat_profit = df.groupby(['Category', 'Sub-Category'])['Profit'].sum().reset_index()\\ntop_subcats = category_subcat_profit.sort_values('Profit', ascending=False).groupby('Category').head(1)\\nresult_df = top_subcats.sort_values('Profit', ascending=False)"
        }
        ```
        
        Example 2 (Time trend):
        ```
        {
        "title": "Sales Doubled in Q4 Compared to Q1 Across All Regions",
        "description": "Reveals a strong seasonal pattern with Q4 consistently outperforming other quarters",
        "chartType": "line",
        "dataFields": {
            "x": "Quarter",
            "y": "Sales",
            "color": "Region"
        },
        "dataTransformationCode": "# Create quarterly trend by region\\ndf['Quarter'] = pd.PeriodIndex(df['Order Date'], freq='Q')\\nresult_df = df.groupby(['Quarter', 'Region'])['Sales'].sum().reset_index()\\nresult_df['Quarter'] = result_df['Quarter'].astype(str)"
        }
        ```
        
        # COMMON MISTAKES TO AVOID:
        - DON'T include too many categories (limit to top 5-7 for readability)
        - DON'T try to show too many metrics in one chart
        - DON'T use pie charts for more than 7 categories
        - DON'T forget to sort data in a meaningful way
        - DON'T use line charts for categorical data
        - DON'T create misleading aggregations or comparisons
        
        Return a JSON object with a "visualizations" array. Each element should contain title, description, chartType, dataFields and dataTransformationCode.
        """

        # Get visualization recommendations from OpenAI
        response = self.client.chat.completions.create(
            model=self.model,
            messages=[
                {"role": "system", "content": "You are a data visualization expert. Return only valid JSON with detailed visualization specs."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.2,
            response_format={"type": "json_object"}
        )

        print("VISUALIZATION SPECS:")
        print(response.choices[0].message.content)

        # Parse the visualization configurations
        viz_configs_response = json.loads(response.choices[0].message.content)
        viz_configs = viz_configs_response.get("visualizations", [])
        
        chart_outputs = []
        for viz_config in viz_configs:
            try:
                title = viz_config.get("title", "Chart")
                description = viz_config.get("description", "")
                chart_type = viz_config.get("chartType", "bar")
                data_fields = viz_config.get("dataFields", {})
                
                # Execute the data transformation code
                local_scope = {"df": df.copy(), "pd": pd, "np": np}
                exec(viz_config["dataTransformationCode"], local_scope)
                result_df = local_scope.get("result_df")

                if result_df is None or result_df.empty:
                    print(f"Warning: No result_df produced for visualization '{title}'")
                    continue
                    
                # Map fields from the configuration
                x_column = data_fields.get("x")
                y_columns = [data_fields.get("y")] if data_fields.get("y") else []
                if data_fields.get("y_multi"):
                    y_columns = data_fields.get("y_multi")
                color_column = data_fields.get("color")
                size_column = data_fields.get("size")
                
                # Generate the plotly chart
                chart_html = self._create_plotly_chart(
                    result_df, 
                    chart_type,
                    title,
                    x_column,
                    y_columns,
                    color_column,
                    size_column,
                    description
                )
                
                # Add to output
                chart_outputs.append({
                    "title": title,
                    "description": description,
                    "htmlContent": chart_html,
                    "sourceSheetId": source_sheet_id,
                    "targetSheetId": target_sheet_id
                })
                
            except Exception as e:
                print(f"Error generating chart '{viz_config.get('title', 'unknown')}': {str(e)}")
                traceback.print_exc()
                
                # Add error visualization
                error_html = f"""
                <div style="width:100%;height:300px;border:1px solid #ddd;border-radius:4px;padding:20px;background:#f9f9f9;">
                    <h3 style="color:#d32f2f;margin-top:0">Error Creating Chart</h3>
                    <p>We encountered a problem while generating this visualization:</p>
                    <pre style="background:#f1f1f1;padding:10px;border-radius:4px;font-size:12px;overflow:auto">
                        {str(e)}
                    </pre>
                </div>
                """
                
                chart_outputs.append({
                    "title": viz_config.get("title", "Chart Error"),
                    "description": "Error creating visualization",
                    "htmlContent": error_html,
                    "sourceSheetId": source_sheet_id,
                    "targetSheetId": target_sheet_id,
                    "error": str(e)
                })
        
        return chart_outputs
    
    def _create_plotly_chart(self, df, chart_type, title, x_column, y_columns=None, 
                            color_column=None, size_column=None, description=None):
        """
        Create a Plotly chart and return it as HTML.
        
        Args:
            df: Pandas DataFrame with the data to visualize
            chart_type: Type of chart to create (bar, line, pie, scatter, etc.)
            title: Chart title
            x_column: Column to use for x-axis
            y_columns: List of columns to use for y-axis
            color_column: Column to use for color encoding
            size_column: Column to use for size encoding (scatter plots)
            description: Optional description to show under the title
            
        Returns:
            HTML string with the Plotly chart
        """
        import plotly.express as px
        import plotly.io as pio
        import plotly.graph_objects as go
        from plotly.subplots import make_subplots
        
        # Ensure y_columns is a list
        if y_columns is None:
            y_columns = []
        elif isinstance(y_columns, str):
            y_columns = [y_columns]
        
        # Function to detect if we should use horizontal bar chart
        def should_use_horizontal_bar():
            if not x_column or x_column not in df.columns:
                return False
                
            # Use horizontal bars for categorical x-axis with many or long categories
            if df[x_column].dtype == 'object' or df[x_column].dtype.name == 'category':
                if len(df) > 5:  # More than 5 categories
                    return True
                    
                # Check for long category names
                avg_len = df[x_column].astype(str).str.len().mean()
                return avg_len > 10  # Long category names
                
            return False
        
        # Default figure settings
        width, height = 800, 500
        template = "plotly_white"  # Clean white template
        
        try:
            # Detect if we need value formatting based on column naming conventions
            currency_columns = [col for col in df.columns if any(term in col.lower() for term in 
                            ['price', 'revenue', 'sales', 'profit', 'cost', 'margin', 'income'])]
            
            percentage_columns = [col for col in df.columns if any(term in col.lower() for term in 
                                ['percent', 'rate', 'ratio', 'margin'])]
            
            # Create various chart types
            if chart_type.lower() in ['bar', 'column', 'histogram']:
                # Determine if we should use horizontal bar layout
                horizontal = should_use_horizontal_bar()
                orientation = 'h' if horizontal else 'v'
                
                # Check for stacked option (from title or description)
                stacked = any(['stack' in title.lower(), 'stack' in (description or '').lower()])
                bar_mode = 'stack' if stacked else 'group'
                
                # Single y-column or multiple y-columns approach
                if len(y_columns) <= 1 and color_column:
                    # Use color for groups
                    y_col = y_columns[0] if y_columns else df.columns[1]
                    
                    if horizontal:
                        fig = px.bar(
                            df, 
                            x=y_col, 
                            y=x_column, 
                            color=color_column,
                            title=title,
                            orientation='h',
                            barmode=bar_mode,
                            text=y_col if len(df) <= 15 else None  # Only show text for smaller datasets
                        )
                    else:
                        fig = px.bar(
                            df, 
                            x=x_column, 
                            y=y_col, 
                            color=color_column,
                            title=title,
                            barmode=bar_mode,
                            text=y_col if len(df) <= 15 else None
                        )
                elif len(y_columns) > 1:
                    # Multiple metrics - use each as a series
                    fig = go.Figure()
                    
                    for i, y_col in enumerate(y_columns):
                        fig.add_trace(go.Bar(
                            x=df[x_column] if not horizontal else df[y_col],
                            y=df[y_col] if not horizontal else df[x_column],
                            name=y_col,
                            orientation=orientation,
                            text=df[y_col] if len(df) <= 15 else None,
                            textposition='outside'
                        ))
                    
                    fig.update_layout(
                        title=title,
                        barmode=bar_mode
                    )
                else:
                    # Simple bar chart
                    y_col = y_columns[0] if y_columns else df.columns[1]
                    
                    if horizontal:
                        fig = px.bar(
                            df, 
                            x=y_col, 
                            y=x_column, 
                            title=title,
                            orientation='h',
                            text=y_col if len(df) <= 15 else None
                        )
                    else:
                        fig = px.bar(
                            df, 
                            x=x_column, 
                            y=y_col, 
                            title=title,
                            text=y_col if len(df) <= 15 else None
                        )
                
                # Adjust text display for currency/percentage columns
                for i, y_col in enumerate(y_columns or [df.columns[1]]):
                    if y_col in currency_columns:
                        text_template = '$%{text:.1f}'
                    elif y_col in percentage_columns:
                        text_template = '%{text:.1f}%'
                    else:
                        text_template = '%{text:.1f}'
                    
                    fig.update_traces(
                        texttemplate=text_template,
                        textposition='outside',
                        selector=dict(name=y_col)
                    )
                
                # Add better margin for horizontal bar charts
                if horizontal:
                    fig.update_layout(
                        margin=dict(l=150 if len(df[x_column].astype(str).max()) > 10 else 100, r=50, t=100, b=50)
                    )
                
            elif chart_type.lower() == 'line':
                # Check for time series
                is_timeseries = False
                if x_column and x_column in df.columns:
                    if pd.api.types.is_datetime64_any_dtype(df[x_column]):
                        is_timeseries = True
                    elif df[x_column].dtype == 'object' and all(pd.to_datetime(df[x_column], errors='coerce').notna()):
                        # Try to convert to datetime
                        df[x_column] = pd.to_datetime(df[x_column])
                        is_timeseries = True
                
                if color_column:
                    fig = px.line(
                        df, 
                        x=x_column, 
                        y=y_columns[0] if y_columns else df.columns[1],
                        color=color_column,
                        title=title,
                        markers=True
                    )
                elif len(y_columns) > 1:
                    # Multiple lines
                    fig = px.line(
                        df, 
                        x=x_column, 
                        y=y_columns,
                        title=title,
                        markers=True
                    )
                else:
                    y_col = y_columns[0] if y_columns else df.columns[1]
                    fig = px.line(
                        df, 
                        x=x_column, 
                        y=y_col,
                        title=title,
                        markers=True
                    )
                
                # Improve time series display
                if is_timeseries:
                    fig.update_xaxes(
                        rangeslider_visible=False,
                        tickformatstops=[
                            dict(dtickrange=[None, 1000], value="%H:%M:%S.%L ms"),
                            dict(dtickrange=[1000, 60000], value="%H:%M:%S"),
                            dict(dtickrange=[60000, 3600000], value="%H:%M"),
                            dict(dtickrange=[3600000, 86400000], value="%H:%M"),
                            dict(dtickrange=[86400000, 604800000], value="%e %b"),
                            dict(dtickrange=[604800000, "M1"], value="%e %b"),
                            dict(dtickrange=["M1", "M12"], value="%b '%y"),
                            dict(dtickrange=["M12", None], value="%Y")
                        ]
                    )
                    
            elif chart_type.lower() == 'pie':
                # Force a reasonable limit on pie chart slices
                if len(df) > 8:
                    # Combine smaller slices into "Other"
                    y_col = y_columns[0] if y_columns else df.columns[1]
                    df = df.sort_values(y_col, ascending=False).reset_index(drop=True)
                    
                    top_rows = df.iloc[:7].copy()
                    other_sum = df.iloc[7:][y_col].sum()
                    
                    other_row = pd.DataFrame({
                        x_column: ['Other'],
                        y_col: [other_sum]
                    })
                    
                    if color_column and color_column in df.columns:
                        other_row[color_column] = ['Other']
                        
                    df = pd.concat([top_rows, other_row], ignore_index=True)
                
                fig = px.pie(
                    df, 
                    values=y_columns[0] if y_columns else df.columns[1],
                    names=x_column,
                    title=title,
                    color=color_column if color_column and color_column != x_column else None
                )
                
                # Improve pie chart display
                fig.update_traces(
                    textposition='inside',
                    textinfo='percent+label',
                    hole=0.4,  # Make it a donut chart for better readability
                    pull=[0.05 if i == 0 else 0 for i in range(len(df))],  # Pull out the first slice
                    marker=dict(line=dict(color='white', width=2))
                )
                
            elif chart_type.lower() == 'scatter':
                # Default size column if using bubble chart
                if len(y_columns) > 1 and not size_column:
                    size_column = y_columns[1]
                    
                fig = px.scatter(
                    df,
                    x=x_column,
                    y=y_columns[0] if y_columns else df.columns[1],
                    color=color_column,
                    size=size_column,
                    title=title,
                    hover_name=df.index if len(df.index.names) == 1 else None
                )
                
                # Add trendline for interesting relationships
                if size_column is None and color_column is None:
                    fig.update_layout(
                        shapes=[{
                            'type': 'line',
                            'x0': df[x_column].min(),
                            'y0': df[y_columns[0] if y_columns else df.columns[1]].min(),
                            'x1': df[x_column].max(),
                            'y1': df[y_columns[0] if y_columns else df.columns[1]].max(),
                            'line': {
                                'color': 'rgba(100, 100, 100, 0.5)',
                                'width': 1,
                                'dash': 'dot'
                            }
                        }]
                    )
                    
            elif chart_type.lower() == 'heatmap':
                # Create a pivot table for heatmap
                if len(y_columns) > 0 and x_column and color_column:
                    pivot_df = df.pivot_table(
                        values=y_columns[0],
                        index=x_column,
                        columns=color_column,
                        aggfunc='mean'
                    ).fillna(0)
                    
                    fig = px.imshow(
                        pivot_df,
                        title=title,
                        labels=dict(x=color_column, y=x_column, color=y_columns[0]),
                        text_auto='.1f'
                    )
                else:
                    # Not enough dimensions specified
                    fig = go.Figure()
                    fig.update_layout(
                        title=title,
                        annotations=[{
                            'text': 'Not enough dimensions for heatmap',
                            'showarrow': False,
                            'font': {'size': 20}
                        }]
                    )
                    
            else:
                # Fallback for unknown chart types
                fig = px.bar(
                    df,
                    x=x_column if x_column else df.columns[0],
                    y=y_columns[0] if y_columns else df.columns[1],
                    title=f"{title} (Fallback Bar Chart)"
                )

            # Add subtitle/description if provided
            if description:
                fig.update_layout(
                    title={
                        'text': f"{title}<br><sup>{description}</sup>",
                        'y':0.95,
                        'x':0.5,
                        'xanchor': 'center',
                        'yanchor': 'top'
                    }
                )
                
            # Common layout improvements
            fig.update_layout(
                width=width,
                height=height,
                template=template,
                legend={'orientation': 'h', 'y': -0.15} if len(df.columns) > 3 else None,
                margin=dict(l=50, r=30, t=100, b=100)
            )
            
            # Add special handling for currency/percentage y-axis
            for i, y_col in enumerate(y_columns or [df.columns[1]]):
                if y_col in currency_columns:
                    fig.update_yaxes(tickprefix='$', tickformat=',.1f')
                elif y_col in percentage_columns:
                    fig.update_yaxes(ticksuffix='%', tickformat='.1f')
            
            # Convert to HTML string
            html_str = pio.to_html(
                fig, 
                full_html=False, 
                include_plotlyjs='cdn',
                config={
                    'responsive': True,
                    'displayModeBar': True,
                    'modeBarButtonsToRemove': ['select2d', 'lasso2d'],
                    'toImageButtonOptions': {
                        'format': 'png',
                        'filename': title.replace(' ', '_'),
                        'height': height,
                        'width': width,
                        'scale': 2
                    }
                }
            )
            
            return html_str
            
        except Exception as e:
            print(f"Error creating plotly chart: {str(e)}")
            traceback.print_exc()
            # Return a simple error message as HTML
            return f"""
            <div style="width:100%;height:400px;border:1px solid #ddd;padding:20px;display:flex;flex-direction:column;justify-content:center;align-items:center;background:#f9f9f9;">
                <h3 style="color:#d32f2f;margin-bottom:15px">{title}</h3>
                <div style="text-align:center;max-width:80%;">
                    <p>There was an error creating this visualization:</p>
                    <div style="background:#f1f1f1;padding:10px;border-radius:4px;margin:10px 0;text-align:left;font-family:monospace;overflow:auto">
                        {str(e)}
                    </div>
                    <p>Please try a different visualization type or check your data.</p>
                </div>
            </div>
            """
    
    async def _generate_tables(self, analysis_result: Dict[str, Any], df: pd.DataFrame, 
                                source_sheet_id: str, target_sheet_id: str, original_request: str) -> List[Dict[str, Any]]:
        """Generate tabular data representations based on analysis results.
        
        This function creates structured tables from analysis results to provide clear,
        organized views of the data that complement visualizations.
        
        Args:
            analysis_result: Dictionary containing the results of statistical analysis
            df: The original DataFrame used in the analysis
            source_sheet_id: ID of the sheet containing source data
            target_sheet_id: ID of the sheet where tables will be displayed
            original_request: The user's original query text
            
        Returns:
            List of table configurations including data transformations and presentation settings
        """
        # Create table generation prompt
        prompt = f"""
            You are a data presentation expert. Based on the following analysis results, create appropriate tabular presentations.

            Original USER REQUEST: "{original_request}"

            ANALYSIS RESULTS:
            ```json
            {json.dumps(analysis_result, default=str, indent=2)}
            ```

            DATAFRAME INFO:
            - Columns: {df.columns.tolist()}
            - Sample data: {df.head().to_dict()}

            Create a JSON array of table configurations. Each configuration should have:
            {{
                "title": "Table title",
                "description": "Brief description of what this table shows",
                "dataTransformationCode": "Python code to transform data for tabular presentation",
                "columns": ["List of column names to include"],
                "sortBy": "Column to sort by (optional)",
                "sortDirection": "asc or desc (optional)",
                "format": {{
                    "numberFormat": "options: 'currency', 'percent', 'number', or custom format string",
                    "highlightConditions": [
                        {{
                            "column": "column_name",
                            "condition": "condition_type (greater_than, less_than, equals, top_n, bottom_n)",
                            "value": "threshold value",
                            "style": "highlight_style (positive, negative, neutral)"
                        }}
                    ]
                }}
            }}

            The dataTransformationCode should transform the DataFrame (named df) and assign the result to result_df.
            Include any necessary aggregations, sorting, filtering, or calculations to present the most relevant insights.
            
            IMPORTANT GUIDELINES:
            1. Create tables that answer the user's query directly
            2. Prioritize presenting actionable insights rather than raw data
            3. For each key finding in the analysis, create a focused table (e.g., "Top Performers", "Trend Summary")
            4. Limit tables to relevant columns only (5-7 columns maximum for readability)
            5. Include summary rows where appropriate (totals, averages)
            6. Format numbers appropriately (currency, percentages, etc.)
            7. In your dataTransformationCode, directly access the df variable or analysis_result keys, NOT 'data'
            8. Tables should complement the visualizations, not duplicate them
            9. Each table should tell a specific part of the overall data story
            
            For example transformation code:
            ```python
            # For a summary table of key metrics by region
            if 'regional_analysis' in analysis_result:
                region_data = pd.DataFrame(analysis_result['regional_analysis'])
                # Select only the most important columns
                result_df = region_data[['Region', 'Revenue', 'Profit', 'Units', 'Profit_Margin']]
                # Sort by highest profit margin
                result_df = result_df.sort_values('Profit_Margin', ascending=False)
                # Add a summary row with totals/averages
                summary_row = pd.DataFrame({{
                    'Region': ['Total/Average'],
                    'Revenue': [result_df['Revenue'].sum()],
                    'Profit': [result_df['Profit'].sum()],
                    'Units': [result_df['Units'].sum()],
                    'Profit_Margin': [result_df['Profit_Margin'].mean()]
                }})
                result_df = pd.concat([result_df, summary_row], ignore_index=True)
            else:
                # Create a summary of key statistics from the original data
                result_df = pd.DataFrame({{
                    'Metric': ['Total Revenue', 'Average Order Value', 'Total Units', 'Profit Margin'],
                    'Value': [
                        df['Revenue'].sum(),
                        df['Revenue'].sum() / len(df) if len(df) > 0 else 0,
                        df['Units'].sum(),
                        df['Profit'].sum() / df['Revenue'].sum() * 100 if df['Revenue'].sum() > 0 else 0
                    ]
                }})
            ```
            
            Use your data expertise to identify what tables would best summarize the analysis results and provide actionable insights to the user.
            """

        # Get table recommendations from OpenAI
        response = self.client.chat.completions.create(
            model=self.model,
            messages=[
                {"role": "system", "content": "You are a data presentation API. Return only valid JSON with no comments, no markdown, and no explanation."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.2,
            max_tokens=1000,
            response_format={"type": "json_object"}
        )

        print("TABLE CONFIGS:")
        print(response.choices[0].message.content)

        # Parse the table configurations
        table_configs_response = json.loads(response.choices[0].message.content)
        table_configs = table_configs_response.get("tables", [])
        if not isinstance(table_configs, list):
            table_configs = [table_configs]

        # Process each table configuration
        processed_tables = []
        for table_config in table_configs:
            try:
                # Execute the data transformation code
                local_scope = {
                    "df": df, 
                    "pd": pd, 
                    "np": np, 
                    "analysis_result": analysis_result
                }
                
                # Execute the data transformation code
                exec(table_config["dataTransformationCode"], local_scope)
                result_df = local_scope.get("result_df")

                if result_df is None or result_df.empty:
                    print(f"Warning: Empty result DataFrame for table '{table_config['title']}'")
                    continue

                # Convert result to serializable format (records)
                table_data = []
                for _, row in result_df.iterrows():
                    # Convert each cell to an appropriate type for JSON serialization
                    row_dict = {}
                    for col in result_df.columns:
                        cell_value = row[col]
                        if isinstance(cell_value, (np.int64, np.float64)):
                            row_dict[col] = float(cell_value)
                        elif pd.isna(cell_value):
                            row_dict[col] = None
                        else:
                            row_dict[col] = str(cell_value)
                    table_data.append(row_dict)

                # Get column types for formatting
                column_types = {}
                for col in result_df.columns:
                    if pd.api.types.is_numeric_dtype(result_df[col]):
                        if col.lower() in ['profit_margin', 'margin', 'percentage', 'rate', 'ratio'] or '%' in col:
                            column_types[col] = "percent"
                        elif col.lower() in ['revenue', 'sales', 'profit', 'cost', 'price', 'income', 'expense']:
                            column_types[col] = "currency"
                        else:
                            column_types[col] = "number"
                    else:
                        column_types[col] = "string"

                # Create table configuration
                processed_table = {
                    "title": table_config["title"],
                    "description": table_config.get("description", ""),
                    "data": table_data,
                    "columns": result_df.columns.tolist(),
                    "columnTypes": column_types,
                    "format": table_config.get("format", {}),
                    "sourceSheetId": source_sheet_id,
                    "targetSheetId": target_sheet_id
                }
                
                # Add optional sort information if provided
                if "sortBy" in table_config and table_config["sortBy"] in result_df.columns:
                    processed_table["sortBy"] = table_config["sortBy"]
                    processed_table["sortDirection"] = table_config.get("sortDirection", "desc")
                    
                processed_tables.append(processed_table)

            except Exception as e:
                print(f"Error generating table for {table_config.get('title', 'unknown')}: {str(e)}")
                traceback.print_exc()
                continue

        return processed_tables
        
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
            print("CODE GENERATED:\n</>\n")
            print(analysis_package["implementation"]+"\n")
            analysis_result = self._execute_analysis(analysis_package["implementation"], df)

            print("ANALYSIS RESULT:")
            print(json.dumps(analysis_result, indent=2)+"\n")
            
            # Generate visualizations - now using Plotly HTML
            chart_outputs = await self._generate_visualizations(analysis_result, df, primary_sheet_id, target_sheet_id, request.message)
            
            # Generate tables (using your existing method)
            table_configs = await self._generate_tables(analysis_result, df, primary_sheet_id, target_sheet_id, request.message)
            
            # Generate interpretation
            interpretation = await self._generate_interpretation(
                request.message,
                analysis_package.get("analysis_type", "Statistical Analysis"),
                analysis_result,
                analysis_package.get("interpretation_guide", "")
            )
            
            # Return the final response with the new chart format
            return {
                "text": interpretation,
                "analysisType": analysis_package.get("analysis_type", "Statistical Analysis"),
                "charts": chart_outputs,  # Changed from chartConfig to charts
                "tableConfig": table_configs,
                "sourceSheetId": primary_sheet_id,
                "targetSheetId": target_sheet_id,
                "operation": "statistical",
                "metadata": {
                    "rows_analyzed": len(df),
                    "columns_analyzed": len(df.columns),
                    "analysis_type": analysis_package.get("analysis_type"),
                    "chart_count": len(chart_outputs),
                    "table_count": len(table_configs)
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