#!/usr/bin/env python3
"""Create a deterministic license metadata inventory from local lockfiles."""

from __future__ import annotations

import json
import os
import tomllib
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def npm_inventory() -> list[dict[str, object]]:
    lock = json.loads((ROOT / "package-lock.json").read_text(encoding="utf-8"))
    root = lock.get("packages", {}).get("", {})
    direct = set(root.get("dependencies", {})) | set(root.get("devDependencies", {}))
    rows = []
    for key, package in lock.get("packages", {}).items():
        if not key.startswith("node_modules/"):
            continue
        name = key.rsplit("node_modules/", 1)[-1]
        rows.append(
            {
                "name": name,
                "install_path": key,
                "version": package.get("version", ""),
                "license": package.get("license"),
                "license_metadata_missing": not bool(package.get("license")),
                "dev": bool(package.get("dev", False)),
                "direct": name in direct and key == "node_modules/" + name,
            }
        )
    return sorted(rows, key=lambda row: (str(row["name"]), str(row["version"])))


def cargo_inventory() -> list[dict[str, object]]:
    lock = tomllib.loads((ROOT / "src-tauri/Cargo.lock").read_text(encoding="utf-8"))
    manifest = tomllib.loads((ROOT / "src-tauri/Cargo.toml").read_text(encoding="utf-8"))
    cargo_home = Path(os.environ.get("CARGO_HOME", Path.home() / ".cargo"))
    registry_roots = sorted((cargo_home / "registry/src").glob("*"))
    cached: dict[tuple[str, str], dict[str, object]] = {}
    for registry_root in registry_roots:
        for cargo_toml in registry_root.glob("*/Cargo.toml"):
            try:
                data = tomllib.loads(cargo_toml.read_text(encoding="utf-8"))
            except (OSError, tomllib.TOMLDecodeError):
                continue
            package = data.get("package", {})
            if package.get("name") and package.get("version"):
                cached[(package["name"], package["version"])] = package

    root_package = manifest.get("package", {}).get("name")
    dependencies = manifest.get("dependencies", {})
    dev_dependencies = manifest.get("dev-dependencies", {})
    build_dependencies = manifest.get("build-dependencies", {})
    direct_normal = {dep.get("package", alias) for alias, dep in _dependency_table(dependencies).items()}
    direct_build = {dep.get("package", alias) for alias, dep in _dependency_table(build_dependencies).items()}
    direct_dev = {dep.get("package", alias) for alias, dep in _dependency_table(dev_dependencies).items()}

    packages = [p for p in lock.get("package", []) if p["name"] != root_package]
    # Cargo.lock does not encode target/feature activation. Keep role flags
    # exact for direct dependencies and leave transitive role classification
    # unknown instead of guessing from incomplete lockfile edges.
    rows = []
    for package in packages:
        key = (package["name"], package["version"])
        local = cached.get(key)
        license_expression = local.get("license") if local else None
        license_file = local.get("license-file") if local else None
        rows.append(
            {
                "name": package["name"],
                "version": package["version"],
                "license": license_expression,
                "license_file_declared": license_file,
                "license_metadata_missing": not bool(license_expression or license_file),
                "manifest_available_locally": local is not None,
                "dev": package["name"] in direct_dev and package["name"] not in direct_normal | direct_build,
                "direct": package["name"] in direct_normal | direct_build | direct_dev,
                "role": (
                    "development" if package["name"] in direct_dev and package["name"] not in direct_normal | direct_build
                    else "build" if package["name"] in direct_build and package["name"] not in direct_normal | direct_dev
                    else "runtime" if package["name"] in direct_normal and package["name"] not in direct_build | direct_dev
                    else "multiple" if package["name"] in direct_normal | direct_build | direct_dev
                    else "transitive_or_target_specific"
                ),
            }
        )
    return sorted(rows, key=lambda row: (str(row["name"]), str(row["version"])))


def _dependency_table(table: dict[str, object]) -> dict[str, dict[str, object]]:
    result = {}
    for alias, value in table.items():
        result[alias] = value if isinstance(value, dict) else {}
    return result


def summarize(rows: list[dict[str, object]]) -> dict[str, int]:
    return {
        "packages": len(rows),
        "license_metadata_missing": sum(bool(row["license_metadata_missing"]) for row in rows),
    }


def main() -> None:
    npm = npm_inventory()
    cargo = cargo_inventory()
    output = {
        "format_version": 1,
        "source": "package-lock.json and src-tauri/Cargo.lock; Cargo license fields read from locally cached exact-version manifests",
        "npm": {"summary": summarize(npm), "packages": npm},
        "cargo": {"summary": summarize(cargo), "packages": cargo},
    }
    target = ROOT / "docs/dependency-licenses.json"
    target.parent.mkdir(exist_ok=True)
    target.write_text(json.dumps(output, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"Wrote {target.relative_to(ROOT)}")
    print(f"npm: {len(npm)} packages; {output['npm']['summary']['license_metadata_missing']} missing license metadata")
    print(f"Cargo: {len(cargo)} packages; {output['cargo']['summary']['license_metadata_missing']} missing license metadata")


if __name__ == "__main__":
    main()
