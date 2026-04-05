from pathlib import Path

from tests.architecture.helpers import iter_module_directories


def test_opted_in_bounded_contexts_require_all_context_packages() -> None:
    required_packages = ("application", "infrastructure", "interface")

    for module_dir in iter_module_directories():
        if not (module_dir / "domain").is_dir():
            continue

        missing_packages = [
            package_name
            for package_name in required_packages
            if not (module_dir / package_name).is_dir()
        ]
        assert not missing_packages, (
            f"{module_dir.relative_to(Path.cwd())} opts into bounded-context layout via "
            f"'domain/' but is missing sibling packages: {', '.join(missing_packages)}"
        )


def test_flat_modules_without_domain_remain_valid() -> None:
    assert not (Path("app/modules/user") / "domain").exists()
