from __future__ import annotations

import ast
from dataclasses import dataclass
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
APP_ROOT = REPO_ROOT / "app"
API_ROOT = APP_ROOT / "api"
CORE_ROOT = APP_ROOT / "core"
FEATURES_ROOT = APP_ROOT / "features"
MODELS_ROOT = APP_ROOT / "models"
SCHEMAS_ROOT = APP_ROOT / "schemas"
SERVICES_ROOT = REPO_ROOT / "app" / "services"
REPOSITORIES_ROOT = APP_ROOT / "repositories"


@dataclass(frozen=True)
class ImportRecord:
    file_path: Path
    imported_module: str


def iter_module_directories() -> list[Path]:
    return sorted(path for path in APP_ROOT.iterdir() if path.is_dir())


def iter_feature_package_roots() -> list[Path]:
    if not FEATURES_ROOT.exists():
        return []

    return sorted(
        path
        for path in FEATURES_ROOT.iterdir()
        if path.is_dir() and not path.name.startswith("__")
    )


def iter_python_files(root: Path) -> list[Path]:
    return sorted(path for path in root.rglob("*.py") if path.is_file())


def module_name_for_path(file_path: Path) -> str:
    relative_path = file_path.relative_to(REPO_ROOT)
    return ".".join(relative_path.with_suffix("").parts)


def iter_import_records(root: Path) -> list[ImportRecord]:
    records: list[ImportRecord] = []

    for file_path in iter_python_files(root):
        module_name = module_name_for_path(file_path)
        tree = ast.parse(file_path.read_text(), filename=str(file_path))

        for node in ast.walk(tree):
            if isinstance(node, ast.Import):
                for alias in node.names:
                    records.append(
                        ImportRecord(file_path=file_path, imported_module=alias.name)
                    )

            if isinstance(node, ast.ImportFrom):
                imported_module = _resolve_from_import(module_name, node)
                if imported_module:
                    records.append(
                        ImportRecord(
                            file_path=file_path,
                            imported_module=imported_module,
                        )
                    )

    return records


def _resolve_from_import(module_name: str, node: ast.ImportFrom) -> str:
    if node.level == 0:
        return node.module or ""

    package_parts = module_name.split(".")[:-1]
    parent_parts = package_parts[: len(package_parts) - (node.level - 1)]

    if node.module:
        return ".".join([*parent_parts, node.module])

    return ".".join(parent_parts)
