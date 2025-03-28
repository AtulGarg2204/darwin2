from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from database import get_db
from models.record import Record
from models.user import User
from .auth import get_current_user

router = APIRouter()

@router.post("/")
async def create_record(
    data: dict,
    file_name: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    try:
        new_record = Record(
            user_id=current_user.id,
            data=data,
            file_name=file_name
        )
        db.add(new_record)
        db.commit()
        db.refresh(new_record)
        return new_record
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/")
async def get_records(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    try:
        records = db.query(Record).filter(Record.user_id == current_user.id).order_by(Record.created_at.desc()).all()
        return records
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) 