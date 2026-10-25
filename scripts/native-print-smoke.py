#!/usr/bin/env python3
"""Layout L1 native print feasibility probe (isolated com.folio.smoke app only).

--probe:
  1. refuses a diagnostic binary older than the sources it embeds or compiles;
  2. starts a loopback request counter and a file:// canary folder;
  3. generates schema-built fixtures (scripts/native-print-fixtures.mjs via esbuild + Node);
  4. launch A: all fixtures with the native lockdown; launch B (counter liveness control):
     the hostile fixture with the smoke-only lockdown switch off;
  5. inspects every PDF with poppler (pdfinfo boxes, per-page pdftotext, -bbox-layout,
     pdffonts, pdfimages) and renders every page to PNG for visual inspection;
  6. feeds four defective inputs to the same checker (one tall page, missing font readiness,
     external resource loads, raster-only PDF); each must fail its own assertion.
Writes <run>/result.json and prints PROBE_RESULT: PASS or STOP with the failing assertions.
"""
import argparse
import copy
from datetime import datetime, timezone
import hashlib
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
import os
from pathlib import Path
import platform
import re
import shutil
import signal
import subprocess
import sys
import threading
import time
import unicodedata
import uuid

ROOT = Path(__file__).resolve().parents[1]
BINARY = ROOT / "src-tauri/target/debug/folio"
CACHE = ROOT / "node_modules/.cache/personal-word-beta/print-smoke"
NODE = ROOT / "node_modules/.cache/personal-word-alpha-review/tools/node-v22.23.3-darwin-x64/bin/node"
ESBUILD = ROOT / "node_modules/.bin/esbuild"
DIAGNOSTIC_PROTOCOL = "d1-profile-isolation-v1"
EMBEDDED_OR_COMPILED = [
    "tests/native-print.js",
    "src-tauri/src/printing.rs",
    "src-tauri/src/smoke.rs",
    "src-tauri/src/lib.rs",
    "src-tauri/Cargo.toml",
]
PAPER = {"letter": (612.0, 792.0), "a4": (595.28, 841.89)}
BOX_TOLERANCE = 1.5


def tool(name):
    found = shutil.which(name) or f"/usr/local/bin/{name}"
    if not Path(found).is_file():
        raise RuntimeError(f"{name} is missing (poppler)")
    return found


def run(args, **kw):
    r = subprocess.run([str(a) for a in args], capture_output=True, text=True, **kw)
    if r.returncode != 0:
        raise RuntimeError(f"{Path(str(args[0])).name} failed ({r.returncode}): {r.stderr.strip()[:400]}")
    return r.stdout


def sha256(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


# ---------------------------------------------------------------- external-load counter
class Counter:
    def __init__(self):
        self.lock = threading.Lock()
        self.hits = []
        counter = self

        class Handler(BaseHTTPRequestHandler):
            def handle_one_request(self):
                with counter.lock:
                    counter.hits.append({"at": time.time(), "client": self.client_address[0]})
                super().handle_one_request()
                if getattr(self, "path", None):
                    with counter.lock:
                        counter.hits[-1]["request"] = f"{getattr(self, 'command', '?')} {self.path}"

            def do_GET(self):
                self.send_response(404)
                self.send_header("Content-Length", "0")
                self.end_headers()

            do_POST = do_HEAD = do_GET

            def log_message(self, *args):
                pass

        self.server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
        self.port = self.server.server_address[1]
        threading.Thread(target=self.server.serve_forever, daemon=True).start()

    def take(self):
        with self.lock:
            hits, self.hits = self.hits, []
        return hits

    def close(self):
        self.server.shutdown()
        self.server.server_close()


# ---------------------------------------------------------------- app launch
def stop_owned(proc):
    if proc is not None and proc.poll() is None:
        try:
            os.killpg(proc.pid, signal.SIGKILL)
        except ProcessLookupError:
            pass
    if proc is not None:
        try:
            proc.wait(timeout=20)
        except Exception:
            pass


def launch(work, fixtures_path, extra_env, timeout):
    work.mkdir(parents=True)
    (work / "projects").mkdir()
    data_store_id = uuid.uuid4().hex
    env = {
        **os.environ,
        "FOLIO_SMOKE_DIR": str(work),
        "FOLIO_SMOKE_SCRIPT": "native-print",
        "FOLIO_SMOKE_PHASE": "probe",
        "FOLIO_SMOKE_DATA_STORE_ID": data_store_id,
        "FOLIO_SMOKE_PRINT_FIXTURES": str(fixtures_path),
        **extra_env,
    }
    if "FOLIO_SMOKE_PRINT_CONTROL" not in extra_env:
        env.pop("FOLIO_SMOKE_PRINT_CONTROL", None)
    report_path = work / "report-probe.json"
    proc = None
    with (work / "process.log").open("w") as log:
        try:
            proc = subprocess.Popen([str(BINARY)], cwd=ROOT, env=env, stdout=log, stderr=subprocess.STDOUT, start_new_session=True)
            deadline = time.monotonic() + timeout
            while time.monotonic() < deadline and not report_path.is_file():
                if proc.poll() is not None:
                    break
                time.sleep(0.2)
            if report_path.is_file():
                time.sleep(1)
                try:
                    proc.wait(timeout=30)
                except subprocess.TimeoutExpired:
                    pass
        finally:
            stop_owned(proc)
    if not report_path.is_file():
        progress = (work / "progress.log").read_text(errors="replace")[-1500:] if (work / "progress.log").is_file() else ""
        raise RuntimeError(
            f"Diagnostic app produced no report (exit {proc.returncode if proc else '?'}) in {work}.\n"
            f"progress:\n{progress}\nlog tail:\n{(work / 'process.log').read_text(errors='replace')[-1500:]}"
        )
    report = json.loads(report_path.read_text())
    if report.get("diagnosticAppIdentifier") != "com.folio.smoke":
        raise RuntimeError(f"Report did not come from com.folio.smoke: {report.get('diagnosticAppIdentifier')}")
    if report.get("diagnosticProtocol") != DIAGNOSTIC_PROTOCOL:
        raise RuntimeError("Report protocol mismatch")
    if report.get("diagnosticDataStoreIdentifier") != data_store_id:
        raise RuntimeError("Report isolated WebKit data store mismatch")
    if not report.get("ok"):
        raise RuntimeError(f"In-app probe failed: {report.get('error')}")
    return report


# ---------------------------------------------------------------- PDF inspection
def inspect_pdf(pdf):
    info = run([tool("pdfinfo"), pdf])
    pages = int(re.search(r"^Pages:\s+(\d+)", info, re.M).group(1))
    boxes = []
    sized = run([tool("pdfinfo"), "-f", 1, "-l", pages, pdf])
    for m in re.finditer(r"^Page\s+(\d+) size:\s+([\d.]+) x ([\d.]+) pts", sized, re.M):
        boxes.append((float(m.group(2)), float(m.group(3))))
    texts = [run([tool("pdftotext"), "-f", i, "-l", i, "-enc", "UTF-8", pdf, "-"]) for i in range(1, pages + 1)]
    fonts = []
    for line in run([tool("pdffonts"), pdf]).splitlines()[2:]:
        cols = line.split()
        if len(cols) >= 7:
            # name type... encoding emb sub uni object ID
            fonts.append({"name": cols[0], "type": " ".join(cols[1:-6]), "emb": cols[-5], "uni": cols[-3]})
    images = []
    for line in run([tool("pdfimages"), "-list", pdf]).splitlines()[2:]:
        cols = line.split()
        if len(cols) >= 14 and cols[0].isdigit():
            ppi = lambda v: float(v) if re.fullmatch(r"[\d.]+", v) else 72.0
            images.append({"page": int(cols[0]), "type": cols[2], "width": int(cols[3]), "height": int(cols[4]),
                           "widthPt": int(cols[3]) / ppi(cols[12]) * 72, "heightPt": int(cols[4]) / ppi(cols[13]) * 72})
    bbox = run([tool("pdftotext"), "-bbox-layout", "-enc", "UTF-8", pdf, "-"])
    words = []
    for page_index, page in enumerate(re.findall(r"<page [^>]*>(.*?)</page>", bbox, re.S)):
        for m in re.finditer(r'<word xMin="([\d.]+)" yMin="([\d.]+)" xMax="([\d.]+)" yMax="([\d.]+)">(.*?)</word>', page):
            words.append({"page": page_index + 1, "x0": float(m.group(1)), "y0": float(m.group(2)),
                          "x1": float(m.group(3)), "y1": float(m.group(4)), "text": m.group(5)})
    return {"pages": pages, "boxes": boxes, "texts": texts, "fonts": fonts, "images": images, "words": words,
            "bytes": Path(pdf).stat().st_size, "sha256": sha256(pdf)}


def norm(text):
    return re.sub(r"\s+", " ", unicodedata.normalize("NFKC", text))


def found(needle, haystack):
    """'logical' when extracted in reading order; 'reversed' when only the visual order matches."""
    n, h = norm(needle), norm(haystack)
    if n in h:
        return "logical"
    if n[::-1] in h or " ".join(w[::-1] for w in reversed(n.split(" "))) in h:
        return "reversed"
    return None


def check_render(fixture, result, pdf):
    """All assertions for one rendered fixture; returns [(id, ok, detail)]."""
    exp = fixture["expect"]
    out = []

    def add(aid, ok, detail):
        out.append((aid, bool(ok), detail))

    add("native-result", result.get("ok"), result.get("error", "rendered"))
    if not result.get("ok") or not Path(pdf).is_file():
        return out
    pdfi = inspect_pdf(pdf)
    width, height = PAPER[exp["paper"]]
    margin = exp["marginInches"] * 72
    want = exp.get("pages")
    count_ok = result.get("pageCount") == pdfi["pages"] and (pdfi["pages"] == want if want else pdfi["pages"] >= exp.get("minPages", 1))
    add("page-count", count_ok, f"native {result.get('pageCount')}, pdfinfo {pdfi['pages']}, expected {want or ('>=' + str(exp.get('minPages')))}")
    bad_boxes = [b for b in pdfi["boxes"] if abs(b[0] - width) > BOX_TOLERANCE or abs(b[1] - height) > BOX_TOLERANCE]
    add("page-boxes", len(pdfi["boxes"]) == pdfi["pages"] and not bad_boxes, f"boxes {sorted(set(pdfi['boxes']))}, expected {width}x{height}")
    if exp.get("markersByPage"):
        problems = []
        for i, markers in enumerate(exp["markersByPage"]):
            for marker in markers:
                pages_with = [p + 1 for p, t in enumerate(pdfi["texts"]) if marker in t]
                if pages_with != [i + 1]:
                    problems.append(f"{marker} on pages {pages_with}, expected [{i + 1}]")
        add("explicit-breaks", not problems, "; ".join(problems) or "every marker on its own page only")
        lefts = []
        for i, markers in enumerate(exp["markersByPage"]):
            hit = [w for w in pdfi["words"] if w["page"] == i + 1 and w["text"] == markers[0]]
            lefts.append(round(hit[0]["x0"], 1) if hit else None)
        add("margins", all(x is not None and margin - 2 <= x <= margin + 4 for x in lefts),
            f"first-marker left edge per page {lefts}, expected about {margin} pt")
    all_text = "\n".join(pdfi["texts"])
    thin = [p + 1 for p, t in enumerate(pdfi["texts"]) if len(re.sub(r"\s", "", t)) < 15]
    modes = {s: found(s, all_text) for s in exp["requiredText"]}
    missing = [s for s, m in modes.items() if not m]
    reversed_only = [s for s, m in modes.items() if m == "reversed"]
    add("searchable-text", not thin and not missing,
        f"pages without text {thin}; missing {missing}; reversed-order only {reversed_only}" if thin or missing or reversed_only
        else f"{len(all_text)} chars, all {len(modes)} required strings found in reading order")
    add("informational-text", True, "not gated; extraction mode per string: "
        + json.dumps({s: found(s, all_text) for s in exp["informationalText"]}, ensure_ascii=False))
    t3 = [f["name"] for f in pdfi["fonts"] if "Type 3" in f["type"]]
    unemb = [f["name"] for f in pdfi["fonts"] if f["emb"] != "yes"]
    fam = exp.get("embeddedFontFamily")
    fam_ok = not fam or any(fam in f["name"] for f in pdfi["fonts"])
    add("embedded-fonts", pdfi["fonts"] and not t3 and not unemb and fam_ok,
        f"{len(pdfi['fonts'])} fonts {[f['name'] for f in pdfi['fonts']]}; type3 {t3}; unembedded {unemb}; wanted {fam}")
    page_area = width * height
    big = [im for im in pdfi["images"] if im["widthPt"] * im["heightPt"] >= 0.5 * page_area]
    if exp["images"] is None:
        add("media-info", True, f"not gated for this fixture; {len(pdfi['images'])} images {[(i['width'], i['height'], i['type']) for i in pdfi['images']]}")
    else:
        add("media", len(pdfi["images"]) == exp["images"] and not big, f"{len(pdfi['images'])} images (expected {exp['images']}), page-sized {len(big)}")
    if exp.get("runningHeaders"):
        problems = []
        for page in range(1, pdfi["pages"] + 1):
            head = [w for w in pdfi["words"] if w["page"] == page and w["text"].startswith("PWHEAD")]
            foot = [w for w in pdfi["words"] if w["page"] == page and w["text"] == "Sheet"]
            if not head or not (margin - 2 <= head[0]["y0"] <= margin + 30):
                problems.append(f"page {page} header {[(round(w['y0'], 1)) for w in head]}")
            if not foot or not (height - margin - 30 <= foot[0]["y1"] <= height - margin + 2):
                problems.append(f"page {page} footer {[(round(w['y1'], 1)) for w in foot]}")
        add("running-headers", not problems, "; ".join(problems) or f"header top in [{margin - 2},{margin + 30}], footer bottom in [{height - margin - 30},{height - margin + 2}] on every page")
    d = result.get("diagnostics") or {}
    faces, images = d.get("faces") or [], d.get("images")
    ready = (d.get("fontsStatus") == "loaded" and all(f.get("status") == "loaded" for f in faces)
             and (not fam or any(f.get("status") == "loaded" for f in faces))
             and isinstance(images, list) and (exp["images"] is None or len(images) == exp["images"])
             and all(i.get("complete") and i.get("decoded") and i.get("naturalWidth", 0) > 0 for i in images))
    add("readiness", ready, f"fonts {d.get('fontsStatus')}, faces {[(f.get('family'), f.get('status')) for f in faces]}, images {images}")
    add("opaque-origin", d.get("allowedNavigation") == "about:blank" and str(d.get("location", "")).startswith("about:"),
        f"allowed first navigation {d.get('allowedNavigation')!r}, document location {d.get('location')!r}")
    heights = sorted(w["y1"] - w["y0"] for w in pdfi["words"] if re.fullmatch(r"[A-Za-z]{4,}", w["text"]))
    add("css-scale", True, "not gated; median Latin word box height "
        + (f"{heights[len(heights) // 2]:.1f} pt" if heights else "n/a")
        + f" for {exp.get('paper')} body text set in pt units; screen layout {d.get('screenLayout')}")
    local = [r for r in d.get("resources") or [] if not r.startswith("data:")]
    add("no-loads-in-view", not local and d.get("pageScriptRan") is False, f"resource entries {local}; page script ran {d.get('pageScriptRan')}")
    if exp.get("hostile"):
        add("hostile-blocked", isinstance(d.get("violations"), list) and len(d["violations"]) > 0,
            f"{len(d.get('violations') or [])} CSP violations recorded; blocked navigations {d.get('blockedNavigations')}")
    if exp.get("noteSentences"):
        ns = exp["noteSentences"]
        flat = norm(all_text)
        order = [int(m.group(1)) for m in re.finditer(ns["prefix"] + r"(\d{3})", flat)]
        first = next((p + 1 for p, t in enumerate(pdfi["texts"]) if f"{ns['prefix']}001" in t), None)
        last = next((p + 1 for p, t in enumerate(pdfi["texts"]) if f"{ns['prefix']}{ns['count']:03d}" in t), None)
        ok = order == list(range(1, ns["count"] + 1)) and first and last and last > first
        add("note-continuation", ok, f"{len(order)} sentences in order={order == list(range(1, ns['count'] + 1))}; first on page {first}, last on page {last}")
    return out


def check_rejection(fixture, result):
    exp = fixture["expect"]
    ok = not result.get("ok") and exp["error"].lower() in str(result.get("error", "")).lower()
    aid = "native-readiness-fail-closed" if fixture["kind"] == "readiness-control" else "boundary-rejection"
    return [(aid, ok, result.get("error", "unexpectedly rendered"))]


def check_lockdown(hits, results):
    page_scripts = [r["name"] for r in results if (r.get("diagnostics") or {}).get("pageScriptRan")]
    return [("zero-external-loads", not hits and not page_scripts, f"{len(hits)} loopback requests {[h.get('request') for h in hits][:12]}; page scripts ran in {page_scripts}")]


def failed(assertions):
    return [a for a in assertions if not a[1]]


# ---------------------------------------------------------------- probe
def probe(timeout):
    if platform.system() != "Darwin":
        raise RuntimeError("The native print probe needs macOS WebKit")
    if not BINARY.is_file():
        raise RuntimeError(f"Diagnostic binary missing: {BINARY}")
    stale = [p for p in EMBEDDED_OR_COMPILED if (ROOT / p).stat().st_mtime > BINARY.stat().st_mtime]
    if stale:
        raise RuntimeError(f"Diagnostic binary is older than {stale}; rebuild it first")
    run_id = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ") + "-" + uuid.uuid4().hex[:8]
    work = CACHE / "runs" / run_id
    work.mkdir(parents=True)
    print(f"run folder: {work}", flush=True)
    identity = {"binary": sha256(BINARY), **{p: sha256(ROOT / p) for p in EMBEDDED_OR_COMPILED + ["src/print/nativePdf.ts", "src/print/printProbe.ts", "scripts/native-print-fixtures.mjs", "scripts/native-print-smoke.py"]}}
    canary = work / "canary"
    canary.mkdir()
    for name in ("link.css", "import.css", "bg.png"):
        (canary / name).write_text("canary\n")
    counter = Counter()
    try:
        env_path = f"{NODE.parent}{os.pathsep}{os.environ.get('PATH', '')}"
        gen = work / "gen.mjs"
        run([ESBUILD, "scripts/native-print-fixtures.mjs", "--bundle", "--platform=node", "--format=esm", f"--outfile={gen}", "--log-level=warning",
             "--banner:js=import { createRequire as __cr } from 'module'; const require = __cr(import.meta.url);"], cwd=ROOT, env={**os.environ, "PATH": env_path})
        fixtures_path = work / "fixtures.json"
        print(run([NODE, gen, "fixtures", counter.port, canary.as_uri(), fixtures_path], cwd=ROOT).strip(), flush=True)
        fixtures = json.loads(fixtures_path.read_text())
        by_name = {f["name"]: f for f in fixtures}

        print("launch A: all fixtures, lockdown on", flush=True)
        counter.take()
        report_a = launch(work / "launch-a", fixtures_path, {}, timeout)
        hits_a = counter.take()
        results = {r["name"]: r for r in report_a["results"]}

        hostile_only = work / "fixtures-hostile.json"
        hostile_only.write_text(json.dumps([by_name["hostile"]]))
        print("launch B: hostile fixture, smoke-only lockdown switch off (counter liveness control)", flush=True)
        report_b = launch(work / "launch-b", hostile_only, {"FOLIO_SMOKE_PRINT_CONTROL": "unlocked"}, timeout)
        hits_b = counter.take()
    finally:
        counter.close()

    assertions = {}
    pngs = work / "pages"
    pngs.mkdir()
    for f in fixtures:
        r = results.get(f["name"], {"ok": False, "error": "no result"})
        if f["expect"]["outcome"] == "render":
            pdf = Path(r.get("path", work / "missing.pdf"))
            assertions[f["name"]] = check_render(f, r, pdf)
            if pdf.is_file():
                run([tool("pdftoppm"), "-r", 80, "-png", pdf, pngs / f["name"]])
        else:
            assertions[f["name"]] = check_rejection(f, r)
    assertions["launch-a lockdown"] = check_lockdown(hits_a, list(results.values()))

    # ------------------------------------------------ checker negative controls (fail-first)
    controls = []
    letter_fx, letter_res = by_name["letter"], results.get("letter", {})
    letter_pdf = Path(letter_res.get("path", work / "missing.pdf"))
    ctl = work / "controls"
    ctl.mkdir()

    def control(name, target, assertions_list, note):
        failing = [a[0] for a in failed(assertions_list)]
        controls.append({"control": name, "target": target, "detected": target in failing, "failingAssertions": failing, "note": note})

    if letter_pdf.is_file():
        tall = ctl / "one-tall-page.pdf"
        print(run([NODE, gen, "tall", letter_pdf, tall], cwd=ROOT).strip(), flush=True)
        control("one-tall-page", "page-count", check_render(letter_fx, letter_res, tall), str(tall))
        doctored = copy.deepcopy(letter_res)
        doctored.setdefault("diagnostics", {})["fontsStatus"] = "loading"
        for face in doctored["diagnostics"].get("faces") or []:
            face["status"] = "error"
        (ctl / "missing-font-readiness.json").write_text(json.dumps(doctored["diagnostics"], indent=2))
        control("missing-font-readiness", "readiness", check_render(letter_fx, doctored, letter_pdf), "real letter.pdf with doctored readiness report")
        run([tool("pdftoppm"), "-r", 100, "-png", letter_pdf, ctl / "raster"])
        raster_pngs = sorted(ctl.glob("raster-*.png"))
        raster = ctl / "raster-only.pdf"
        print(run([NODE, gen, "raster", raster, *raster_pngs], cwd=ROOT).strip(), flush=True)
        control("raster-only", "searchable-text", check_render(letter_fx, letter_res, raster), str(raster))
    else:
        controls.append({"control": "pdf-based controls", "target": "-", "detected": False, "note": "letter.pdf missing"})
    control("external-resource", "zero-external-loads", check_lockdown(hits_b, report_b["results"]),
            f"launch B (lockdown off) loopback requests {len(hits_b)}")

    summary = {
        "runId": run_id,
        "runFolder": str(work),
        "finishedAt": datetime.now(timezone.utc).isoformat(),
        "identity": identity,
        "macos": platform.mac_ver()[0],
        "machine": platform.machine(),
        "launchA": {"hits": hits_a, "results": report_a["results"]},
        "launchB": {"hits": hits_b, "results": report_b["results"]},
        "assertions": {k: [{"id": a, "ok": o, "detail": d} for a, o, d in v] for k, v in assertions.items()},
        "controls": controls,
    }
    (work / "result.json").write_text(json.dumps(summary, indent=2, ensure_ascii=False) + "\n")
    (CACHE / "latest-probe.json").write_text(json.dumps({"runFolder": str(work), "runId": run_id}) + "\n")

    print("\nASSERTIONS")
    bad = []
    for name, items in assertions.items():
        for aid, ok, detail in items:
            print(f"  {'PASS' if ok else 'FAIL'}  {name:26} {aid:28} {detail}")
            if not ok:
                bad.append(f"{name}:{aid}")
    print("\nCHECKER NEGATIVE CONTROLS (each must be detected by its target assertion)")
    for c in controls:
        print(f"  {'DETECTED' if c['detected'] else 'MISSED  '}  {c['control']:24} target {c['target']:22} failing {c.get('failingAssertions')}")
        if not c["detected"]:
            bad.append(f"control:{c['control']}")
    print(f"\npage images: {pngs}")
    return bad, work


def main():
    parser = argparse.ArgumentParser(description="Personal Word native print feasibility probe (layout L1)")
    parser.add_argument("--probe", action="store_true", help="run the full native probe")
    parser.add_argument("--timeout", type=int, default=900, help="seconds to wait for each app launch")
    args = parser.parse_args()
    if not args.probe:
        parser.print_help()
        return 2
    try:
        bad, work = probe(args.timeout)
    except Exception as error:
        print(f"\nPROBE_RESULT: ERROR -- the probe could not complete: {error}", file=sys.stderr)
        return 1
    if bad:
        print(f"\nPROBE_RESULT: STOP -- failing: {', '.join(bad)}\nresult: {work / 'result.json'}")
        return 1
    print(f"\nPROBE_RESULT: PASS (all assertions and negative controls as expected)\nresult: {work / 'result.json'}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
