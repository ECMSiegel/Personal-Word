# Saving, recovery, and backups

Personal Word keeps projects on this Mac. SQLite is the saved copy; portable JSON and text files are secondary copies. Keep a separate backup for writing you cannot replace.

## What the save indicators mean

- **Saving…** means Personal Word has a write queued or in progress.
- **Unsaved edits** means the latest edit has not been acknowledged by SQLite.
- **Saved** means the latest queued revision completed its SQLite transaction. The JSON and text copies may still be catching up; an error banner names a portable-copy problem and offers Retry.
- **Save failed** means SQLite did not acknowledge the latest revision. The app keeps the edit in memory and keeps its recovery journal when possible. Retry the save before closing or switching away.

The editor schedules a save after typing stops and also sets a maximum scheduling wait while typing continues. That wait only bounds when a healthy queue attempts persistence. Slow or failed storage, app suspension, and a blocked event loop can make it longer. An edit that has not reached SQLite exists in app memory and WebView recovery storage; it is not a committed database revision.

When closing the app, Personal Word flushes pending edits and portable copies. If either operation fails, the app should stay open and show Retry. Resolve the error before closing. If Retry continues to fail, export a project JSON copy and make a closed-app copy of the project folder before further recovery attempts.

## Make and verify a backup

1. Use the **Export portable project** button to save a complete `.json` copy. Store it somewhere separate from the Mac's application-data folder.
2. To check that the copy can be read without replacing the current project, import it as a new project. Compare its sections and research material, then keep or close the test copy as appropriate.
3. For a folder backup, open **Settings > Storage location**, quit Personal Word, then copy the complete project folder to another disk or backup service. Do not copy only `project.sqlite3` while the app is open; SQLite may also have committed data in its WAL file.
4. Keep more than one dated backup when the writing matters. A snapshot, portable mirror, or previous-session database backup on this Mac cannot protect against loss of the Mac or its drive.

## Recover after an interruption

When opening a project, Personal Word checks its saved database and any local recovery journal. If the journal contains a newer complete revision, the app can reopen that writing. If the journal is malformed, incomplete, or conflicts with the saved copy, the app keeps the raw journal and asks what to do. Export the journal first when you may need to inspect or preserve that copy; choose **Keep journal copy** only when that version is the one you want to recover. Choose **Keep disk copy** or **Discard and open** only after deciding that the saved project is the version to continue from.

Before restoring an older version, Personal Word creates a safety snapshot of the current project. Open **Snapshots & history** to inspect versions. A restore is a new project revision; the safety snapshot is available there if you need to return to the pre-restore state.

If a project fails to open or SQLite reports damage, do not delete or replace its folder. Quit the app, copy the entire folder to a separate location, and preserve the JSON mirror and any `previous-session.sqlite3` file before trying an import or restore. Importing a JSON mirror creates a separate project so the original remains available for comparison.

## Limits

The recovery journal is written synchronously to WebView local storage, but WebKit schedules its disk writes and Personal Word cannot fsync that store. The SQLite commit is the save acknowledgement; a hard kill or power loss can still lose an uncommitted edit, and a sudden loss may also outrun the operating system or storage hardware. macOS `fullfsync` settings request stronger SQLite flush behavior, but they do not guarantee survival of hardware failure or power interruption. Keep external backups.
