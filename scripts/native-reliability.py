#!/usr/bin/env python3
"""Run the D1 native durability matrix against an already-built diagnostic app.

Every app process and SQLite library lives below node_modules/.cache, and this
supervisor signals only process groups it created. It never builds the app or
opens the user's com.folio.writing store.
"""
import argparse
from contextlib import contextmanager
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import platform
import signal
import sqlite3
import subprocess
import sys
import time
import uuid

ROOT = Path(__file__).resolve().parents[1]
BINARY = ROOT / "src-tauri/target/debug/folio"
CACHE = ROOT / "node_modules/.cache/personal-word-beta/d1"
DIAGNOSTIC_PROTOCOL = "d1-profile-isolation-v1"
FIXED_INPUTS = (
    "src-tauri/build.rs",
    "src-tauri/Cargo.toml",
    "src-tauri/Cargo.lock",
    "src-tauri/tauri.conf.json",
    "index.html",
    "vite.config.ts",
    "package.json",
    "package-lock.json",
    "tests/native-smoke.js",
    "tests/native-reliability.js",
)


def source_inputs():
    """Every file the diagnostic binary embeds or compiles: all Rust and frontend sources."""
    tree = [path for folder in ("src-tauri/src", "src") for path in (ROOT / folder).rglob("*") if path.is_file()]
    return sorted({*tree, *(ROOT / name for name in FIXED_INPUTS)})
ACTIVE_SUMMARY = None


def canonical(value):
    return json.dumps(value, sort_keys=True, ensure_ascii=False, separators=(",", ":"))


def diagnostic_binary_identity():
    if not BINARY.is_file():
        raise RuntimeError(f"Diagnostic app is missing: {BINARY}")
    sources = source_inputs()
    newest_source = max(path.stat().st_mtime_ns for path in sources)
    if BINARY.stat().st_mtime_ns < newest_source:
        raise RuntimeError("Diagnostic binary predates a D1 source input; rebuild it before launch")
    inputs = [
        {"path": str(path.relative_to(ROOT)), "sha256": hashlib.sha256(path.read_bytes()).hexdigest()}
        for path in sources
    ]
    return {
        "binaryPath": str(BINARY),
        "binarySha256": hashlib.sha256(BINARY.read_bytes()).hexdigest(),
        "sourceInputs": inputs,
        "sourceManifestSha256": hashlib.sha256(canonical(inputs).encode()).hexdigest(),
        "protocol": DIAGNOSTIC_PROTOCOL,
    }


def tail(path, limit=4000):
    try:
        return path.read_text(errors="replace")[-limit:]
    except OSError:
        return "(no process log)"


def persist_active_result():
    if ACTIVE_SUMMARY is None:
        return
    data = json.dumps(ACTIVE_SUMMARY, indent=2) + "\n"
    (Path(ACTIVE_SUMMARY["dataAndLogs"]) / "result.json").write_text(data)
    (CACHE / "latest.json").write_text(data)


def record_result(item):
    ACTIVE_SUMMARY["scenarios"].append(item)
    persist_active_result()


def stop_owned(process):
    if process is not None and process.poll() is None:
        try:
            os.killpg(process.pid, signal.SIGKILL)
        except ProcessLookupError:
            pass
    if process is not None:
        process.wait(timeout=10)


def launch(scenario, work, run_id):
    work.mkdir(parents=True, exist_ok=True)
    (work / "projects").mkdir(exist_ok=True)
    invocation_id = uuid.uuid4().hex
    (work / "report-2.json").unlink(missing_ok=True)
    log_path = work / f"process-{scenario}-{invocation_id[:8]}.log"
    output = log_path.open("w")
    env = {
        **os.environ,
        "FOLIO_SMOKE_DIR": str(work),
        "FOLIO_SMOKE_PHASE": "2",
        "FOLIO_SMOKE_SCENARIO": scenario,
        "FOLIO_SMOKE_SCRIPT": "native-reliability",
        "FOLIO_SMOKE_RUN": run_id,
        "FOLIO_SMOKE_INVOCATION": invocation_id,
        "FOLIO_SMOKE_DATA_STORE_ID": hashlib.sha256(run_id.encode()).hexdigest()[:32],
    }
    process = subprocess.Popen(
        [str(BINARY)],
        cwd=ROOT,
        env=env,
        stdout=output,
        stderr=subprocess.STDOUT,
        start_new_session=True,
    )
    return process, output, log_path, invocation_id


@contextmanager
def reported_live_process(scenario, work, run_id, timeout):
    process, output, log_path, invocation_id = launch(scenario, work, run_id)
    try:
        report_path = work / "report-2.json"
        deadline = time.monotonic() + timeout
        while time.monotonic() < deadline and not report_path.is_file():
            if process.poll() is not None:
                raise RuntimeError(
                    f"Native scenario {scenario} exited before reporting "
                    f"(code {process.returncode}).\n{tail(log_path)}"
                )
            time.sleep(0.025)
        if not report_path.is_file():
            raise RuntimeError(
                f"Native scenario {scenario} did not report within {timeout}s.\n{tail(log_path)}"
            )
        report = read_report(work, scenario, invocation_id, run_id)
        yield report, log_path
    finally:
        output.close()
        if process.poll() is None:
            stop_owned(process)


def read_report(work, scenario, invocation_id, run_id):
    path = work / "report-2.json"
    if not path.is_file():
        raise RuntimeError(f"Native scenario produced no report: {path}")
    report = json.loads(path.read_text())
    if report.get("scenario") != scenario:
        raise RuntimeError(
            f"Native report belongs to {report.get('scenario')!r}, expected {scenario!r}"
        )
    if report.get("invocationId") != invocation_id:
        raise RuntimeError("Native report is stale or belongs to another app invocation")
    if report.get("runId") != run_id:
        raise RuntimeError("Native report belongs to another scenario run")
    if report.get("diagnosticAppIdentifier") != "com.folio.smoke":
        raise RuntimeError("Native report did not come from the isolated com.folio.smoke diagnostic app")
    if report.get("diagnosticProtocol") != DIAGNOSTIC_PROTOCOL:
        raise RuntimeError("Native report came from a stale diagnostic protocol build")
    expected_store_id = hashlib.sha256(run_id.encode()).hexdigest()[:32]
    profile = report.get("diagnosticProfile") or {}
    if (
        report.get("diagnosticDataStoreIdentifier") != expected_store_id
        or profile.get("appIdentifier") != "com.folio.smoke"
        or profile.get("protocol") != DIAGNOSTIC_PROTOCOL
        or profile.get("dataStoreIdentifier") != expected_store_id
        or expected_store_id not in profile.get("activeDataStoreIdentifiers", [])
    ):
        raise RuntimeError("Native report did not use the expected isolated WebKit data store")
    if not report.get("ok"):
        raise RuntimeError(f"Native script reported failure: {report}")
    return report


def run_to_exit(scenario, work, run_id, timeout):
    process, output, log_path, invocation_id = launch(scenario, work, run_id)
    try:
        try:
            process.wait(timeout=timeout)
        except subprocess.TimeoutExpired as error:
            stop_owned(process)
            raise RuntimeError(
                f"Native scenario {scenario} did not close in {timeout}s.\n{tail(log_path)}"
            ) from error
        if process.returncode != 0:
            raise RuntimeError(
                f"Native scenario {scenario} exited {process.returncode}.\n{tail(log_path)}"
            )
        return read_report(work, scenario, invocation_id, run_id), log_path
    finally:
        output.close()
        if process.poll() is None:
            stop_owned(process)


def run_to_checkpoint(scenario, work, run_id, checkpoint, timeout):
    process, output, log_path, invocation_id = launch(scenario, work, run_id)
    marker = work / f"checkpoint-{checkpoint}.json"
    try:
        deadline = time.monotonic() + timeout
        while time.monotonic() < deadline and not marker.is_file():
            if process.poll() is not None:
                raise RuntimeError(
                    f"Scenario {scenario} exited before checkpoint {checkpoint} "
                    f"(code {process.returncode}).\n{tail(log_path)}"
                )
            time.sleep(0.025)
        if not marker.is_file():
            raise RuntimeError(
                f"Scenario {scenario} missed checkpoint {checkpoint}.\n{tail(log_path)}"
            )
        checkpoint_data = json.loads(marker.read_text())
        report = read_report(work, scenario, invocation_id, run_id)
        # The only child signalled here is the exact process this function started.
        stop_owned(process)
        return report, checkpoint_data, log_path
    finally:
        output.close()
        if process.poll() is None:
            stop_owned(process)


def read_database(work):
    databases = list((work / "projects").glob("*/project.sqlite3"))
    if len(databases) != 1:
        raise AssertionError(f"Expected one harness-owned database, found {len(databases)}")
    path = databases[0]
    uri = path.as_uri() + "?mode=ro"
    with sqlite3.connect(uri, uri=True, timeout=5) as database:
        integrity = database.execute("PRAGMA integrity_check").fetchone()[0]
        if integrity != "ok":
            raise AssertionError(f"SQLite integrity_check returned {integrity!r}")
        headers = database.execute("SELECT id,data FROM project").fetchall()
        if len(headers) != 1:
            raise AssertionError(f"Expected one project header row, found {len(headers)}")
        project_id, header_json = headers[0]
        header = json.loads(header_json)
        rows = {
            entry_id: json.loads(data)
            for entry_id, data in database.execute("SELECT id,data FROM entries")
        }
        entry_ids = header.pop("entryIds")
        if set(entry_ids) != set(rows):
            raise AssertionError("Project header IDs differ from the persisted entry rows")
        project = {**header, "entries": [rows[entry_id] for entry_id in entry_ids]}
        if project["id"] != project_id:
            raise AssertionError("Project row ID differs from the canonical header")
    return path, project


def assert_mirror_matches(database_path, project):
    mirror_path = database_path.parent / "project.json"
    if not mirror_path.is_file():
        raise AssertionError("Portable project.json mirror is missing")
    mirror = json.loads(mirror_path.read_text())
    if canonical(mirror) != canonical(project):
        raise AssertionError("Portable project.json differs from the canonical SQLite project")


def require_mirror_lag(database_path, project):
    mirror_path = database_path.parent / "project.json"
    if not mirror_path.is_file():
        return
    mirror = json.loads(mirror_path.read_text())
    if mirror.get("revision", -1) >= project["revision"]:
        raise AssertionError("Post-commit/pre-mirror checkpoint did not leave the prior mirror revision")


def require_revision(database_project, acknowledged_revision):
    actual = database_project["revision"]
    if actual < acknowledged_revision:
        raise AssertionError(
            f"SQLite revision {actual} is below acknowledged revision {acknowledged_revision}"
        )


def require_safety_snapshot(safety, before_restore, label):
    if not isinstance(safety, dict) or not isinstance(safety.get("project"), dict):
        raise AssertionError(f"{label}: generated safety snapshot is missing")
    if canonical(safety["project"]) != canonical(before_restore):
        raise AssertionError(f"{label}: safety snapshot differs from the complete pre-restore project")


def require_metadata(project, label, *, history=False):
    if len(project.get("entries", [])) != 2:
        raise AssertionError(f"{label} does not contain the exact two-entry fixture")
    expected = {
        "research": {
            "sources": [{"id": "source-d1", "kind": "book", "title": "Bounded durability", "authors": []}],
            "notes": [{"id": "note-d1", "text": "Research note survives sparse save"}],
            "footnotes": [{"id": "footnote-d1", "text": "Footnote survives sparse save", "form": "short"}],
        },
        "annotations": [{
            "id": "comment-d1",
            "entryId": project["entries"][0]["id"],
            "quote": "Keep this.",
            "text": "Annotation survives sparse save",
            "resolved": False,
        }],
        "documentSettings": {"fontFamily": "serif", "fontSize": 12, "lineSpacing": 2},
        "pageLayout": {"mode": "pages", "paper": "letter", "margin": 96, "zoom": 100},
        "goals": {"dailyWords": 500} if history else {"dailyWords": 750, "deadline": "2026-12-31"},
        "sidebarOrder": ["research", "manuscript", "comments"],
        "additiveD1Field": {"kept": True, "nested": ["alpha", "beta"]},
    }
    actual = {key: project.get(key) for key in expected}
    # Comment anchors (E1) are additive: the fixture quote is not in the entry text,
    # so an anchored copy must be the conservative detached form, every other field exact.
    annotations = [dict(item) for item in actual.get("annotations") or []]
    for item in annotations:
        anchor = item.pop("anchor", None)
        if anchor is not None and (anchor.get("status") != "detached" or anchor.get("version") != 1
                                   or anchor.get("from") != anchor.get("to")):
            raise AssertionError(f"{label} comment anchor is not the conservative detached form: {anchor}")
    actual["annotations"] = annotations
    if canonical(actual) != canonical(expected):
        raise AssertionError(f"{label} project metadata differs from the exact sparse-save fixture")
    first_tags = ["d1", "source-alpha"] if history else ["d1", "source-alpha", "revised"]
    expected_entry_metadata = [
        {"tags": first_tags, "synopsis": "Entry metadata before second sparse save"},
        {"tags": ["d1", "untouched"], "synopsis": "Unchanged entry metadata survives a later sparse save"},
    ]
    actual_entry_metadata = [
        {key: entry.get(key) for key in ("tags", "synopsis")}
        for entry in project["entries"]
    ]
    if canonical(actual_entry_metadata) != canonical(expected_entry_metadata):
        raise AssertionError(f"{label} entry metadata differs from the exact sparse-save fixture")


def assert_sync_settings(settings, *, expect_fullfsync):
    if settings.get("journalMode", "").lower() != "wal":
        raise AssertionError("SQLite WAL mode is not enabled")
    if settings.get("synchronous") != 2:
        raise AssertionError("SQLite synchronous=FULL is not enabled")
    if expect_fullfsync:
        if settings.get("fullfsync") != 1:
            raise AssertionError("macOS PRAGMA fullfsync did not report ON")
        if settings.get("checkpointFullfsync") != 1:
            raise AssertionError("macOS PRAGMA checkpoint_fullfsync did not report ON")
    elif settings.get("fullfsync") != 0:
        raise AssertionError("FULLFSYNC negative control did not produce the false value")


def close_event_count(work):
    path = work / "window-close-events.log"
    return len(path.read_text().splitlines()) if path.is_file() else 0


def assert_close_contract(report, observed_events):
    contract = report.get("closeContract") or {}
    required = ("firstCloseBlocked", "errorVisible", "retryCompleted")
    if any(contract.get(field) is not True for field in required):
        raise AssertionError(
            "close acceptance check did not observe a blocked close, visible error, and completed retry"
        )
    if observed_events < 2:
        raise AssertionError(
            f"close acceptance check expected the initial close and retry close WindowEvents; saw {observed_events}"
        )


def run_suite(timeout, run_id, root, identity):
    if platform.system() != "Darwin":
        raise RuntimeError("Native reliability requires macOS WebKit data-store isolation")
    if not BINARY.is_file():
        raise RuntimeError(
            f"Diagnostic app is missing: {BINARY}. Build it separately with the approved native-smoke configuration."
        )
    results = ACTIVE_SUMMARY["scenarios"]

    metadata_work = root / "metadata"
    metadata_report, metadata_log = run_to_exit(
        "metadata-close", metadata_work, f"{run_id}-metadata", timeout
    )
    close_count = close_event_count(metadata_work)
    assert_close_contract(metadata_report, close_count)
    if not metadata_report.get("mirrorError") or "portable copy failed" not in metadata_report["mirrorError"]:
        raise AssertionError("Injected mirror write failure was not surfaced to the native caller")
    require_metadata(metadata_report["seed"]["current"], "current sparse save")
    require_metadata(metadata_report["seed"]["history"], "automatic history revision", history=True)
    if metadata_report["acknowledgedRevision"] != metadata_report["current"]["revision"]:
        raise AssertionError("The UI's recorded acknowledgement does not match the saved project revision")
    if "Changed after the named snapshot" not in metadata_report["safety"]["project"]["entries"][0]["text"]:
        raise AssertionError("Safety snapshot did not preserve the complete pre-restore writing")
    require_safety_snapshot(
        metadata_report.get("safety"), metadata_report.get("beforeRestore"), "positive safety-copy check"
    )
    require_metadata(metadata_report["safety"]["project"], "pre-restore safety snapshot")
    if platform.system() == "Darwin":
        fullfsync_off = metadata_report["fullfsyncOff"]
        assert_sync_settings(fullfsync_off, expect_fullfsync=False)
        try:
            # Fail-first control: the same acceptance check used for the normal
            # Mac connection must reject the deliberately false pragma value.
            assert_sync_settings(fullfsync_off, expect_fullfsync=True)
        except AssertionError as error:
            if "fullfsync did not report ON" not in str(error):
                raise
            record_result({
                "scenario": "FULLFSYNC false-value negative control",
                "status": "detected",
                "reason": str(error),
            })
        else:
            raise AssertionError("FULLFSYNC acceptance check passed with the false value")
        assert_sync_settings(metadata_report["fullfsyncOn"], expect_fullfsync=True)
    else:
        record_result({"scenario": "macOS FULLFSYNC", "status": "blocked", "reason": "host is not macOS"})
    db_path, persisted = read_database(metadata_work)
    require_revision(persisted, metadata_report["acknowledgedRevision"])
    if canonical(persisted) != canonical(metadata_report["current"]):
        raise AssertionError("Reopened SQLite project differs from the native report")
    assert_mirror_matches(db_path, persisted)
    record_result({
        "scenario": "sparse metadata, mirror retry, native close retry",
        "status": "passed",
        "databaseRevision": persisted["revision"],
        "acknowledgedRevision": metadata_report["acknowledgedRevision"],
        "windowCloseEvents": close_count,
        "processLog": str(metadata_log),
    })

    # Reopen a second native process against the same harness library and query the
    # generated safety snapshot again; an in-process preview is not enough.
    reopen_report, reopen_log = run_to_exit(
        "reopen-safety", metadata_work, f"{run_id}-metadata", timeout
    )
    safety_reopened = reopen_report["safety"]
    if canonical(safety_reopened) != canonical(metadata_report["safety"]):
        raise AssertionError("Reopened safety snapshot differs from the original pre-restore copy")
    if canonical(reopen_report["current"]) != canonical(metadata_report["current"]):
        raise AssertionError("Reopened native project differs from the complete post-restore project")
    db_path, persisted = read_database(metadata_work)
    assert_mirror_matches(db_path, persisted)
    record_result({
        "scenario": "reopen complete pre-restore safety snapshot",
        "status": "passed",
        "projectRevision": persisted["revision"],
        "processLog": str(reopen_log),
    })

    for scenario in ("journal-malformed", "journal-incomplete", "journal-conflict"):
        work = root / scenario
        scenario_run = f"{run_id}-{scenario}"
        seeded, seed_log = run_to_exit(scenario, work, scenario_run, timeout)
        if seeded.get("stage") != "journal-seeded" or not seeded.get("raw"):
            raise AssertionError(f"{scenario} did not persist its isolated journal fixture")
        resolved, resolve_log = run_to_exit(scenario, work, scenario_run, timeout)
        if resolved.get("stage") != "journal-resolved":
            raise AssertionError(f"{scenario} did not reach its explicit recovery choice")
        if resolved.get("journalBeforeChoice") != seeded["raw"]:
            raise AssertionError(f"{scenario} journal changed before the writer chose an action")
        if resolved.get("journalAfterChoice") is not None:
            raise AssertionError(f"{scenario} left the explicitly discarded journal in WebView storage")
        expected_title = (
            "Two copies of this project disagree."
            if scenario == "journal-conflict"
            else "The recovery journal for this project is damaged."
        )
        expected_action = "Keep disk copy" if scenario == "journal-conflict" else "Discard and open"
        if resolved.get("dialogTitle") != expected_title or resolved.get("action") != expected_action:
            raise AssertionError(f"{scenario} did not present and resolve the expected recovery choice")
        if canonical(resolved.get("baseline")) != canonical(resolved.get("current")):
            raise AssertionError(f"{scenario} changed the complete saved project during recovery")
        database_path, persisted = read_database(work)
        if canonical(persisted) != canonical(resolved["baseline"]):
            raise AssertionError(f"{scenario} did not preserve the exact SQLite project")
        assert_mirror_matches(database_path, persisted)
        record_result({
            "scenario": scenario,
            "status": "passed",
            "projectRevision": persisted["revision"],
            "seedProcessLog": str(seed_log),
            "resolveProcessLog": str(resolve_log),
        })

    failure_messages = {
        "sql-rollback": "injected SQL failure after staged writes",
        "sql-disk-full": "injected SQLite disk-full failure after staged writes",
        "sql-permission-denied": "injected SQLite permission failure after staged writes",
    }
    for scenario, expected_error in failure_messages.items():
        work = root / scenario
        scenario_run = f"{run_id}-{scenario}"
        with reported_live_process(scenario, work, scenario_run, timeout) as (report, log_path):
            if report.get("saveStatus") != "Save failed":
                raise AssertionError(f"{scenario} did not surface the failed save state")
            if expected_error not in (report.get("errorBanner") or ""):
                raise AssertionError(f"{scenario} did not show its deterministic storage error")
            if report.get("acknowledgedRevision") != report.get("baseline", {}).get("revision"):
                raise AssertionError(f"{scenario} changed the last acknowledged SQLite revision")
            if canonical(report.get("current")) != canonical(report.get("baseline")):
                raise AssertionError(f"{scenario} did not preserve the complete project in the live store")
            database_path, live_database = read_database(work)
            if canonical(live_database) != canonical(report["baseline"]):
                raise AssertionError(f"{scenario} left partial entry/history/project changes in SQLite")
            if not (work / f"fault-used-{scenario}").is_file():
                raise AssertionError(f"{scenario} did not consume its deterministic transaction fault")
            journal_header = json.loads(report.get("journalHeader") or "null")
            journal_entry = json.loads(report.get("journalEntry") or "null")
            if not journal_header or not journal_entry:
                raise AssertionError(f"{scenario} failure cleared the local recovery journal")
            if journal_header.get("revision") != report["baseline"]["revision"] + 1:
                raise AssertionError(f"{scenario} journal does not retain the failed edit revision")
            if "Uncommitted text for deterministic" not in canonical(journal_entry):
                raise AssertionError(f"{scenario} journal entry does not retain the failed edit")
            process_log = str(log_path)
        _, after_kill = read_database(work)
        if canonical(after_kill) != canonical(report["baseline"]):
            raise AssertionError(f"{scenario} rollback changed after the harness killed its owned process")
        record_result({
            "scenario": scenario,
            "status": "passed",
            "databaseRevision": after_kill["revision"],
            "journalRevision": journal_header["revision"],
            "processLog": process_log,
        })

    # Controlled process termination at three exact SQLite/mirror boundaries.
    for scenario, point in (
        ("pre-commit", "pre-commit"),
        ("post-commit-pre-mirror", "post-commit-pre-mirror"),
        ("post-mirror", "post-mirror"),
    ):
        work = root / scenario
        report, checkpoint, log_path = run_to_checkpoint(
            scenario, work, f"{run_id}-{scenario}", point, timeout
        )
        db_path, persisted = read_database(work)
        acknowledged = report["acknowledgedRevision"]
        require_revision(persisted, acknowledged)
        if scenario == "pre-commit":
            if checkpoint["revision"] != acknowledged + 1 or persisted["revision"] != acknowledged:
                raise AssertionError("Pre-commit termination changed SQLite or misreported the last acknowledgement")
        elif scenario == "post-commit-pre-mirror":
            if persisted["revision"] != checkpoint["revision"]:
                raise AssertionError("Post-commit termination lost the committed SQLite transaction")
            require_mirror_lag(db_path, persisted)
            restart_report, restart_log = run_to_exit(
                "post-commit-restart", work, f"{run_id}-{scenario}", timeout
            )
            if canonical(restart_report["current"]) != canonical(persisted):
                raise AssertionError("Restart changed or lost the committed project revision")
            db_path, reopened = read_database(work)
            if canonical(reopened) != canonical(persisted):
                raise AssertionError("Restart changed the canonical SQLite project")
            # This is intentionally the same exact-equality check used for normal
            # mirrors: a stale/missing portable copy after restart must fail D1.
            assert_mirror_matches(db_path, reopened)
            record_result({
                "scenario": "post-commit mirror repair after restart",
                "status": "passed",
                "databaseRevision": reopened["revision"],
                "processLog": str(restart_log),
            })
        else:
            if persisted["revision"] != checkpoint["revision"]:
                raise AssertionError("Post-mirror checkpoint revision differs from SQLite")
            assert_mirror_matches(db_path, persisted)
        record_result({
            "scenario": scenario,
            "status": "passed",
            "lastAcknowledgedRevision": acknowledged,
            "checkpointRevision": checkpoint["revision"],
            "databaseRevision": persisted["revision"],
            "processLog": str(log_path),
        })

    # Each deliberately defective path runs only in its own test profile and isolated
    # library. A control counts as proven only when the same checker detects the defect.
    metadata_control = root / "control-metadata"
    report, log_path = run_to_exit(
        "metadata-negative", metadata_control, f"{run_id}-control-metadata", timeout
    )
    database_path, persisted = read_database(metadata_control)
    safety_history = report["seed"]["history"]
    try:
        require_metadata(safety_history, "doctored sparse history", history=True)
    except AssertionError as error:
        if "metadata" not in str(error):
            raise
        record_result({"scenario": "metadata-loss negative control", "status": "detected", "reason": str(error), "processLog": str(log_path)})
    else:
        raise AssertionError("Metadata-loss negative control passed; the checker missed dropped metadata")

    safety_control = root / "control-safety"
    report, log_path = run_to_exit(
        "safety-negative", safety_control, f"{run_id}-control-safety", timeout
    )
    try:
        require_safety_snapshot(report.get("safety"), report.get("beforeRestore"), "safety negative control")
    except AssertionError as error:
        if "generated safety snapshot is missing" not in str(error):
            raise
        if "safety snapshot is missing" not in (report.get("safetyError") or ""):
            raise AssertionError("Safety-copy negative control did not come from the missing-snapshot hook")
        record_result({"scenario": "missing safety snapshot negative control", "status": "detected", "reason": str(error), "processLog": str(log_path)})
    else:
        raise AssertionError("Safety-copy acceptance check passed the deliberately missing snapshot")

    close_control = root / "control-close"
    report, log_path = run_to_exit(
        "close-negative", close_control, f"{run_id}-control-close", timeout
    )
    if not (close_control / "fault-used-close-flush").is_file():
        raise AssertionError("Close-control did not drive the close mirror writer failure hook")
    if not (close_control / "fault-used-bypass-close-guard").is_file():
        raise AssertionError("Close-control did not drive the explicit close-guard bypass hook")
    if close_event_count(close_control) != 1:
        raise AssertionError("Close-control fixture did not stop at its first actual WindowEvent")
    try:
        assert_close_contract(report, close_event_count(close_control))
    except AssertionError as error:
        if "blocked close, visible error, and completed retry" not in str(error):
            raise
        record_result({"scenario": "premature close negative control", "status": "detected", "reason": str(error), "processLog": str(log_path)})
    else:
        raise AssertionError("Close acceptance checker passed the deliberately bypassed close guard")

    ack_control = root / "control-sql-ack"
    report, log_path = run_to_exit(
        "sql-ack-negative", ack_control, f"{run_id}-control-sql-ack", timeout
    )
    _, persisted = read_database(ack_control)
    acknowledged = report["acknowledgedRevision"]
    try:
        require_revision(persisted, acknowledged)
    except AssertionError as error:
        if "below acknowledged revision" not in str(error):
            raise
        record_result({"scenario": "premature SQL acknowledgement negative control", "status": "detected", "reason": str(error), "processLog": str(log_path)})
    else:
        raise AssertionError("Acknowledged-revision acceptance check passed the premature SQL ack control")

    ACTIVE_SUMMARY["ok"] = all(item["status"] != "blocked" for item in results)
    ACTIVE_SUMMARY["status"] = "passed" if ACTIVE_SUMMARY["ok"] else "failed"
    persist_active_result()
    print(json.dumps(ACTIVE_SUMMARY, indent=2))
    return 0 if ACTIVE_SUMMARY["ok"] else 2


def main():
    global ACTIVE_SUMMARY
    parser = argparse.ArgumentParser()
    parser.add_argument("--suite", required=True, choices=["baseline"])
    parser.add_argument("--timeout", type=int, default=180, help="seconds allowed for each owned native app process")
    args = parser.parse_args()
    CACHE.mkdir(parents=True, exist_ok=True)
    run_id = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ") + "-" + uuid.uuid4().hex[:8]
    root = CACHE / "runs" / run_id
    root.mkdir(parents=True)
    latest_path = CACHE / "latest.json"
    identity = None
    identity_error = None
    try:
        identity = diagnostic_binary_identity()
    except Exception as error:
        identity_error = str(error)
    running = {
        "suite": args.suite,
        "ok": False,
        "status": "running",
        "runId": run_id,
        "host": platform.platform(),
        "binary": str(BINARY),
        "identity": identity,
        "identityError": identity_error,
        "dataAndLogs": str(root),
        "scenarios": [],
        "limit": "Owned-process termination tests acknowledged SQLite checkpoints; they do not test an uncommitted keystroke, physical power loss, or hardware failure.",
    }
    ACTIVE_SUMMARY = running
    latest_path.write_text(json.dumps(running, indent=2) + "\n")
    try:
        if identity_error:
            raise RuntimeError(identity_error)
        return run_suite(args.timeout, run_id, root, identity)
    except Exception as error:
        ACTIVE_SUMMARY.update({"ok": False, "status": "failed", "error": str(error)})
        persist_active_result()
        print(f"Native reliability suite blocked or failed: {error}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
