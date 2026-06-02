from tests.architecture.helpers import (
    APP_ROOT,
    iter_feature_package_roots,
    iter_import_records,
)


def test_tasks_feature_exports_router_and_service_surface() -> None:
    from app.features.tasks import TaskService, task_router

    assert TaskService.__name__ == "TaskService"
    assert task_router.prefix == "/{project_id}/tasks"


def test_app_code_imports_tasks_through_feature_surface() -> None:
    blocked_modules = {
        "app.api.v1.endpoints.tasks",
        "app.services.task_service",
    }
    violations = [
        f"{record.file_path}: import tasks through 'app.features.tasks', not '{record.imported_module}'"
        for record in iter_import_records(APP_ROOT)
        if record.imported_module in blocked_modules
    ]

    assert not violations, "\n".join(violations)


def test_task_feature_internals_do_not_leak_to_unrelated_app_modules() -> None:
    tasks_root = APP_ROOT / "features" / "tasks"
    violations = [
        f"{record.file_path}: import the public 'app.features.tasks' surface, not '{record.imported_module}'"
        for record in iter_import_records(APP_ROOT)
        if record.imported_module.startswith("app.features.tasks.")
        and not record.file_path.is_relative_to(tasks_root)
    ]

    assert not violations, "\n".join(violations)


def test_unrelated_features_do_not_import_feature_internals() -> None:
    violations: list[str] = []

    for feature_root in iter_feature_package_roots():
        importing_feature = feature_root.name

        for record in iter_import_records(feature_root):
            imported_parts = record.imported_module.split(".")
            if len(imported_parts) < 4:
                continue

            if imported_parts[:2] != ["app", "features"]:
                continue

            imported_feature = imported_parts[2]
            imports_internal_module = len(imported_parts) > 3
            if imported_feature != importing_feature and imports_internal_module:
                violations.append(
                    f"{record.file_path}: feature '{importing_feature}' must import "
                    f"the public 'app.features.{imported_feature}' surface, not "
                    f"'{record.imported_module}'"
                )

    assert not violations, "\n".join(violations)
