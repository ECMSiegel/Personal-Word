(async () => {
  const steps = [];
  const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const wait = async (fn, label) => {
    for (let i = 0; i < 500; i++) {
      const result = fn();
      if (result) return result;
      await delay(40);
    }
    throw Error("Timed out: " + label);
  };
  const button = (text) =>
    [...document.querySelectorAll("button")].find(
      (b) =>
        b.textContent.trim() === text ||
        (b.classList.contains("entry-main") &&
          b.querySelector("span")?.textContent === text),
    );
  const click = async (text) => {
    (await wait(() => button(text), text)).click();
    await delay(60);
  };
  const input = async (label, text) => {
    const el = await wait(
      () =>
        [...document.querySelectorAll("label")]
          .find((l) => l.textContent === label)
          ?.querySelector("input"),
      label,
    );
    Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    ).set.call(el, text);
    el.dispatchEvent(new Event("input", { bubbles: true }));
    await delay(50);
  };
  const editor = () => document.querySelector('[aria-label="Writing editor"]');
  const type = async (text) => {
    const el = await wait(editor, "editor");
    el.focus();
    const range = document.createRange();
    range.selectNodeContents(el);
    const selection = getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
    document.execCommand("insertText", false, text);
  };
  const saved = () =>
    wait(
      () => document.querySelector(".save-status")?.textContent === "Saved",
      "saved",
    );
  try {
    await wait(() => document.querySelector(".app"), "application mounted");
    localStorage.setItem("personal-word.restoreTabs", "true");
    if (window.__SMOKE_PHASE__ === "1") {
      // Only clear the last-project navigation key in this isolated test application.
      if (!button("Start new project")) {
        await click(
          document.querySelector(".project-switch")?.textContent.trim(),
        );
      }
      await click("Start new project");
      await click("Blank");
      await input("Project title", "Native durability check");
      await click("Save");
      await saved();
      steps.push("native project creation");
      await type("Native page flow keeps the same editor and document. ".repeat(300));
      await click("Continuous");
      await wait(() => { const el=editor();return el?.querySelector("p")?.getClientRects().length>1; }, "native paragraph pagination");
      const count=document.querySelector('[aria-label="Page count"]')?.textContent;
      if(!count || !/of [2-9]/.test(count))throw Error("Native page count did not reflect overflowing text: "+count);
      await click("Pages");
      steps.push("native WebKit page fragmentation and continuous toggle");
      await type("Original prose kept for a fragment.");
      await wait(
        () => document.querySelector('[aria-label="New section"]'),
        "new section",
      );
      document.querySelector('[aria-label="New section"]').click();
      await input("Title", "Second section");
      await click("Save");
      await type("Second section survives switching.");
      await click("Opening");
      await wait(
        () => editor()?.textContent === "Original prose kept for a fragment.",
        "rapid section switch",
      );
      steps.push("rapid edit and section switch");
      const el = editor();
      el.focus();
      const range = document.createRange();
      range.selectNodeContents(el);
      getSelection().removeAllRanges();
      getSelection().addRange(range);
      document.dispatchEvent(new Event("selectionchange"));
      await delay(100);
      await click("Keep as fragment");
      await wait(
        () => !editor()?.textContent.includes("Original prose"),
        "cut",
      );
      await click("Original prose kept for a fragment.");
      await wait(
        () => editor()?.textContent.includes("Original prose"),
        "fragment",
      );
      await click("Append to section →");
      await wait(
        () => editor()?.textContent.includes("Original prose"),
        "restored",
      );
      steps.push("fragment extraction and restoration");
      await click("Snapshot");
      await input("Snapshot name", "Native milestone");
      await click("Save");
      await wait(
        () => !document.querySelector('[role="dialog"]'),
        "snapshot saved",
      );
      steps.push("named snapshot");
      await type("Rapid final text must survive native quit.");
      steps.push("typed immediately before quit");
    } else {
      await wait(
        () =>
          editor()?.textContent.includes(
            "Rapid final text must survive native quit.",
          ),
        "reopened latest writing",
      );
      steps.push("native restart preserved final edit");
      await click("Snapshots & history");
      await wait(
        () => document.querySelector(".version-item"),
        "snapshot list",
      );
      document.querySelector(".version-item").click();
      await wait(() => button("Restore this version"), "snapshot preview");
      await click("Restore this version");
      await wait(
        () =>
          editor()?.textContent.includes("Original prose kept for a fragment."),
        "snapshot restoration",
      );
      await saved();
      steps.push("snapshot restored after process restart");
    }
    await window.__TAURI_INTERNALS__.invoke("smoke_report", {
      report: { ok: true, phase: window.__SMOKE_PHASE__, steps },
    });
  } catch (error) {
    await window.__TAURI_INTERNALS__.invoke("smoke_report", {
      report: {
        ok: false,
        error: String(error),
        steps,
        body: document.body.innerText,
      },
    });
  }
})();
