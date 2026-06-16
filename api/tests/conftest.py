import os
from pathlib import Path
import sys


ROOT = Path(__file__).resolve().parents[1]

if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

os.environ.setdefault("DATABASE_URL", "sqlite+aiosqlite:///./test.db")
os.environ.setdefault("REDIS_URL", "redis://localhost:6379/0")
os.environ.setdefault("ENVIRONMENT", "local")
os.environ.setdefault("PUBLIC_API_BASE_URL", "https://api.example.test")
os.environ.setdefault(
    "AUTH__DISCOVERY_ENDPOINT", "https://example.test/.well-known/openid-configuration"
)
os.environ.setdefault("AUTH__AUDIENCE", "kanai-api")
os.environ.setdefault("AI__MODEL_NAME", "test-model")
os.environ.setdefault("AI__BASE_URL", "https://ai.example.test/v1")
os.environ.setdefault("AI__API_KEY", "test-api-key")
