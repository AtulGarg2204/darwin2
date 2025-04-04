import asyncio
import json
import pandas as pd
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Import the agent
from routes.agents.statistical import StatisticalAgent

# Create sample data (sales data)
data = [
    ["Date", "Region", "Product", "Units", "Price", "Revenue", "Costs", "Profit"],
    ["2023-01-01", "North", "Widget A", 120, 25, 3000, 2100, 900],
    ["2023-01-15", "North", "Widget B", 85, 32, 2720, 1870, 850],
    ["2023-01-22", "East", "Widget A", 95, 25, 2375, 1662, 713],
    ["2023-02-05", "South", "Widget C", 143, 15, 2145, 1502, 643],
    ["2023-02-12", "West", "Widget B", 56, 32, 1792, 1075, 717],
    ["2023-02-18", "North", "Widget C", 72, 15, 1080, 756, 324],
    ["2023-03-01", "East", "Widget A", 130, 25, 3250, 2275, 975],
    ["2023-03-15", "South", "Widget B", 67, 32, 2144, 1501, 643],
    ["2023-03-29", "West", "Widget C", 99, 15, 1485, 1040, 445],
    ["2023-04-10", "North", "Widget A", 145, 25, 3625, 2538, 1087],
    ["2023-04-22", "East", "Widget B", 78, 32, 2496, 1747, 749],
    ["2023-05-05", "South", "Widget A", 156, 25, 3900, 2730, 1170],
    ["2023-05-18", "West", "Widget C", 124, 15, 1860, 1302, 558],
    ["2023-06-01", "North", "Widget B", 95, 32, 3040, 2128, 912],
    ["2023-06-14", "East", "Widget C", 85, 15, 1275, 893, 382]
]

async def debug_statistical_agent():
    """Test the core data handling and analysis components of the EnhancedStatisticalAgent."""
    # Initialize the agent
    agent = StatisticalAgent()
    
    # Step 1: Convert raw data to DataFrame
    print("Step 1: Convert raw data to DataFrame")
    df = agent._create_dataframe_from_raw(data)
    print(f"DataFrame shape: {df.shape}")
    print(f"DataFrame columns: {df.columns.tolist()}")
    print(f"DataFrame dtypes:\n{df.dtypes}")
    print("\nFirst 3 rows:")
    print(df.head(3))
    
    # Step 2: Generate data profile
    print("\nStep 2: Generate data profile")
    profile = agent._generate_data_profile(df)
    print(f"Profile contains {len(profile['columns'])} column details")
    print(f"Numeric columns: {profile['numeric_columns']}")
    print(f"Categorical columns: {profile['categorical_columns']}")
    print(f"Datetime columns: {profile['datetime_columns']}")
    
    # Step 3: Execute a simple analysis manually
    print("\nStep 3: Manual analysis test")
    
    # Test code that calculates profit margin by region
    analysis_code = """
try:
    # Ensure numeric columns
    df['Revenue'] = pd.to_numeric(df['Revenue'], errors='coerce')
    df['Profit'] = pd.to_numeric(df['Profit'], errors='coerce')
    
    # Calculate profit margin by region
    region_performance = df.groupby('Region').agg({
        'Revenue': 'sum',
        'Profit': 'sum'
    }).reset_index()
    
    # Calculate profit margin
    region_performance['Profit_Margin'] = (region_performance['Profit'] / region_performance['Revenue'] * 100).round(2)
    
    # Sort by profit margin
    region_performance = region_performance.sort_values('Profit_Margin', ascending=False)
    
    # Get highest profit margin region
    highest_margin_region = region_performance.iloc[0]['Region']
    highest_margin_value = region_performance.iloc[0]['Profit_Margin']
    
    # Prepare data for visualization
    chart_data = region_performance.to_dict('records')
    
    analysis_result = {
        'profit_margin_by_region': chart_data,
        'highest_margin_region': highest_margin_region,
        'highest_margin_value': highest_margin_value
    }
except Exception as e:
    print(f"Error calculating profit margin: {str(e)}")
    analysis_result = {'profit_margin_by_region': None}
    """
    
    result = agent._execute_analysis(analysis_code, df)
    print("Analysis result:")
    print(json.dumps(result, indent=2))
    
    # Step 4: Test the create and execute analysis flow
    print("\nStep 4: Testing create and execute analysis flow")
    user_message = "Analyze the sales performance by region and identify which region has the highest profit margin."
    analysis_package = await agent._create_statistical_analysis(user_message, df, profile)
    print(f"Generated analysis package of type: {analysis_package.get('analysis_type')}")
    
    print("\nImplementation code:")
    print(analysis_package.get('implementation', 'No implementation code generated'))
    
    print("\nExecuting implementation...")
    analysis_result = agent._execute_analysis(analysis_package['implementation'], df)
    print("Analysis result:")
    print(json.dumps(analysis_result, indent=2))

if __name__ == "__main__":
    asyncio.run(debug_statistical_agent())