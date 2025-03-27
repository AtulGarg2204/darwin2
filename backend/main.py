from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .routes import chat, auth
from .database import engine
from .models import user
from dotenv import load_dotenv
import os

# Load environment variables
load_dotenv()

# Create database tables
user.Base.metadata.create_all(bind=engine)

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Replace with your frontend URL in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api/auth", tags=["auth"])
app.include_router(chat.router, prefix="/api", tags=["chat"])