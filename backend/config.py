import os
from pathlib import Path
from dotenv import load_dotenv

# Locate backend/.env explicitly
BASE_DIR = Path(__file__).resolve().parent
ENV_FILE = BASE_DIR / ".env"

# Load environment variables
load_dotenv(dotenv_path=ENV_FILE, override=False)

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_PUBLISHABLE_KEY = os.getenv("SUPABASE_PUBLISHABLE_KEY")
DATABASE_URL = os.getenv("DATABASE_URL")


def validate_config():
    required_variables = {
        "SUPABASE_URL": SUPABASE_URL,
        "SUPABASE_PUBLISHABLE_KEY": SUPABASE_PUBLISHABLE_KEY,
        "DATABASE_URL": DATABASE_URL,
    }

    missing = [
        name for name, value in required_variables.items()
        if not value or value.startswith("YOUR_")
    ]

    if missing:
        raise RuntimeError(
            f"Missing or incomplete environment variables: {', '.join(missing)}"
        )