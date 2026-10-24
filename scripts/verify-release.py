#!/usr/bin/env python3
"""Fail-closed checks for a Personal Word macOS release candidate."""

from __future__ import annotations

import argparse
import hashlib
import json
import plistlib
import re
import shutil
import stat
import subprocess
import sys
import tomllib
from pathlib import Path, PurePosixPath


APP_ID = "com.folio.writing"
EXECUTABLE = "folio"
SMOKE_MARKERS = (b"FOLIO_SMOKE", b"native-smoke", b"smoke_report", b"smoke_progress", b"native-smoke.js")
SOURCE_ANCHORS = (
    "package.json",
    "src-tauri/tauri.conf.json",
    "src-tauri/Cargo.lock",
    "src-tauri/resources/THIRD_PARTY_NOTICES.txt",
    "src-tauri/resources/licenses/noto-sans-OFL-1.1.txt",
    "src-tauri/resources/licenses/noto-sans-mono-OFL-1.1.txt",
    "src-tauri/resources/licenses/noto-serif-OFL-1.1.txt",
    "THIRD_PARTY.md",
    "docs/distribution.md",
)
ROOT = Path(__file__).resolve().parents[1]
REQUIRED_LICENSES = (
    "noto-sans-OFL-1.1.txt",
    "noto-sans-mono-OFL-1.1.txt",
    "noto-serif-OFL-1.1.txt",
)


class CheckFailure(Exception):
    pass


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def safe_source_path(path: str) -> bool:
    # The map uses Git's slash-separated repository paths on every host.
    if not path or "\\" in path or "\x00" in path:
        return False
    parts = PurePosixPath(path).parts
    if PurePosixPath(path).is_absolute() or not parts or ".." in parts:
        return False
    forbidden = {
        ".git", ".hg", ".svn", ".aws", ".ssh", ".gnupg", ".cache",
        "node_modules", "target", "test-results", "playwright-report", "cache", "caches", "credentials",
        "secrets", "tokens", "keys", "handoff.md", "id_rsa", "id_ed25519", ".cargo-ok",
    }
    forbidden_suffixes = (
        ".pem", ".key", ".p12", ".pfx", ".p7b", ".p7c",
        ".mobileprovision", ".provisionprofile", ".cer", ".crt",
    )
    for part in parts:
        lower = part.lower()
        if (lower in forbidden or lower.startswith(".env")
                or lower.endswith(forbidden_suffixes)
                or any(word in lower for word in ("credential", "private-key", "private_key", "secret", "token"))):
            return False
    return True


def _git(*args: str) -> bytes:
    result = subprocess.run(
        ["git", "-C", str(ROOT), *args], capture_output=True, check=False
    )
    if result.returncode:
        raise CheckFailure("source checkout Git metadata could not be verified")
    return result.stdout


def source_checkout() -> tuple[Path, str, set[str]]:
    checkout = ROOT.resolve()
    try:
        invocation_dir = Path.cwd().resolve()
    except OSError as exc:
        raise CheckFailure("verifier working directory is unavailable") from exc
    if invocation_dir != checkout:
        raise CheckFailure("verifier must run with the exact source repository root as its working directory")
    try:
        git_root = Path(_git("rev-parse", "--show-toplevel").decode("utf-8").strip()).resolve()
        revision = _git("rev-parse", "HEAD").decode("ascii").strip()
        index_raw = _git("ls-files", "-z")
        head_raw = _git("ls-tree", "-r", "--name-only", "-z", "HEAD")
    except (UnicodeDecodeError, OSError) as exc:
        raise CheckFailure("source checkout Git metadata is unreadable") from exc
    if git_root != checkout:
        raise CheckFailure("verifier script must belong to the exact source repository root")
    if not re.fullmatch(r"[0-9a-f]{40,64}", revision):
        raise CheckFailure("source checkout does not identify a full Git revision")
    try:
        index_paths = {path.decode("utf-8") for path in index_raw.split(b"\0") if path}
        head_paths = {path.decode("utf-8") for path in head_raw.split(b"\0") if path}
    except UnicodeDecodeError as exc:
        raise CheckFailure("tracked source path is not valid UTF-8") from exc
    tracked_candidates = index_paths | head_paths
    if any(not safe_source_path(path) for path in tracked_candidates):
        raise CheckFailure("tracked source contains an unsafe path")

    # Validate all tracked names and their filesystem entries before `git diff`
    # can inspect working-tree file contents. In particular, do not follow a
    # tracked symlink or a symlinked ancestor while checking source cleanliness.
    for relative in tracked_candidates:
        parts = PurePosixPath(relative).parts
        current = checkout
        for index, part in enumerate(parts):
            current = current / part
            try:
                entry = current.lstat()
            except OSError as exc:
                raise CheckFailure("tracked source path is missing or unreadable") from exc
            if stat.S_ISLNK(entry.st_mode):
                raise CheckFailure("tracked source path or ancestor is a symlink")
            if index < len(parts) - 1:
                if not stat.S_ISDIR(entry.st_mode):
                    raise CheckFailure("tracked source ancestor is not a directory")
            elif not stat.S_ISREG(entry.st_mode):
                raise CheckFailure("tracked source entry is not a regular file")
        if not current.resolve().is_relative_to(checkout):
            raise CheckFailure("tracked source path escapes the repository root")

    clean = subprocess.run(
        ["git", "-C", str(checkout), "diff", "--quiet", "HEAD", "--"],
        capture_output=True,
        check=False,
    )
    if clean.returncode != 0:
        raise CheckFailure("tracked source checkout has changes relative to HEAD")
    return checkout, revision, head_paths


def source_versions(checkout: Path) -> dict[str, object]:
    try:
        package = json.loads((checkout / "package.json").read_text(encoding="utf-8"))
        lock = json.loads((checkout / "package-lock.json").read_text(encoding="utf-8"))
        tauri = json.loads((checkout / "src-tauri/tauri.conf.json").read_text(encoding="utf-8"))
        cargo = tomllib.loads((checkout / "src-tauri/Cargo.toml").read_text(encoding="utf-8"))
        cargo_lock = tomllib.loads((checkout / "src-tauri/Cargo.lock").read_text(encoding="utf-8"))
        cargo_package = cargo["package"]
        cargo_lock_rows = [
            row for row in cargo_lock["package"]
            if row.get("name") == cargo_package["name"]
        ]
        if len(cargo_lock_rows) != 1:
            raise CheckFailure("Cargo.lock does not identify exactly one application package")
        versions = {
            "package.json": package["version"],
            "package-lock.json": lock["version"],
            "package-lock.json packages root": lock["packages"][""]["version"],
            "src-tauri/tauri.conf.json": tauri["version"],
            "src-tauri/Cargo.toml": cargo_package["version"],
            "src-tauri/Cargo.lock": cargo_lock_rows[0]["version"],
        }
    except (OSError, json.JSONDecodeError, KeyError, TypeError, tomllib.TOMLDecodeError) as exc:
        raise CheckFailure("source version metadata is missing or unreadable") from exc
    if any(not isinstance(version, str) or not version for version in versions.values()):
        raise CheckFailure("source version metadata is missing or unreadable")
    return versions


def source_evidence(manifest_path: Path, expected_version: str) -> dict[str, object]:
    try:
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise CheckFailure("source manifest is unreadable") from exc
    if not isinstance(manifest, dict) or not manifest:
        raise CheckFailure("source manifest must be a non-empty repo-path to SHA-256 mapping")
    for path, digest in manifest.items():
        if not isinstance(path, str):
            raise CheckFailure("source manifest contains a non-text path")
        if (not isinstance(path, str) or not safe_source_path(path)
                or not isinstance(digest, str)
                or not re.fullmatch(r"[0-9a-f]{64}", digest)):
            raise CheckFailure("source manifest contains an unsafe path or invalid SHA-256")
    checkout, revision, tracked = source_checkout()
    if not set(SOURCE_ANCHORS).issubset(tracked):
        raise CheckFailure("source manifest is missing required source anchor files")
    if set(manifest) != tracked:
        raise CheckFailure("source manifest paths do not exactly match the tracked source files")
    for relative, expected_hash in manifest.items():
        source_file = checkout / relative
        path_parts = PurePosixPath(relative).parts
        ancestors = [checkout.joinpath(*path_parts[:index]) for index in range(1, len(path_parts))]
        if (source_file.is_symlink() or any(part.is_symlink() for part in ancestors)
                or not source_file.is_file() or not source_file.resolve().is_relative_to(checkout)):
            raise CheckFailure("source manifest path is missing, a symlink, or escapes the checkout")
        if sha256(source_file) != expected_hash:
            raise CheckFailure("source manifest does not match the current checked-out source tree")
    versions = source_versions(checkout)
    if any(version != expected_version for version in versions.values()):
        raise CheckFailure("requested version does not match all source package and application version fields")
    distribution_doc = (checkout / "docs/distribution.md").read_text(encoding="utf-8")
    marker = "## Current release blockers"
    if marker not in distribution_doc:
        raise CheckFailure("distribution document must state its current release blockers")
    section = distribution_doc.split(marker, 1)[1].split("\n## ", 1)[0]
    blockers = [line[2:].strip() for line in section.splitlines() if line.startswith("- ")]
    return {
        "verified_paths": len(manifest),
        "manifest_sha256": sha256(manifest_path),
        "revision": revision,
        "version": expected_version,
        "version_fields": versions,
        "blockers": blockers,
    }


def independent_review(manifest_path: Path, app_binary: Path, source: dict[str, object]) -> None:
    review_path = manifest_path.parent / "release-review.json"
    try:
        review = json.loads(review_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise CheckFailure("strict publication requires release-review.json tied to this exact candidate") from exc
    if (not isinstance(review, dict)
            or review.get("decision") != "approved"
            or not isinstance(review.get("reviewer"), str) or not review["reviewer"].strip()
            or not isinstance(review.get("reviewed_at"), str) or len(review["reviewed_at"]) < 10
            or review.get("artifact_sha256") != sha256(app_binary)
            or review.get("source_manifest_sha256") != source["manifest_sha256"]
            or review.get("source_revision") != source["revision"]
            or review.get("distribution_blockers") != []):
        raise CheckFailure("independent review is missing, unresolved, or does not match this exact candidate")


def architectures(binary: Path) -> set[str]:
    lipo = shutil.which("lipo")
    if not lipo:
        raise CheckFailure("lipo is unavailable; executable architecture cannot be verified")
    result = subprocess.run([lipo, "-archs", str(binary)], capture_output=True, text=True, check=False)
    if result.returncode:
        raise CheckFailure("lipo could not read executable architecture")
    return set(result.stdout.split())


def command_ok(args: list[str], description: str) -> None:
    if not shutil.which(args[0]):
        raise CheckFailure(f"{args[0]} is unavailable; {description} cannot be verified")
    result = subprocess.run(args, capture_output=True, text=True, check=False)
    if result.returncode:
        raise CheckFailure(f"{description} failed")


def verify(args: argparse.Namespace) -> dict[str, object]:
    app = args.app.resolve()
    contents = app / "Contents"
    info_path = contents / "Info.plist"
    binary = contents / "MacOS" / EXECUTABLE
    if (not app.is_dir() or not info_path.is_file() or not binary.is_file()
            or info_path.is_symlink() or binary.is_symlink()
            or not info_path.resolve().is_relative_to(app) or not binary.resolve().is_relative_to(app)):
        raise CheckFailure("app must contain Contents/Info.plist and Contents/MacOS/folio")
    try:
        info = plistlib.loads(info_path.read_bytes())
    except (OSError, plistlib.InvalidFileException) as exc:
        raise CheckFailure("Info.plist is unreadable") from exc
    if info.get("CFBundleIdentifier") != APP_ID:
        raise CheckFailure("bundle identifier does not match com.folio.writing")
    if app.name != "Personal Word.app" or info.get("CFBundleName") != "Personal Word" or info.get("CFBundleDisplayName") != "Personal Word":
        raise CheckFailure("app bundle name is not Personal Word")
    if info.get("CFBundleExecutable") != EXECUTABLE:
        raise CheckFailure("bundle executable is not folio")
    if info.get("CFBundleShortVersionString") != args.version or info.get("CFBundleVersion") != args.version:
        raise CheckFailure("bundle version does not match the requested version")
    found_arches = architectures(binary)
    if found_arches != {args.arch}:
        raise CheckFailure("executable architecture does not exactly match the requested architecture")
    raw = binary.read_bytes()
    if any(marker in raw for marker in SMOKE_MARKERS):
        raise CheckFailure("native smoke-test marker was found in the release executable")

    resources = contents / "Resources"
    notices = resources / "THIRD_PARTY_NOTICES.txt"
    licenses = resources / "licenses"
    if (not notices.is_file() or notices.is_symlink()
            or not notices.resolve().is_relative_to(app) or licenses.is_symlink()
            or not licenses.resolve().is_relative_to(app)):
        raise CheckFailure("bundled THIRD_PARTY_NOTICES.txt is missing")
    notice_text = notices.read_text(encoding="utf-8", errors="replace")
    if "OFL-1.1" not in notice_text:
        raise CheckFailure("bundled notices do not identify OFL-1.1")
    source_notices = Path.cwd() / "src-tauri/resources/THIRD_PARTY_NOTICES.txt"
    if notices.read_bytes() != source_notices.read_bytes():
        raise CheckFailure("bundled notices differ from the exact checked-out notice file")
    missing = [name for name in REQUIRED_LICENSES if not (licenses / name).is_file()]
    if missing:
        raise CheckFailure("required bundled Noto OFL license text is missing")
    for name in REQUIRED_LICENSES:
        license_path = licenses / name
        if (license_path.is_symlink() or not license_path.resolve().is_relative_to(app)
                or not license_path.stat().st_size):
            raise CheckFailure("required bundled Noto OFL license text is empty")
        source_license = Path.cwd() / "src-tauri/resources/licenses" / name
        if license_path.read_bytes() != source_license.read_bytes():
            raise CheckFailure("bundled Noto OFL text differs from the exact checked-out license file")

    source_manifest = args.source_manifest.resolve()
    source = source_evidence(source_manifest, args.version)
    if binary.stat().st_mtime_ns <= source_manifest.stat().st_mtime_ns:
        raise CheckFailure("candidate executable predates the captured source manifest")
    notarized = False
    if args.require_notarized:
        command_ok(["codesign", "--verify", "--deep", "--strict", "--verbose=2", str(app)], "code signature verification")
        detail = subprocess.run(["codesign", "-dv", "--verbose=4", str(app)], capture_output=True, text=True, check=False)
        if detail.returncode or "Authority=Developer ID Application:" not in detail.stderr or "TeamIdentifier=not set" in detail.stderr:
            raise CheckFailure("strict verification requires a valid Developer ID Application signature")
        command_ok(["spctl", "--assess", "--type", "execute", "--verbose=2", str(app)], "Gatekeeper assessment")
        command_ok(["xcrun", "stapler", "validate", str(app)], "notarization ticket validation")
        if source["blockers"]:
            raise CheckFailure("strict publication blocked by unresolved source or notice obligations")
        independent_review(args.source_manifest.resolve(), binary, source)
        notarized = True
    return {
        "status": "pass",
        "app": app.name,
        "bundle_id": APP_ID,
        "version": args.version,
        "architecture": args.arch,
        "source_revision": source["revision"],
        "executable_sha256": sha256(binary),
        "binary_mtime_ns": binary.stat().st_mtime_ns,
        "source_manifest_mtime_ns": source_manifest.stat().st_mtime_ns,
        "notarized": notarized,
        "source": source,
        "distribution_blockers": source["blockers"],
        "distribution_ready": notarized and not bool(source["blockers"]),
        "notices": "present; candidate check does not establish actual binary dependency graph completeness",
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--app", required=True, type=Path)
    parser.add_argument("--arch", required=True, choices=("x86_64", "arm64"))
    parser.add_argument("--version", required=True)
    parser.add_argument("--source-manifest", required=True, type=Path)
    parser.add_argument("--require-notarized", action="store_true")
    args = parser.parse_args()
    try:
        evidence = verify(args)
    except CheckFailure as exc:
        print(json.dumps({"status": "fail", "reason": str(exc)}, sort_keys=True))
        return 1
    print(json.dumps(evidence, sort_keys=True))
    return 0


if __name__ == "__main__":
    sys.exit(main())
