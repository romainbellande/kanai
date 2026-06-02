from tests.architecture.helpers import (
    iter_feature_package_roots,
    iter_import_records,
)


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
