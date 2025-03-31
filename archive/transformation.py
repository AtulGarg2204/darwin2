"""
Todos

PHASE 1
# Filtering
- filtering rows based on conditions
- filtering by date ranges
- filtering by categorical values

# Aggregation Operations
- grouping by columns
- applying aggregate functions (sum, mean, count, etc.)
- creatnging pivot tables (eg. show sales by region and product)

# Sorting
- complex sorting, sorting by multiple columns

# Column Operations
- creating new columns based on existing ones (eg. add a new column for profit = sales - cost)
- renaming columns
- dropping columns

"""

from typing import Dict, Any, List, Optional, Union
from openai import OpenAI
import os
import json
from fastapi import HTTPException
import pandas as pd
import re
from datetime import datetime

class DataTransformationAgent:
    def __init__(self):
        """Initialize the DataTransformationAgent with the OpenAI client."""
        self.openai_client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
    
    def infer_data_type(self, values: List[Any]) -> str:
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
                if re.match(date_pattern, v) or pd.to_datetime(v, errors='coerce') is not pd.NaT:
                    date_values.append(v)
        
        if len(date_values) == len(clean_values):
            return 'date'
        
        # Default to string
        return 'string'

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

    def _convert_dataframe_to_response(self, df: pd.DataFrame, operation_type: str, description: str) -> Dict[str, Any]:
        """Convert processed DataFrame to the expected response format."""
        # Convert DataFrame back to list format for response
        if df.empty:
            result_data = []
        else:
            # Include column headers as the first row
            headers = df.columns.tolist()
            data_rows = df.values.tolist()
            result_data = [headers] + data_rows
        
        return {
            "text": description,
            "transformedData": result_data,
            "operationType": operation_type
        }

    def apply_filter(self, df: pd.DataFrame, filter_config: Dict[str, Any]) -> pd.DataFrame:
        """Apply filtering operations to the DataFrame."""
        if df.empty or not filter_config:
            return df
        
        try:
            # Get filter conditions
            conditions = filter_config.get('conditions', [])
            
            # Apply each condition sequentially
            filtered_df = df.copy()
            for condition in conditions:
                column = condition.get('column')
                operator = condition.get('operator')
                value = condition.get('value')
                
                if not (column and operator):
                    continue
                
                # Handle different operator types
                if column not in filtered_df.columns:
                    print(f"Warning: Column {column} not found. Skipping condition.")
                    continue
                
                # Try to convert column to appropriate type based on operator and value
                if operator in ['contains', 'startsWith', 'endsWith']:
                    # String operations
                    filtered_df[column] = filtered_df[column].astype(str)
                elif operator in ['equals', 'notEquals', 'greaterThan', 'lessThan', 'greaterThanOrEqual', 'lessThanOrEqual']:
                    # If comparing with numeric value, try to convert column to numeric
                    if isinstance(value, (int, float)) or (isinstance(value, str) and value.replace('.', '', 1).isdigit()):
                        filtered_df[column] = pd.to_numeric(filtered_df[column], errors='coerce')
                        if isinstance(value, str):
                            value = float(value)
                
                # Apply the filter condition
                if operator == 'equals':
                    filtered_df = filtered_df[filtered_df[column] == value]
                elif operator == 'notEquals':
                    filtered_df = filtered_df[filtered_df[column] != value]
                elif operator == 'contains':
                    filtered_df = filtered_df[filtered_df[column].str.contains(str(value), na=False, case=False)]
                elif operator == 'startsWith':
                    filtered_df = filtered_df[filtered_df[column].str.startswith(str(value), na=False)]
                elif operator == 'endsWith':
                    filtered_df = filtered_df[filtered_df[column].str.endswith(str(value), na=False)]
                elif operator == 'greaterThan':
                    filtered_df = filtered_df[filtered_df[column] > value]
                elif operator == 'lessThan':
                    filtered_df = filtered_df[filtered_df[column] < value]
                elif operator == 'greaterThanOrEqual':
                    filtered_df = filtered_df[filtered_df[column] >= value]
                elif operator == 'lessThanOrEqual':
                    filtered_df = filtered_df[filtered_df[column] <= value]
                elif operator == 'between':
                    # For date/numeric ranges
                    min_val = condition.get('minValue')
                    max_val = condition.get('maxValue')
                    if min_val is not None and max_val is not None:
                        # If these look like dates, try to convert
                        if self.infer_data_type([min_val, max_val]) == 'date':
                            filtered_df[column] = pd.to_datetime(filtered_df[column], errors='coerce')
                            min_val = pd.to_datetime(min_val)
                            max_val = pd.to_datetime(max_val)
                        filtered_df = filtered_df[(filtered_df[column] >= min_val) & (filtered_df[column] <= max_val)]
                elif operator == 'in':
                    # For list of values
                    values = condition.get('values', [])
                    if values:
                        filtered_df = filtered_df[filtered_df[column].isin(values)]
            
            return filtered_df
        
        except Exception as e:
            print(f"Error applying filter: {str(e)}")
            import traceback
            traceback.print_exc()
            return df

    def apply_aggregation(self, df: pd.DataFrame, agg_config: Dict[str, Any]) -> pd.DataFrame:
        """Apply aggregation operations to the DataFrame."""
        if df.empty or not agg_config:
            return df
        
        try:
            # Get aggregation settings
            group_by_columns = agg_config.get('groupBy', [])
            metrics = agg_config.get('metrics', {})
            
            if not group_by_columns or not metrics:
                return df
            
            # Check if grouping columns exist
            missing_cols = [col for col in group_by_columns if col not in df.columns]
            if missing_cols:
                print(f"Warning: Missing columns for grouping: {missing_cols}")
                return df
            
            # Prepare aggregation dictionary
            agg_dict = {}
            for col, func in metrics.items():
                if col not in df.columns:
                    print(f"Warning: Column {col} not found for aggregation.")
                    continue
                
                # Convert numeric columns
                df[col] = pd.to_numeric(df[col], errors='coerce')
                
                # Set aggregation function
                if func == 'sum':
                    agg_dict[col] = 'sum'
                elif func == 'avg' or func == 'mean':
                    agg_dict[col] = 'mean'
                elif func == 'count':
                    agg_dict[col] = 'count'
                elif func == 'min':
                    agg_dict[col] = 'min'
                elif func == 'max':
                    agg_dict[col] = 'max'
                else:
                    agg_dict[col] = 'sum'  # Default
            
            # Apply groupby and aggregation
            if agg_dict:
                grouped_df = df.groupby(group_by_columns).agg(agg_dict).reset_index()
                
                # Flatten the multi-index columns if they exist
                if isinstance(grouped_df.columns, pd.MultiIndex):
                    grouped_df.columns = ['_'.join(col).strip('_') for col in grouped_df.columns.values]
                
                return grouped_df
            
            return df
        
        except Exception as e:
            print(f"Error applying aggregation: {str(e)}")
            import traceback
            traceback.print_exc()
            return df

    def apply_sort(self, df: pd.DataFrame, sort_config: Dict[str, Any]) -> pd.DataFrame:
        """Apply sorting operations to the DataFrame."""
        if df.empty or not sort_config:
            return df
        
        try:
            # Get sorting parameters
            sort_columns = sort_config.get('columns', [])
            
            if not sort_columns:
                return df
            
            # Prepare sorting parameters
            sort_cols = []
            ascending_vals = []
            
            for sort_item in sort_columns:
                column = sort_item.get('column')
                order = sort_item.get('order', 'ascending')
                
                if column and column in df.columns:
                    sort_cols.append(column)
                    ascending_vals.append(order.lower() == 'ascending')
            
            # Apply sorting if columns are valid
            if sort_cols:
                return df.sort_values(by=sort_cols, ascending=ascending_vals)
            
            return df
        
        except Exception as e:
            print(f"Error applying sort: {str(e)}")
            return df

    def apply_column_operations(self, df: pd.DataFrame, column_ops_config: Dict[str, Any]) -> pd.DataFrame:
        """Apply column operations (create, rename, drop) to the DataFrame."""
        if df.empty or not column_ops_config:
            return df
        
        result_df = df.copy()
        
        try:
            # Handle column renames
            rename_ops = column_ops_config.get('rename', [])
            rename_dict = {}
            for rename_op in rename_ops:
                old_name = rename_op.get('oldName')
                new_name = rename_op.get('newName')
                if old_name and new_name and old_name in result_df.columns:
                    rename_dict[old_name] = new_name
            
            if rename_dict:
                result_df = result_df.rename(columns=rename_dict)
            
            # Handle column drops
            drop_columns = column_ops_config.get('drop', [])
            valid_drop_columns = [col for col in drop_columns if col in result_df.columns]
            if valid_drop_columns:
                result_df = result_df.drop(columns=valid_drop_columns)
            
            # Handle new calculated columns
            new_columns = column_ops_config.get('create', [])
            for new_col in new_columns:
                column_name = new_col.get('name')
                formula = new_col.get('formula')
                
                if not column_name or not formula:
                    continue
                
                # Handle basic arithmetic operations
                # This is simplified and would need more complex parsing for a full implementation
                try:
                    # Replace column references with df['column'] syntax
                    for col in result_df.columns:
                        # Use regex to replace column names with proper pandas references
                        # This handles cases where column names are substrings of each other
                        formula = re.sub(r'\b' + re.escape(col) + r'\b', f"result_df['{col}']", formula)
                    
                    # Execute the formula
                    result_df[column_name] = eval(formula)
                except Exception as e:
                    print(f"Error creating calculated column {column_name}: {str(e)}")
            
            return result_df
        
        except Exception as e:
            print(f"Error applying column operations: {str(e)}")
            import traceback
            traceback.print_exc()
            return df

    def transform_data(self, raw_data: List[Any], transformation_config: Dict[str, Any]) -> pd.DataFrame:
        """Apply transformations to the data based on configuration."""
        if not raw_data or not transformation_config:
            return pd.DataFrame(), "No data or transformation configuration provided."
        
        try:
            # Create DataFrame
            df = self._create_dataframe_from_raw(raw_data)
            if df.empty:
                return df, "Could not create DataFrame from the provided data."
            
            # Execute transformations in sequence
            description_parts = []
            
            # 1. Apply filtering if specified
            filter_config = transformation_config.get('filter')
            if filter_config:
                before_count = len(df)
                df = self.apply_filter(df, filter_config)
                after_count = len(df)
                description_parts.append(f"Filtered data from {before_count} to {after_count} rows.")
            
            # 2. Apply column operations if specified
            column_ops_config = transformation_config.get('columnOperations')
            if column_ops_config:
                before_cols = set(df.columns)
                df = self.apply_column_operations(df, column_ops_config)
                after_cols = set(df.columns)
                
                added_cols = after_cols - before_cols
                removed_cols = before_cols - after_cols
                renamed_cols = len(column_ops_config.get('rename', []))
                
                if added_cols:
                    description_parts.append(f"Added {len(added_cols)} new column(s): {', '.join(added_cols)}.")
                if removed_cols:
                    description_parts.append(f"Removed {len(removed_cols)} column(s).")
                if renamed_cols:
                    description_parts.append(f"Renamed {renamed_cols} column(s).")
            
            # 3. Apply aggregation if specified
            agg_config = transformation_config.get('aggregation')
            if agg_config:
                before_shape = df.shape
                df = self.apply_aggregation(df, agg_config)
                after_shape = df.shape
                
                group_by_cols = agg_config.get('groupBy', [])
                if group_by_cols:
                    description_parts.append(f"Aggregated data by {', '.join(group_by_cols)}, resulting in {after_shape[0]} rows.")
            
            # 4. Apply sorting if specified
            sort_config = transformation_config.get('sort')
            if sort_config:
                df = self.apply_sort(df, sort_config)
                
                sort_columns = sort_config.get('columns', [])
                if sort_columns:
                    sort_desc = [f"{item['column']} ({item['order']})" for item in sort_columns if 'column' in item]
                    description_parts.append(f"Sorted data by {', '.join(sort_desc)}.")
            
            # Prepare the description
            if description_parts:
                transformation_description = " ".join(description_parts)
            else:
                transformation_description = "Applied transformation to the data."
            
            return df, transformation_description
        
        except Exception as e:
            print(f"Error transforming data: {str(e)}")
            import traceback
            traceback.print_exc()
            return pd.DataFrame(), f"Error during transformation: {str(e)}"

    async def analyze(self, request: Any, current_user: Dict = None):
        """
        Main entry point for data transformation requests.
        Analyzes user request and transforms data accordingly.
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
                            column_types[column] = self.infer_data_type(sample_values)
                else:
                    for column in columns:
                        sample_values = [row.get(column) for row in primary_sheet_data[:20]]
                        column_types[column] = self.infer_data_type(sample_values)
            
            # Create transformation prompt
            transformation_prompt = f"""
            You are a data analyst helping to transform spreadsheet data.

            USER REQUEST: "{request.message}"

            PRIMARY DATASET:
            - Sheet: {primary_sheet_name} (ID: {primary_sheet_id})
            - Rows: {len(primary_sheet_data)}
            - Columns: {', '.join(columns)}
            - Column data types: {json.dumps(column_types)}

            SAMPLE DATA (first 5 rows from primary sheet):
            {json.dumps(primary_sheet_data[:5], indent=2)}

            Analyze what the user wants to do with the data and determine:
            1. What type of transformation is needed (filtering, aggregation, sorting, column operations)
            2. Which columns should be involved
            3. What specific operations should be performed

            Return ONLY a JSON object with this structure:
            {{
                "transformationType": "The primary transformation type (filter, aggregate, sort, columnOps)",
                "filter": {{
                    "conditions": [
                        {{
                            "column": "Column name",
                            "operator": "equals|notEquals|contains|startsWith|endsWith|greaterThan|lessThan|greaterThanOrEqual|lessThanOrEqual|between|in",
                            "value": "Value to compare with",
                            "minValue": "For between operator - lower bound",
                            "maxValue": "For between operator - upper bound",
                            "values": ["For in operator - list of values"]
                        }}
                    ]
                }},
                "aggregation": {{
                    "groupBy": ["Column names to group by"],
                    "metrics": {{
                        "columnName": "aggregation function (sum, avg, count, min, max)"
                    }}
                }},
                "sort": {{
                    "columns": [
                        {{
                            "column": "Column name",
                            "order": "ascending|descending"
                        }}
                    ]
                }},
                "columnOperations": {{
                    "create": [
                        {{
                            "name": "New column name",
                            "formula": "Expression (e.g., Sales - Cost)"
                        }}
                    ],
                    "rename": [
                        {{
                            "oldName": "Current column name",
                            "newName": "New column name"
                        }}
                    ],
                    "drop": ["Column names to drop"]
                }},
                "sourceSheetId": "{primary_sheet_id}",
                "targetSheetId": "{request.explicitTargetSheetId or request.activeSheetId}"
            }}
            
            Include only the relevant parts based on the transformation type. For example, if the user just wants to filter data, only include the "filter" section.
            """
            
            # Get OpenAI transformation analysis
            transformation_response = self.openai_client.chat.completions.create(
                model="gpt-4o",
                messages=[
                    {"role": "system", "content": "You are a data transformation API. Return only valid JSON with no comments, no markdown, and no explanation."},
                    {"role": "user", "content": transformation_prompt}
                ],
                temperature=0.2,
                max_tokens=1000,
                response_format={"type": "json_object"}
            )
            
            # Parse the transformation config
            transformation_config = json.loads(transformation_response.choices[0].message.content)
            print("Transformation config:", transformation_config)
            
            # Get source sheet ID from transformation config or use default
            source_sheet_id = transformation_config.get('sourceSheetId', primary_sheet_id)
            target_sheet_id = transformation_config.get('targetSheetId', request.activeSheetId)
            
            # Get data for the source sheet
            source_data = request.relevantData.get(source_sheet_id, [])
            
            # Apply the transformation
            print("Processing data transformation...")
            transformed_df, transformation_description = self.transform_data(source_data, transformation_config)
            
            if transformed_df.empty:
                return {
                    "text": "I couldn't transform your data as requested. Please check your data or try a different request.",
                    "transformedData": [],
                    "operationType": transformation_config.get('transformationType', 'unknown')
                }
            
            # Convert transformed DataFrame back to list format for response
            headers = transformed_df.columns.tolist()
            data_rows = transformed_df.values.tolist()
            transformed_data = [headers] + data_rows
            
            # Prepare the response
            operation_type = transformation_config.get('transformationType', 'transformation')
            response_text = f"I've {operation_type}ed your data. {transformation_description}"
            
            return {
                "text": response_text,
                "transformedData": transformed_data,
                "operationType": operation_type,
                "sourceSheetId": source_sheet_id,
                "targetSheetId": target_sheet_id
            }
            
        except Exception as e:
            print(f"Error processing transformation request: {str(e)}")
            import traceback
            traceback.print_exc()
            raise HTTPException(
                status_code=500,
                detail={
                    "error": "Failed to transform data",
                    "text": "I couldn't transform your data as requested. Please try a different request or check your data format."
                }
            )