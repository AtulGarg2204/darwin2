from fastapi import APIRouter, HTTPException, Depends, UploadFile, File
from typing import Dict, List, Optional, Any
from pydantic import BaseModel
from openai import OpenAI
import json
import os
from routes.auth import get_current_user
from models.record import Record
from routes.agents.classifier import RequestClassifier
from backend.routes.agents.visualization import DataVizualizationAgent
from models.user import User

router = APIRouter()
from dotenv import load_dotenv
load_dotenv()

class AnalysisRequest(BaseModel):
    message: str
    relevantData: Dict[str, Any]
    sheets: Dict[str, Any]
    activeSheetId: Optional[str] = None
    explicitTargetSheetId: Optional[str] = None

# Initialize agents
request_classifier = RequestClassifier()
data_analysis_agent = DataVizualizationAgent()

@router.post("/analyze2")
async def analyze(
    request: AnalysisRequest,
    current_user: User = Depends(get_current_user)
):
    """
    Main entry point for all analysis requests. Routes to appropriate handler based on request type.
    """
    try:
        # Classify the request
        request_type = await request_classifier.classify(request)
        
        # Route to appropriate handler based on request type
        if request_type == "visualization":
            return await data_analysis_agent.analyze(request, current_user)
        else:
            raise HTTPException(
                status_code=400,
                detail={
                    "error": "Unsupported request type",
                    "text": f"This type of request ({request_type}) is not supported yet. Please try a visualization request."
                }
            )
    except Exception as e:
        print(f"Error in analyze route: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail={
                "error": "Failed to process request",
                "text": "An error occurred while processing your request. Please try again."
            }
        )