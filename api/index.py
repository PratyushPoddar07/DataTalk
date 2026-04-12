"""
Vercel Serverless Function Entry Point
Wraps the FastAPI app for Vercel's Python runtime.
"""
import sys
import os

# Add the project root and backend directory to Python path
_project_root = os.path.join(os.path.dirname(__file__), '..')
_backend_dir = os.path.join(_project_root, 'backend')

# Insert at the beginning of sys.path so our modules take priority
if _project_root not in sys.path:
    sys.path.insert(0, _project_root)
if _backend_dir not in sys.path:
    sys.path.insert(0, _backend_dir)

# Set working directory to backend so relative paths (like .env) resolve
os.chdir(_backend_dir)

from main import app

# Vercel expects your ASGI/WSGI app to be named `app` at module level
# The FastAPI `app` is already an ASGI application that Vercel can serve directly.
