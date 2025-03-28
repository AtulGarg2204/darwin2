# middleware/auth.py
from fastapi import HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import jwt
from typing import Dict
import os

security = HTTPBearer()

def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> Dict:
    """
    Verifies the JWT token and returns the user data
    """
    token = credentials.credentials
    
    if not token:
        raise HTTPException(
            status_code=401,
            detail="No token, authorization denied"
        )
    
    try:
        # Verify token using your JWT secret
        payload = jwt.decode(
            token, 
            os.environ.get("SECRET_KEY"), 
            algorithms=["HS256"]
        )
        user_id = payload.get("sub")
        
        if not user_id:
            raise HTTPException(
                status_code=401, 
                detail="Invalid token format"
            )
            
        return {"id": user_id}
        
    except jwt.PyJWTError:
        raise HTTPException(
            status_code=401,
            detail="Token is not valid"
        )