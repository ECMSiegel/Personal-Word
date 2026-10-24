#!/usr/bin/env python3
"""Create a provisional, path-safe source package for an exact public revision.

This packages the public Git revision and checked-in reviewed notices. It does
not claim an offline reconstruction or resolve binary dependency obligations.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import io
import os
import re
import subprocess
import sys
import tarfile
import tempfile
from pathlib import Path, PurePosixPath


ROOT = Path(__file__).resolve().parents[1]
ARCHIVE = "personal-word-source.tar.gz"
EXCLUDED_PARTS = {
    ".git", ".hg", ".svn", "node_modules", "target", "test-results", "playwright-report", "HANDOFF.md", "handoff.md",
    ".env", ".aws", ".ssh", ".gnupg", ".cache", "credentials", "secrets", "tokens", "keys", "cache", "caches",
}
EXCLUDED_PARTS_LOWER = {part.lower() for part in EXCLUDED_PARTS} | {".gnupg"}
KEY_OR_CERT_SUFFIXES = (".pem", ".key", ".p12", ".pfx", ".p7b", ".p7c", ".mobileprovision", ".provisionprofile", ".cer", ".crt")
PERSONAL_PATH = re.compile(rb"(?:/Users/[^\s\"']+|/home/[^\s\"']+)")
PACKAGE_LINE = re.compile(r"^([A-Za-z0-9_.+-]+) v([^ ]+)(?:\s|$)")


class PackageFailure(Exception):
    pass


def run_git(*args: str) -> str:
    result = subprocess.run(["git", *args], cwd=ROOT, capture_output=True, text=True, check=False)
    if result.returncode:
        raise PackageFailure("git could not resolve the requested public revision")
    return result.stdout.strip()


def run_git_bytes(*args: str) -> bytes:
    result = subprocess.run(["git", *args], cwd=ROOT, capture_output=True, check=False)
    if result.returncode:
        raise PackageFailure("git could not read a public source object")
    return result.stdout


def safe_member(name: str) -> bool:
    path = PurePosixPath(name)
    if not name or "\\" in name or "\x00" in name or path.is_absolute() or ".." in path.parts:
        return False
    for part in path.parts:
        lower = part.lower()
        if lower in EXCLUDED_PARTS_LOWER or lower.startswith(".env") or lower in {"id_rsa", "id_ed25519", ".cargo-ok"}:
            return False
        if lower.endswith(KEY_OR_CERT_SUFFIXES):
            return False
        if any(term in lower for term in ("credential", "private-key", "private_key", "secret", "token")):
            return False
    return True


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def dependency_sources(revision: str, archive: tarfile.TarFile) -> tuple[dict[str, str], list[str], dict[str, object]]:
    blockers: list[str] = []
    hashes: dict[str, str] = {}
    provenance: dict[str, object] = {
        "npm_production_packages": 0,
        "cargo_target_union_packages": 0,
        "cargo_targets": [],
        "dependency_content_integrity": {
            "status": "unverified",
            "npm": "local package trees are version-checked; lockfile integrity values are recorded but not verified against tree bytes",
            "cargo": "local cache trees are name/version-checked; Cargo lock checksums and .cargo-checksum.json are not verified",
        },
    }
    blockers.extend((
        "npm dependency source bytes have not been verified against package-lock.json integrity values.",
        "Cargo dependency source bytes have not been verified against Cargo.lock checksums or .cargo-checksum.json.",
    ))

    # Refuse mixed revisions: the local caches and Cargo target graph must be
    # matched to the exact lock/config files being packaged.
    tracked_inputs = ("package.json", "package-lock.json", "src-tauri/Cargo.toml", "src-tauri/Cargo.lock")
    for relative in tracked_inputs:
        committed = run_git_bytes("show", f"{revision}:{relative}")
        if (ROOT / relative).read_bytes() != committed:
            raise PackageFailure("source cache packaging requires a clean worktree matching the requested revision")

    def add_tree(source: Path, archive_prefix: str, package_label: str) -> bool:
        if not source.is_dir() or source.is_symlink():
            blockers.append(f"Local source tree is missing for {package_label}.")
            return False
        for current, dirs, files in os.walk(source, followlinks=False):
            current_path = Path(current)
            kept_dirs = []
            for name in dirs:
                p = current_path / name
                internal = p.relative_to(source).as_posix()
                if p.is_symlink() or not safe_member(internal):
                    blockers.append(f"Unsafe or excluded dependency source path for {package_label}: {internal}.")
                    continue
                kept_dirs.append(name)
            dirs[:] = kept_dirs
            for name in sorted(files):
                path = current_path / name
                internal = path.relative_to(source).as_posix()
                if internal == ".cargo-ok":
                    continue
                if path.is_symlink() or not safe_member(internal):
                    blockers.append(f"Unsafe or excluded dependency source path for {package_label}: {internal}.")
                    continue
                data = path.read_bytes()
                if PERSONAL_PATH.search(data):
                    blockers.append(f"Dependency source contains a personal machine path for {package_label}: {internal}.")
                    continue
                member_name = f"{archive_prefix}/{internal}"
                info = tarfile.TarInfo(member_name)
                info.size = len(data)
                info.mode = path.stat().st_mode & 0o755
                info.mtime = 0
                info.uid = 0
                info.gid = 0
                archive.addfile(info, io.BytesIO(data))
                hashes[member_name] = hashlib.sha256(data).hexdigest()
        return True

    try:
        package_lock = json.loads(run_git_bytes("show", f"{revision}:package-lock.json"))
    except (json.JSONDecodeError, PackageFailure) as exc:
        raise PackageFailure("exact revision package-lock.json is unreadable") from exc
    npm_rows = package_lock.get("packages", {})
    npm_packages = []
    for key, record in sorted(npm_rows.items()):
        if not key.startswith("node_modules/") or record.get("dev", False):
            continue
        if not _supports_macos_arch_union(record):
            continue
        if not safe_member(key.removeprefix("node_modules/")):
            blockers.append(f"Unsafe npm source package path excluded before reading: {key}.")
            continue
        package_path = ROOT / key
        package_json = package_path / "package.json"
        if package_path.is_symlink() or package_json.is_symlink() or not package_json.is_file() or json.loads(package_json.read_text(encoding="utf-8")).get("version") != record.get("version"):
            blockers.append(f"Version-matched local npm source is unavailable: {key}@{record.get('version')}.")
            continue
        if add_tree(package_path, f"npm/{key}", f"{key}@{record.get('version')}"):
            npm_packages.append({
                "install_path": key,
                "version": record.get("version"),
                "lock_integrity": record.get("integrity"),
                "lock_integrity_verified": False,
            })
    provenance["npm_production_packages"] = len(npm_packages)
    provenance["npm_packages"] = npm_packages

    cargo_cache = Path(os.environ.get("CARGO_HOME", Path.home() / ".cargo")) / "registry/src"
    cargo_sets: dict[str, set[tuple[str, str]]] = {}
    for target in ("x86_64-apple-darwin", "aarch64-apple-darwin"):
        try:
            result = subprocess.run(
                ["cargo", "tree", "--locked", "--offline", "--manifest-path", "src-tauri/Cargo.toml", "--edges", "normal,build", "--target", target, "--prefix", "none"],
                cwd=ROOT, capture_output=True, text=True, check=False,
            )
        except OSError:
            blockers.append(f"Cargo is unavailable to resolve the offline dependency graph for {target}.")
            cargo_sets[target] = set()
            continue
        if result.returncode:
            blockers.append(f"Offline Cargo dependency graph could not be resolved for {target}.")
            cargo_sets[target] = set()
            continue
        packages = set()
        for line in result.stdout.splitlines():
            match = PACKAGE_LINE.match(line)
            if match and not line.startswith("folio v"):
                packages.add((match.group(1), match.group(2)))
        cargo_sets[target] = packages
    cargo_union = set().union(*cargo_sets.values())
    provenance["cargo_targets"] = {target: len(rows) for target, rows in cargo_sets.items()}
    cargo_packages = []
    for name, version in sorted(cargo_union):
        candidates = sorted(cargo_cache.glob(f"*/{name}-{version}"))
        if len(candidates) != 1:
            blockers.append(f"Version-matched Cargo source cache is missing or ambiguous: {name} {version}.")
            continue
        source = candidates[0]
        if add_tree(source, f"cargo/{name}-{version}", f"{name} {version}"):
            cargo_packages.append({
                "name": name,
                "version": version,
                "cache_tree": "Cargo registry source cache",
                "lock_checksum_verified": False,
            })
    provenance["cargo_target_union_packages"] = len(cargo_packages)
    provenance["cargo_packages"] = cargo_packages
    return hashes, blockers, provenance


def _supports_macos_arch_union(record: dict[str, object]) -> bool:
    os_values = record.get("os")
    cpu_values = record.get("cpu")
    return (not os_values or "darwin" in os_values) and (not cpu_values or bool({"x64", "arm64"} & set(cpu_values)))


def build(revision: str, output: Path) -> dict[str, object]:
    if not re.fullmatch(r"[0-9a-fA-F]{40,64}", revision):
        raise PackageFailure("--revision must be a full hexadecimal commit ID")
    resolved = run_git("rev-parse", "--verify", f"{revision}^{{commit}}")
    if resolved.lower() != revision.lower():
        raise PackageFailure("--revision must name the exact full commit ID")
    try:
        package_json = json.loads(run_git("show", f"{resolved}:package.json"))
        version = package_json["version"]
    except (json.JSONDecodeError, KeyError, TypeError) as exc:
        raise PackageFailure("package.json at the requested revision has no readable version") from exc
    output = output.resolve()
    if output.exists() and (not output.is_dir() or any(output.iterdir())):
        raise PackageFailure("--out must be a new or empty directory")
    output.mkdir(parents=True, exist_ok=True)

    archive_path = output / ARCHIVE
    filtered_source_files: list[dict[str, str]] = []
    tree = run_git_bytes("ls-tree", "-r", "-z", resolved)
    objects: list[tuple[str, str, bytes]] = []
    source_manifest: dict[str, str] = {}
    for record in tree.split(b"\0"):
        if not record:
            continue
        metadata, raw_path = record.split(b"\t", 1)
        mode, kind, oid = metadata.decode("ascii").split()
        try:
            repo_path = raw_path.decode("utf-8")
        except UnicodeDecodeError as exc:
            raise PackageFailure("revision contains a non-UTF-8 path; source packaging stopped") from exc
        if not safe_member(repo_path):
            filtered_source_files.append({"repo_path": repo_path, "reason": "excluded path may contain private or generated material"})
            continue
        if kind != "blob":
            filtered_source_files.append({"repo_path": repo_path, "reason": "non-regular tracked file omitted"})
            raise PackageFailure("complete source manifest cannot represent a tracked submodule or non-blob entry")
        data = run_git_bytes("cat-file", "blob", oid)
        # This map describes the exact safe Git-tracked snapshot for the
        # verifier. It is intentionally separate from the archive manifest:
        # the package archive may omit a symlink or personal-path document.
        source_manifest[repo_path] = hashlib.sha256(data).hexdigest()
        if mode == "120000":
            filtered_source_files.append({"repo_path": repo_path, "reason": "tracked symlink omitted"})
            continue
        objects.append((repo_path, mode, data))

    with tempfile.TemporaryDirectory(prefix="personal-word-source-") as temp_dir:
        archive_path_tmp = Path(temp_dir) / ARCHIVE
        with tarfile.open(archive_path_tmp, "w:gz", format=tarfile.PAX_FORMAT) as packaged:
            root_dir = tarfile.TarInfo("source/")
            root_dir.type = tarfile.DIRTYPE
            root_dir.mode = 0o755
            root_dir.mtime = 0
            packaged.addfile(root_dir)
            seen_dirs = {"source"}
            for repo_path, mode, data in objects:
                segments = PurePosixPath(repo_path).parts
                for index in range(1, len(segments)):
                    directory = "source/" + "/".join(segments[:index])
                    if directory not in seen_dirs:
                        info = tarfile.TarInfo(directory + "/")
                        info.type = tarfile.DIRTYPE
                        info.mode = 0o755
                        info.mtime = 0
                        packaged.addfile(info)
                        seen_dirs.add(directory)
                if PERSONAL_PATH.search(data):
                    filtered_source_files.append({"repo_path": repo_path, "reason": "tracked documentation contains a personal machine path"})
                    continue
                clean = tarfile.TarInfo("source/" + repo_path)
                clean.size = len(data)
                clean.mode = int(mode, 8) & 0o755
                clean.mtime = 0
                clean.uid = 0
                clean.gid = 0
                clean.uname = ""
                clean.gname = ""
                packaged.addfile(clean, io.BytesIO(data))
        final_archive = output / ARCHIVE
        final_archive.write_bytes(archive_path_tmp.read_bytes())

    # The tracked app source is paired with locally available, version-matched
    # production npm sources and the target-specific normal/build Cargo source
    # union. Cache content is not authenticated against lockfile checksums.
    lock_hash = hashlib.sha256((ROOT / "package-lock.json").read_bytes() + (ROOT / "src-tauri/Cargo.lock").read_bytes()).hexdigest()
    blockers = _documented_distribution_blockers(resolved)
    if filtered_source_files:
        blockers.append("The project source archive omits one or more tracked paths; inspect filtered_source_files and resolve the source-package completeness review.")
    third_party_archive = output / "third-party-source.tar.gz"
    with tarfile.open(third_party_archive, "w:gz", format=tarfile.PAX_FORMAT) as dependency_tar:
        dependency_hashes, dependency_blockers, dependency_provenance = dependency_sources(resolved, dependency_tar)
    blockers.extend(dependency_blockers)
    (output / "dependency-manifest.json").write_text(json.dumps(dependency_hashes, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    archive_manifest: dict[str, str] = {}
    with tarfile.open(final_archive, "r:gz") as source_tar:
        for member in source_tar.getmembers():
            if member.isfile():
                stream = source_tar.extractfile(member)
                if stream is None:
                    raise PackageFailure("cannot read packaged source member")
                archive_manifest[member.name.removeprefix("source/")] = hashlib.sha256(stream.read()).hexdigest()
    source_manifest_path = output / "source-manifest.json"
    archive_manifest_path = output / "archive-manifest.json"
    source_manifest_path.write_text(json.dumps(source_manifest, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    archive_manifest_path.write_text(json.dumps(archive_manifest, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    provenance = {
        "format_version": 2,
        "source_revision": resolved,
        "version": version,
        "archive": ARCHIVE,
        "archive_sha256": sha256(final_archive),
        "source_manifest": source_manifest_path.name,
        "source_manifest_sha256": sha256(source_manifest_path),
        "archive_manifest": archive_manifest_path.name,
        "archive_manifest_sha256": sha256(archive_manifest_path),
        "third_party_source_archive": third_party_archive.name,
        "third_party_source_archive_sha256": sha256(third_party_archive),
        "lockfiles_sha256": lock_hash,
        "source_scope": "filtered tracked public source plus locally cached version-matched production npm and Mac-target normal/build Rust sources; project archive omissions are listed separately; dependency bytes are not verified against lockfile checksums; no Git metadata",
        "source_archive_complete": not bool(filtered_source_files),
        "filtered_source_files": filtered_source_files,
        "third_party_source": dependency_provenance,
        "distribution_blockers": blockers,
    }
    (output / "provenance.json").write_text(json.dumps(provenance, indent=2) + "\n", encoding="utf-8")
    (output / "BUILDING.md").write_text(
        "# Rebuild Personal Word from this source\n\n"
        "The project archive contains safe tracked source files from the exact revision that pass the path and personal-machine-path filters. "
        "Any filtered tracked paths are listed in provenance.json and leave a source-completeness blocker. The separate third-party-source.tar.gz "
        "contains locally available version-matched production npm package trees and the union of normal/build Cargo trees "
        "resolved offline for x86_64-apple-darwin and aarch64-apple-darwin. Dependency source bytes have not been verified "
        "against the package-lock.json integrity values or Cargo.lock checksums, so this archive is provisional and is not "
        "authenticated corresponding-source evidence. This is not a self-contained offline source bundle. "
        "Use Node.js 22, Rust and Apple command line tools, "
        "then run `npm ci` and `npm run tauri build` on a supported Mac. The lockfiles pin package versions.\n\n"
        "The adjacent source-manifest.json is the SHA-256 map of safe tracked Git files for comparison with the matching "
        "clean checkout; archive-manifest.json separately maps the actual project archive members. These maps differ when "
        "tracked files are filtered, so the source map does not imply those omitted bytes are present in the archive. "
        "The source archive omits Git metadata; run the verifier from the matching clean Git checkout.\n\n"
        "The adjacent provenance.json lists unresolved binary notice and corresponding-source questions. Package metadata "
        "does not prove which dependencies are linked into a particular binary. Do not treat this package "
        "as legal-completeness evidence or use it to clear a release gate.\n",
        encoding="utf-8",
    )
    sums = [f"{sha256(final_archive)}  {ARCHIVE}"]
    sums.append(f"{sha256(third_party_archive)}  {third_party_archive.name}")
    sums.append(f"{sha256(output / 'source-manifest.json')}  source-manifest.json")
    sums.append(f"{sha256(output / 'archive-manifest.json')}  archive-manifest.json")
    sums.append(f"{sha256(output / 'dependency-manifest.json')}  dependency-manifest.json")
    sums.append(f"{sha256(output / 'provenance.json')}  provenance.json")
    sums.append(f"{sha256(output / 'BUILDING.md')}  BUILDING.md")
    (output / "SHA256SUMS").write_text("\n".join(sums) + "\n", encoding="utf-8")
    return provenance


def _documented_distribution_blockers(revision: str) -> list[str]:
    document = run_git_bytes("show", f"{revision}:docs/distribution.md").decode("utf-8")
    marker = "## Current release blockers"
    if marker not in document:
        raise PackageFailure("distribution status must document current release blockers")
    section = document.split(marker, 1)[1].split("\n## ", 1)[0]
    blockers = [line[2:].strip() for line in section.splitlines() if line.startswith("- ")]
    return blockers


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--revision", required=True)
    parser.add_argument("--out", required=True, type=Path)
    args = parser.parse_args()
    try:
        manifest = build(args.revision, args.out)
    except (OSError, PackageFailure, tarfile.TarError) as exc:
        print(json.dumps({"status": "fail", "reason": str(exc)}, sort_keys=True))
        return 1
    print(json.dumps({"status": "provisional", "revision": manifest["source_revision"], "archive_sha256": manifest["archive_sha256"], "distribution_blockers": len(manifest["distribution_blockers"])}, sort_keys=True))
    return 0


if __name__ == "__main__":
    sys.exit(main())
