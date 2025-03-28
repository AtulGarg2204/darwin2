from fastapi import APIRouter, Depends, HTTPException, Body
from sqlalchemy.orm import Session
from typing import Dict, Any
from database import get_db
from models.record import Record
from models.user import User
from .auth import get_current_user
from pydantic import BaseModel

router = APIRouter()

# Define a request model that matches your frontend structure
class RecordCreate(BaseModel):
    data: list  # This will accept the array of row objects
    file_name: str

@router.post("/")
async def create_record(
    record_data: RecordCreate,  # This receives the entire request body as a single object
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    try:
        new_record = Record(
            user_id=current_user.id,
            data=record_data.data,  # Access the 'data' field from the request body
            file_name=record_data.file_name  # Access the 'file_name' field from the request body
        )
        db.add(new_record)
        db.commit()
        db.refresh(new_record)
        return new_record
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))