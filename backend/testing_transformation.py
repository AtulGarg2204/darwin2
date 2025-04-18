# test_pandas_gpt.py
import asyncio
import json
from routes.agents.transformation import DataTransformationAgent

sample_data = [
    ["Row ID", "Order ID", "Order Date", "Ship Date", "Ship Mode", "Customer ID", "Customer Name", "Segment", "Country", "City", "State", "Postal Code", "Region", "Product ID", "Category", "Sub-Category", "Product Name", "Sales", "Quantity", "Discount", "Profit"],
    [1, "CA-2017-152156", "2017-11-08", "2017-11-11", "Second Class", "CG-12520", "Claire Gute", "Consumer", "United States", "Henderson", "Kentucky", 42420, "South", "FUR-BO-10001798", "Furniture", "Bookcases", "Bush Somerset Collection Bookcase", 261.96, 2, 0, 41.9136],
    [2, "CA-2017-152156", "2017-11-08", "2017-11-11", "Second Class", "CG-12520", "Claire Gute", "Consumer", "United States", "Henderson", "Kentucky", 42420, "South", "FUR-CH-10000454", "Furniture", "Chairs", "Hon Deluxe Fabric Upholstered Stacking Chairs, Rounded Back", 731.94, 3, 0, 219.582],
    [3, "CA-2017-138688", "2017-06-12", "2017-06-16", "Second Class", "DV-13045", "Darrin Van Huff", "Corporate", "United States", "Los Angeles", "California", 90036, "West", "OFF-LA-10000240", "Office Supplies", "Labels", "Self-Adhesive Address Labels for Typewriters by Universal", 14.62, 2, 0, 6.8714],
    [4, "US-2016-108966", "2016-10-11", "2016-10-18", "Standard Class", "SO-20335", "Sean O'Donnell", "Consumer", "United States", "Fort Lauderdale", "Florida", 33311, "South", "FUR-TA-10000577", "Furniture", "Tables", "Bretford CR4500 Series Slim Rectangular Table", 957.5775, 5, 0.45, -383.031],
    [5, "US-2016-108966", "2016-10-11", "2016-10-18", "Standard Class", "SO-20335", "Sean O'Donnell", "Consumer", "United States", "Fort Lauderdale", "Florida", 33311, "South", "OFF-ST-10000760", "Office Supplies", "Storage", "Eldon Fold 'N Roll Cart System", 22.368, 2, 0.2, 2.5164]
]

class MockRequest:
    def __init__(self):
        self.message = ""
        self.relevantData = {"sheet1": sample_data}
        self.sheets = {"sheet1": {"name": "Sales Data"}}
        self.activeSheetId = "sheet1"
        self.explicitTargetSheetId = None

async def test_transformation_agent():
    agent = DataTransformationAgent()
    
    # Test 1: Simple Filter
    print("\n=== TEST 1: SIMPLE FILTER ===")
    request = MockRequest()
    request.message = "Show me sales greater than 500 dollars"
    result = await agent.analyze(request)
    print(f"Generated result with {len(result['transformedData'])-1} rows")
    
    # Test 2: Complex Aggregation
    print("\n=== TEST 2: COMPLEX AGGREGATION ===")
    request = MockRequest()
    request.message = "Group sales by region and segment, calculate total sales, average profit, and count of orders for each group"
    result = await agent.analyze(request)
    print(f"Generated result with {len(result['transformedData'])-1} rows")
    
    # Test 3: Multi-step Transformation
    print("\n=== TEST 3: MULTI-STEP TRANSFORMATION ===")
    request = MockRequest()
    request.message = "Calculate profit margin as profit divided by sales, filter to show only items with negative profit margin, sort by profit margin ascending, and show only customer name, category, sales, profit and profit margin"
    result = await agent.analyze(request)
    print(f"Generated result with {len(result['transformedData'])-1} rows")
    
    # Test 4: Date Handling
    print("\n=== TEST 4: DATE HANDLING ===")
    request = MockRequest()
    request.message = "Convert Order Date to datetime, extract the month, and show average sales by month"
    result = await agent.analyze(request)
    print(f"Generated result with {len(result['transformedData'])-1} rows")
    
    # Test 5: Window Functions
    print("\n=== TEST 5: ADVANCED PANDAS ===")
    request = MockRequest()
    request.message = "For each customer, calculate their total sales and what percentage of total sales they represent"
    result = await agent.analyze(request)
    print(f"Generated result with {len(result['transformedData'])-1} rows")

if __name__ == "__main__":
    asyncio.run(test_transformation_agent())