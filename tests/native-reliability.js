// Injected only by the cfg(native-smoke) diagnostic app. The Python supervisor owns
// the temporary library and every process this script asks the harness to close.
(async () => {
  const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const scenario = window.__SMOKE_SCENARIO__;
  const run = window.__SMOKE_RUN__;
  const expectedDataStoreId = window.__SMOKE_DATA_STORE_ID__;
  let diagnosticProfile;
  const invoke = (command, args = {}) =>
    window.__TAURI_INTERNALS__.invoke(command, args);
  const mark = (message) => {
    void invoke("smoke_progress", { message: `${scenario} ${message}` }).catch(
      () => {},
    );
  };
  const wait = async (fn, label, attempts = 500) => {
    mark(`wait ${label}`);
    for (let i = 0; i < attempts; i++) {
      const value = fn();
      if (value) {
        mark(`ok ${label}`);
        return value;
      }
      await delay(40);
    }
    throw Error(`Timed out: ${label}`);
  };
  const button = (text) =>
    [...document.querySelectorAll("button")].find(
      (candidate) =>
        candidate.textContent.trim() === text ||
        (candidate.classList.contains("entry-main") &&
          candidate.querySelector("span")?.textContent === text),
    );
  const click = async (text) => {
    (await wait(() => button(text), `button ${text}`)).click();
    await delay(70);
  };
  const openProject = async (title) => {
    const rowButton = await wait(
      () =>
        [...document.querySelectorAll(".project-row > button:first-child")].find(
          (candidate) => candidate.querySelector(".project-name")?.textContent === title,
        ),
      `project ${title}`,
    );
    rowButton.click();
  };
  const input = async (label, text) => {
    const el = await wait(
      () =>
        [...document.querySelectorAll("label")]
          .find((candidate) => candidate.textContent === label)
          ?.querySelector("input"),
      `input ${label}`,
    );
    Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    ).set.call(el, text);
    el.dispatchEvent(new Event("input", { bubbles: true }));
  };
  const editor = () => document.querySelector('[aria-label="Writing editor"]');
  const status = () => document.querySelector(".save-status")?.textContent;
  const type = async (text) => {
    const el = await wait(editor, "writing editor");
    el.focus();
    const range = document.createRange();
    range.selectNodeContents(el);
    const selection = getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
    document.execCommand("insertText", false, text);
  };
  const waitSavedAfterEdit = async () => {
    await wait(() => status() && status() !== "Saved", "edit became pending");
    await wait(() => status() === "Saved", "SQLite save acknowledgement");
  };
  const projectId = async (title) => {
    const listing = await invoke("list_projects");
    const project = listing.projects.find((candidate) => candidate.title === title);
    if (!project) throw Error(`Native project ${title} was not listed`);
    localStorage.setItem("folio.d1.projectId", project.id);
    return project.id;
  };
  const createProject = async () => {
    const title = "D1 durability fixture";
    if (!button("Start new project")) {
      // The sidebar title renames in place; the Projects tab goes back.
      await click("Projects");
    }
    await click("Start new project");
    await click("Blank");
    await input("Project title", title);
    await click("Save");
    await wait(() => editor(), "new native project opened");
    await type("Before restore content, with all fixture metadata.");
    await waitSavedAfterEdit();
    const id = await projectId(title);
    localStorage.setItem("folio.d1.projectTitle", title);
    return id;
  };
  const ensureProjectOpen = async () => {
    const id = localStorage.getItem("folio.d1.projectId");
    if (!id) return createProject();
    if (!editor()) {
      const title = localStorage.getItem("folio.d1.projectTitle") || "D1 durability fixture";
      await openProject(title);
      await wait(() => editor(), "saved native project reopened");
    }
    return id;
  };
  const beginRun = async () => {
    await wait(() => document.querySelector(".app"), "application mounted");
    diagnosticProfile = await invoke("diagnostic_profile_identity");
    if (
      diagnosticProfile.appIdentifier !== "com.folio.smoke" ||
      diagnosticProfile.protocol !== "d1-profile-isolation-v1" ||
      diagnosticProfile.dataStoreIdentifier !== expectedDataStoreId ||
      !diagnosticProfile.activeDataStoreIdentifiers.includes(expectedDataStoreId)
    ) {
      throw Error("Native diagnostic app or isolated WebKit profile identity mismatch");
    }
    const existingRun = localStorage.getItem("folio.nativeReliabilityRun");
    if (existingRun && existingRun !== run) {
      throw Error("Unexpected WebKit profile marker; refusing to clear or reuse storage");
    }
    if (!existingRun) localStorage.setItem("folio.nativeReliabilityRun", run);
    return true;
  };
  const closeWindow = () => invoke("smoke_close_window");
  const report = (data) =>
    invoke("smoke_report", {
      report: {
        ...data,
        scenario,
        runId: run,
        invocationId: window.__SMOKE_INVOCATION__,
        diagnosticProfile,
      },
    });
  const cleanClose = async (data) => {
    await report(data);
    await closeWindow();
  };
  const createNamedSnapshot = async () => {
    await click("Snapshot");
    await input("Snapshot name", "D1 baseline");
    await click("Save");
    await wait(() => !document.querySelector('[role="dialog"]'), "named snapshot saved");
  };
  const restoreNamedSnapshot = async (withMissingSnapshot = false) => {
    await createNamedSnapshot();
    await type("Changed after the named snapshot; preserve this complete state.");
    await waitSavedAfterEdit();
    await click("Snapshots & history");
    const item = await wait(
      () =>
        [...document.querySelectorAll(".version-item")].find((node) =>
          node.textContent.includes("D1 baseline"),
        ),
      "D1 named snapshot in native history",
    );
    item.click();
    const beforeRestore = await invoke("load_project", {
      id: localStorage.getItem("folio.d1.projectId"),
    });
    if (withMissingSnapshot)
      await invoke("arm_fault", { fault: "skip-safety-snapshot" });
    await click("Restore this version");
    await wait(
      () => editor()?.textContent.includes("Before restore content"),
      "named snapshot restored to the editor",
    );
    return beforeRestore;
  };

  try {
    if (!(await beginRun())) return;

    if (scenario === "metadata-close" || scenario === "metadata-negative" || scenario === "safety-negative") {
      let id = localStorage.getItem("folio.d1.projectId");
      if (!id) {
        id = await createProject();
        if (scenario === "metadata-negative")
          await invoke("arm_fault", { fault: "drop-metadata" });
        const seed = await invoke("seed_durability_metadata", { projectId: id });
        localStorage.setItem("folio.d1.seed", JSON.stringify(seed));
        location.reload();
        return;
      }

      const seed = JSON.parse(localStorage.getItem("folio.d1.seed") || "null");
      if (!seed) throw Error("Native metadata seed report was not retained");
      if (scenario === "metadata-negative") {
        await invoke("flush_mirrors", { id });
        const current = await invoke("load_project", { id });
        await cleanClose({ ok: true, scenario, seed, current });
        return;
      }

      if (!editor()) {
        const title = localStorage.getItem("folio.d1.projectTitle") || "D1 durability fixture";
        await openProject(title);
        await wait(() => editor(), "metadata fixture reopened after sparse save");
      }
      const beforeRestore = await restoreNamedSnapshot(scenario === "safety-negative");
      let safety = null;
      let safetyError = null;
      try {
        safety = await invoke("verify_safety_snapshot", { projectId: id });
      } catch (error) {
        safetyError = String(error);
      }

      if (scenario === "safety-negative") {
        await cleanClose({ ok: true, scenario, seed, safety, safetyError, beforeRestore });
        return;
      }

      // Force one owned mirror pass, prove its error is surfaced, then repair it.
      await invoke("mark_mirrors_pending", { projectId: id });
      await invoke("arm_fault", { fault: "mirror-write" });
      let mirrorError = null;
      try {
        await invoke("flush_mirrors", { id });
      } catch (error) {
        mirrorError = String(error);
      }
      await invoke("flush_mirrors", { id });

      // The native Mac connection must reject the false value and report ON after
      // the negative control is consumed.
      await invoke("arm_fault", { fault: "fullfsync-off" });
      const fullfsyncOff = await invoke("sqlite_sync_settings", { projectId: id });
      const fullfsyncOn = await invoke("sqlite_sync_settings", { projectId: id });
      const current = await invoke("load_project", { id });
      await invoke("mark_mirrors_pending", { projectId: id });
      await invoke("arm_fault", { fault: "close-flush" });
      const closeRecord = {
        ok: true,
        scenario,
        projectId: id,
        seed,
        current,
        safety,
        beforeRestore,
        mirrorError,
        fullfsyncOff,
        fullfsyncOn,
        acknowledgedRevision: current.revision,
      };
      await report(closeRecord);

      await closeWindow();
      const closeError = await wait(
        () => {
          const text = document.querySelector(".error-banner")?.textContent || "";
          return text.includes("Close stopped because saving failed") &&
            text.includes("injected close flush failure");
        },
        "actual close remains blocked and displays its mirror error",
      );
      if (!closeError) throw Error("The first native close was not blocked");
      await click("Retry");
      await wait(() => !document.querySelector(".error-banner"), "portable copies repaired by Retry");
      await report({
        ...closeRecord,
        closeContract: {
          firstCloseBlocked: true,
          errorVisible: true,
          retryCompleted: true,
        },
      });
      await closeWindow();
      return;
    }

    if (scenario === "reopen-safety") {
      const id = await ensureProjectOpen();
      const current = await invoke("load_project", { id });
      const safety = await invoke("verify_safety_snapshot", { projectId: id });
      await cleanClose({ ok: true, scenario, current, safety });
      return;
    }

    if (["journal-malformed", "journal-incomplete", "journal-conflict"].includes(scenario)) {
      const id = localStorage.getItem("folio.d1.projectId");
      if (!id) {
        const projectId = await createProject();
        const baseline = await invoke("load_project", { id: projectId });
        const header = { ...baseline };
        delete header.entries;
        const raw =
          scenario === "journal-malformed"
            ? "{broken"
            : scenario === "journal-incomplete"
              ? JSON.stringify({
                  ...header,
                  entryIds: [...baseline.entries.map((entry) => entry.id), "missing-entry-d1"],
                  journaled: [baseline.entries[0].id, "missing-entry-d1"],
                })
              : JSON.stringify({ ...baseline, title: "Conflicting recovery journal" });
        localStorage.setItem(`folio.recovery.${projectId}`, raw);
        localStorage.setItem("folio.d1.journalBaseline", JSON.stringify(baseline));
        await report({ ok: true, stage: "journal-seeded", projectId, raw });
        await closeWindow();
        return;
      }

      if (!editor()) {
        const title = localStorage.getItem("folio.d1.projectTitle") || "D1 durability fixture";
        await openProject(title);
      }
      const dialog = await wait(() => document.querySelector('[role="dialog"]'), "journal recovery dialog");
      const dialogTitle = dialog.querySelector("h2")?.textContent || "";
      const raw = localStorage.getItem(`folio.recovery.${id}`);
      const expectedTitle =
        scenario === "journal-conflict"
          ? "Two copies of this project disagree."
          : "The recovery journal for this project is damaged.";
      if (dialogTitle !== expectedTitle)
        throw Error(`Expected recovery dialog ${expectedTitle}, received ${dialogTitle}`);
      if (!raw) throw Error("The recovery journal was removed before an explicit choice");
      const action = scenario === "journal-conflict" ? "Keep disk copy" : "Discard and open";
      await click(action);
      await wait(() => editor(), "disk project opened after explicit recovery choice");
      const current = await invoke("load_project", { id });
      await cleanClose({
        ok: true,
        stage: "journal-resolved",
        projectId: id,
        baseline: JSON.parse(localStorage.getItem("folio.d1.journalBaseline") || "null"),
        current,
        journalBeforeChoice: raw,
        journalAfterChoice: localStorage.getItem(`folio.recovery.${id}`),
        dialogTitle,
        action,
      });
      return;
    }

    if (["sql-rollback", "sql-disk-full", "sql-permission-denied"].includes(scenario)) {
      let id = localStorage.getItem("folio.d1.projectId");
      if (!id) id = await createProject();
      const baseline = await invoke("load_project", { id });
      await invoke("arm_fault", { fault: scenario });
      await type(`Uncommitted text for deterministic ${scenario} failure.`);
      await wait(() => status() === "Save failed", `${scenario} failure surfaced to SaveQueue`);
      const current = await invoke("load_project", { id });
      const firstEntry = baseline.entries[0];
      const reportData = {
        ok: true,
        projectId: id,
        baseline,
        current,
        acknowledgedRevision: baseline.revision,
        saveStatus: status(),
        errorBanner: document.querySelector(".error-banner")?.textContent || "",
        journalHeader: localStorage.getItem(`folio.recovery.${id}`),
        journalEntry: localStorage.getItem(`folio.recovery-entry.${id}.${firstEntry.id}`),
      };
      await report(reportData);
      return;
    }

    if (["pre-commit", "post-commit-pre-mirror", "post-mirror"].includes(scenario)) {
      let id = localStorage.getItem("folio.d1.projectId");
      if (!id) {
        id = await createProject();
        location.reload();
        return;
      }
      // The app launches to Projects, so reopen the fixture before editing it.
      await ensureProjectOpen();
      await invoke("flush_mirrors", { id });
      if (scenario === "post-mirror") {
        await type("This acknowledged revision reaches the portable mirror.");
        await waitSavedAfterEdit();
        const current = await invoke("load_project", { id });
        await invoke("mark_mirrors_pending", { projectId: id });
        await invoke("arm_checkpoint", { point: "post-mirror" });
        await report({ ok: true, scenario, acknowledgedRevision: current.revision });
        await invoke("flush_mirrors", { id });
        return;
      }
      const current = await invoke("load_project", { id });
      await report({ ok: true, scenario, acknowledgedRevision: current.revision });
      await invoke("arm_checkpoint", { point: scenario });
      await type(`Unacknowledged checkpoint edit for ${scenario}.`);
      await waitSavedAfterEdit();
      return;
    }

    if (scenario === "post-commit-restart") {
      const id = await ensureProjectOpen();
      const current = await invoke("load_project", { id });
      await cleanClose({ ok: true, scenario, current });
      return;
    }

    if (scenario === "sql-ack-negative") {
      let id = localStorage.getItem("folio.d1.projectId");
      if (!id) {
        id = await createProject();
        location.reload();
        return;
      }
      await ensureProjectOpen();
      const before = await invoke("load_project", { id });
      await invoke("arm_fault", { fault: "premature-sql-ack" });
      await type("This must never be acknowledged before SQLite commits.");
      await waitSavedAfterEdit();
      await report({
        ok: true,
        scenario,
        acknowledgedRevision: before.revision + 1,
      });
      await closeWindow();
      return;
    }

    if (scenario === "close-negative") {
      let id = localStorage.getItem("folio.d1.projectId");
      if (!id) {
        id = await createProject();
        location.reload();
        return;
      }
      const current = await invoke("load_project", { id });
      await invoke("mark_mirrors_pending", { projectId: id });
      await invoke("arm_fault", { fault: "close-flush" });
      await invoke("arm_fault", { fault: "bypass-close-guard" });
      await report({
        ok: true,
        scenario,
        acknowledgedRevision: current.revision,
        closeContract: {
          firstCloseBlocked: false,
          errorVisible: false,
          retryCompleted: false,
        },
      });
      await closeWindow();
      return;
    }

    // Asset staging crash scenario: stage asset, arm checkpoint, kill before content edit
    if (scenario === "asset-crash") {
      let id = localStorage.getItem("folio.d1.projectId");
      if (!id) {
        id = await createProject();
        location.reload();
        return;
      }
      await ensureProjectOpen();
      const baseline = await invoke("load_project", { id });

      // Minimal valid 1x1 PNG fixture (67 bytes)
      const fixtureData = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGP4z8AAAAMBAQDJ/pLvAAAAAElFTkSuQmCC";
      const fixtureBytes = Uint8Array.from(atob(fixtureData), (c) => c.charCodeAt(0));
      const hashBuffer = await crypto.subtle.digest("SHA-256", fixtureBytes);
      const fixtureId = Array.from(new Uint8Array(hashBuffer))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");

      const fixtureMeta = {
        mime: "image/png",
        byteLength: fixtureBytes.length,
        width: 1,
        height: 1,
      };

      // Report BEFORE staging: on the current tree (store.rs with the
      // native-smoke checkpoint hook), stage_assets fires the
      // "post-asset-stage" checkpoint right after its SQLite commit and
      // blocks there until the supervisor resumes or kills the process.
      // The supervisor requires report-2.json for this invocation to exist
      // before the kill, and smoke_report writes it synchronously, so the
      // report (which depends only on data known pre-stage) must be durable
      // before the stage invoke can block. stagedMeta is the fixture meta
      // itself; the stage result can no longer be observed here.
      await report({
        ok: true,
        scenario,
        projectId: id,
        baseline,
        acknowledgedRevision: baseline.revision,
        stagedAssetId: fixtureId,
        stagedMeta: fixtureMeta,
      });

      localStorage.setItem("folio.d1.stagedAssetId", fixtureId);
      localStorage.setItem("folio.d1.stagedAssetBase64", fixtureData);

      // Arm first, then stage: the checkpoint fires inside stage_assets
      // (post-commit) and blocks; the supervisor kills this process once the
      // checkpoint file and the report above are on disk.
      await invoke("arm_checkpoint", { point: "post-asset-stage" });

      await invoke("stage_assets", {
        projectId: id,
        assets: [{ id: fixtureId, meta: fixtureMeta, data: fixtureData }],
      });
      return;
    }

    // Asset restart: verify clean open, no missing image, verify read_asset, then insert image & save
    if (scenario === "asset-restart") {
      const id = await ensureProjectOpen();
      const current = await invoke("load_project", { id });
      const stagedAssetId = localStorage.getItem("folio.d1.stagedAssetId");
      if (!stagedAssetId) throw Error("Staged asset ID missing from test storage");

      // Verify no uncommitted asset reference in project JSON
      if (JSON.stringify(current).includes(stagedAssetId)) {
        throw Error("Project contains uncommitted asset reference after staging kill");
      }

      // Verify DOM editor contains baseline text and NO error banner
      const editorText = editor()?.textContent || "";
      if (!editorText.includes("Before restore content")) {
        throw Error("Reopened editor does not contain the last acknowledged writing");
      }
      if (document.querySelector(".error-banner")) {
        throw Error("Unexpected error banner visible on clean restart");
      }

      // Verify read_asset returns exact bytes matching SHA-256
      const rawBytes = await invoke("read_asset", { projectId: id, assetId: stagedAssetId });
      const rawUint8 = new Uint8Array(rawBytes);
      const readHashBuf = await crypto.subtle.digest("SHA-256", rawUint8);
      const readHash = Array.from(new Uint8Array(readHashBuf))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
      if (readHash !== stagedAssetId) {
        throw Error(`read_asset SHA-256 mismatch: expected ${stagedAssetId}, got ${readHash}`);
      }

      // Save an image project referencing this staged asset. A narrow toolbar
      // overflows Insert into the closed More formatting popover, which keeps
      // the file input unmounted; open it, and fail rather than skip the save.
      const imageInput = () => document.querySelector('input[type="file"][accept*="image"]');
      if (!imageInput()) {
        mark("insert hidden, opening More formatting");
        document.querySelector('button[aria-label="More formatting"]')?.click();
      }
      const fileInput = await wait(imageInput, "image file input");
      {
        const fixtureBase64 = localStorage.getItem("folio.d1.stagedAssetBase64");
        const bytes = Uint8Array.from(atob(fixtureBase64), (c) => c.charCodeAt(0));
        const dt = new DataTransfer();
        dt.items.add(new File([bytes], "test.png", { type: "image/png" }));
        fileInput.files = dt.files;
        fileInput.dispatchEvent(new Event("change", { bubbles: true }));
        await delay(100);
        const altInput = await wait(
          () => document.querySelector('input[aria-label="Image alternative text"]'),
          "alt input dialog",
        );
        altInput.value = "Staged recovery test image";
        altInput.dispatchEvent(new Event("input", { bubbles: true }));
        altInput.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
        await waitSavedAfterEdit();
      }

      const updated = await invoke("load_project", { id });
      await cleanClose({
        ok: true,
        scenario,
        projectId: id,
        current: updated,
        stagedAssetId,
        readHash,
        acknowledgedRevision: updated.revision,
      });
      return;
    }

    // Asset reopen: fresh process verification of saved image project
    if (scenario === "asset-reopen") {
      const id = await ensureProjectOpen();
      const current = await invoke("load_project", { id });
      const stagedAssetId = localStorage.getItem("folio.d1.stagedAssetId");

      const rawBytes = await invoke("read_asset", { projectId: id, assetId: stagedAssetId });
      const rawUint8 = new Uint8Array(rawBytes);
      const readHashBuf = await crypto.subtle.digest("SHA-256", rawUint8);
      const readHash = Array.from(new Uint8Array(readHashBuf))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");

      await cleanClose({
        ok: true,
        scenario,
        projectId: id,
        current,
        stagedAssetId,
        readHash,
        acknowledgedRevision: current.revision,
      });
      return;
    }

    // --- D2 / WP11 beta scenarios -------------------------------------------------------------
    // The synthetic project is one file shared with the unit tests, the Rust store test and the
    // Python checker (tests/fixtures/beta-synthetic-project.json, embedded by smoke_beta_fixture).
    // This script only executes steps and reports what the app returned. scripts/native-reliability.py
    // derives every expected state from the same file and compares it with SQLite, history, snapshots,
    // project.json and the attachments on disk, so nothing here is read back as its own expectation.
    if (scenario.startsWith("beta-")) {
      const fixture = JSON.parse(await invoke("smoke_beta_fixture"));
      const { ids, edits } = fixture;
      const projectId = ids.project;
      const clone = (value) => JSON.parse(JSON.stringify(value));
      const sortKeys = (value) =>
        Array.isArray(value)
          ? value.map(sortKeys)
          : value && typeof value === "object"
            ? Object.fromEntries(Object.keys(value).sort().map((key) => [key, sortKeys(value[key])]))
            : value;
      const same = (left, right) => JSON.stringify(sortKeys(left)) === JSON.stringify(sortKeys(right));
      // The native save contract is camelCase and keeps entry ids in the header.
      const headerOf = ({ entries, ...rest }) => ({ ...rest, entryIds: entries.map((entry) => entry.id) });
      const entryIds = (project) => project.entries.map((entry) => entry.id);
      const changeOf = (project, changedIds, baseRevision) => ({
        header: headerOf(project),
        entries: project.entries.filter((entry) => changedIds.includes(entry.id)),
        baseRevision,
      });
      // One edit of the fixture: the next revision with a replaced entry body and/or patched sources.
      const applyEdit = (project, edit) => {
        const next = clone(project);
        next.revision += 1;
        next.updatedAt = edit.updatedAt;
        if (edit.entryId) {
          const index = next.entries.findIndex((entry) => entry.id === edit.entryId);
          next.entries[index] = { ...next.entries[index], ...clone(edit.entry) };
        }
        for (const patch of edit.sources || []) {
          Object.assign(next.research.sources.find((source) => source.id === patch.id), clone(patch.set));
        }
        return next;
      };
      const assetByName = (name) => fixture.assets.find((asset) => asset.name === name);
      const upload = (name) => {
        const { id, meta, data } = assetByName(name);
        return { id, meta, data };
      };
      const hex = (buffer) =>
        [...new Uint8Array(buffer)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
      const sha256 = async (bytes) => hex(await crypto.subtle.digest("SHA-256", bytes));
      const readBytes = async (id, assetId) =>
        new Uint8Array(await invoke("read_asset", { projectId: id, assetId }));
      const toBase64 = (bytes) => {
        let binary = "";
        for (const byte of bytes) binary += String.fromCharCode(byte);
        return btoa(binary);
      };
      const load = (id = projectId) => invoke("load_project", { id });
      const failure = async (promise) => {
        try {
          await promise;
          return null;
        } catch (error) {
          return String(error);
        }
      };
      const waitAsync = async (fn, label, attempts = 500) => {
        mark(`wait ${label}`);
        for (let i = 0; i < attempts; i++) {
          if (await fn()) {
            mark(`ok ${label}`);
            return true;
          }
          await delay(40);
        }
        throw Error(`Timed out: ${label}`);
      };
      // Creates the whole fixture through the import route: project and both referenced images in one transaction.
      const createFixtureProject = async () => {
        const s1 = clone(fixture.initial);
        await invoke("create_project_with_assets", {
          change: changeOf(s1, entryIds(s1), null),
          assets: [upload("png-section-drawing"), upload("jpeg-sherd")],
        });
        return s1;
      };
      const saveEdit = async (project, edit, changedIds) => {
        const next = applyEdit(project, edit);
        await invoke("save_changes", { change: changeOf(next, changedIds, project.revision) });
        return next;
      };

      // Lifecycle, process 1: create, ordinary reload, one-entry incremental saves, history, named snapshot.
      if (scenario === "beta-lifecycle") {
        const s1 = await createFixtureProject();
        const afterCreate = await load();
        const s2 = await saveEdit(s1, edits.incremental, [ids.sec2]);
        const afterIncremental = await load();
        await invoke("create_snapshot", { id: projectId, name: "Beta snapshot A" });
        await saveEdit(s2, edits.second, [ids.sec2]);
        const afterSecond = await load();
        await invoke("flush_mirrors", { id: projectId });
        await cleanClose({ ok: true, scenario, projectId, afterCreate, afterIncremental, afterSecond });
        return;
      }

      // Lifecycle, process 2: the real UI restore generates the safety snapshot.
      if (scenario === "beta-lifecycle-restore") {
        await openProject(fixture.initial.title);
        await wait(() => editor(), "beta fixture opened in the native UI");
        const beforeRestore = await load();
        await click("Snapshots & history");
        const item = await wait(
          () => [...document.querySelectorAll(".version-item")].find((node) => node.textContent.includes("Beta snapshot A")),
          "Beta snapshot A in native history",
        );
        item.click();
        await click("Restore this version");
        await waitAsync(async () => (await load()).revision === beforeRestore.revision + 1, "restored project committed");
        await wait(() => status() === "Saved", "restore acknowledged by SQLite");
        await invoke("flush_mirrors", { id: projectId });
        const current = await load();
        const safety = await invoke("verify_safety_snapshot", {
          projectId,
          snapshotName: "Before restoring Beta snapshot A",
        });
        await cleanClose({ ok: true, scenario, projectId, beforeRestore, current, safety });
        return;
      }

      // Lifecycle, process 3 (a fresh native start): reload, image bytes, then an import under a new identity.
      if (scenario === "beta-lifecycle-reopen") {
        const current = await load();
        const hashes = {};
        const uploads = [];
        for (const asset of fixture.assets.slice(0, 2)) {
          const bytes = await readBytes(projectId, asset.id);
          hashes[asset.id] = await sha256(bytes);
          uploads.push({ id: asset.id, meta: asset.meta, data: toBase64(bytes) });
        }
        const versions = await invoke("list_versions", { id: projectId, history: false });
        const safety = await invoke("verify_safety_snapshot", {
          projectId,
          snapshotName: "Before restoring Beta snapshot A",
        });
        // What App.importProject does with a v2 archive: same content and bytes, new id and revision 1.
        const cloneId = "7c1d4e8a-2b3f-4a5c-9d6e-0f1a2b3c4d5e";
        const imported = {
          ...clone(current),
          id: cloneId,
          revision: 1,
          title: `${current.title} (recovered)`,
          updatedAt: "2026-10-25T00:00:00.000Z",
        };
        await invoke("create_project_with_assets", {
          change: changeOf(imported, entryIds(imported), null),
          assets: uploads,
        });
        await invoke("flush_mirrors", { id: cloneId });
        const importedLoaded = await load(cloneId);
        await cleanClose({
          ok: true, scenario, projectId, current, hashes, versions, safety, cloneId, imported: importedLoaded,
        });
        return;
      }

      // Asset staging vs content commit: the kill lands after the staged bytes are durable and before any edit uses them.
      if (scenario === "beta-crash-asset-stage") {
        await createFixtureProject();
        await invoke("flush_mirrors", { id: projectId });
        const baseline = await load();
        await invoke("arm_checkpoint", { point: "post-asset-stage" });
        await report({ ok: true, scenario, projectId, baseline });
        await invoke("stage_assets", { projectId, assets: [upload("png-late")] });
        return;
      }
      if (scenario === "beta-asset-stage-restart") {
        const before = await load();
        const lateHash = await sha256(await readBytes(projectId, assetByName("png-late").id));
        const next = applyEdit(clone(fixture.initial), edits.lateImage);
        await invoke("save_changes", { change: changeOf(next, [ids.sec2], before.revision) });
        await invoke("flush_mirrors", { id: projectId });
        const current = await load();
        await cleanClose({ ok: true, scenario, projectId, before, lateHash, current });
        return;
      }

      // SQL transaction vs mirrors: an injected portable-copy failure is surfaced and repaired, then the kill
      // lands after SQLite committed an edit that adds an image reference and before project.json/attachments.
      if (scenario === "beta-crash-sql-mirrors") {
        const s1 = await createFixtureProject();
        await invoke("flush_mirrors", { id: projectId });
        await invoke("mark_mirrors_pending", { projectId });
        await invoke("arm_fault", { fault: "mirror-write" });
        const mirrorError = await failure(invoke("flush_mirrors", { id: projectId }));
        await invoke("flush_mirrors", { id: projectId });
        await invoke("stage_assets", { projectId, assets: [upload("png-late")] });
        const baseline = await load();
        const next = applyEdit(s1, edits.lateImage);
        await invoke("arm_checkpoint", { point: "post-commit-pre-mirror" });
        await report({ ok: true, scenario, projectId, baseline, mirrorError });
        await invoke("save_changes", { change: changeOf(next, [ids.sec2], baseline.revision) });
        return;
      }
      if (scenario === "beta-mirror-restart") {
        const current = await load();
        await invoke("flush_mirrors", { id: projectId });
        await cleanClose({ ok: true, scenario, projectId, current });
        return;
      }

      // Source merge: the kill lands after the safety snapshot is durable and before the merge commits.
      if (scenario === "beta-crash-source-merge") {
        await createFixtureProject();
        await invoke("flush_mirrors", { id: projectId });
        const baseline = await load();
        await invoke("arm_checkpoint", { point: "post-merge-safety-snapshot" });
        await report({ ok: true, scenario, projectId, baseline });
        await invoke("create_snapshot", { id: projectId, name: "Before updating research sources" });
        return;
      }
      if (scenario === "beta-merge-restart") {
        const before = await load();
        const survivors = await invoke("list_versions", { id: projectId, history: false });
        // Retry as App.applySourceChoices does: a safety snapshot, a check that it equals the writing, one commit.
        const key = await invoke("create_snapshot", { id: projectId, name: "Before updating research sources" });
        const safety = await invoke("load_version", { id: projectId, key, history: false });
        if (!same(safety, before))
          throw Error("The safety snapshot did not match the current writing. No sources were updated.");
        const merged = applyEdit(clone(fixture.initial), edits.merge);
        await invoke("save_changes", { change: changeOf(merged, [], before.revision) });
        await invoke("flush_mirrors", { id: projectId });
        const current = await load();
        await cleanClose({ ok: true, scenario, projectId, before, survivors, current });
        return;
      }

      // Restore: the kill lands after the pre-restore safety snapshot and before the restored content commits.
      if (scenario === "beta-crash-restore") {
        const s1 = await createFixtureProject();
        await invoke("flush_mirrors", { id: projectId });
        await invoke("create_snapshot", { id: projectId, name: "Beta V1" });
        await saveEdit(s1, edits.incremental, [ids.sec2]);
        await invoke("flush_mirrors", { id: projectId });
        const baseline = await load();
        await invoke("arm_checkpoint", { point: "post-restore-safety-snapshot" });
        await report({ ok: true, scenario, projectId, baseline });
        await invoke("create_snapshot", { id: projectId, name: "Before restoring Beta V1" });
        return;
      }
      if (scenario === "beta-restore-restart") {
        const before = await load();
        const versions = await invoke("list_versions", { id: projectId, history: false });
        const target = versions.find((version) => version.name === "Beta V1");
        if (!target) throw Error("The named snapshot did not survive the crash");
        const v1 = await invoke("load_version", { id: projectId, key: target.id, history: false });
        const safetyKey = await invoke("create_snapshot", { id: projectId, name: "Before restoring Beta V1" });
        const safety = await invoke("load_version", { id: projectId, key: safetyKey, history: false });
        if (!same(safety, before)) throw Error("The safety snapshot does not equal the pre-restore project");
        const restored = { ...clone(v1), revision: before.revision + 1, updatedAt: edits.restore.updatedAt };
        const changed = restored.entries
          .filter((entry) => !same(entry, before.entries.find((candidate) => candidate.id === entry.id)))
          .map((entry) => entry.id);
        await invoke("save_changes", { change: changeOf(restored, changed, before.revision) });
        await invoke("flush_mirrors", { id: projectId });
        const current = await load();
        await cleanClose({ ok: true, scenario, projectId, before, versions, changed, current });
        return;
      }

      // Newer-schema project (the harness raised user_version on its own copy): fail clearly, change nothing.
      if (scenario === "beta-newer-schema") {
        const listing = await invoke("list_projects");
        const loadError = await failure(load());
        await cleanClose({ ok: true, scenario, projectId, listing, loadError });
        return;
      }

      // Real-app controls for the Python checkers.
      if (scenario === "beta-control-drop-metadata") {
        const s1 = await createFixtureProject();
        await invoke("arm_fault", { fault: "drop-metadata" });
        await saveEdit(s1, edits.incremental, [ids.sec2]);
        await invoke("flush_mirrors", { id: projectId });
        const current = await load();
        await cleanClose({ ok: true, scenario, projectId, current });
        return;
      }
      if (scenario === "beta-control-corrupt-table") {
        const s1 = await createFixtureProject();
        const bad = clone(s1);
        bad.revision += 1;
        const table = bad.entries.find((entry) => entry.id === ids.sec1).content.content.find((node) => node.type === "table");
        table.content[2].content.pop();
        const rejected = await failure(invoke("save_changes", { change: changeOf(bad, [ids.sec1], s1.revision) }));
        const current = await load();
        await cleanClose({ ok: true, scenario, projectId, rejected, current });
        return;
      }
      if (scenario === "beta-control-missing-asset") {
        const s1 = await createFixtureProject();
        const bad = applyEdit(s1, edits.lateImage);
        const rejected = await failure(invoke("save_changes", { change: changeOf(bad, [ids.sec2], s1.revision) }));
        const current = await load();
        await cleanClose({ ok: true, scenario, projectId, rejected, current });
        return;
      }
      if (scenario === "beta-control-merge-no-safety") {
        await createFixtureProject();
        await invoke("flush_mirrors", { id: projectId });
        const before = await load();
        await invoke("arm_fault", { fault: "skip-safety-snapshot" });
        const key = await invoke("create_snapshot", { id: projectId, name: "Before updating research sources" });
        // App.applySourceChoices reads the safety copy back and stops when it is missing: nothing is merged.
        const safetyError = await failure(invoke("load_version", { id: projectId, key, history: false }));
        const current = await load();
        await cleanClose({ ok: true, scenario, projectId, before, safetyError, current });
        return;
      }
    }

    throw Error(`Unknown native reliability scenario: ${scenario}`);
  } catch (error) {
    mark(`failed ${String(error)}`);
    try {
      await report({
        ok: false,
        scenario,
        error: String(error),
        body: document.body.innerText.slice(0, 2000),
      });
    } catch {
      /* the native process may be blocked at a deliberate checkpoint */
    }
  }
})();
