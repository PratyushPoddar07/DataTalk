"""
Vercel Serverless Function Entry Point
Wraps the FastAPI app for Vercel's Python runtime.
"""
import sys
import os

# Add the backend directory to Python path so imports work
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend'))

from backend.main import app

# Vercel expects your ASGI/WSGI app to be named `app` at module level
# The FastAPI `app` is already an ASGI application that Vercel can serve directly.
