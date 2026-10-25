// tests/native-print.js -- layout L1 print probe, injected into the com.folio.smoke app when
// FOLIO_SMOKE_SCRIPT=native-print. It sends each harness-generated fixture to render_pdf,
// writes every returned PDF into the run folder, and reports raw results. All pass/fail
// decisions are made by scripts/native-print-smoke.py against the fixtures' expectations.
(async () => {
  const steps = [];
  const invoke = (command, args = {}) => window.__TAURI_INTERNALS__.invoke(command, args);
  const mark = (message) => {
    try {
      void invoke("smoke_progress", { message: `native-print ${Math.round(performance.now())}ms ${message}` });
    } catch {
      /* diagnostics only */
    }
  };
  const step = (name) => {
    steps.push(name);
    mark("step " + name);
  };
  const fromBase64 = (value) => Uint8Array.from(atob(value), (c) => c.charCodeAt(0));

  try {
    step("validating isolated diagnostic profile");
    const profile = await invoke("diagnostic_profile_identity");
    if (
      profile.appIdentifier !== "com.folio.smoke" ||
      profile.protocol !== "d1-profile-isolation-v1" ||
      profile.dataStoreIdentifier !== window.__SMOKE_DATA_STORE_ID__ ||
      !profile.activeDataStoreIdentifiers.includes(window.__SMOKE_DATA_STORE_ID__)
    ) {
      throw Error("Native smoke app or isolated WebKit profile identity mismatch");
    }
    const fixtures = window.__SMOKE_PRINT_FIXTURES__;
    if (!Array.isArray(fixtures) || fixtures.length === 0) {
      throw Error("No print fixtures were injected (FOLIO_SMOKE_PRINT_FIXTURES)");
    }
    const projectsDir = await invoke("storage_path");
    const runDir = projectsDir.replace(/[\\/]projects\/?$/, "");

    const results = [];
    for (const fixture of fixtures) {
      step(`render ${fixture.name}`);
      const request = { ...fixture.request };
      if (fixture.padToBytes) {
        request.pagesHtml = request.pagesHtml + " ".repeat(fixture.padToBytes - request.pagesHtml.length);
      }
      const started = performance.now();
      try {
        const rendered = await invoke("render_pdf", { request });
        const bytes = fromBase64(rendered.bytesBase64);
        const path = `${runDir}/${fixture.name}.pdf`;
        await invoke("export_bytes", { path, data: Array.from(bytes) });
        results.push({
          name: fixture.name,
          ok: true,
          path,
          byteLength: bytes.length,
          pageCount: rendered.pageCount,
          sourceRevision: rendered.sourceRevision,
          warnings: rendered.warnings,
          diagnostics: rendered.diagnostics,
          ms: Math.round(performance.now() - started),
        });
      } catch (error) {
        results.push({ name: fixture.name, ok: false, error: String(error), ms: Math.round(performance.now() - started) });
      }
      step(`finished ${fixture.name}`);
    }

    step("submitting report");
    await invoke("smoke_report", { report: { ok: true, phase: window.__SMOKE_PHASE__, steps, diagnosticProfile: profile, results } });
  } catch (error) {
    mark("fatal error " + String(error));
    await invoke("smoke_report", {
      report: { ok: false, phase: window.__SMOKE_PHASE__, error: String(error), steps },
    });
  }
})();
