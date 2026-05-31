from tests.architecture.helpers import MODELS_ROOT, SCHEMAS_ROOT, iter_import_records


def test_models_and_schemas_stay_free_of_api_and_service_imports() -> None:
    violations: list[str] = []

    for root in (MODELS_ROOT, SCHEMAS_ROOT):
        blocked_prefixes = (
            "fastapi",
            "starlette",
            "app.api",
            "app.integrations",
            "app.repositories",
            "app.services",
        )

        for record in iter_import_records(root):
            if record.imported_module.startswith(blocked_prefixes):
                violations.append(
                    f"{record.file_path}: models and schemas must not import '{record.imported_module}'"
                )

    assert not violations, "\n".join(violations)
