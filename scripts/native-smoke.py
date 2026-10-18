#!/usr/bin/env python3
"""Qualify native save/recovery using only an isolated, harness-owned app process."""
import json
import os
from pathlib import Path
import signal
import sqlite3
import subprocess
import tempfile
import time

root = Path(__file__).resolve().parents[1]
binary = root / "src-tauri/target/debug/folio"
work = Path(tempfile.mkdtemp(prefix="personal-word-native-smoke-"))
projects = work / "projects"
projects.mkdir()
print(f"Native test data: {work}", flush=True)
process = None
reports = []


def launch(phase):
    global process
    env = {
        **os.environ,
        "FOLIO_SMOKE_DIR": str(work),
        "FOLIO_SMOKE_PHASE": str(phase),
    }
    output = (work / f"process-{phase}.log").open("w")
    process = subprocess.Popen(
        [str(binary)], env=env, stdout=output, stderr=subprocess.STDOUT, start_new_session=True
    )
    return output


def stop_owned_process():
    global process
    if process is not None and process.poll() is None:
        try:
            os.killpg(process.pid, signal.SIGKILL)
        except ProcessLookupError:
            pass
    if process is not None:
        process.wait(timeout=10)
        process = None


def read_report(phase):
    path = work / f"report-{phase}.json"
    if not path.exists():
        log = (work / f"process-{phase}.log").read_text(errors="replace")
        raise RuntimeError(
            f"Native phase {phase} produced no report; last breadcrumbs:\n"
            f"{last_progress()}\n{log[-4000:]}"
        )
    report = json.loads(path.read_text())
    print(json.dumps(report, indent=2), flush=True)
    if not report.get("ok"):
        raise RuntimeError(f"Native phase {phase} reported failure: {report}")
    return report


def last_progress(limit=12):
    """Breadcrumbs the injected script wrote, so a stall names the step it reached."""
    path = work / "progress.log"
    if not path.exists():
        return "(no breadcrumbs)"
    lines = path.read_text(errors="replace").strip().splitlines()
    return "\n".join(lines[-limit:]) or "(no breadcrumbs)"


def verify_database(expected_text, verify_mirror):
    databases = list(projects.glob("*/project.sqlite3"))
    if len(databases) != 1:
        raise RuntimeError(f"Expected one isolated project database, found {len(databases)}")
    db_path = databases[0]
    with sqlite3.connect(db_path, timeout=5) as db:
        integrity = db.execute("PRAGMA integrity_check").fetchone()[0]
        if integrity != "ok":
            raise AssertionError(f"SQLite integrity_check returned {integrity!r}")
        header = json.loads(db.execute("SELECT data FROM project").fetchone()[0])
        rows = {entry_id: json.loads(data) for entry_id, data in db.execute("SELECT id, data FROM entries")}
        entry_ids = header.pop("entryIds")
        project = {**header, "entries": [rows[entry_id] for entry_id in entry_ids]}
        text = next(entry["text"] for entry in project["entries"] if entry["id"] == project["order"][0])
        if expected_text not in text:
            raise AssertionError(f"Expected database text {expected_text!r}, found {text!r}")
        if verify_mirror:
            mirror = json.loads((db_path.parent / "project.json").read_text())
            if mirror != project:
                raise AssertionError("Portable JSON mirror differs from SQLite")
        return db_path


try:
    if not binary.is_file():
        raise RuntimeError(f"Native smoke binary is missing: {binary}")

    # Phase 1 finishes through the actual frontend flush and native quit guard.
    output = launch(1)
    try:
        stdout, _ = process.communicate(timeout=180)
    except subprocess.TimeoutExpired:
        stop_owned_process()
        raise RuntimeError(
            "Native phase 1 did not quit normally; last breadcrumbs:\n"
            f"{last_progress()}\n{(work / 'process-1.log').read_text(errors='replace')[-2000:]}"
        )
    finally:
        output.close()
    if process.returncode:
        raise RuntimeError(f"Native phase 1 exited {process.returncode}: {(work / 'process-1.log').read_text(errors='replace')[-4000:]}")
    reports.append(read_report(1))
    verify_database("Rapid final text must survive native quit.", verify_mirror=True)

    # Phase 2 proves normal quit/reopen, then leaves one journaled edit after a
    # separately acknowledged SQLite checkpoint for this harness to terminate.
    output = launch(2)
    deadline = time.monotonic() + 180
    try:
        report_path = work / "report-2.json"
        while time.monotonic() < deadline and not report_path.exists():
            if process.poll() is not None:
                raise RuntimeError(
                    "Native phase 2 exited before arming forced restart; last breadcrumbs:\n"
                    f"{last_progress()}\n{(work / 'process-2.log').read_text(errors='replace')[-2000:]}"
                )
            time.sleep(0.01)
        reports.append(read_report(2))
        if process.poll() is not None:
            raise RuntimeError("Native phase 2 exited before the harness could terminate it")
        os.killpg(process.pid, signal.SIGKILL)
        process.wait(timeout=10)
        if process.returncode == 0:
            raise RuntimeError("Phase 2 unexpectedly exited cleanly instead of being terminated by the harness")
        process = None
        verify_database("Acknowledged SQLite checkpoint.", verify_mirror=False)
    finally:
        output.close()

    # Phase 3 reopens the same isolated native store and must recover the latest
    # edit from WebView localStorage before it can save and quit normally.
    output = launch(3)
    try:
        process.communicate(timeout=180)
    except subprocess.TimeoutExpired:
        stop_owned_process()
        raise RuntimeError(
            "Native phase 3 did not quit normally; last breadcrumbs:\n"
            f"{last_progress()}\n{(work / 'process-3.log').read_text(errors='replace')[-2000:]}"
        )
    finally:
        output.close()
    if process.returncode:
        raise RuntimeError(f"Native phase 3 exited {process.returncode}: {(work / 'process-3.log').read_text(errors='replace')[-4000:]}")
    reports.append(read_report(3))
    verify_database("Original prose kept for a fragment.", verify_mirror=True)

    summary = {
        "ok": True,
        "phases": reports,
        "dataDirectory": str(work),
        "checks": [
            "phase 1 normal quit flushes SQLite and portable mirrors",
            "phase 2 normal quit/reopen preserves the latest saved edit",
            "phase 2 deliberate harness-owned termination follows an acknowledged SQLite checkpoint",
            "phase 3 restart recovers the journaled edit from isolated WebView storage",
            "SQLite integrity and portable JSON mirror match after clean shutdown",
            "fragment extraction, restoration, and snapshot restoration",
        ],
    }
    (root / "test-results").mkdir(exist_ok=True)
    (root / "test-results/native-smoke.json").write_text(json.dumps(summary, indent=2) + "\n")
    print("Native WebView + SQLite smoke test passed.", flush=True)
finally:
    stop_owned_process()
