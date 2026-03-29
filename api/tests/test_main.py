import importlib
import sys
from types import ModuleType

from app.modules.auth.infrastructure.joserfc_token_verifier import (
    JoserfcTokenVerifier,
)


def test_authenticate_request_wires_configured_audience_into_verifier() -> None:
    async def create_db_and_tables() -> None:
        return None

    database_service_module = ModuleType("app.services.database_service")
    setattr(database_service_module, "create_db_and_tables", create_db_and_tables)
    sys.modules["app.services.database_service"] = database_service_module
    main = importlib.import_module("main")

    verifier = main.authenticate_request._token_verifier

    assert isinstance(verifier, JoserfcTokenVerifier)
    assert verifier.expected_audience == main.settings.auth.audience
