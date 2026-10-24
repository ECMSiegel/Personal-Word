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
      const projectSwitch = document.querySelector(".project-switch");
      if (projectSwitch) await click(projectSwitch.textContent.trim());
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
  const closeWindow = async () => {
    const { getCurrentWindow } = await import("@tauri-apps/api/window");
    await getCurrentWindow().close();
  };
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
