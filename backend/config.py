from typing import Dict, Any
import os
from pathlib import Path

# Application configuration
BASE_DIR = Path(__file__).parent
TEMP_DIR = BASE_DIR / "temp"
SAMPLE_DATA_DIR = BASE_DIR / "sample_data"

# Ensure temp directory exists
TEMP_DIR.mkdir(exist_ok=True)

# Default shift configurations
DEFAULT_SHIFT_CONFIG = {
    "am": {
        "start": "09:45",
        "end": "16:30",
        "cross_midnight": False
    },
    "pm": {
        "start": "16:00", 
        "end": "00:15",
        "cross_midnight": True
    },
    "tardy_minutes": 5,
    "early_minutes": 15,
    "timezone": "America/New_York"
}

# File upload settings
MAX_FILE_SIZE = 50 * 1024 * 1024  # 50MB
ALLOWED_EXTENSIONS = {'.xlsx', '.xls'}