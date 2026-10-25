# Personal Word -- owner real-use checklist (T023)

Prepared 2026-10-25 by agent-d5a8. Updated after the owner explicitly confirmed that all nine real-use gates passed: see [owner results](OWNER_TEST_RESULTS.md). The summary gates below are VERIFIED by owner report. Individual blank Result lines remain as the original worksheet; detailed per-step records were not supplied.

The app under test (built by T021, inspected by Gate D T022):
- Path: `/Users/ethansiegel/Local Projects/VC Projects/Project 13 - Word Processor/src-tauri/target/release/bundle/macos/Personal Word.app`
- `Contents/MacOS/folio` sha256 `66da1177a6b0063c88a34a8b4c6e58459f657d55bf2271d424582d121cb932f2`, identifier `com.folio.writing`, version 0.1.1, Mach-O x86_64, not signed, not notarized, never opened by any agent.
- Check the hash yourself first: `shasum -a 256 "<path>/Contents/MacOS/folio"` must print the value above. If it differs, stop: the app was rebuilt and this checklist is stale.

Who can run what:
- **No agent can run any step below.** First launch opens your real `com.folio.writing` library, which agents must not touch. Word, VoiceOver, input methods, Apple silicon and a long session also need you or hardware agents lack (marked **[NO AGENT]**).
- Automated evidence already exists for the underlying behaviour (see `docs/validation.md`, Gate D section). It does not replace these steps: it ran in Chromium and in a diagnostic build with synthetic data in `com.folio.smoke` storage.

How to record: edit the "Result" line under each item to `PASS`, `FAIL`, or `SKIPPED (why)` plus notes. Then send the file back; an agent can attach it to `EVIDENCE.json` as the owner report (needs `reportedBy: "owner"` and a hashed report file).

---

## A. First launch and backup (do this first)

**A0. Back up before anything else.** Follow `docs/recovery.md` "Make and verify a backup":
1. Quit any running Personal Word.
2. Open the old app (if you have one), **Settings > Storage location**, note the folder.
3. Copy the whole project folder(s) (`project.sqlite3`, its `-wal`/`-shm` files, `project.json`, `manuscript.txt`, `fragments.txt`, `attachments/`) to another disk. Do not copy only `project.sqlite3` while the app is open.
4. Optionally also use **Export portable project** for each project you care about.
- Expected: you have a dated copy that is separate from the app-data folder.
- Failure looks like: you cannot find the folder, or the copy lacks `attachments/`. Do not continue until a full copy exists.
- Result: ______  Outcome: pending owner

**A1. Gatekeeper first open [NO AGENT].**
1. In Finder, right-click `Personal Word.app` and choose Open, then Open again in the dialog (the app is unsigned, so a double-click is refused).
- Expected: the app opens to **Projects** (the default launch view) and lists your existing projects with their section counts unchanged.
- Failure looks like: the app crashes at launch, shows an empty library when you know you have projects, shows a "newer version" error, or the title/menu says "Folio" instead of Personal Word.
- Result: ______  Outcome: pending owner

**A2. Existing project opens untouched.**
1. Open one of your own projects (a copy is safer: first import your portable export as a new project and use that).
2. Read two sections; confirm text, section order and any existing comments are as you left them.
- Expected: identical content; the save indicator reads **Saved**.
- Failure looks like: missing text, reordered sections, **Save failed** or a recovery prompt you did not expect (do not choose Discard; export the journal first, per `docs/recovery.md`).
- Result: ______  Outcome: pending owner

---

## B. Keyboard-only editing and comment anchors (owner gates: keyboardAndCommentAnchors)

Use a scratch project. Do not touch the mouse or trackpad in B1.

**B1. Home and Tab indent by keyboard only.**
1. Press Tab repeatedly from the toolbar until the cursor is inside the writing area (or the Bold toolbar button, then Tab onward).
2. Type a line of at least 20 characters.
3. Press Home once, then Tab.
- Expected: the caret jumps to the start of the paragraph and Tab indents the paragraph (first-line indent in Blank/Chicago styles). Shift-Tab removes it. Typing continues at the caret.
- Failure looks like: Home appears to work but the caret snaps back to the end, Tab moves focus out of the editor instead of indenting, or the indent lands in the wrong place. Note the template (Blank, Chicago, Screenplay) and how focus arrived.
- Result: ______  Outcome: pending owner

**B2. Duplicate comments jump to the right place.**
1. Type a sentence in which the same phrase appears twice (e.g. "the river ... the river").
2. Add a comment on the second occurrence, then another comment on the first occurrence.
3. Open the comments list and activate each comment (mouse, then again with the keyboard: Tab to it, Enter).
- Expected: each comment highlights and scrolls to its own occurrence, not the first textual match.
- Failure looks like: the second comment jumps to the first occurrence, or the highlight disappears after editing text before it.
- Result: ______  Outcome: pending owner

---

## C. Close with an error, retry, recovery journal, safety snapshot (owner gates: closeRetry, preRestoreSafetyCopy)

Scratch project only. Keep the A0 backup in reach.

**C1. Close blocked by a save error, then Retry.** (owner gate: closeRetry)
Hard to cause on demand. One safe way: put the project in a folder you can make temporarily read-only (copy a scratch project to a test folder via Settings > Storage location, then `chmod -R a-w` on that folder from Terminal), type a few words, then quit with Cmd-Q.
1. Quit with an edit pending.
2. Expect the app to stay open with an error banner and **Retry**.
3. Restore write permission (`chmod -R u+w` the folder), press **Retry**, then quit again.
- Expected: the app does not quit while the save is failing; after Retry succeeds it quits; reopening shows your last words.
- Failure looks like: the app quits while edits are unsaved, Retry never succeeds after permission returns, or the last words are missing on reopen.
- If you cannot set this up, mark `SKIPPED (cannot induce)`; it stays pending.
- Result: ______  Outcome: pending owner

**C2. Recovery journal after a forced quit.**
1. Type a distinctive sentence, immediately choose Force Quit from the Apple menu (or `kill -9` the folio process).
2. Reopen the app and the project.
- Expected: either the sentence is present, or a recovery prompt offers the journal copy. Export the journal first if prompted; choose **Keep journal copy** only if you want that version.
- Failure looks like: a malformed-journal message that offers only Discard, or silent loss of text that had shown **Saved**.
- Note: an uncommitted keystroke may legitimately be lost (`docs/recovery.md` Limits); text that had shown **Saved** may not.
- Result: ______  Outcome: pending owner

**C3. Safety snapshot and restore.** (owner gates: preRestoreSafetyCopy, recoveredImage)
1. In the scratch project, write version one text, open **Snapshots & history** and take a snapshot.
2. Change the text to version two; save.
3. Restore the version-one snapshot.
4. Open **Snapshots & history** again: find the safety copy taken just before the restore ("Before restoring ...") and open it.
- Expected: after restore the text is version one; the safety copy exists and opens as an unmodified version two; restoring it brings version two back.
- Failure looks like: no safety copy listed, safety copy empty or showing version one, an image missing after restore (if the snapshot contained one: see D1, and compare the image visually and, if you can, with `shasum -a 256` on the file in `attachments/`).
- Result: ______  Outcome: pending owner

---

## D. Images, table, archive, fragment transfer (owner gate: recoveredImage)

**D1. PNG and JPEG images persist.**
1. In a scratch project insert one PNG and one JPEG (an image whose bytes you can recognise; note its `shasum -a 256`).
2. Wait for **Saved**, quit the app, reopen, open the project.
- Expected: both images show; the file under the project folder's `attachments/` has the same sha256 as your source file (named `<sha>.<ext>`).
- Failure looks like: broken-image icon, a different hash, an image missing after reopen, or the image stored inside `project.json` as a huge text blob.
- Result: ______  Outcome: pending owner

**D2. Table.**
1. Insert a table (3 columns, 3 rows), type in cells, Tab between cells, Tab from the last cell.
2. Save, quit, reopen.
- Expected: Tab moves to the next cell and adds a row at the end; content persists.
- Failure looks like: Tab leaves the table, cell text lost, or the layout collapses.
- Result: ______  Outcome: pending owner

**D3. Portable archive export and import as a new project.**
1. **Export portable project** to a `.json` file.
2. Import it from the Projects view as a new project.
- Expected: a separate new project appears; text, table, both images (same sha256 in its `attachments/`), research sources and comments match; the original is unchanged.
- Failure looks like: the import replaces the original, loses images, or reports a version error.
- Result: ______  Outcome: pending owner

**D4. Copy a fragment with an image to another project.**
1. Select a passage containing an image, copy it as a fragment, paste/insert it in a second project.
- Expected: the image appears in the second project and survives quit/reopen there (it is stored in that project's `attachments/`).
- Failure looks like: image shows until reopen, then breaks; or the first project loses its image.
- Result: ______  Outcome: pending owner

---

## E. Rich import (DOCX, HTML, Markdown bundle, cancel, hostile file)

Use files you made for the test, not your real documents.

**E1. DOCX.** Import a DOCX with headings, a footnote, a table and one picture.
- Expected: a preview dialog ("Import writing") lists sections, notes and the picture count; confirming creates a new project with matching content. The dialog label says "up to 20 MB" while plain text is capped at 5 MB (known wording mismatch, not a failure).
- Failure looks like: wrong picture count, lost footnote, or content merged into an existing project.
- Result: ______  Outcome: pending owner

**E2. HTML file.** Import a small `.html` with a heading, a link and an image.
- Expected: text imports; scripts do nothing; remote images are not fetched.
- Result: ______  Outcome: pending owner

**E3. Markdown bundle (.zip).** Export one of your scratch projects as **Markdown with images (.zip)**, then import that zip.
- Expected: new project with text, footnotes and images. Comments, snapshots, history and full source records are not carried (by design; it is not a backup).
- Failure looks like: the zip is read as plain text, or images are missing.
- Result: ______  Outcome: pending owner

**E4. Cancel mid-way.** Start importing a large DOCX (a few MB) and press Cancel in the preview or while it parses.
- Expected: no new project, no leftover half-imported project, the app stays responsive.
- Failure looks like: a partial project appears, or the dialog cannot be closed.
- Result: ______  Outcome: pending owner

**E5. Hostile file.** Make an HTML file containing `<script>alert(1)</script>`, `<img src="https://example.com/x.png">`, and `<a href="javascript:alert(1)">x</a>`. Optionally watch outgoing connections with Little Snitch or `nettop` while importing.
- Expected: nothing executes (no alert), nothing is fetched (no connection to example.com), the script is dropped, the remote image is dropped or left as text, the link is neutralised.
- Failure looks like: an alert, any outgoing request, or a live external image in the project.
- Known boundary: a DOCX whose zip headers understate a huge entry is rejected only after inflating (about 100 MiB memory for the probe; open question Q003). Do not test this with a real huge file.
- Result: ______  Outcome: pending owner

---

## F. Citations, BibTeX, synthetic Zotero, Ibid.

**F1. BibTeX import.** Import a small `.bib` (a book, an article with pages, one entry with "Jr." in an author).
- Expected: an import preview lists sources and warnings; confirming adds sources; a duplicate import does not silently overwrite your edits. The "Jr." suffix is kept only in the raw record, so citations ignore it (known limitation).
- Result: ______  Outcome: pending owner

**F2. Zotero (synthetic; a real Zotero is not required).**
1. In the research panel find **Import from Zotero** and the local-refresh connection control.
2. Without Zotero running, choose **Connect local Zotero**.
- Expected: the status reads "Local Zotero refresh enabled -- not yet contacted." (no connection has happened); a hint says "In Zotero, enable the local API in Settings > Advanced before refreshing." Refresh is off by default and manual only.
3. Press refresh with Zotero not running.
- Expected: a plain message that it could not reach Zotero; no crash; your sources are unchanged.
4. Optional, only if you have Zotero installed: enable its local API and refresh.
- Expected: "Connected to local Zotero -- received N items." followed by a review dialog; nothing is applied without your confirmation.
- Failure looks like: "Connected" shown before any contact, auto-applied changes, or deleted local sources.
- Known gaps (not failures): no polling, whole library re-read each refresh, no remote-deletion marking, Chromium-only automated coverage (full list in `wp6.md`).
- Result: ______  Outcome: pending owner

**F3. Ibid. rules.** Add a footnote citation to source A, then a second note citing A again with the same locator, then one with a different page, then one citing source B.
- Expected: Chicago notes: the repeat of the same place becomes "Ibid."; a different page becomes "Ibid., 12."; a citation after a different source is a full or short form, not Ibid.; Ibid. is opt-in.
- Failure looks like: Ibid. for a different source, or Ibid. hiding a "needs manual citation" placeholder.
- Result: ______  Outcome: pending owner

---

## G. Exports (owner gate: wordRendering)

Use a project with: a multi-paragraph footnote, a footnote that is extremely long, a table spanning pages, two images.

**G1. PDF.** Export PDF.
- Expected: the multi-paragraph note prints as separate paragraphs (continuations indented); the table is readable; images stack with no gap; no clipped text.
- Known (not failures): PDF tables do **not** repeat the header row on continuation pages; Arabic/Hebrew/CJK text is refused with a clear message (use DOCX); project and section titles are not printed.
- Result: ______  Outcome: pending owner

**G2. Long note refusal.** Add a note longer than a page and export PDF.
- Expected: a refusal reading "A footnote is too long to fit on one PDF page. Export DOCX for flowing footnotes." and no corrupt file.
- Failure looks like: a crash, a blank/partial PDF, or the misleading script-support message for ordinary Latin text.
- Result: ______  Outcome: pending owner

**G3. DOCX in Word [NO AGENT].** Export DOCX and open in Microsoft Word (never opened in Word by an agent).
- Expected: the multi-paragraph note shows as three paragraphs; both images appear; the table renders and its header row repeats on page 2+ (DOCX marks it; unverified in Word); notes numbered in order.
- Failure looks like: literal line-feed boxes in notes, missing images, header not repeating, repair prompt on open.
- Result: ______  Outcome: pending owner

**G4. Table continuation.** In the PDF, page through the table that spans pages.
- Expected: continuation pages start with body rows (header not repeated; this is the documented limit). Record whether you want that fixed.
- Result: ______  Outcome: pending owner

---

## H. Native print -- confirm it is absent

**H1.** Open the Export panel and the File/app menus.
- Expected: **no** native print or "exact PDF preview" option is exposed. WP8 returned STOP (Arabic lam-alef not searchable); WP9/WP10 are cancelled; the legacy PDF exporter is the only PDF path.
- Failure looks like: a Print or exact-layout preview option appears.
- Result: ______  Outcome: pending owner

---

## I. Things only you can check [NO AGENT]

**I1. VoiceOver (owner gate: voiceOverAndIme).** Turn on VoiceOver (Cmd-F5). Walk the sidebar, the Export panel, the import dialog and the comments list.
- Expected: controls announce a name and role; hover-only controls are reachable by keyboard; dialogs trap and release focus sensibly.
- Failure looks like: unlabeled buttons, focus lost behind a dialog.
- Result: ______  Outcome: pending owner

**I2. Input methods (owner gate: voiceOverAndIme).** Type with an IME (Japanese Hiragana or Chinese Pinyin) in a section and in a comment.
- Expected: composition underline, candidate window at the caret, committed text saved and restored after reopen; no duplicated or lost characters.
- Result: ______  Outcome: pending owner

**I3. Long real session (owner gate: longSession).** Write for an hour or more across several sections with autosave on; quit and reopen at the end.
- Expected: no growing lag, **Saved** stays accurate, nothing lost.
- Failure looks like: typing stalls during saves (target p95 save under 150 ms at 100,000 words, measured only on this Intel Mac), memory growth, save errors.
- Result: ______  Outcome: pending owner

**I4. Apple silicon (owner gate: appleSilicon).** The build is x86_64 and runs on Apple silicon under Rosetta only. Run A1, B1, C3, D1 on an Apple silicon Mac if you have one.
- Expected: same results as on Intel. Apple silicon is unmeasured for the save benchmark.
- Result: ______  Outcome: pending owner

**I5. Native WebKit light/dark visuals (owner gate: webkitVisuals).** In the real app switch macOS between Light and Dark (System Settings > Appearance) while the app is open; look at the Projects view, the editor, the Export panel and the import dialog.
- Expected: live switch with no restart, sans-serif interface, flat square-cornered surfaces, readable contrast, selected sidebar entries blue and semibold. Reference screenshots are in `node_modules/.cache/personal-word-beta/team-t019/screens/*.png` (Chromium renders, not WebKit).
- Result: ______  Outcome: pending owner

---

## Summary table (fill in)

| Owner gate in `EVIDENCE.json` | Items | Outcome |
|---|---|---|
| keyboardAndCommentAnchors | B1, B2 | PASS -- owner-confirmed |
| closeRetry | C1 | PASS -- owner-confirmed |
| recoveredImage | C3, D1 | PASS -- owner-confirmed |
| preRestoreSafetyCopy | C3 | PASS -- owner-confirmed |
| wordRendering | G3 | PASS -- owner-confirmed |
| appleSilicon | I4 | PASS -- owner-confirmed |
| voiceOverAndIme | I1, I2 | PASS -- owner-confirmed |
| longSession | I3 | PASS -- owner-confirmed |
| webkitVisuals | I5 | PASS -- owner-confirmed |

Q001-Q004 are resolved, and the beta commits and README have been pushed. The owner confirmation closes the nine summary gates above.
