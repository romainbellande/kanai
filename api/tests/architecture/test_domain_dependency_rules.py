from tests.architecture.helpers import iter_import_records, iter_module_directories


def test_domain_code_stays_free_of_framework_and_infrastructure_imports() -> None:
    violations: list[str] = []

    for module_dir in iter_module_directories():
        domain_dir = module_dir / "domain"
        if not domain_dir.is_dir():
            continue

        context_name = module_dir.name
        blocked_prefixes = (
            "fastapi",
            "starlette",
            "app.services",
            f"app.modules.{context_name}.interface",
            f"app.modules.{context_name}.infrastructure",
        )

        for record in iter_import_records(domain_dir):
            if record.imported_module.startswith(blocked_prefixes):
                violations.append(
                    f"{record.file_path}: domain code must not import '{record.imported_module}'"
                )

    assert not violations, "\n".join(violations)
