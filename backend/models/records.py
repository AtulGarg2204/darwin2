# In models/record.py
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
from datetime import datetime

class Record(BaseModel):
    user: str  # ObjectId as string
    data: List[Dict[str, Any]]
    fileName: Optional[str] = None
    createdAt: datetime = datetime.now()