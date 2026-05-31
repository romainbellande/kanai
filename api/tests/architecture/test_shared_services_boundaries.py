from tests.architecture.helpers import SERVICES_ROOT, iter_import_records


def test_shared_services_do_not_depend_on_feature_modules() -> None:
    violations = [
        f"{record.file_path}: shared service must not import '{record.imported_module}'"
        for record in iter_import_records(SERVICES_ROOT)
        if record.imported_module.startswith("app.api.v1.endpoints")
    ]

    assert not violations, "\n".join(violations)
