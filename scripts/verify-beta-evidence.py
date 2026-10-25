#!/usr/bin/env python3
"""Strict, fail-closed verifier for the Personal Word beta evidence manifest (plan D2).

    python3 scripts/verify-beta-evidence.py --evidence <EVIDENCE.json> --source-manifest <SOURCE_MANIFEST.json>
    python3 scripts/verify-beta-evidence.py --write-source-manifest <SOURCE_MANIFEST.json>

What it does, in plain terms
- Re-hashes every source file the manifest lists and refuses any difference, extra file or missing file.
- Opens every log the evidence names, checks its SHA-256 and re-reads the result line itself, so a
  count typed into EVIDENCE.json cannot disagree with the real log.
- Re-opens the native durability run folders (result.json) and checks that the source identity
  they recorded still matches the current tree and the current diagnostic binary.
- Inspects the normal Personal Word.app: release location, Info.plist identity, freshness against the
  build start and the sources, and a byte search for diagnostic markers.
- Reports states honestly: passed | failed | blocked | not-run. Owner real-use outcomes and the
  independent review are "pending" until someone records them, which keeps the exit code nonzero.

Exit codes
  0  every required item is verified (nothing failed, blocked, not-run or pending)
  1  integrity failure or a failed check (evidence is wrong, forged, stale or a check failed)
  2  evidence is consistent, but items are pending/blocked/not-run (named in the output)
  3  usage error

Review verdict rule (check 6, REVIEW-CLAIM-UNBACKED): a review recorded as passed must cite the file's current
sha256, and the file must contain at least one markdown heading line '## Verdict: ...' or '## Final verdict: ...'
(any heading level) and EVERY such heading's text must begin with PASS/PASSED. A FAIL heading, a missing heading,
or 'verdict: PASS' appearing only in body text (e.g. quoting an earlier gate) is rejected with REVIEW-CLAIM-UNBACKED.

Only standard-library Python. Nothing is signed, notarized or downloaded; those are out of scope.
"""
from __future__ import annotations

import argparse
import hashlib
import importlib.util
import json
import plistlib
import re
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
STATES = ("passed", "failed", "blocked", "not-run")
OWNER_STATES = ("pending", "passed", "failed", "blocked")
SCHEMA = "personal-word-beta-evidence/2"
MANIFEST_SCHEMA = "personal-word-source-manifest/1"

REQUIRED_CHECKS = (
    "tsc",
    "build",
    "unitTests",
    "playwright",
    "cargoTest",
    "nativeSmokeBuild",
    "nativeBaseline",
    "nativeBeta",
    "saveBenchmark",
    "normalReleaseBuild",
)
OWNER_GATES = (
    "keyboardAndCommentAnchors",
    "closeRetry",
    "recoveredImage",
    "preRestoreSafetyCopy",
    "wordRendering",
    "appleSilicon",
    "voiceOverAndIme",
    "longSession",
    "webkitVisuals",
)
# Bytes that must never be inside the normal app (diagnostic hooks and the diagnostic identity).
APP_MARKERS = (
    "smoke_beta_fixture",
    "post-asset-stage",
    "post-merge-safety-snapshot",
    "post-restore-safety-snapshot",
    "FOLIO_SMOKE",
    "Beta synthetic durability fixture",
    "com.folio.smoke",
    "native-print",
    "native-smoke",
    "smoke_report",
    "smoke_progress",
)
# Evidence may not carry signing, notarization or download fields (descoped by the owner).
FORBIDDEN_WORDS = re.compile(r"\b(sign|signs|signed|signing|signature|signatures|dmg|codesign\w*|notar\w*|staple\w*|download\w*)\b", re.I)


def forbidden_key(key: str) -> bool:
    """True for keys like signedBy, code_sign, notarization or downloadUrl (camelCase and snake_case are split into words)."""
    words = re.sub(r"([a-z0-9])([A-Z])", r"\1 \2", key).replace("_", " ").replace("-", " ")
    return bool(FORBIDDEN_WORDS.search(words) or re.search(r"notar|codesign|download", key, re.I))

# Source manifest selection: everything that builds, tests or checks the app.
SOURCE_DIRS = ("src", "src-tauri/src", "src-tauri/tests", "src-tauri/capabilities", "src-tauri/resources", "tests", "scripts")
SOURCE_FILES = (
    "package.json",
    "package-lock.json",
    "index.html",
    "tsconfig.json",
    "vite.config.ts",
    "src-tauri/Cargo.toml",
    "src-tauri/Cargo.lock",
    "src-tauri/build.rs",
    "src-tauri/tauri.conf.json",
    "src-tauri/tauri.release.conf.json",
)
SOURCE_SKIP_PARTS = {"__pycache__", "node_modules", "target", "dist", ".cache", ".DS_Store"}
# Files that end up inside the app binary: used for the freshness comparison.
APP_INPUT_DIRS = ("src", "src-tauri/src", "src-tauri/capabilities", "src-tauri/resources")
APP_INPUT_FILES = ("index.html", "package.json", "package-lock.json", "vite.config.ts", "src-tauri/Cargo.toml",
                   "src-tauri/Cargo.lock", "src-tauri/build.rs", "src-tauri/tauri.conf.json")


class Report:
    def __init__(self):
        self.failures: list[tuple[str, str]] = []
        self.pending: list[tuple[str, str]] = []
        self.notes: list[str] = []

    def ok(self, text):
        print(f"  [PASS] {text}")

    def fail(self, code, text):
        self.failures.append((code, text))
        print(f"  [FAIL] {code}: {text}")

    def wait(self, name, text):
        self.pending.append((name, text))
        print(f"  [PENDING] {name}: {text}")

    def na(self, text):
        self.notes.append(text)
        print(f"  [N/A]  {text}")


# ----------------------------------------------------------------------------- helpers

def canonical(value):
    return json.dumps(value, sort_keys=True, ensure_ascii=False, separators=(",", ":"))


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with open(path, "rb") as stream:
        for chunk in iter(lambda: stream.read(1 << 20), b""):
            digest.update(chunk)
    return digest.hexdigest()


def rel(path: Path) -> str:
    try:
        return str(path.relative_to(ROOT))
    except ValueError:
        return str(path)


def resolve(value) -> Path | None:
    if not isinstance(value, str) or not value:
        return None
    path = Path(value)
    return path if path.is_absolute() else ROOT / path


def parse_time(value):
    if not isinstance(value, str):
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00")).astimezone(timezone.utc)
    except ValueError:
        return None


def walk_keys(value, path=""):
    if isinstance(value, dict):
        for key, child in value.items():
            yield f"{path}/{key}", key
            yield from walk_keys(child, f"{path}/{key}")
    elif isinstance(value, list):
        for index, child in enumerate(value):
            yield from walk_keys(child, f"{path}[{index}]")


def git_head():
    result = subprocess.run(["git", "-C", str(ROOT), "rev-parse", "HEAD"], capture_output=True, text=True, check=False)
    return result.stdout.strip() if result.returncode == 0 else None


def file_arch(path: Path):
    result = subprocess.run(["file", "-b", str(path)], capture_output=True, text=True, check=False)
    text = result.stdout.strip()
    for arch in ("x86_64", "arm64"):
        if arch in text:
            return arch, text
    return None, text


def load_native_module():
    """Reuse the native runner's own source-input rule so the two never drift apart."""
    spec = importlib.util.spec_from_file_location("native_reliability_for_verifier", ROOT / "scripts/native-reliability.py")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


# ----------------------------------------------------------------------------- source manifest

def source_files() -> list[Path]:
    found: set[Path] = set()
    for name in SOURCE_FILES:
        path = ROOT / name
        if path.is_file():
            found.add(path)
    for folder in SOURCE_DIRS:
        base = ROOT / folder
        if base.is_dir():
            for path in base.rglob("*"):
                parts = set(path.relative_to(ROOT).parts)
                if path.is_file() and not (parts & SOURCE_SKIP_PARTS) and path.suffix != ".pyc":
                    found.add(path)
    return sorted(found, key=lambda item: rel(item))


def build_source_manifest() -> dict:
    files = [{"path": rel(path), "sha256": sha256_file(path)} for path in source_files()]
    return {
        "schema": MANIFEST_SCHEMA,
        "generatedAt": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "gitCommit": git_head(),
        "selection": {"dirs": list(SOURCE_DIRS), "files": list(SOURCE_FILES), "skippedParts": sorted(SOURCE_SKIP_PARTS)},
        "fileCount": len(files),
        "manifestSha256": hashlib.sha256(canonical(files).encode()).hexdigest(),
        "files": files,
    }


def check_source_manifest(report: Report, evidence: dict, manifest_path: Path):
    print("2. Source manifest (exact current hashes)")
    try:
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    except (OSError, ValueError) as error:
        report.fail("SOURCE-MANIFEST-UNREADABLE", f"{manifest_path}: {error}")
        return
    files = manifest.get("files")
    if manifest.get("schema") != MANIFEST_SCHEMA or not isinstance(files, list) or not files:
        report.fail("SOURCE-MANIFEST-SCHEMA", "manifest has the wrong schema or no files")
        return
    declared = {}
    for item in files:
        if not isinstance(item, dict) or not isinstance(item.get("path"), str) or not isinstance(item.get("sha256"), str):
            report.fail("SOURCE-MANIFEST-SCHEMA", f"malformed manifest entry: {item!r}")
            return
        declared[item["path"]] = item["sha256"]
    digest = hashlib.sha256(canonical(files).encode()).hexdigest()
    if digest != manifest.get("manifestSha256"):
        report.fail("SOURCE-MANIFEST-DIGEST", f"manifestSha256 {manifest.get('manifestSha256')} does not match its own file list ({digest})")
    claimed = (evidence.get("sourceManifest") or {}).get("manifestSha256")
    if claimed != manifest.get("manifestSha256"):
        report.fail("SOURCE-MANIFEST-LINK", f"EVIDENCE.json sourceManifest.manifestSha256 {claimed} != manifest file {manifest.get('manifestSha256')}")
    current = {rel(path): path for path in source_files()}
    mismatched = []
    for path_text, expected in declared.items():
        path = current.get(path_text)
        if path is None:
            continue
        if sha256_file(path) != expected:
            mismatched.append(path_text)
    missing = sorted(set(declared) - set(current))
    extra = sorted(set(current) - set(declared))
    if mismatched:
        report.fail("SOURCE-HASH-MISMATCH", f"{len(mismatched)} file(s) differ from the manifest, first: {mismatched[:5]}")
    if missing:
        report.fail("SOURCE-FILE-MISSING", f"{len(missing)} manifest file(s) are gone, first: {missing[:5]}")
    if extra:
        report.fail("SOURCE-FILE-UNLISTED", f"{len(extra)} current source file(s) are not in the manifest, first: {extra[:5]}")
    if not (mismatched or missing or extra) and digest == manifest.get("manifestSha256"):
        report.ok(f"{len(declared)} source files match the manifest exactly (manifest {digest[:16]})")


# ----------------------------------------------------------------------------- log parsing

def read_log(report: Report, check_id: str, entry: dict, field="logPath", hash_field="logSha256"):
    path = resolve(entry.get(field))
    if path is None or not path.is_file():
        report.fail("PATH-MISSING", f"{check_id}: {field} {entry.get(field)!r} does not exist")
        return None, None
    actual = sha256_file(path)
    if entry.get(hash_field) != actual:
        report.fail("LOG-HASH-MISMATCH", f"{check_id}: {rel(path)} sha256 {actual[:16]} != recorded {str(entry.get(hash_field))[:16]}")
        return None, None
    return path, path.read_text(encoding="utf-8", errors="replace")


def expect_counts(report: Report, check_id: str, entry: dict, actual: dict):
    claimed = entry.get("counts") or {}
    for key, value in actual.items():
        if claimed.get(key) != value:
            report.fail("COUNT-MISMATCH", f"{check_id}: counts.{key} recorded {claimed.get(key)!r} but the log says {value!r}")
            return False
    return True


def verify_tsc(report, entry, text):
    if re.search(r"error TS\d+", text):
        report.fail("CHECK-LOG-FAILED", "tsc: log contains TypeScript errors")
        return False
    return expect_counts(report, "tsc", entry, {"errors": 0})


def verify_build(report, entry, text):
    if "built in" not in text or re.search(r"error TS\d+|Build failed|error during build", text):
        report.fail("CHECK-LOG-FAILED", "build: log has no clean 'built in' line")
        return False
    return True


def verify_units(report, entry, text):
    files = re.search(r"Test Files\s+(?:(\d+) failed \| )?(\d+) passed(?: \| (\d+) skipped)? \((\d+)\)", text)
    tests = re.search(r"Tests\s+(?:(\d+) failed \| )?(\d+) passed(?: \| (\d+) (?:skipped|todo))*(?: \| (\d+) \w+)* \((\d+)\)", text)
    if not files or not tests:
        report.fail("CHECK-LOG-FAILED", "unitTests: no vitest summary lines in the log")
        return False
    if files.group(1) or tests.group(1):
        report.fail("CHECK-LOG-FAILED", "unitTests: the log reports failed tests")
        return False
    return expect_counts(report, "unitTests", entry, {"testFiles": int(files.group(2)), "tests": int(tests.group(2))})


def verify_cargo(report, entry, text):
    results = re.findall(r"test result: (\w+)\. (\d+) passed; (\d+) failed; (\d+) ignored", text)
    if not results:
        report.fail("CHECK-LOG-FAILED", "cargoTest: no 'test result' lines in the log")
        return False
    if any(status != "ok" or int(failed) for status, _, failed, _ in results):
        report.fail("CHECK-LOG-FAILED", "cargoTest: the log reports a failed test result")
        return False
    return expect_counts(report, "cargoTest", entry, {
        "passed": sum(int(p) for _, p, _, _ in results),
        "failed": 0,
        "ignored": sum(int(i) for _, _, _, i in results),
    })


def verify_playwright(report, entry, text):
    path, _ = read_log(report, "playwright", entry, "reportPath", "reportSha256")
    if path is None:
        return False
    data = json.loads(path.read_text(encoding="utf-8"))
    stats = data.get("stats", {})
    per_spec: dict[str, dict[str, int]] = {}
    retries = {project.get("retries") for project in data.get("config", {}).get("projects", [])}

    def visit(suite):
        for spec in suite.get("specs", []):
            file = spec.get("file", suite.get("file", "?"))
            bucket = per_spec.setdefault(file, {"passed": 0, "failed": 0, "skipped": 0})
            tests = spec.get("tests", [])
            if tests and all(t.get("status") == "skipped" for t in tests):
                bucket["skipped"] += 1
            elif spec.get("ok"):
                bucket["passed"] += 1
            else:
                bucket["failed"] += 1
        for child in suite.get("suites", []):
            visit(child)

    for suite in data.get("suites", []):
        visit(suite)
    if retries != {0}:
        report.fail("CHECK-LOG-FAILED", f"playwright: report retries {sorted(map(str, retries))}, expected 0")
        return False
    if stats.get("unexpected") or stats.get("flaky"):
        report.fail("CHECK-LOG-FAILED", f"playwright: report has unexpected={stats.get('unexpected')} flaky={stats.get('flaky')}")
        return False
    expected_specs = {f"{item.name}" for item in (ROOT / "tests").glob("*.spec.ts")}
    if set(per_spec) != expected_specs:
        report.fail("COUNT-MISMATCH", f"playwright: specs run {sorted(set(per_spec) ^ expected_specs)} differ from tests/*.spec.ts")
        return False
    actual = {"expected": stats.get("expected"), "unexpected": stats.get("unexpected"), "flaky": stats.get("flaky"),
              "skipped": stats.get("skipped"), "specFiles": len(per_spec)}
    if not expect_counts(report, "playwright", entry, actual):
        return False
    if entry.get("perSpec") != per_spec:
        report.fail("COUNT-MISMATCH", "playwright: perSpec counts differ from the JSON report")
        return False
    return True


def verify_smoke_build(report, entry, text):
    if not re.search(r"Finished .*target\(s\)", text) or "error:" in text.lower().split("finished")[0][-2000:]:
        report.fail("CHECK-LOG-FAILED", "nativeSmokeBuild: no clean 'Finished' line")
        return False
    return True


def verify_release_build(report, entry, text):
    if not re.search(r"Finished \d+ bundle", text) and "Personal Word.app" not in text:
        report.fail("CHECK-LOG-FAILED", "normalReleaseBuild: log shows no finished macOS bundle")
        return False
    return True


def verify_benchmark(report, entry, text):
    match = re.search(r"median=([\d.]+) ms p95=([\d.]+) ms", text)
    if not match or "test result: ok. 1 passed" not in text:
        report.fail("CHECK-LOG-FAILED", "saveBenchmark: log has no median/p95 line with a passing test")
        return False
    median, p95 = float(match.group(1)), float(match.group(2))
    bound = entry.get("counts", {}).get("acceptanceBoundMs")
    if bound is None or p95 > float(bound):
        report.fail("CHECK-LOG-FAILED", f"saveBenchmark: p95 {p95} ms is above the bound {bound}")
        return False
    return expect_counts(report, "saveBenchmark", entry, {"medianMs": median, "p95Ms": p95, "acceptanceBoundMs": bound})


LOG_VERIFIERS = {
    "tsc": verify_tsc,
    "build": verify_build,
    "unitTests": verify_units,
    "playwright": verify_playwright,
    "cargoTest": verify_cargo,
    "nativeSmokeBuild": verify_smoke_build,
    "saveBenchmark": verify_benchmark,
    "normalReleaseBuild": verify_release_build,
}


def check_automated(report: Report, evidence: dict):
    print("3. Automated checks (each log is re-read, not trusted)")
    checks = evidence.get("checks")
    if not isinstance(checks, dict):
        report.fail("SCHEMA-INVALID", "checks must be an object keyed by check id")
        return
    for check_id in REQUIRED_CHECKS:
        entry = checks.get(check_id)
        if not isinstance(entry, dict):
            report.fail("SCHEMA-INVALID", f"required check {check_id} is missing")
            continue
        state = entry.get("state")
        if state not in STATES:
            report.fail("STATE-INVALID", f"{check_id}: state {state!r} is not one of {STATES}")
            continue
        for field in ("command", "logPath", "resultLine"):
            if field not in entry:
                report.fail("SCHEMA-INVALID", f"{check_id}: missing field {field}")
        if state in ("blocked", "not-run"):
            report.wait(check_id, f"{state}: {entry.get('reason', '(no reason recorded)')}")
            continue
        if state == "failed":
            report.fail("CHECK-FAILED", f"{check_id} is recorded as failed (log {entry.get('logPath')})")
            continue
        # state == passed: everything must be backed by a real log
        if entry.get("exitCode") != 0:
            report.fail("CHECK-LOG-FAILED", f"{check_id}: claims passed but exitCode is {entry.get('exitCode')!r}")
            continue
        path, text = read_log(report, check_id, entry)
        if path is None:
            continue
        if check_id in ("nativeBaseline", "nativeBeta"):
            report.ok(f"{check_id}: log present (run folder checked in section 4)")
            continue
        verifier = LOG_VERIFIERS[check_id]
        if verifier(report, entry, text):
            report.ok(f"{check_id}: {entry.get('resultLine')}")
    for extra in sorted(set(checks) - set(REQUIRED_CHECKS) - {"nativePrintMatrix"}):
        report.fail("SCHEMA-INVALID", f"unknown check id {extra}")
    print_matrix = checks.get("nativePrintMatrix")
    if not isinstance(print_matrix, dict):
        report.fail("SCHEMA-INVALID", "nativePrintMatrix must be recorded (state not-run with a reason)")
    elif print_matrix.get("state") == "passed":
        report.fail("STATE-INVALID", "nativePrintMatrix cannot be passed: WP8 STOP means it was never run")
    elif print_matrix.get("state") == "not-run" and print_matrix.get("applicable") is False and print_matrix.get("reason"):
        report.na(f"nativePrintMatrix: not-run, not applicable -- {print_matrix['reason']}")
    else:
        report.wait("nativePrintMatrix", f"{print_matrix.get('state')}: {print_matrix.get('reason', '(no reason)')}")


def check_not_applicable(report: Report, evidence: dict):
    items = evidence.get("notApplicable", {})
    if not isinstance(items, dict):
        report.fail("SCHEMA-INVALID", "notApplicable must be an object")
        return
    for name, item in items.items():
        if not isinstance(item, dict) or item.get("state") != "not-run" or not item.get("reason"):
            report.fail("SCHEMA-INVALID", f"notApplicable.{name} must have state 'not-run' and a reason")
        else:
            report.na(f"{name}: not-run -- {item['reason']}")


# ----------------------------------------------------------------------------- native runs

def check_native(report: Report, evidence: dict):
    print("4. Native durability runs (identity against the current tree)")
    native = evidence.get("native")
    if not isinstance(native, dict):
        report.fail("NATIVE-ARCH-MISSING", "evidence has no native section")
        return
    architecture = native.get("architecture")
    if not architecture:
        report.fail("NATIVE-ARCH-MISSING", "native.architecture is missing: the evidence does not say which CPU the native runs used")
    nr = load_native_module()
    current_inputs = [{"path": rel(path), "sha256": sha256_file(path)} for path in nr.source_inputs()]
    current_digest = hashlib.sha256(canonical(current_inputs).encode()).hexdigest()
    binary = Path(nr.BINARY)
    binary_sha = sha256_file(binary) if binary.is_file() else None
    if binary_sha is None:
        report.fail("PATH-MISSING", f"diagnostic binary {rel(binary)} is missing, so the runs cannot be tied to it")
    else:
        arch, _ = file_arch(binary)
        if architecture and arch != architecture:
            report.fail("NATIVE-ARCH-MISMATCH", f"native.architecture is {architecture!r} but the diagnostic binary is {arch!r}")
    runs = native.get("runs")
    for suite in ("baseline", "beta"):
        entry = (runs or {}).get(suite)
        label = f"native {suite}"
        if not isinstance(entry, dict) or not entry.get("runId"):
            report.fail("NATIVE-RUN-MISSING", f"{label}: no runId recorded")
            continue
        result_path = resolve(entry.get("resultPath"))
        if result_path is None or not result_path.is_file():
            report.fail("PATH-MISSING", f"{label}: result.json {entry.get('resultPath')!r} does not exist")
            continue
        if entry.get("resultSha256") != sha256_file(result_path):
            report.fail("LOG-HASH-MISMATCH", f"{label}: result.json changed after it was recorded")
            continue
        run = json.loads(result_path.read_text(encoding="utf-8"))
        problems = []
        if run.get("runId") != entry["runId"] or result_path.parent.name != entry["runId"]:
            problems.append("runId does not match the run folder")
        if run.get("suite") != suite:
            problems.append(f"suite is {run.get('suite')!r}")
        if run.get("ok") is not True or run.get("status") != "passed":
            problems.append(f"ok={run.get('ok')!r} status={run.get('status')!r}")
        if run.get("identityError"):
            problems.append(f"identityError {run.get('identityError')}")
        host = str(run.get("host", ""))
        if architecture and architecture not in host:
            problems.append(f"host {host!r} does not mention {architecture}")
        scenarios = run.get("scenarios") or []
        passed = sum(1 for item in scenarios if item.get("status") == "passed")
        detected = sum(1 for item in scenarios if item.get("status") == "detected")
        if not scenarios or passed + detected != len(scenarios):
            problems.append("a scenario is neither passed nor detected")
        if entry.get("passed") != passed or entry.get("detected") != detected:
            problems.append(f"counts recorded {entry.get('passed')}+{entry.get('detected')} but result.json has {passed}+{detected}")
        for scenario in scenarios:
            for key, value in scenario.items():
                if key.endswith("ProcessLog") or key == "processLog":
                    log = resolve(value)
                    if value and (log is None or not log.is_file()):
                        problems.append(f"scenario {scenario.get('scenario')!r} process log missing: {value}")
        identity = run.get("identity") or {}
        if identity.get("sourceManifestSha256") != entry.get("manifestSha256"):
            problems.append("recorded manifestSha256 differs from the run's identity manifest")
        if identity.get("sourceInputs") != current_inputs or identity.get("sourceManifestSha256") != current_digest:
            changed = sorted(
                {i["path"] for i in identity.get("sourceInputs", [])} ^ {i["path"] for i in current_inputs}
                | {a["path"] for a, b in zip(identity.get("sourceInputs", []), current_inputs) if a != b}
            )
            problems.append(f"run identity is stale against the current sources (first differences: {changed[:4]})")
        if binary_sha is None or identity.get("binarySha256") != binary_sha:
            problems.append("run was made with a different diagnostic binary than the current one")
        if problems:
            code = "NATIVE-IDENTITY-STALE" if any("stale" in p or "different diagnostic" in p for p in problems) else "NATIVE-RUN-INVALID"
            report.fail(code, f"{label} {entry['runId']}: " + "; ".join(problems))
        else:
            report.ok(f"{label} {entry['runId']}: {passed} passed + {detected} negative controls detected, "
                      f"identity {current_digest[:16]} equals the current tree, binary {binary_sha[:16]}, {architecture}")


# ----------------------------------------------------------------------------- normal app

def newest_app_input_mtime() -> float:
    newest = 0.0
    for name in APP_INPUT_FILES:
        path = ROOT / name
        if path.is_file():
            newest = max(newest, path.stat().st_mtime)
    for folder in APP_INPUT_DIRS:
        base = ROOT / folder
        if base.is_dir():
            for path in base.rglob("*"):
                if path.is_file() and not (set(path.relative_to(ROOT).parts) & SOURCE_SKIP_PARTS):
                    newest = max(newest, path.stat().st_mtime)
    return newest


def check_app(report: Report, evidence: dict):
    print("5. Normal Personal Word.app (identity, freshness, no diagnostic markers)")
    app = evidence.get("app")
    if not isinstance(app, dict):
        report.fail("APP-MISSING", "evidence has no app section")
        return
    bundle = resolve(app.get("path"))
    release_dir = ROOT / "src-tauri/target/release/bundle/macos"
    if bundle is None or bundle.suffix != ".app" or release_dir not in bundle.parents:
        report.fail("APP-STALE-SMOKE", f"app.path {app.get('path')!r} is not a .app bundle under src-tauri/target/release/bundle/macos "
                    "(a diagnostic/smoke binary or stale bundle cannot stand in for the normal app)")
        return
    if not bundle.is_dir():
        report.fail("PATH-MISSING", f"app bundle {rel(bundle)} does not exist")
        return
    plist_path = bundle / "Contents/Info.plist"
    if not plist_path.is_file():
        report.fail("PATH-MISSING", f"{rel(plist_path)} does not exist")
        return
    plist = plistlib.loads(plist_path.read_bytes())
    tauri = json.loads((ROOT / "src-tauri/tauri.conf.json").read_text(encoding="utf-8"))
    package = json.loads((ROOT / "package.json").read_text(encoding="utf-8"))
    problems = []
    identifier = plist.get("CFBundleIdentifier")
    if identifier != tauri.get("identifier") or identifier == "com.folio.smoke":
        problems.append(f"CFBundleIdentifier {identifier!r} != tauri identifier {tauri.get('identifier')!r}")
    if plist.get("CFBundleName") != "Personal Word" or plist.get("CFBundleDisplayName", "Personal Word") != "Personal Word":
        problems.append(f"bundle name {plist.get('CFBundleName')!r}/{plist.get('CFBundleDisplayName')!r}")
    version = plist.get("CFBundleShortVersionString")
    if version != package.get("version") or version != tauri.get("version"):
        problems.append(f"version {version!r} vs package {package.get('version')!r} / tauri {tauri.get('version')!r}")
    executable = bundle / "Contents/MacOS" / str(plist.get("CFBundleExecutable"))
    if not executable.is_file():
        report.fail("PATH-MISSING", f"app executable {rel(executable)} does not exist")
        return
    sha = sha256_file(executable)
    if app.get("executableSha256") != sha:
        problems.append(f"executable sha256 {sha[:16]} != recorded {str(app.get('executableSha256'))[:16]}")
    nr_binary = ROOT / "src-tauri/target/debug/folio"
    if nr_binary.is_file() and sha == sha256_file(nr_binary):
        problems.append("executable is byte-identical to the diagnostic smoke binary")
    started = parse_time(app.get("buildStartedAt"))
    mtime = executable.stat().st_mtime
    if started is None:
        problems.append("buildStartedAt is missing or unparsable")
    elif mtime < started.timestamp() - 2:
        problems.append(f"executable was modified {datetime.fromtimestamp(mtime, timezone.utc):%Y-%m-%dT%H:%M:%SZ}, before the recorded build start {app.get('buildStartedAt')}")
    if mtime < newest_app_input_mtime() - 2:
        problems.append("executable is older than a source file that goes into it")
    arch, _ = file_arch(executable)
    native_arch = (evidence.get("native") or {}).get("architecture")
    if native_arch and arch != native_arch:
        problems.append(f"executable architecture {arch!r} differs from native.architecture")
    data = executable.read_bytes()
    found = [marker for marker in APP_MARKERS if marker.encode() in data]
    if found:
        problems.append(f"diagnostic markers inside the app binary: {found}")
    if problems:
        code = "APP-MARKER" if found else "APP-STALE" if any("modified" in p or "older" in p or "identical" in p for p in problems) else "APP-IDENTITY"
        report.fail(code, "; ".join(problems))
    else:
        report.ok(f"{rel(bundle)}: {identifier} v{version}, {arch}, sha256 {sha[:16]}, fresh, 0 of {len(APP_MARKERS)} diagnostic markers")


# ----------------------------------------------------------------------------- review and owner gates

def review_verdict_lines(text: str) -> list[str] | None:
    """Verdict text of every markdown heading '#.. Verdict: <text>' or '#.. Final verdict: <text>'.
    Only these heading lines count; 'verdict: PASS' elsewhere in the file (for example an earlier gate) is ignored."""
    found = []
    for line in text.splitlines():
        m = re.match(r"\s{0,3}#{1,6}\s*(?:final\s+)?verdict\s*:\s*(.*)$", line, re.I)
        if m:
            found.append(re.sub(r"^[\s*_`]+", "", m.group(1)))
    return found


def check_review(report: Report, evidence: dict):
    print("6. Independent review")
    review = evidence.get("review")
    if not isinstance(review, dict):
        report.fail("SCHEMA-INVALID", "review section is missing")
        return
    state = review.get("state")
    if state not in OWNER_STATES:
        report.fail("STATE-INVALID", f"review.state {state!r}")
    elif state == "pending":
        report.wait("independentReview", review.get("note", "pending"))
    elif state in ("blocked", "failed"):
        (report.fail if state == "failed" else report.wait)(*(("REVIEW-FAILED", "review recorded as failed") if state == "failed" else ("independentReview", "blocked")))
    else:
        path = resolve(review.get("reviewFile"))
        if not review.get("reviewer") or path is None or not path.is_file() or review.get("reviewFileSha256") != sha256_file(path):
            report.fail("REVIEW-CLAIM-UNBACKED", "review claims passed without a reviewer, an existing file and a matching sha256")
        elif (verdicts := review_verdict_lines(path.read_text(encoding="utf-8", errors="replace"))) is None or not verdicts or not all(re.match(r"pass(ed)?\b", v, re.I) for v in verdicts):
            report.fail("REVIEW-CLAIM-UNBACKED", f"{rel(path)} has no verdict heading, or a verdict heading ('## Verdict: ...' / '## Final verdict: ...') does not begin with PASS (found: {verdicts or 'none'})")
        else:
            report.ok(f"review by {review['reviewer']} recorded in {rel(path)} (file sha256 matches)")


def check_owner_gates(report: Report, evidence: dict):
    print("7. Owner real-use outcomes (the only way anything becomes VERIFIED)")
    gates = evidence.get("ownerGates")
    if not isinstance(gates, dict):
        report.fail("SCHEMA-INVALID", "ownerGates is missing")
        return
    for name in OWNER_GATES:
        gate = gates.get(name)
        if not isinstance(gate, dict):
            report.fail("SCHEMA-INVALID", f"owner gate {name} is missing")
            continue
        state = gate.get("state")
        if state not in OWNER_STATES:
            report.fail("STATE-INVALID", f"{name}: state {state!r}")
        elif state == "pending":
            report.wait(name, gate.get("note", "waiting for the owner"))
        elif state == "blocked":
            report.wait(name, f"blocked: {gate.get('blockedReason', '(no reason)')}")
        elif state == "failed":
            report.fail("OWNER-GATE-FAILED", f"{name} failed: {gate.get('note', '')}")
        else:  # passed
            path = resolve(gate.get("reportFile"))
            if gate.get("blockedReason") or gate.get("blocked") or gate.get("toolAvailable") is False:
                report.fail("BLOCKED-CLAIMED-PASSED", f"{name}: claimed passed while the evidence records it as blocked ({gate.get('blockedReason') or 'toolAvailable=false'})")
            elif gate.get("reportedBy") != "owner" or path is None or not path.is_file() or gate.get("reportSha256") != sha256_file(path):
                report.fail("OWNER-CLAIM-UNBACKED", f"{name}: passed needs reportedBy=owner and a report file whose sha256 matches")
            else:
                report.ok(f"{name}: owner report {rel(path)}")
    for extra in sorted(set(gates) - set(OWNER_GATES)):
        report.fail("SCHEMA-INVALID", f"unknown owner gate {extra}")


# ----------------------------------------------------------------------------- main

def check_schema(report: Report, evidence: dict):
    print("1. Schema")
    if evidence.get("schema") != SCHEMA:
        report.fail("SCHEMA-INVALID", f"schema must be {SCHEMA!r}, got {evidence.get('schema')!r}")
    meta = evidence.get("meta")
    if not isinstance(meta, dict):
        report.fail("SCHEMA-INVALID", "meta is missing")
        return
    for key in ("target", "version", "generatedAt", "gitCommit", "status"):
        if key not in meta:
            report.fail("SCHEMA-INVALID", f"meta.{key} is missing")
    for key_path, key in walk_keys(evidence):
        if forbidden_key(key):
            report.fail("SCHEMA-FORBIDDEN-FIELD", f"{key_path}: signing/notarization/download fields are out of scope and must not be present")
    if not report.failures:
        report.ok("required sections present, no signing/notarization/download fields")


def check_status_claim(report: Report, evidence: dict):
    claimed = (evidence.get("meta") or {}).get("status")
    if claimed in ("passed", "beta-ready", "verified") and (report.failures or report.pending):
        report.fail("STATUS-OVERCLAIM", f"meta.status is {claimed!r} but {len(report.failures)} failure(s) and {len(report.pending)} pending item(s) exist")


def verify(evidence_path: Path, manifest_path: Path) -> int:
    report = Report()
    print(f"Evidence: {evidence_path}\nSource manifest: {manifest_path}\n")
    try:
        evidence = json.loads(evidence_path.read_text(encoding="utf-8"))
    except (OSError, ValueError) as error:
        print(f"[FAIL] EVIDENCE-UNREADABLE: {error}")
        return 1
    check_schema(report, evidence)
    check_source_manifest(report, evidence, manifest_path)
    check_automated(report, evidence)
    check_not_applicable(report, evidence)
    check_native(report, evidence)
    check_app(report, evidence)
    check_review(report, evidence)
    check_owner_gates(report, evidence)
    check_status_claim(report, evidence)
    print("\n== Result ==")
    if report.failures:
        print(f"FAILED: {len(report.failures)} integrity/check failure(s):")
        for code, text in report.failures:
            print(f"  - {code}: {text}")
    if report.pending:
        print(f"PENDING/BLOCKED/NOT-RUN: {len(report.pending)} item(s) keep this from being beta-ready:")
        for name, text in report.pending:
            print(f"  - {name}: {text}")
    if report.failures:
        return 1
    if report.pending:
        print("Automated evidence is consistent; the candidate is not beta-ready until the items above are recorded.")
        return 2
    print("All required evidence verified (automated results remain CLAIMED until the owner confirms real use).")
    return 0


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--evidence", type=Path)
    parser.add_argument("--source-manifest", type=Path)
    parser.add_argument("--write-source-manifest", type=Path, help="write a fresh SOURCE_MANIFEST.json for the current tree and exit")
    args = parser.parse_args()
    if args.write_source_manifest:
        manifest = build_source_manifest()
        args.write_source_manifest.write_text(json.dumps(manifest, indent=1) + "\n", encoding="utf-8")
        print(f"wrote {args.write_source_manifest}: {manifest['fileCount']} files, manifest {manifest['manifestSha256']}")
        return 0
    if not args.evidence or not args.source_manifest:
        parser.print_usage(sys.stderr)
        return 3
    return verify(args.evidence, args.source_manifest)


if __name__ == "__main__":
    sys.exit(main())
