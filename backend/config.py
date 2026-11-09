import os
from pathlib import Path
from dotenv import load_dotenv

# Locate backend/.env explicitly
BASE_DIR = Path(__file__).resolve().parent
ENV_FILE = BASE_DIR / ".env"

# Load environment variables
load_dotenv(dotenv_path=ENV_FILE, override=False)

# Supabase configuration
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_PUBLISHABLE_KEY = os.getenv("SUPABASE_PUBLISHABLE_KEY")

# Privileged key: backend use only
SUPABASE_SECRET_KEY = os.getenv("SUPABASE_SECRET_KEY")

# Database connection
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


def validate_admin_config():
    if (
        not SUPABASE_SECRET_KEY
        or SUPABASE_SECRET_KEY.startswith("YOUR_")
    ):
        raise RuntimeError(
            "Missing or incomplete environment variable: SUPABASE_SECRET_KEY"
        )