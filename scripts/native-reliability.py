#!/usr/bin/env python3
"""Run the D1 native durability matrix (baseline) and the D2 beta matrix against an already-built diagnostic app.

Every app process and SQLite library lives below node_modules/.cache, and this
supervisor signals only process groups it created. It never builds the app or
opens the user's com.folio.writing store.
"""
import argparse
import base64
from contextlib import closing, contextmanager
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import platform
import re
import shutil
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
    "tests/fixtures/beta-synthetic-project.json",
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


# ---------------------------------------------------------------------------------------------
# D2 / WP11 beta suite. tests/fixtures/beta-synthetic-project.json is the only description of the
# synthetic project (the unit tests and the Rust store test read the same file). Every expected
# state below is derived from it here, in Python, and compared with what the killed or quit app left
# on disk. The native script only executes steps; its own reports are never used as expectations.
# ---------------------------------------------------------------------------------------------
BETA_FIXTURE = ROOT / "tests/fixtures/beta-synthetic-project.json"
# Literal anchors that do not come from the fixture file or from Rust, so a wrong id, extension or
# image cannot be accepted just because every layer agrees with itself.
BETA_ASSET_IDS = {
    "png-section-drawing": "f6b373ee62d8abe053e1decceb83b38627e0ce3df932ce72729f10a2e6e8fc58",
    "jpeg-sherd": "3d514a5fefae5717146a5a34587661bf8dc478f1228b7857e95cb8db669a82a9",
    "png-late": "4f41c74697cfb0d0fef50823998e9119d3f1eb92f5d3764fed5d2a1051456de8",
}
BETA_ATTACHMENT_EXTENSIONS = {"image/png": "png", "image/jpeg": "jpg"}
BETA_CLONE_ID = "7c1d4e8a-2b3f-4a5c-9d6e-0f1a2b3c4d5e"


def deep(value):
    return json.loads(json.dumps(value))


def short(value, limit=90):
    text = json.dumps(value, ensure_ascii=False, sort_keys=True)
    return text if len(text) <= limit else text[: limit - 3] + "..."


def first_difference(actual, expected, path="$"):
    """Path of the first field where two JSON values differ, or None when they are identical."""
    if type(actual) is not type(expected):
        return f"{path}: {type(actual).__name__} {short(actual)} vs {type(expected).__name__} {short(expected)}"
    if isinstance(actual, dict):
        for key in sorted(set(actual) | set(expected)):
            if key not in actual:
                return f"{path}.{key}: missing (expected {short(expected[key])})"
            if key not in expected:
                return f"{path}.{key}: unexpected {short(actual[key])}"
            found = first_difference(actual[key], expected[key], f"{path}.{key}")
            if found:
                return found
        return None
    if isinstance(actual, list):
        if len(actual) != len(expected):
            return f"{path}: length {len(actual)} vs {len(expected)}"
        for index, (left, right) in enumerate(zip(actual, expected)):
            found = first_difference(left, right, f"{path}[{index}]")
            if found:
                return found
        return None
    return None if actual == expected else f"{path}: {short(actual)} vs {short(expected)}"


def require_equal(actual, expected, label):
    """Canonical full-structure equality; the failure names the first differing field."""
    if canonical(actual) != canonical(expected):
        raise AssertionError(f"{label}: differs at {first_difference(actual, expected)}")


class Beta:
    """Expected states for the synthetic project, built only from the fixture file."""

    def __init__(self):
        self.fixture = json.loads(BETA_FIXTURE.read_text())
        self.ids = self.fixture["ids"]
        self.edits = self.fixture["edits"]
        self.assets = {}
        for item in self.fixture["assets"]:
            data = base64.b64decode(item["data"])
            if item["id"] != BETA_ASSET_IDS[item["name"]] or hashlib.sha256(data).hexdigest() != item["id"]:
                raise AssertionError(f"Fixture asset {item['name']} does not match its recorded SHA-256")
            if item["meta"]["byteLength"] != len(data):
                raise AssertionError(f"Fixture asset {item['name']} has the wrong byte length")
            self.assets[item["name"]] = {**item, "bytes": data, "extension": BETA_ATTACHMENT_EXTENSIONS[item["meta"]["mime"]]}
        self.pid = self.ids["project"]
        self.s1 = deep(self.fixture["initial"])
        self.s2 = self.apply_edit(self.s1, self.edits["incremental"])
        self.s3 = self.apply_edit(self.s2, self.edits["second"])
        self.late = self.apply_edit(self.s1, self.edits["lateImage"])
        self.merged = self.apply_edit(self.s1, self.edits["merge"])
        # Crash-restore scenario: V1 content (S1) returned over S2 as revision 3.
        self.restored_from_v1 = {**deep(self.s1), "revision": 3, "updatedAt": self.edits["restore"]["updatedAt"]}
        for state in (self.s1, self.s2, self.s3, self.late, self.merged):
            referenced = referenced_assets(state)
            unknown = referenced - {item["id"] for item in self.assets.values()}
            if unknown:
                raise AssertionError(f"Fixture state references an image that is not in the fixture: {sorted(unknown)}")

    @staticmethod
    def apply_edit(project, edit):
        nxt = deep(project)
        nxt["revision"] += 1
        nxt["updatedAt"] = edit["updatedAt"]
        if edit.get("entryId"):
            entry = next(e for e in nxt["entries"] if e["id"] == edit["entryId"])
            entry.update(deep(edit["entry"]))
        for patch in edit.get("sources", []):
            next(s for s in nxt["research"]["sources"] if s["id"] == patch["id"]).update(deep(patch["set"]))
        return nxt

    def asset_id(self, name):
        return self.assets[name]["id"]

    def attachment_name(self, name):
        return f"{self.assets[name]['id']}.{self.assets[name]['extension']}"


def referenced_assets(project):
    found = set()

    def walk(node):
        if isinstance(node, dict):
            if node.get("type") == "image" and isinstance(node.get("attrs"), dict):
                found.add(node["attrs"]["assetId"])
            for child in node.get("content") or []:
                walk(child)

    for entry in project["entries"]:
        walk(entry["content"])
    return found


def manuscript_text(project):
    by_id = {entry["id"]: entry for entry in project["entries"]}
    return "\n\n".join(f"{by_id[i]['title']}\n\n{by_id[i]['text']}\n" for i in project["order"])


def fragments_text(project):
    return "\n\n".join(
        f"{entry['title']}\n\n{entry['text']}\n" for entry in project["entries"] if entry["kind"] == "fragment"
    )


class DiskState:
    """Everything one project left on disk, read without the app (read-only SQLite, plain files)."""

    def __init__(self, folder):
        self.folder = folder
        self.project = None
        self.history = {}
        self.snapshots = []
        self.assets = {}
        self.attachments = {}
        self.snapshot_files = {}
        self.mirror = None
        self.manuscript = None
        self.fragments = None
        self.user_version = None


def read_disk_state(work, project_id):
    folder = work / "projects" / project_id
    state = DiskState(folder)
    database_path = folder / "project.sqlite3"
    if not database_path.is_file():
        raise AssertionError(f"Project database is missing: {database_path}")
    with closing(sqlite3.connect(database_path.as_uri() + "?mode=ro", uri=True, timeout=5)) as database:
        integrity = database.execute("PRAGMA integrity_check").fetchone()[0]
        if integrity != "ok":
            raise AssertionError(f"SQLite integrity_check returned {integrity!r}")
        state.user_version = database.execute("PRAGMA user_version").fetchone()[0]
        headers = database.execute("SELECT id,data FROM project").fetchall()
        if len(headers) != 1 or headers[0][0] != project_id:
            raise AssertionError(f"Expected exactly project {project_id}, found {[row[0] for row in headers]}")
        rows = {entry_id: json.loads(data) for entry_id, data in database.execute("SELECT id,data FROM entries")}
        header = json.loads(headers[0][1])
        entry_ids = header.pop("entryIds")
        if set(entry_ids) != set(rows):
            raise AssertionError("Project header IDs differ from the persisted entry rows")
        state.project = {**header, "entries": [rows[i] for i in entry_ids]}
        for revision, header_json in database.execute("SELECT revision,header FROM history"):
            old = json.loads(header_json)
            old_ids = old.pop("entryIds")
            blobs = {
                entry_id: json.loads(data)
                for entry_id, data in database.execute(
                    "SELECT h.entry_id,b.data FROM history_entries h JOIN history_blobs b ON b.id=h.blob WHERE h.revision=?",
                    [revision],
                )
            }
            state.history[revision] = {**old, "entries": [blobs[i] for i in old_ids]}
        for key, name, created_at, data in database.execute("SELECT id,name,created_at,data FROM snapshots ORDER BY rowid"):
            state.snapshots.append({"id": key, "name": name, "createdAt": created_at, "project": json.loads(data)})
        for asset_id, mime, length, width, height, data in database.execute(
            "SELECT id,mime,byte_length,width,height,data FROM assets"
        ):
            state.assets[asset_id] = {"mime": mime, "byteLength": length, "width": width, "height": height, "data": bytes(data)}
    attachments = folder / "attachments"
    if attachments.is_dir():
        state.attachments = {
            path.name: hashlib.sha256(path.read_bytes()).hexdigest() for path in attachments.iterdir() if path.is_file()
        }
    snapshots = folder / "snapshots"
    if snapshots.is_dir():
        state.snapshot_files = {path.stem: json.loads(path.read_text()) for path in snapshots.glob("*.json")}
    if (folder / "project.json").is_file():
        state.mirror = json.loads((folder / "project.json").read_text())
    if (folder / "manuscript.txt").is_file():
        state.manuscript = (folder / "manuscript.txt").read_text()
    if (folder / "fragments.txt").is_file():
        state.fragments = (folder / "fragments.txt").read_text()
    return state


def check_project(state, expected, label):
    require_equal(state.project, expected, f"{label}: SQLite project")


def check_history(state, expected_by_revision, label):
    for revision, expected in expected_by_revision.items():
        if revision not in state.history:
            raise AssertionError(f"{label}: automatic history has no row for revision {revision}")
        require_equal(state.history[revision], expected, f"{label}: history revision {revision}")


def check_snapshots(state, expected_by_name, label):
    """Every named snapshot equals the expected complete project, its file copy equals its row, none are lost."""
    for name, expected_projects in expected_by_name.items():
        rows = [row for row in state.snapshots if row["name"] == name]
        if len(rows) != len(expected_projects):
            raise AssertionError(f"{label}: expected {len(expected_projects)} snapshot(s) named {name!r}, found {len(rows)}")
        actual = sorted(canonical(row["project"]) for row in rows)
        wanted = sorted(canonical(project) for project in expected_projects)
        if actual != wanted:
            index = next(i for i, (a, w) in enumerate(zip(actual, wanted)) if a != w)
            raise AssertionError(
                f"{label}: snapshot {name!r} differs at {first_difference(json.loads(actual[index]), json.loads(wanted[index]))}"
            )
        for row in rows:
            copy = state.snapshot_files.get(row["id"])
            if copy is None:
                raise AssertionError(f"{label}: snapshot {name!r} has no file copy {row['id']}.json")
            require_equal(copy, row["project"], f"{label}: snapshot {name!r} file copy")


def check_assets(beta, state, stored, attached, label):
    """The assets table holds exactly `stored` (name -> id, bytes, meta); attachments hold exactly `attached`, byte-exact."""
    expected_ids = {beta.asset_id(name) for name in stored}
    if set(state.assets) != expected_ids:
        raise AssertionError(f"{label}: stored images {sorted(i[:8] for i in state.assets)} differ from {sorted(i[:8] for i in expected_ids)}")
    for name in stored:
        item = beta.assets[name]
        row = state.assets[item["id"]]
        meta = item["meta"]
        if (row["mime"], row["byteLength"], row["width"], row["height"]) != (meta["mime"], meta["byteLength"], meta["width"], meta["height"]):
            raise AssertionError(f"{label}: stored image {name} metadata differs")
        if hashlib.sha256(row["data"]).hexdigest() != item["id"] or row["data"] != item["bytes"]:
            raise AssertionError(f"{label}: stored image {name} bytes do not match their SHA-256")
    wanted = {beta.attachment_name(name): beta.asset_id(name) for name in attached}
    if set(state.attachments) != set(wanted):
        raise AssertionError(f"{label}: attachment files {sorted(state.attachments)} differ from {sorted(wanted)}")
    for file_name, asset_id in wanted.items():
        if state.attachments[file_name] != asset_id:
            raise AssertionError(f"{label}: attachment {file_name} bytes do not match their SHA-256")


def check_mirror(state, expected, label):
    """project.json and the text copies equal the expected project (independently rendered)."""
    if state.mirror is None:
        raise AssertionError(f"{label}: portable project.json is missing")
    require_equal(state.mirror, expected, f"{label}: project.json")
    if state.manuscript != manuscript_text(expected):
        raise AssertionError(f"{label}: manuscript.txt differs from the expected rendering")
    if state.fragments != fragments_text(expected):
        raise AssertionError(f"{label}: fragments.txt differs from the expected rendering")


def check_mirror_lags(state, committed, older, label):
    """After a post-commit kill: SQLite has the new revision, project.json still shows the old one."""
    if state.mirror is None:
        raise AssertionError(f"{label}: expected the previous project.json to remain")
    require_equal(state.mirror, older, f"{label}: project.json must still be the previous revision")
    if state.mirror["revision"] >= committed["revision"]:
        raise AssertionError(f"{label}: the portable copy did not lag the committed revision")


def check_ui_restore(actual, target, prior, label):
    """The app's restore of `target` over `prior`: identical except for the new revision, the project's
    updatedAt, and the contentRevision the app stamps on entries whose body changed."""
    revision = prior["revision"] + 1
    if actual["revision"] != revision:
        raise AssertionError(f"{label}: restored revision {actual['revision']}, expected {revision}")
    got, wanted = deep(actual), deep(target)
    wanted["revision"] = revision
    got["updatedAt"] = wanted["updatedAt"] = "(restore time)"
    prior_content = {e["id"]: canonical(e["content"]) for e in prior["entries"]}
    changed = {e["id"] for e in target["entries"] if canonical(e["content"]) != prior_content[e["id"]]}
    wanted_entries = {e["id"]: e for e in wanted["entries"]}
    for entry in got["entries"]:
        if entry["id"] in changed:
            stamp = entry.pop("contentRevision", None)
            if not isinstance(stamp, int) or isinstance(stamp, bool) or stamp < 1:
                raise AssertionError(f"{label}: entry {entry['id'][-4:]} was not given a content revision ({stamp!r})")
            wanted_entries[entry["id"]].pop("contentRevision", None)
    require_equal(got, wanted, label)


def sha_of_tree(folder):
    """Relative path -> SHA-256 for every file below `folder` (journal sidecars excluded and reported separately)."""
    return {
        str(path.relative_to(folder)): hashlib.sha256(path.read_bytes()).hexdigest()
        for path in sorted(folder.rglob("*"))
        if path.is_file()
    }


def record_control(label, check, *args):
    """Runs the same acceptance check the passing path uses against a deliberately wrong state: it must fail."""
    try:
        check(*args)
    except AssertionError as error:
        record_result({"scenario": label, "status": "detected", "reason": str(error)[:400]})
        return
    raise AssertionError(f"Negative control did not fail the acceptance check: {label}")


class Doctor:
    """Doctored copies of a finished scenario state. The live run files are never touched."""

    def __init__(self, root):
        self.root = root / "controls"
        self.count = 0

    def copy(self, work, project_id, label):
        self.count += 1
        destination = self.root / f"{self.count:02d}-{re.sub(r'[^A-Za-z0-9-]+', '-', label)}"
        source = work / "projects" / project_id
        target = destination / "projects" / project_id
        target.mkdir(parents=True)
        with closing(sqlite3.connect(source.as_uri() + "/project.sqlite3?mode=ro", uri=True)) as live:
            with closing(sqlite3.connect(target / "project.sqlite3")) as copy:
                live.backup(copy)
        for name in ("attachments", "snapshots"):
            if (source / name).is_dir():
                shutil.copytree(source / name, target / name)
        for name in ("project.json", "manuscript.txt", "fragments.txt"):
            if (source / name).is_file():
                shutil.copy2(source / name, target / name)
        return destination

    @staticmethod
    def sql(destination, project_id, statement, parameters=()):
        with closing(sqlite3.connect(destination / "projects" / project_id / "project.sqlite3")) as database:
            database.execute(statement, parameters)
            database.commit()

    @staticmethod
    def edit_json_row(destination, project_id, table, key_column, key, mutate):
        with closing(sqlite3.connect(destination / "projects" / project_id / "project.sqlite3")) as database:
            (data,) = database.execute(f"SELECT data FROM {table} WHERE {key_column}=?", [key]).fetchone()
            value = json.loads(data)
            mutate(value)
            database.execute(f"UPDATE {table} SET data=? WHERE {key_column}=?", [json.dumps(value, ensure_ascii=False), key])
            database.commit()


def run_beta_suite(timeout, run_id, root):
    """Lifecycle, fault-checkpoint, schema and control scenarios for the synthetic beta project."""
    beta = Beta()
    doctor = Doctor(root)
    pid = beta.pid
    ids = beta.ids
    s1, s2, s3, late, merged = beta.s1, beta.s2, beta.s3, beta.late, beta.merged
    both = ["png-section-drawing", "jpeg-sherd"]
    everything = both + ["png-late"]

    def control(work, label, mutate, check, project_id=pid):
        """Doctor a copy of `work`'s current state, then require `check` to fail on it."""
        destination = doctor.copy(work, project_id, label.replace(" ", "-")[:40])
        mutate(destination)
        record_control(f"beta control: {label}", lambda: check(read_disk_state(destination, project_id)))

    def drop_project_field(field):
        return lambda d: Doctor.edit_json_row(d, pid, "project", "id", pid, lambda v: v.pop(field))

    def drop_entry_field(entry_id, field):
        return lambda d: Doctor.edit_json_row(d, pid, "entries", "id", entry_id, lambda v: v.pop(field))

    def delete_rows(statement, parameters=()):
        return lambda d: Doctor.sql(d, pid, statement, parameters)

    def flip_attachment(name):
        def mutate(destination):
            path = destination / "projects" / pid / "attachments" / beta.attachment_name(name)
            data = path.read_bytes()
            path.write_bytes(bytes([data[0] ^ 1]) + data[1:])
        return mutate

    def delete_attachment(name):
        def mutate(destination):
            (destination / "projects" / pid / "attachments" / beta.attachment_name(name)).unlink()
        return mutate

    def write_mirror(project):
        def mutate(destination):
            (destination / "projects" / pid / "project.json").write_text(json.dumps(project, indent=2, ensure_ascii=False))
        return mutate

    def set_project(project):
        """Make a copy's SQLite rows show `project` (header and every entry)."""
        def mutate(destination):
            header = {k: v for k, v in project.items() if k != "entries"}
            header["entryIds"] = [entry["id"] for entry in project["entries"]]
            with closing(sqlite3.connect(destination / "projects" / pid / "project.sqlite3")) as database:
                database.execute("UPDATE project SET revision=?, data=? WHERE id=?",
                                 [project["revision"], json.dumps(header, ensure_ascii=False), pid])
                for entry in project["entries"]:
                    database.execute("UPDATE entries SET data=? WHERE id=?", [json.dumps(entry, ensure_ascii=False), entry["id"]])
                database.commit()
        return mutate

    # ---- 1. Lifecycle: three native processes (create/edit/snapshot -> UI restore -> fresh start + import) ----
    life = root / "beta-lifecycle"
    life_run = f"{run_id}-beta-life"
    report_a, log_a = run_to_exit("beta-lifecycle", life, life_run, timeout)
    require_equal(report_a["afterCreate"], s1, "ordinary reload after creating the fixture")
    require_equal(report_a["afterIncremental"], s2, "ordinary reload after the one-entry incremental save")
    require_equal(report_a["afterSecond"], s3, "ordinary reload after the second incremental save")

    def check_life_a(state):
        check_project(state, s3, "lifecycle quit 1")
        check_history(state, {1: s1, 2: s2}, "lifecycle quit 1")
        check_snapshots(state, {"Beta snapshot A": [s2]}, "lifecycle quit 1")
        check_assets(beta, state, both, both, "lifecycle quit 1")
        check_mirror(state, s3, "lifecycle quit 1")

    check_life_a(read_disk_state(life, pid))
    control(life, "lifecycle drops a project field (goals)", drop_project_field("goals"), check_life_a)
    control(life, "lifecycle drops an entry field (tags)", drop_entry_field(ids["sec1"], "tags"), check_life_a)
    control(life, "lifecycle alters a source raw field", lambda d: Doctor.edit_json_row(
        d, pid, "project", "id", pid,
        lambda v: v["research"]["sources"][0]["cslData"].pop("rawUnknownField")), check_life_a)
    control(life, "lifecycle loses an image row", delete_rows("DELETE FROM assets WHERE id=?", [beta.asset_id("jpeg-sherd")]), check_life_a)
    control(life, "lifecycle flips an attachment byte", flip_attachment("png-section-drawing"), check_life_a)
    control(life, "lifecycle loses an attachment file", delete_attachment("jpeg-sherd"), check_life_a)
    control(life, "lifecycle loses a history row", delete_rows("DELETE FROM history WHERE revision=1"), check_life_a)
    control(life, "lifecycle loses the named snapshot", delete_rows("DELETE FROM snapshots WHERE name='Beta snapshot A'"), check_life_a)
    control(life, "lifecycle leaves a stale project.json", write_mirror(s2), check_life_a)

    report_b, log_b = run_to_exit("beta-lifecycle-restore", life, life_run, timeout)
    require_equal(report_b["beforeRestore"], s3, "opening the project in the UI must not rewrite it")

    def check_life_b(state):
        check_ui_restore(state.project, s2, s3, "UI restore of Beta snapshot A")
        check_history(state, {1: s1, 2: s2, 3: s3}, "lifecycle restore")
        check_snapshots(state, {"Beta snapshot A": [s2], "Before restoring Beta snapshot A": [s3]}, "lifecycle restore")
        check_assets(beta, state, both, both, "lifecycle restore")
        check_mirror(state, state.project, "lifecycle restore")

    state_b = read_disk_state(life, pid)
    check_life_b(state_b)
    restored = state_b.project
    require_equal(report_b["current"], restored, "reported restored project")
    if report_b["safety"]["name"] != "Before restoring Beta snapshot A":
        raise AssertionError("The generated safety snapshot has the wrong name")
    require_equal(report_b["safety"]["project"], s3, "generated safety snapshot (complete pre-restore project)")
    control(life, "restore loses the generated safety snapshot",
            delete_rows("DELETE FROM snapshots WHERE name='Before restoring Beta snapshot A'"), check_life_b)
    control(life, "restore changes a table cell", lambda d: Doctor.edit_json_row(
        d, pid, "entries", "id", ids["sec1"],
        lambda v: v["content"]["content"][3]["content"][1]["content"][1]["content"][0]["content"][0].update(text="0-46")), check_life_b)
    control(life, "restore drops a comment anchor", lambda d: Doctor.edit_json_row(
        d, pid, "project", "id", pid, lambda v: v["annotations"][0].pop("anchor")), check_life_b)

    report_c, log_c = run_to_exit("beta-lifecycle-reopen", life, life_run, timeout)
    require_equal(report_c["current"], restored, "a fresh native start reads the identical project")
    for name in both:
        if report_c["hashes"].get(beta.asset_id(name)) != beta.asset_id(name):
            raise AssertionError(f"Fresh start read different bytes for image {name}")
    if [v["name"] for v in report_c["versions"]].count("Before restoring Beta snapshot A") != 1:
        raise AssertionError("The fresh start does not list exactly one generated safety snapshot")
    require_equal(report_c["safety"]["project"], s3, "safety snapshot read by the fresh start")
    check_life_b(read_disk_state(life, pid))
    clone = {**deep(restored), "id": BETA_CLONE_ID, "revision": 1,
             "title": restored["title"] + " (recovered)", "updatedAt": "2026-10-25T00:00:00.000Z"}
    require_equal(report_c["imported"], clone, "reload of the project imported under a new identity")

    def check_clone(state):
        check_project(state, clone, "import under a new identity")
        check_assets(beta, state, both, both, "import under a new identity")
        check_mirror(state, clone, "import under a new identity")
        if state.history:
            raise AssertionError("A new identity starts without history rows")

    check_clone(read_disk_state(life, BETA_CLONE_ID))
    control(life, "new identity loses an image", lambda d: Doctor.sql(
        d, BETA_CLONE_ID, "DELETE FROM assets WHERE id=?", [beta.asset_id("png-section-drawing")]), check_clone,
        project_id=BETA_CLONE_ID)
    record_result({
        "scenario": "beta lifecycle: create, incremental saves, history, snapshot, UI restore with generated safety copy, fresh start, import under a new identity",
        "status": "passed",
        "finalRevision": restored["revision"],
        "finalProjectSha256": hashlib.sha256(canonical(restored).encode()).hexdigest(),
        "processLogs": [str(log_a), str(log_b), str(log_c)],
    })

    # ---- 2. Fault: asset staging vs content commit ----
    work = root / "beta-asset-stage"
    stage_run = f"{run_id}-beta-asset"
    crash, checkpoint, crash_log = run_to_checkpoint("beta-crash-asset-stage", work, stage_run, "post-asset-stage", timeout)
    require_equal(crash["baseline"], s1, "baseline before staging")

    def check_stage_crash(state):
        check_project(state, s1, "after staging crash (the content commit never happened)")
        if state.history:
            raise AssertionError("Staging alone must not create history rows")
        check_assets(beta, state, everything, both, "after staging crash")
        check_mirror(state, s1, "after staging crash")

    check_stage_crash(read_disk_state(work, pid))
    control(work, "staged image lost before the kill", delete_rows("DELETE FROM assets WHERE id=?", [beta.asset_id("png-late")]), check_stage_crash)
    control(work, "staged image bytes corrupted", delete_rows("UPDATE assets SET data=zeroblob(73) WHERE id=?", [beta.asset_id("png-late")]), check_stage_crash)
    control(work, "content visible although never committed", set_project(late), check_stage_crash)
    restart, restart_log = run_to_exit("beta-asset-stage-restart", work, stage_run, timeout)
    require_equal(restart["before"], s1, "restart after the staging crash")
    if restart["lateHash"] != beta.asset_id("png-late"):
        raise AssertionError("The staged image read back with different bytes")

    def check_stage_recovered(state):
        check_project(state, late, "content commit after the staging crash")
        check_history(state, {1: s1}, "content commit after the staging crash")
        check_assets(beta, state, everything, everything, "content commit after the staging crash")
        check_mirror(state, late, "content commit after the staging crash")

    check_stage_recovered(read_disk_state(work, pid))
    control(work, "late image attachment missing after recovery", delete_attachment("png-late"), check_stage_recovered)
    control(work, "content commit lost after recovery", set_project(s1), check_stage_recovered)
    record_result({
        "scenario": "beta fault: asset staging vs content commit (kill, restart, commit referencing the staged image)",
        "status": "passed",
        "checkpoint": checkpoint,
        "databaseRevision": late["revision"],
        "crashProcessLog": str(crash_log),
        "restartProcessLog": str(restart_log),
    })

    # ---- 3. Fault: SQL transaction vs mirrors (portable-copy failure, then kill after commit) ----
    work = root / "beta-sql-mirrors"
    sql_run = f"{run_id}-beta-sql"
    crash, checkpoint, crash_log = run_to_checkpoint("beta-crash-sql-mirrors", work, sql_run, "post-commit-pre-mirror", timeout)
    mirror_error = crash.get("mirrorError") or ""
    if "portable copy failed" not in mirror_error or "injected mirror write failure" not in mirror_error:
        raise AssertionError(f"The injected portable-copy failure was not surfaced: {mirror_error!r}")
    require_equal(crash["baseline"], s1, "baseline before the committed edit")
    if checkpoint["revision"] != late["revision"]:
        raise AssertionError("The kill did not land on the new revision's post-commit checkpoint")

    def check_sql_crash(state):
        check_project(state, late, "after post-commit kill (the committed edit survives)")
        check_history(state, {1: s1}, "after post-commit kill")
        check_assets(beta, state, everything, both, "after post-commit kill (new image stored, not yet attached)")
        check_mirror_lags(state, late, s1, "after post-commit kill")

    check_sql_crash(read_disk_state(work, pid))
    control(work, "committed edit lost by the kill", set_project(s1), check_sql_crash)
    control(work, "portable copy already current", write_mirror(late), check_sql_crash)
    restart, restart_log = run_to_exit("beta-mirror-restart", work, sql_run, timeout)
    require_equal(restart["current"], late, "restart after the post-commit kill")

    def check_sql_recovered(state):
        check_project(state, late, "mirror repair after restart")
        check_history(state, {1: s1}, "mirror repair after restart")
        check_assets(beta, state, everything, everything, "mirror repair after restart")
        check_mirror(state, late, "mirror repair after restart")

    check_sql_recovered(read_disk_state(work, pid))
    control(work, "repair leaves the old project.json", write_mirror(s1), check_sql_recovered)
    control(work, "repair misses the new image attachment", delete_attachment("png-late"), check_sql_recovered)
    record_result({
        "scenario": "beta fault: SQL transaction vs mirrors (surfaced portable-copy failure, kill after commit, repair on restart)",
        "status": "passed",
        "checkpoint": checkpoint,
        "mirrorError": mirror_error,
        "databaseRevision": late["revision"],
        "crashProcessLog": str(crash_log),
        "restartProcessLog": str(restart_log),
    })

    # ---- 4. Fault: source merge ----
    work = root / "beta-source-merge"
    merge_run = f"{run_id}-beta-merge"
    crash, checkpoint, crash_log = run_to_checkpoint("beta-crash-source-merge", work, merge_run, "post-merge-safety-snapshot", timeout)
    require_equal(crash["baseline"], s1, "baseline before the merge")
    safety_name = "Before updating research sources"

    def check_merge_crash(state):
        check_project(state, s1, "after merge crash (nothing merged)")
        if state.history:
            raise AssertionError("A merge that never committed must not create history rows")
        check_snapshots(state, {safety_name: [s1]}, "after merge crash")
        check_assets(beta, state, both, both, "after merge crash")
        check_mirror(state, s1, "after merge crash")

    check_merge_crash(read_disk_state(work, pid))
    control(work, "merge visible before its commit", set_project(merged), check_merge_crash)
    control(work, "merge safety snapshot missing", delete_rows("DELETE FROM snapshots WHERE name=?", [safety_name]), check_merge_crash)
    control(work, "merge safety snapshot holds merged sources", lambda d: Doctor.edit_json_row(
        d, pid, "snapshots", "name", safety_name,
        lambda v: v["research"]["sources"][1].update(title="Changed")), check_merge_crash)
    restart, restart_log = run_to_exit("beta-merge-restart", work, merge_run, timeout)
    require_equal(restart["before"], s1, "restart after the merge crash")
    if [v["name"] for v in restart["survivors"]] != [safety_name]:
        raise AssertionError(f"The crashed merge's safety snapshot is not the only snapshot: {restart['survivors']}")

    def check_merge_done(state):
        check_project(state, merged, "retried merge")
        check_history(state, {1: s1}, "retried merge")
        check_snapshots(state, {safety_name: [s1, s1]}, "retried merge (the crashed copy is kept)")
        check_assets(beta, state, both, both, "retried merge")
        check_mirror(state, merged, "retried merge")

    check_merge_done(read_disk_state(work, pid))
    control(work, "retried merge not committed", set_project(s1), check_merge_done)
    control(work, "retry deleted the crashed safety copy", lambda d: Doctor.sql(
        d, pid, "DELETE FROM snapshots WHERE rowid=(SELECT min(rowid) FROM snapshots WHERE name=?)", [safety_name]), check_merge_done)
    record_result({
        "scenario": "beta fault: source merge (kill after the safety snapshot, restart, retried merge)",
        "status": "passed",
        "checkpoint": checkpoint,
        "databaseRevision": merged["revision"],
        "crashProcessLog": str(crash_log),
        "restartProcessLog": str(restart_log),
    })

    # ---- 5. Fault: restore ----
    work = root / "beta-restore"
    restore_run = f"{run_id}-beta-restore"
    crash, checkpoint, crash_log = run_to_checkpoint("beta-crash-restore", work, restore_run, "post-restore-safety-snapshot", timeout)
    require_equal(crash["baseline"], s2, "pre-restore project")
    restore_name = "Before restoring Beta V1"

    def check_restore_crash(state):
        check_project(state, s2, "after restore crash (nothing restored)")
        check_history(state, {1: s1}, "after restore crash")
        check_snapshots(state, {"Beta V1": [s1], restore_name: [s2]}, "after restore crash")
        check_assets(beta, state, both, both, "after restore crash")
        check_mirror(state, s2, "after restore crash")

    check_restore_crash(read_disk_state(work, pid))
    control(work, "restored content visible before its commit", set_project(beta.restored_from_v1), check_restore_crash)
    control(work, "pre-restore safety snapshot missing", delete_rows("DELETE FROM snapshots WHERE name=?", [restore_name]), check_restore_crash)
    control(work, "named snapshot altered", lambda d: Doctor.edit_json_row(
        d, pid, "snapshots", "name", "Beta V1", lambda v: v.pop("goals")), check_restore_crash)
    restart, restart_log = run_to_exit("beta-restore-restart", work, restore_run, timeout)
    require_equal(restart["before"], s2, "restart after the restore crash")
    if restart["changed"] != [ids["sec2"]]:
        raise AssertionError(f"The restore rewrote unexpected entries: {restart['changed']}")

    def check_restore_done(state):
        check_project(state, beta.restored_from_v1, "retried restore")
        check_history(state, {1: s1, 2: s2}, "retried restore")
        check_snapshots(state, {"Beta V1": [s1], restore_name: [s2, s2]}, "retried restore")
        check_assets(beta, state, both, both, "retried restore")
        check_mirror(state, beta.restored_from_v1, "retried restore")

    check_restore_done(read_disk_state(work, pid))
    control(work, "retried restore not committed", set_project(s2), check_restore_done)
    record_result({
        "scenario": "beta fault: snapshot restore (kill after the safety snapshot, restart, retried restore)",
        "status": "passed",
        "checkpoint": checkpoint,
        "databaseRevision": beta.restored_from_v1["revision"],
        "crashProcessLog": str(crash_log),
        "restartProcessLog": str(restart_log),
    })

    # ---- 6. A project written by a newer app version: fail clearly, change nothing ----
    work = root / "beta-newer-schema"
    schema_run = f"{run_id}-beta-schema"
    source = life / "projects" / pid
    target = work / "projects" / pid
    target.mkdir(parents=True)
    with closing(sqlite3.connect(source.as_uri() + "/project.sqlite3?mode=ro", uri=True)) as live:
        with closing(sqlite3.connect(target / "project.sqlite3")) as copy:
            live.backup(copy)
    for name in ("attachments", "snapshots"):
        shutil.copytree(source / name, target / name)
    for name in ("project.json", "manuscript.txt", "fragments.txt"):
        shutil.copy2(source / name, target / name)
    with closing(sqlite3.connect(target / "project.sqlite3")) as database:
        database.execute("PRAGMA user_version=99")
        database.commit()

    def settled(tree):
        return {path: digest for path, digest in tree.items() if not path.endswith(("-wal", "-shm"))}

    before_tree = settled(sha_of_tree(target))

    def check_untouched(tree):
        after = settled(tree)
        if after != before_tree:
            changed = sorted(p for p in set(after) | set(before_tree) if after.get(p) != before_tree.get(p))
            raise AssertionError(f"Opening a newer-schema project changed its files: {changed}")

    report, log = run_to_exit("beta-newer-schema", work, schema_run, timeout)
    check_untouched(sha_of_tree(target))
    if pid not in report["listing"]["damaged"] or any(p["id"] == pid for p in report["listing"]["projects"]):
        raise AssertionError("The newer-schema project should be listed as unreadable, not as a normal project")
    if "newer version of Personal Word" not in (report.get("loadError") or ""):
        raise AssertionError(f"Opening a newer-schema project did not fail clearly: {report.get('loadError')!r}")
    doctored_tree = sha_of_tree(target)
    first_file = sorted(path for path in doctored_tree if not path.endswith(("-wal", "-shm")))[0]
    doctored_tree[first_file] = "0" * 64
    record_control("beta control: a changed file in a newer-schema project is detected", check_untouched, doctored_tree)
    record_result({
        "scenario": "beta schema: project from a newer app version fails clearly and every file stays byte-identical",
        "status": "passed",
        "error": report["loadError"],
        "filesCompared": len(before_tree),
        "processLog": str(log),
    })

    # ---- 7. Controls that drive the real app into a defect or a rejection ----
    work = root / "beta-control-drop"
    report, log = run_to_exit("beta-control-drop-metadata", work, f"{run_id}-beta-drop", timeout)
    record_control("beta control: the app's drop-metadata fault fails the equality check used by the lifecycle",
                   check_project, read_disk_state(work, pid), s2, "drop-metadata control")

    work = root / "beta-control-table"
    report, log = run_to_exit("beta-control-corrupt-table", work, f"{run_id}-beta-table", timeout)
    if "same number of cells" not in (report.get("rejected") or ""):
        raise AssertionError(f"A ragged table was not rejected clearly: {report.get('rejected')!r}")
    state = read_disk_state(work, pid)
    check_project(state, s1, "rejected ragged table leaves the project unchanged")
    if state.history:
        raise AssertionError("A rejected save must not archive a history row")
    record_result({"scenario": "beta control: ragged table rejected, project unchanged", "status": "detected",
                   "reason": report["rejected"], "processLog": str(log)})

    work = root / "beta-control-missing-asset"
    report, log = run_to_exit("beta-control-missing-asset", work, f"{run_id}-beta-missing", timeout)
    if "missing from the project's storage" not in (report.get("rejected") or ""):
        raise AssertionError(f"A reference to an unstored image was not rejected: {report.get('rejected')!r}")
    state = read_disk_state(work, pid)
    check_project(state, s1, "rejected missing image leaves the project unchanged")
    check_assets(beta, state, both, both, "rejected missing image")
    if state.history:
        raise AssertionError("A rejected save must not archive a history row")
    record_result({"scenario": "beta control: edit referencing an unstored image rejected, project unchanged", "status": "detected",
                   "reason": report["rejected"], "processLog": str(log)})

    work = root / "beta-control-merge-no-safety"
    report, log = run_to_exit("beta-control-merge-no-safety", work, f"{run_id}-beta-nosafety", timeout)
    if not report.get("safetyError"):
        raise AssertionError("The skipped safety snapshot could still be read back")
    state = read_disk_state(work, pid)
    check_project(state, s1, "merge stopped without a readable safety copy")
    record_control("beta control: a skipped merge safety snapshot fails the snapshot check",
                   check_snapshots, state, {safety_name: [s1]}, "merge without safety copy")
    record_result({"scenario": "beta control: merge stopped when its safety copy cannot be read", "status": "detected",
                   "reason": report["safetyError"], "processLog": str(log)})


def run_suite(timeout, run_id, root, identity, suite="baseline"):
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

    # Asset crash and recovery scenario
    asset_work = root / "asset-crash"
    asset_report, checkpoint, crash_log = run_to_checkpoint(
        "asset-crash", asset_work, f"{run_id}-asset-crash", "post-asset-stage", timeout
    )
    staged_asset_id = asset_report["stagedAssetId"]
    acknowledged_rev = asset_report["acknowledgedRevision"]

    # 1. Verify SQLite state immediately after kill
    db_path, db_before_restart = read_database(asset_work)
    if db_before_restart["revision"] != acknowledged_rev:
        raise AssertionError(
            f"Asset crash changed project revision: expected {acknowledged_rev}, got {db_before_restart['revision']}"
        )
    if staged_asset_id in canonical(db_before_restart):
        raise AssertionError("SQLite project contains uncommitted asset reference after staging kill")

    # Verify SQLite assets table directly
    uri = db_path.as_uri() + "?mode=ro"
    with sqlite3.connect(uri, uri=True, timeout=5) as database:
        asset_rows = database.execute(
            "SELECT id, mime, byte_length, data FROM assets WHERE id=?", [staged_asset_id]
        ).fetchall()
        if len(asset_rows) != 1:
            raise AssertionError("Staged asset is missing from SQLite assets table after kill")
        aid, mime, byte_length, data = asset_rows[0]
        if aid != staged_asset_id:
            raise AssertionError("Asset table ID mismatch")
        if hashlib.sha256(data).hexdigest() != staged_asset_id:
            raise AssertionError("Staged asset data SHA-256 does not match ID")
        if byte_length != len(data):
            raise AssertionError("Asset byte_length does not match data length")
        if mime != "image/png":
            raise AssertionError(f"Expected mime image/png, got {mime}")

    # 2. Restart app: verify clean open, no missing image, verify read_asset, save image project
    restart_report, restart_log = run_to_exit(
        "asset-restart", asset_work, f"{run_id}-asset-crash", timeout
    )
    if restart_report.get("readHash") != staged_asset_id:
        raise AssertionError("read_asset after restart returned mismatched SHA-256")

    # 3. Reopen in fresh process: verify image project and attachments mirror
    reopen_report, reopen_log = run_to_exit(
        "asset-reopen", asset_work, f"{run_id}-asset-crash", timeout
    )
    if reopen_report.get("readHash") != staged_asset_id:
        raise AssertionError("read_asset on reopen returned mismatched SHA-256")

    db_path, final_db = read_database(asset_work)
    attachment_file = db_path.parent / "attachments" / f"{staged_asset_id}.png"
    if not attachment_file.is_file():
        raise AssertionError("Attachments mirror file is missing after saving image project")
    if hashlib.sha256(attachment_file.read_bytes()).hexdigest() != staged_asset_id:
        raise AssertionError("Attachments mirror file bytes do not match expected SHA-256")

    record_result({
        "scenario": "asset crash recovery: stage, kill, restart, reopen",
        "status": "passed",
        "stagedAssetId": staged_asset_id,
        "databaseRevision": final_db["revision"],
        "crashProcessLog": str(crash_log),
        "restartProcessLog": str(restart_log),
        "reopenProcessLog": str(reopen_log),
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

    if suite == "beta":
        run_beta_suite(timeout, run_id, root)

    ACTIVE_SUMMARY["ok"] = all(item["status"] != "blocked" for item in results)
    ACTIVE_SUMMARY["status"] = "passed" if ACTIVE_SUMMARY["ok"] else "failed"
    persist_active_result()
    print(json.dumps(ACTIVE_SUMMARY, indent=2))
    return 0 if ACTIVE_SUMMARY["ok"] else 2


def main():
    global ACTIVE_SUMMARY
    parser = argparse.ArgumentParser()
    parser.add_argument("--suite", required=True, choices=["baseline", "beta"])
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
        return run_suite(args.timeout, run_id, root, identity, args.suite)
    except Exception as error:
        ACTIVE_SUMMARY.update({"ok": False, "status": "failed", "error": str(error)})
        persist_active_result()
        print(f"Native reliability suite blocked or failed: {error}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
