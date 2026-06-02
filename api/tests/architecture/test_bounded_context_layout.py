from pathlib import Path

from tests.architecture.helpers import APP_ROOT, FEATURES_ROOT, iter_python_files


def test_layered_api_layout_contains_expected_packages_and_entrypoints() -> None:
    required_directories = (
        "api/v1/endpoints",
        "core",
        "db/migrations/versions",
        "features",
        "integrations",
        "models",
        "repositories",
        "schemas",
        "services",
        "utils",
    )
    required_files = (
        "main.py",
        "core/config.py",
        "core/security.py",
        "core/logging.py",
        "core/exceptions.py",
        "api/deps.py",
        "api/v1/router.py",
        "api/v1/endpoints/users.py",
        "api/v1/endpoints/auth.py",
        "api/v1/endpoints/products.py",
        "schemas/user.py",
        "schemas/auth.py",
        "schemas/product.py",
        "models/user.py",
        "models/product.py",
        "repositories/user_repository.py",
        "repositories/product_repository.py",
        "services/user_service.py",
        "services/auth_service.py",
        "services/product_service.py",
        "db/session.py",
        "db/base.py",
        "features/__init__.py",
        "integrations/email_client.py",
        "integrations/payment_client.py",
        "utils/pagination.py",
    )

    missing_directories = [
        directory
        for directory in required_directories
        if not (APP_ROOT / directory).is_dir()
    ]
    missing_files = [
        file_path
        for file_path in required_files
        if not (APP_ROOT / file_path).is_file()
    ]

    assert not missing_directories, (
        f"Missing directories: {', '.join(missing_directories)}"
    )
    assert not missing_files, f"Missing files: {', '.join(missing_files)}"


def test_legacy_feature_modules_do_not_contain_python_sources() -> None:
    legacy_modules_root = APP_ROOT / "modules"

    if not legacy_modules_root.exists():
        return

    python_files = [
        path.relative_to(Path.cwd()) for path in iter_python_files(legacy_modules_root)
    ]

    assert not python_files


def test_feature_packages_export_public_surface_from_package_root() -> None:
    if not FEATURES_ROOT.exists():
        return

    feature_roots = [
        path
        for path in FEATURES_ROOT.iterdir()
        if path.is_dir() and not path.name.startswith("__")
    ]
    missing_init_files = [
        path.relative_to(Path.cwd())
        for path in feature_roots
        if not (path / "__init__.py").is_file()
    ]

    assert not missing_init_files, (
        "Feature packages must expose their public API from __init__.py: "
        + ", ".join(str(path) for path in missing_init_files)
    )
