# test_visualization.py
import asyncio
import json
from routes.agents.visualization import DataVizualizationAgent

# Sample data (similar to what your frontend would send)
sample_data = [
    ["Row ID", "Order ID", "Order Date", "Ship Date", "Ship Mode", "Customer ID", "Customer Name", "Segment", "Country", "City", "State", "Postal Code", "Region", "Product ID", "Category", "Sub-Category", "Product Name", "Sales", "Quantity", "Discount", "Profit"],
    [1, "CA-2017-152156", "2017-11-08", "2017-11-11", "Second Class", "CG-12520", "Claire Gute", "Consumer", "United States", "Henderson", "Kentucky", 42420, "South", "FUR-BO-10001798", "Furniture", "Bookcases", "Bush Somerset Collection Bookcase", 261.96, 2, 0, 41.9136],
    [2, "CA-2017-152156", "2017-11-08", "2017-11-11", "Second Class", "CG-12520", "Claire Gute", "Consumer", "United States", "Henderson", "Kentucky", 42420, "South", "FUR-CH-10000454", "Furniture", "Chairs", "Hon Deluxe Fabric Upholstered Stacking Chairs, Rounded Back", 731.94, 3, 0, 219.582],
    [3, "CA-2017-138688", "2017-06-12", "2017-06-16", "Second Class", "DV-13045", "Darrin Van Huff", "Corporate", "United States", "Los Angeles", "California", 90036, "West", "OFF-LA-10000240", "Office Supplies", "Labels", "Self-Adhesive Address Labels for Typewriters by Universal", 14.62, 2, 0, 6.8714],
    [4, "US-2016-108966", "2016-10-11", "2016-10-18", "Standard Class", "SO-20335", "Sean O'Donnell", "Consumer", "United States", "Fort Lauderdale", "Florida", 33311, "South", "FUR-TA-10000577", "Furniture", "Tables", "Bretford CR4500 Series Slim Rectangular Table", 957.5775, 5, 0.45, -383.031],
    [5, "US-2016-108966", "2016-10-11", "2016-10-18", "Standard Class", "SO-20335", "Sean O'Donnell", "Consumer", "United States", "Fort Lauderdale", "Florida", 33311, "South", "OFF-ST-10000760", "Office Supplies", "Storage", "Eldon Fold 'N Roll Cart System", 22.368, 2, 0.2, 2.5164]
]

# Create a mock request object
class MockRequest:
    def __init__(self):
        self.message = ""
        self.relevantData = {"sheet1": sample_data}
        self.sheets = {"sheet1": {"name": "Sales Data"}}
        self.activeSheetId = "sheet1"
        self.explicitTargetSheetId = None

# Test different visualization scenarios
async def test_visualization_agent():
    agent = DataVizualizationAgent()
    
    # Test 1: Simple Bar Chart
    print("\n=== TEST 1: SIMPLE BAR CHART ===")
    request = MockRequest()
    request.message = "Create a bar chart of sales by region"
    result = await agent.analyze(request)
    print(f"Chart type: {result['chartConfig']['type']}")
    print(f"Chart title: {result['chartConfig']['title']}")
    print(f"Generated {len(result['chartConfig']['data'])} data points")
    
    # Test 2: Line Chart with Aggregation
    print("\n=== TEST 2: LINE CHART WITH AGGREGATION ===")
    request = MockRequest()
    request.message = "Show me a line chart of sales over time based on order date"
    result = await agent.analyze(request)
    print(f"Chart type: {result['chartConfig']['type']}")
    print(f"Chart title: {result['chartConfig']['title']}")
    print(f"Generated {len(result['chartConfig']['data'])} data points")
    
    # Test 3: Pie Chart
    print("\n=== TEST 3: PIE CHART ===")
    request = MockRequest()
    request.message = "Create a pie chart showing sales distribution by category"
    result = await agent.analyze(request)
    print(f"Chart type: {result['chartConfig']['type']}")
    print(f"Chart title: {result['chartConfig']['title']}")
    print(f"Generated {len(result['chartConfig']['data'])} data points")
    
    # Test 4: Complex Multi-Series Chart
    print("\n=== TEST 4: MULTI-SERIES CHART ===")
    request = MockRequest()
    request.message = "Create a chart showing both sales and profit by region, and sort by sales descending"
    result = await agent.analyze(request)
    print(f"Chart type: {result['chartConfig']['type']}")
    print(f"Chart title: {result['chartConfig']['title']}")
    print(f"Generated {len(result['chartConfig']['data'])} data points")
    
    # Test 5: Chart with Calculated Metrics
    print("\n=== TEST 5: CALCULATED METRICS ===")
    request = MockRequest()
    request.message = "Show profit margin (profit divided by sales) by segment"
    result = await agent.analyze(request)
    print(f"Chart type: {result['chartConfig']['type']}")
    print(f"Chart title: {result['chartConfig']['title']}")
    print(f"Generated {len(result['chartConfig']['data'])} data points")

# Run the tests
if __name__ == "__main__":
    asyncio.run(test_visualization_agent())