#!/usr/bin/env python3
"""T0 diagnostic: take native WebKit screenshots of the four main screens.

Launches the isolated `com.folio.smoke` diagnostic binary twice (light, dark),
lets tests/native-screens.js drive the UI and call `smoke_snapshot`, then copies
the PNGs and the per-scenario report into --out. Never touches the real writing
library: every launch uses a fresh FOLIO_SMOKE_DIR and a derived WebKit data store.
"""

import argparse
import hashlib
import json
import os
import shutil
import signal
import subprocess
import sys
import time
import uuid
from contextlib import contextmanager
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BINARY = ROOT / "src-tauri/target/debug/folio"
DIAGNOSTIC_PROTOCOL = "d1-profile-isolation-v1"
SCENARIOS = ("light", "dark")
SCREENS = ("projects", "writing", "research", "settings")


def tail(path, lines=40):
    try:
        return "\n".join(path.read_text(errors="replace").splitlines()[-lines:])
    except OSError:
        return "(no process log)"


def stop_owned(process):
    if process is not None and process.poll() is None:
        try:
            os.killpg(process.pid, signal.SIGKILL)
        except ProcessLookupError:
            pass
        except PermissionError as error:
            print(f"cleanup: killpg refused ({error}); continuing", file=sys.stderr)
    if process is not None:
        process.wait(timeout=10)


def launch(scenario, work, run_id, palette):
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
        "FOLIO_SMOKE_SCRIPT": "native-screens",
        "FOLIO_SMOKE_RUN": run_id,
        "FOLIO_SMOKE_INVOCATION": invocation_id,
        "FOLIO_SMOKE_DATA_STORE_ID": hashlib.sha256(
            (run_id + scenario).encode()
        ).hexdigest()[:32],
        "FOLIO_SMOKE_PALETTE": json.dumps(palette),
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
def reported_live_process(scenario, work, run_id, palette, timeout):
    process, output, log_path, invocation_id = launch(scenario, work, run_id, palette)
    try:
        report_path = work / "report-2.json"
        deadline = time.monotonic() + timeout
        while time.monotonic() < deadline and not report_path.is_file():
            if process.poll() is not None:
                raise RuntimeError(
                    f"Native scenario {scenario} exited before reporting "
                    f"(code {process.returncode}).\n{tail(log_path)}"
                )
            time.sleep(0.05)
        if not report_path.is_file():
            raise RuntimeError(
                f"Native scenario {scenario} did not report within {timeout}s.\n{tail(log_path)}"
            )
        yield read_report(work, scenario, invocation_id, run_id), log_path
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
    expected_store_id = hashlib.sha256((run_id + scenario).encode()).hexdigest()[:32]
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
    screens = report.get("screens")
    if not isinstance(screens, list) or len(screens) != len(SCREENS):
        raise RuntimeError(f"Native script reported {screens!r} instead of {len(SCREENS)} screen paths")
    for screen_path in screens:
        if not (work / "screens" / Path(screen_path).name).is_file():
            raise RuntimeError(f"Native script reported a missing snapshot: {screen_path}")
    return report


def capture_scenario(scenario, out, palette, timeout):
    run_id = f"{uuid.uuid4().hex}{scenario}"[:24]
    work = out / scenario
    with reported_live_process(scenario, work, run_id, palette, timeout) as (report, log_path):
        for screen_path in report["screens"]:
            source = work / "screens" / Path(screen_path).name
            name = Path(screen_path).stem
            if name not in SCREENS:
                raise RuntimeError(f"Unexpected snapshot name {name!r}")
            shutil.copyfile(source, out / f"{name}-{scenario}.png")
        shutil.copyfile(work / "report-2.json", out / f"report-{scenario}.json")
        print(f"{scenario}: captured {', '.join(Path(p).stem for p in report['screens'])}")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--out", required=True, help="Directory that receives the PNGs and reports")
    parser.add_argument("--timeout", type=int, default=180, help="Per-scenario report timeout in seconds")
    parser.add_argument(
        "--palette",
        choices=("plain", "color"),
        default="plain",
        help="Palette recorded into folio.workspace.appearance (no effect until T5)",
    )
    args = parser.parse_args()
    if not BINARY.is_file():
        raise SystemExit(f"Smoke binary missing: {BINARY}. Build it with the SMOKE command first.")
    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    try:
        for scenario in SCENARIOS:
            capture_scenario(scenario, out, args.palette, args.timeout)
    except Exception as error:  # noqa: BLE001 - the CLI reports failures honestly and exits 1
        print(f"native-screens failed: {error}", file=sys.stderr)
        return 1
    total = len(SCENARIOS) * len(SCREENS)
    print(f"{total} native screenshots written to {out}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
