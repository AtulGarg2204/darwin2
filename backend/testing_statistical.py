import asyncio
import json
import pandas as pd
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Import the agent
from routes.agents.statistical import StatisticalAgent

# Create a mock request class
class MockRequest:
    def __init__(self, message, data):
        self.message = message
        self.relevantData = {"sheet1": data}
        self.sheets = {"sheet1": {"name": "Sample Data"}}
        self.activeSheetId = "sheet1"
        self.explicitTargetSheetId = None

async def test_statistical_agent():
    """Test the EnhancedStatisticalAgent with sample data."""
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
    
    # Create test messages
    test_messages = [
        "Analyze the sales performance by region and identify which region has the highest profit margin.",
        "Is there a correlation between units sold and profit?",
        "Compare the performance of different products and show me which one is most profitable.",
        "How has revenue changed over time? Can you identify any trends?",
        "Analyze the profitability of each product and region combination."
    ]

    # Initialize the agent
    agent = StatisticalAgent()
    
    # Test with one message
    test_message = test_messages[3]
    print(f"\nTesting with message: '{test_message}'")
    
    # Create mock request
    request = MockRequest(test_message, data)
    
    # Debug: Print first few rows of the data
    print("\nSample data:")
    sample_df = pd.DataFrame(data[1:5], columns=data[0])
    print(sample_df)
    
    print("\nRunning analysis...")
    
    # Run analysis
    result = await agent.analyze(request)
    
    # Output result
    print("\nAnalysis Type:", result.get("analysisType"))
    
    # Print metadata
    print("\nMetadata:")
    metadata = result.get("metadata", {})
    for key, value in metadata.items():
        print(f"  {key}: {value}")
    
    # Print number of chart configs
    chart_configs = result.get("chartConfigs", [])
    print(f"\nChart Configs: {len(chart_configs)}")
    if chart_configs:
        print("Charts:")
        for i, chart in enumerate(chart_configs):
            print(f"  {i+1}. {chart.get('title')} ({chart.get('type')})")
    
    # Print interpretation
    print("\nInterpretation:")
    print(result.get("text"))
    
    # Save result to file
    with open("statistical_analysis_result.json", "w") as f:
        json.dump(result, f, indent=2)
    
    print("\nSaved complete result to 'statistical_analysis_result.json'")

if __name__ == "__main__":
    asyncio.run(test_statistical_agent())