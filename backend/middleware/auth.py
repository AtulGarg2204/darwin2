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
            os.environ.get("JWT_SECRET"), 
            algorithms=["HS256"]
        )
        user = payload.get("user")
        
        if not user:
            raise HTTPException(
                status_code=401, 
                detail="Invalid token format"
            )
            
        return user
        
    except jwt.PyJWTError:
        raise HTTPException(
            status_code=401,
            detail="Token is not valid"
        )