use rusqlite::{params, Connection, OptionalExtension, Transaction, TransactionBehavior};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::{
    collections::{HashMap, HashSet},
    fs::{self, File},
    io::Write,
    path::{Path, PathBuf},
    sync::Mutex,
};
use uuid::Uuid;

type Result<T> = std::result::Result<T, String>;
fn err(e: impl std::fmt::Display) -> String {
    e.to_string()
}
const SCHEMA_VERSION: i64 = 2;
/// Upper bound on automatic history rows, whatever the time buckets allow.
const HISTORY_CAP: usize = 2000;
const TABLES: &str = "
    CREATE TABLE project (id TEXT PRIMARY KEY, revision INTEGER NOT NULL, saved_at INTEGER NOT NULL, data TEXT NOT NULL);
    CREATE TABLE entries (id TEXT PRIMARY KEY, kind TEXT NOT NULL, data TEXT NOT NULL, blob INTEGER);
    CREATE TABLE history (revision INTEGER PRIMARY KEY, saved_at INTEGER NOT NULL, header TEXT NOT NULL);
    CREATE TABLE history_blobs (id INTEGER PRIMARY KEY, entry_id TEXT NOT NULL, data TEXT NOT NULL);
    CREATE TABLE history_entries (revision INTEGER NOT NULL, entry_id TEXT NOT NULL, blob INTEGER NOT NULL, PRIMARY KEY (revision, entry_id));
    CREATE INDEX history_entries_blob ON history_entries(blob);";
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Entry {
    pub id: String,
    pub kind: String,
    pub title: String,
    pub content: Value,
    pub text: String,
    pub updated_at: String,
    pub origin: Option<Value>,
    #[serde(flatten)]
    pub extra: serde_json::Map<String, Value>,
}
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Project {
    pub id: String,
    pub title: String,
    pub created_at: String,
    pub updated_at: String,
    pub revision: i64,
    pub order: Vec<String>,
    pub entries: Vec<Entry>,
    #[serde(flatten)]
    pub extra: serde_json::Map<String, Value>,
}
/// The project row: everything except entry bodies, with entry ids in display order.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Header {
    pub id: String,
    pub title: String,
    pub created_at: String,
    pub updated_at: String,
    pub revision: i64,
    pub order: Vec<String>,
    pub entry_ids: Vec<String>,
    #[serde(flatten)]
    pub extra: serde_json::Map<String, Value>,
}
/// One save: the new header plus the entries that changed since `base_revision`
/// (or every entry when the frontend does not know what is on disk).
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Change {
    pub header: Header,
    pub entries: Vec<Entry>,
    pub base_revision: Option<i64>,
}
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Summary {
    pub created_at: String,
    pub id: String,
    pub title: String,
    pub updated_at: String,
}
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Listing {
    pub projects: Vec<Summary>,
    pub damaged: Vec<String>,
}
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Version {
    pub id: String,
    pub name: String,
    pub created_at: String,
}
impl Project {
    fn header(&self) -> Header {
        Header {
            id: self.id.clone(),
            title: self.title.clone(),
            created_at: self.created_at.clone(),
            updated_at: self.updated_at.clone(),
            revision: self.revision,
            order: self.order.clone(),
            entry_ids: self.entries.iter().map(|e| e.id.clone()).collect(),
            extra: self.extra.clone(),
        }
    }
    fn assemble(h: Header, mut entries: HashMap<String, Entry>) -> Result<Project> {
        let entries = h
            .entry_ids
            .iter()
            .map(|id| {
                entries.remove(id).ok_or_else(|| {
                    "Project database is missing an entry. Restore a backup or import project.json; no files were replaced.".to_string()
                })
            })
            .collect::<Result<_>>()?;
        Ok(Project {
            id: h.id,
            title: h.title,
            created_at: h.created_at,
            updated_at: h.updated_at,
            revision: h.revision,
            order: h.order,
            entries,
            extra: h.extra,
        })
    }
}

pub struct Store {
    pub root: PathBuf,
    /// Projects whose project.json and text copies are behind SQLite.
    dirty: HashSet<String>,
}
impl Store {
    pub fn new(root: PathBuf) -> Result<Self> {
        fs::create_dir_all(&root).map_err(err)?;
        Ok(Self {
            root,
            dirty: HashSet::new(),
        })
    }
    /// A second handle on the same files for reading outside the store lock.
    fn reader(&self) -> Store {
        Store {
            root: self.root.clone(),
            dirty: HashSet::new(),
        }
    }
    fn dir(&self, id: &str) -> Result<PathBuf> {
        Uuid::parse_str(id).map_err(err)?;
        Ok(self.root.join(id))
    }
    fn connect(&self, id: &str, create: bool) -> Result<Connection> {
        let dir = self.dir(id)?;
        if !create && !dir.join("project.sqlite3").is_file() {
            return Err("Project database is missing. Restore a backup or import project.json; no files were replaced.".into());
        }
        fs::create_dir_all(dir.join("attachments")).map_err(err)?;
        let mut db = Connection::open(dir.join("project.sqlite3")).map_err(err)?;
        db.busy_timeout(std::time::Duration::from_secs(5))
            .map_err(err)?;
        let version: i64 = db
            .pragma_query_value(None, "user_version", |r| r.get(0))
            .map_err(err)?;
        if version > SCHEMA_VERSION {
            return Err("This project needs a newer version of Folio.".into());
        }
        db.execute_batch(
            "PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA foreign_keys=ON;",
        )
        .map_err(err)?;
        match version {
            0 => db
                .execute_batch(&format!(
                    "BEGIN IMMEDIATE; {TABLES}
    CREATE TABLE snapshots (id TEXT PRIMARY KEY, name TEXT NOT NULL, created_at TEXT NOT NULL, data TEXT NOT NULL);
    PRAGMA user_version={SCHEMA_VERSION}; COMMIT;"
                ))
                .map_err(err)?,
            1 => migrate_v1(&mut db)?,
            _ => {}
        }
        Ok(db)
    }
    pub fn list(&self) -> Result<Listing> {
        let mut projects = vec![];
        let mut damaged = vec![];
        for item in fs::read_dir(&self.root).map_err(err)? {
            let item = item.map_err(err)?;
            let id = item.file_name().to_string_lossy().to_string();
            if Uuid::parse_str(&id).is_err() || !item.path().is_dir() {
                continue;
            }
            match self
                .connect(&id, false)
                .and_then(|db| read_header(&db, &id))
            {
                Ok(h) => projects.push(Summary {
                    created_at: h.created_at,
                    id: h.id,
                    title: h.title,
                    updated_at: h.updated_at,
                }),
                Err(_) => damaged.push(id),
            }
        }
        projects.sort_by(|a, b| b.updated_at.cmp(&a.updated_at));
        damaged.sort();
        Ok(Listing { projects, damaged })
    }
    pub fn delete(&mut self, id: &str) -> Result<()> {
        let dir = self.dir(id)?;
        if !dir.is_dir() {
            return Err("Project folder is already gone.".into());
        }
        let target = self.root.join(format!("{id}.deleted"));
        if target.exists() {
            return Err(format!(
                "A set-aside copy already exists at {}. Move it away first.",
                target.display()
            ));
        }
        fs::rename(&dir, &target).map_err(err)?;
        // A deleted project has no portable copies left to write.
        self.dirty.remove(id);
        Ok(())
    }
    /// Rebuilds the project from the header row and the entries table.
    pub fn read(&self, id: &str) -> Result<Project> {
        let db = self.connect(id, false)?;
        // One read transaction, so a concurrent save can't mix two revisions.
        let db = db.unchecked_transaction().map_err(err)?;
        let header = read_header(&db, id)?;
        let mut q = db.prepare("SELECT id,data FROM entries").map_err(err)?;
        let entries = q
            .query_map([], |r| Ok((r.get::<_, String>(0)?, r.get::<_, String>(1)?)))
            .map_err(err)?
            .map(|row| {
                let (id, data) = row.map_err(err)?;
                Ok((id, serde_json::from_str(&data).map_err(err)?))
            })
            .collect::<Result<_>>()?;
        let p = Project::assemble(header, entries)?;
        validate(&p)?;
        Ok(p)
    }
    pub fn load(&self, id: &str) -> Result<Project> {
        let p = self.read(id)?;
        let db = self.connect(id, false)?;
        let integrity: String = db
            .query_row("PRAGMA quick_check", [], |r| r.get(0))
            .map_err(err)?;
        if integrity != "ok" {
            return Err(format!(
                "Database check failed: {integrity}. Previous backup was preserved."
            ));
        }
        let backup = self.dir(id)?.join("previous-session.sqlite3");
        db.backup(rusqlite::DatabaseName::Main, &backup, None)
            .map_err(err)?;
        Ok(p)
    }
    /// Saves a whole project; the frontend sends only changed entries via `save_changes`.
    #[cfg(test)]
    pub fn save(&mut self, project: &Project) -> Result<()> {
        validate(project)?;
        self.save_changes(&Change {
            header: project.header(),
            entries: project.entries.clone(),
            base_revision: None,
        })
    }
    pub fn save_changes(&mut self, change: &Change) -> Result<()> {
        let h = &change.header;
        validate_header(h)?;
        let ids: HashSet<&str> = h.entry_ids.iter().map(String::as_str).collect();
        let sent = change
            .entries
            .iter()
            .map(|e| {
                if !ids.contains(e.id.as_str()) {
                    return Err("Invalid entry; nothing was saved".to_string());
                }
                validate_entry(e)?;
                Ok((e, serde_json::to_string(e).map_err(err)?))
            })
            .collect::<Result<Vec<_>>>()?;
        let header = serde_json::to_string(h).map_err(err)?;
        // Don't leave an empty database behind for a new project that can't be saved.
        if sent.len() != ids.len() && !self.dir(&h.id)?.join("project.sqlite3").is_file() {
            return Err("Project is missing sections or fragments; nothing was saved".into());
        }
        let mut db = self.connect(&h.id, true)?;
        let tx = db
            .transaction_with_behavior(TransactionBehavior::Immediate)
            .map_err(err)?;
        let old: Option<(i64, String)> = tx
            .query_row(
                "SELECT revision,data FROM project WHERE id=?1",
                [&h.id],
                |r| Ok((r.get(0)?, r.get(1)?)),
            )
            .optional()
            .map_err(err)?;
        let conflict = || {
            Err("A newer revision is already on disk. Your recovery journal has been kept.".into())
        };
        let stale_base = || {
            Err("The saved project is older than this editor expected. Retry to save every section.".into())
        };
        match (&old, change.base_revision) {
            (None, Some(_)) => return stale_base(),
            (Some((revision, _)), Some(base)) if *revision < base => return stale_base(),
            (Some((revision, _)), _) if h.revision < *revision => return conflict(),
            (Some((revision, previous)), _) if h.revision == *revision => {
                // A retry of a commit that already landed is a no-op, but still repairs mirrors.
                for (e, data) in &sent {
                    let stored: Option<String> = tx
                        .query_row("SELECT data FROM entries WHERE id=?1", [&e.id], |r| {
                            r.get(0)
                        })
                        .optional()
                        .map_err(err)?;
                    if stored.as_ref() != Some(data) {
                        return conflict();
                    }
                }
                if previous != &header {
                    return conflict();
                }
                self.dirty.insert(h.id.clone());
                return Ok(());
            }
            (Some((revision, _)), _) => archive(&tx, *revision)?,
            (None, None) => {}
        }
        for (e, data) in &sent {
            tx.execute("INSERT INTO entries (id,kind,data,blob) VALUES (?1,?2,?3,NULL) ON CONFLICT(id) DO UPDATE SET kind=excluded.kind,data=excluded.data,blob=NULL WHERE data<>excluded.data", params![e.id, e.kind, data]).map_err(err)?;
        }
        let stored: Vec<(String, String)> = {
            let mut q = tx.prepare("SELECT id,kind FROM entries").map_err(err)?;
            let rows = q
                .query_map([], |r| Ok((r.get(0)?, r.get(1)?)))
                .map_err(err)?;
            rows.collect::<std::result::Result<_, _>>().map_err(err)?
        };
        let mut present = 0;
        let mut sections = HashSet::new();
        for (id, kind) in &stored {
            if !ids.contains(id.as_str()) {
                tx.execute("DELETE FROM entries WHERE id=?1", [id])
                    .map_err(err)?;
            } else {
                present += 1;
                if kind == "section" {
                    sections.insert(id.as_str());
                }
            }
        }
        if present != ids.len() {
            return Err("Project is missing sections or fragments; nothing was saved".into());
        }
        let order: HashSet<_> = h.order.iter().map(String::as_str).collect();
        if order.len() != h.order.len() || order != sections {
            return Err("Section order is inconsistent; nothing was saved".into());
        }
        let now = chrono::Utc::now().timestamp();
        tx.execute("INSERT INTO project VALUES (?1,?2,?3,?4) ON CONFLICT(id) DO UPDATE SET revision=excluded.revision,saved_at=excluded.saved_at,data=excluded.data", params![h.id, h.revision, now, header]).map_err(err)?;
        prune(&tx, now)?;
        tx.commit().map_err(err)?;
        self.dirty.insert(h.id.clone());
        Ok(())
    }
    pub fn snapshot(&self, id: &str, name: &str) -> Result<String> {
        if name.trim().is_empty() {
            return Err("Give this snapshot a name.".into());
        }
        let p = self.read(id)?;
        let db = self.connect(id, false)?;
        let key = Uuid::new_v4().to_string();
        let data = serde_json::to_string(&p).map_err(err)?;
        db.execute(
            "INSERT INTO snapshots VALUES (?1,?2,?3,?4)",
            params![key, name, chrono::Utc::now().to_rfc3339(), data],
        )
        .map_err(err)?;
        let dir = self.dir(id)?.join("snapshots");
        fs::create_dir_all(&dir).map_err(err)?;
        atomic(&dir.join(format!("{key}.json")), data.as_bytes())?;
        Ok(key)
    }
    pub fn versions(&self, id: &str, history: bool) -> Result<Vec<Version>> {
        let db = self.connect(id, false)?;
        if history {
            let mut q = db
                .prepare("SELECT revision,saved_at FROM history ORDER BY revision DESC")
                .map_err(err)?;
            let rows = q
                .query_map([], |r| {
                    let saved_at: i64 = r.get(1)?;
                    Ok(Version {
                        id: r.get::<_, i64>(0)?.to_string(),
                        name: "Automatic recovery".into(),
                        created_at: chrono::DateTime::from_timestamp(saved_at, 0)
                            .unwrap_or_default()
                            .to_rfc3339(),
                    })
                })
                .map_err(err)?;
            return rows.collect::<std::result::Result<_, _>>().map_err(err);
        }
        let mut q = db
            .prepare("SELECT id,name,created_at FROM snapshots ORDER BY rowid DESC")
            .map_err(err)?;
        let rows = q
            .query_map([], |r| {
                Ok(Version {
                    id: r.get(0)?,
                    name: r.get(1)?,
                    created_at: r.get(2)?,
                })
            })
            .map_err(err)?;
        rows.collect::<std::result::Result<_, _>>().map_err(err)
    }
    pub fn version(&self, id: &str, key: &str, history: bool) -> Result<Project> {
        let db = self.connect(id, false)?;
        if !history {
            let data: String = db
                .query_row("SELECT data FROM snapshots WHERE id=?1", [key], |r| {
                    r.get(0)
                })
                .map_err(err)?;
            return serde_json::from_str(&data).map_err(err);
        }
        let revision: i64 = key.parse().map_err(err)?;
        let header: String = db
            .query_row(
                "SELECT header FROM history WHERE revision=?1",
                [revision],
                |r| r.get(0),
            )
            .map_err(err)?;
        let mut q = db
            .prepare("SELECT h.entry_id,b.data FROM history_entries h JOIN history_blobs b ON b.id=h.blob WHERE h.revision=?1")
            .map_err(err)?;
        let entries = q
            .query_map([revision], |r| {
                Ok((r.get::<_, String>(0)?, r.get::<_, String>(1)?))
            })
            .map_err(err)?
            .map(|row| {
                let (id, data) = row.map_err(err)?;
                Ok((id, serde_json::from_str(&data).map_err(err)?))
            })
            .collect::<Result<_>>()?;
        Project::assemble(serde_json::from_str(&header).map_err(err)?, entries)
    }
}
fn read_header(db: &Connection, id: &str) -> Result<Header> {
    let data: String = db
        .query_row("SELECT data FROM project WHERE id=?1", [id], |r| r.get(0))
        .map_err(err)?;
    serde_json::from_str(&data).map_err(err)
}
/// Copies the current state (header and entry versions) into history before it is replaced.
/// Each entry version is stored once and shared by every history row that contains it.
fn archive(tx: &Transaction, revision: i64) -> Result<()> {
    let unarchived: Vec<(String, String)> = {
        let mut q = tx
            .prepare("SELECT id,data FROM entries WHERE blob IS NULL")
            .map_err(err)?;
        let rows = q
            .query_map([], |r| Ok((r.get(0)?, r.get(1)?)))
            .map_err(err)?;
        rows.collect::<std::result::Result<_, _>>().map_err(err)?
    };
    for (id, data) in unarchived {
        tx.execute(
            "INSERT INTO history_blobs (entry_id,data) VALUES (?1,?2)",
            params![id, data],
        )
        .map_err(err)?;
        tx.execute(
            "UPDATE entries SET blob=?1 WHERE id=?2",
            params![tx.last_insert_rowid(), id],
        )
        .map_err(err)?;
    }
    let added = tx
        .execute(
            "INSERT OR IGNORE INTO history (revision,saved_at,header) SELECT revision,saved_at,data FROM project",
            [],
        )
        .map_err(err)?;
    if added > 0 {
        tx.execute(
            "INSERT INTO history_entries SELECT ?1,id,blob FROM entries",
            [revision],
        )
        .map_err(err)?;
    }
    Ok(())
}
/// Which history revisions to keep. `rows` are (revision, saved_at unix seconds).
/// Every save from the last 10 minutes; the newest save per 5-minute window for the
/// last day; the newest per hour beyond that; at most HISTORY_CAP rows, newest first.
/// Windows are aligned to the clock, so a kept row stays kept until it ages a tier.
pub(crate) fn retained(rows: &[(i64, i64)], now: i64) -> HashSet<i64> {
    let mut rows = rows.to_vec();
    rows.sort_by(|a, b| b.0.cmp(&a.0));
    let mut windows = HashSet::new();
    let mut keep = HashSet::new();
    for (revision, saved_at) in rows {
        let age = now - saved_at;
        let window = if age <= 10 * 60 {
            None
        } else if age <= 24 * 60 * 60 {
            Some((300, saved_at.div_euclid(300)))
        } else {
            Some((3600, saved_at.div_euclid(3600)))
        };
        if window.is_none_or(|w| windows.insert(w)) {
            keep.insert(revision);
            if keep.len() == HISTORY_CAP {
                break;
            }
        }
    }
    keep
}
fn prune(tx: &Transaction, now: i64) -> Result<()> {
    let rows: Vec<(i64, i64)> = {
        let mut q = tx
            .prepare("SELECT revision,saved_at FROM history")
            .map_err(err)?;
        let rows = q
            .query_map([], |r| Ok((r.get(0)?, r.get(1)?)))
            .map_err(err)?;
        rows.collect::<std::result::Result<_, _>>().map_err(err)?
    };
    let keep = retained(&rows, now);
    let mut freed: Vec<i64> = vec![];
    for (revision, _) in rows.iter().filter(|(r, _)| !keep.contains(r)) {
        let mut q = tx
            .prepare_cached("SELECT blob FROM history_entries WHERE revision=?1")
            .map_err(err)?;
        let blobs = q.query_map([revision], |r| r.get(0)).map_err(err)?;
        for blob in blobs {
            freed.push(blob.map_err(err)?);
        }
        tx.execute("DELETE FROM history_entries WHERE revision=?1", [revision])
            .map_err(err)?;
        tx.execute("DELETE FROM history WHERE revision=?1", [revision])
            .map_err(err)?;
    }
    freed.sort_unstable();
    freed.dedup();
    for blob in freed {
        tx.execute("DELETE FROM history_blobs WHERE id=?1 AND NOT EXISTS (SELECT 1 FROM history_entries WHERE blob=?1) AND NOT EXISTS (SELECT 1 FROM entries WHERE blob=?1)", [blob]).map_err(err)?;
    }
    Ok(())
}
/// Version 1 kept the whole project as one JSON blob per save and full copies in history.
/// Rebuild entries from that blob (the v1 entries table was never read) and split history
/// into shared per-entry versions.
fn migrate_v1(db: &mut Connection) -> Result<()> {
    let tx = db
        .transaction_with_behavior(TransactionBehavior::Immediate)
        .map_err(err)?;
    let version: i64 = tx
        .pragma_query_value(None, "user_version", |r| r.get(0))
        .map_err(err)?;
    if version != 1 {
        return Ok(());
    }
    let read = |sql: &str| -> Result<Vec<(i64, String, String)>> {
        let mut q = tx.prepare(sql).map_err(err)?;
        let rows = q
            .query_map([], |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?)))
            .map_err(err)?;
        rows.collect::<std::result::Result<_, _>>().map_err(err)
    };
    let projects = read("SELECT revision,'',data FROM project")?;
    let history = read("SELECT revision,created_at,data FROM history")?;
    tx.execute_batch(&format!(
        "DROP TABLE project; DROP TABLE entries; DROP TABLE history; {TABLES}"
    ))
    .map_err(err)?;
    let now = chrono::Utc::now().timestamp();
    for (_, _, data) in projects {
        let p: Project = serde_json::from_str(&data).map_err(err)?;
        for e in &p.entries {
            tx.execute(
                "INSERT INTO entries (id,kind,data) VALUES (?1,?2,?3)",
                params![e.id, e.kind, serde_json::to_string(e).map_err(err)?],
            )
            .map_err(err)?;
        }
        tx.execute(
            "INSERT INTO project VALUES (?1,?2,?3,?4)",
            params![
                p.id,
                p.revision,
                now,
                serde_json::to_string(&p.header()).map_err(err)?
            ],
        )
        .map_err(err)?;
    }
    let mut blobs: HashMap<String, i64> = HashMap::new();
    for (revision, created_at, data) in history {
        let p: Project = serde_json::from_str(&data).map_err(err)?;
        let saved_at = chrono::DateTime::parse_from_rfc3339(&created_at)
            .map(|t| t.timestamp())
            .or_else(|_| {
                chrono::NaiveDate::parse_from_str(&created_at, "%Y-%m-%d").map(|d| {
                    d.and_hms_opt(0, 0, 0)
                        .unwrap_or_default()
                        .and_utc()
                        .timestamp()
                })
            })
            .unwrap_or(0);
        tx.execute(
            "INSERT INTO history VALUES (?1,?2,?3)",
            params![
                revision,
                saved_at,
                serde_json::to_string(&p.header()).map_err(err)?
            ],
        )
        .map_err(err)?;
        for e in &p.entries {
            let data = serde_json::to_string(e).map_err(err)?;
            let blob = match blobs.get(&data) {
                Some(blob) => *blob,
                None => {
                    tx.execute(
                        "INSERT INTO history_blobs (entry_id,data) VALUES (?1,?2)",
                        params![e.id, data],
                    )
                    .map_err(err)?;
                    let blob = tx.last_insert_rowid();
                    blobs.insert(data, blob);
                    blob
                }
            };
            tx.execute(
                "INSERT INTO history_entries VALUES (?1,?2,?3)",
                params![revision, e.id, blob],
            )
            .map_err(err)?;
        }
    }
    tx.pragma_update(None, "user_version", SCHEMA_VERSION)
        .map_err(err)?;
    tx.commit().map_err(err)
}
/// Writes project.json and the text copies for every project saved since the last pass
/// (or only `only`). `writing` keeps passes in order so an older copy never lands last.
/// Failed projects stay pending, so the next pass or an explicit flush retries them.
pub fn sync_mirrors(
    store: &Mutex<Store>,
    writing: &Mutex<()>,
    only: Option<&str>,
) -> Vec<(String, Result<()>)> {
    let _writing = writing.lock().unwrap_or_else(|e| e.into_inner());
    let (reader, ids) = {
        let mut s = store.lock().unwrap_or_else(|e| e.into_inner());
        let ids: Vec<String> = s
            .dirty
            .iter()
            .filter(|id| only.is_none_or(|o| o == id.as_str()))
            .cloned()
            .collect();
        for id in &ids {
            s.dirty.remove(id);
        }
        (s.reader(), ids)
    };
    // Reading and writing happen outside the store lock, so saves never wait on a pass.
    // A save that lands meanwhile marks its project dirty again for the next pass.
    let results: Vec<(String, Result<()>)> = ids
        .into_iter()
        // Deleted while queued: nothing to copy, and quit must not wait on it.
        .filter(|id| reader.dir(id).is_ok_and(|d| d.is_dir()))
        .map(|id| {
            let r = reader
                .dir(&id)
                .and_then(|dir| write_mirrors(&dir, &reader.read(&id)?))
                .map_err(|e| {
                    format!("Database saved, but portable copy failed: {e}. Retry to repair it.")
                });
            (id, r)
        })
        .collect();
    let failed: Vec<&String> = results
        .iter()
        .filter(|(id, r)| r.is_err() && reader.dir(id).is_ok_and(|d| d.is_dir()))
        .map(|(id, _)| id)
        .collect();
    if !failed.is_empty() {
        let mut s = store.lock().unwrap_or_else(|e| e.into_inner());
        s.dirty.extend(failed.into_iter().cloned());
    }
    results
}
fn write_mirrors(dir: &Path, p: &Project) -> Result<()> {
    atomic(
        &dir.join("project.json"),
        &serde_json::to_vec_pretty(p).map_err(err)?,
    )?;
    let manuscript = p
        .order
        .iter()
        .filter_map(|id| p.entries.iter().find(|e| &e.id == id))
        .map(|e| format!("{}\n\n{}\n", e.title, e.text))
        .collect::<Vec<_>>()
        .join("\n\n");
    let fragments = p
        .entries
        .iter()
        .filter(|e| e.kind == "fragment")
        .map(|e| format!("{}\n\n{}\n", e.title, e.text))
        .collect::<Vec<_>>()
        .join("\n\n");
    atomic(&dir.join("manuscript.txt"), manuscript.as_bytes())?;
    atomic(&dir.join("fragments.txt"), fragments.as_bytes())
}
pub fn validate(p: &Project) -> Result<()> {
    validate_header(&p.header())?;
    let mut sections = HashSet::new();
    for e in &p.entries {
        validate_entry(e)?;
        if e.kind == "section" {
            sections.insert(&e.id);
        }
    }
    let order: HashSet<_> = p.order.iter().collect();
    if order.len() != p.order.len() || order != sections {
        return Err("Section order is inconsistent; nothing was saved".into());
    }
    Ok(())
}
fn validate_header(h: &Header) -> Result<()> {
    Uuid::parse_str(&h.id).map_err(err)?;
    if h.title.trim().is_empty() || h.revision < 1 {
        return Err("Invalid project title or revision".into());
    }
    let mut ids = HashSet::new();
    for id in &h.entry_ids {
        Uuid::parse_str(id).map_err(err)?;
        if !ids.insert(id) {
            return Err("Invalid entry; nothing was saved".into());
        }
    }
    Ok(())
}
fn validate_entry(e: &Entry) -> Result<()> {
    Uuid::parse_str(&e.id).map_err(err)?;
    if !["section", "fragment"].contains(&e.kind.as_str())
        || e.title.trim().is_empty()
        || e.content.get("type").and_then(Value::as_str) != Some("doc")
        || !e.content.get("content").is_some_and(Value::is_array)
    {
        return Err("Invalid entry; nothing was saved".into());
    }
    validate_node(&e.content, 0)
}
fn validate_node(node: &Value, depth: usize) -> Result<()> {
    if depth > 100 {
        return Err("Rich text nesting is too deep".into());
    }
    let kind = node
        .get("type")
        .and_then(Value::as_str)
        .ok_or("Missing rich text node type")?;
    let inline = ["text", "hardBreak", "footnoteReference"];
    let blocks = [
        "paragraph",
        "heading",
        "blockquote",
        "bulletList",
        "orderedList",
        "codeBlock",
        "horizontalRule",
        "pageBreak",
    ];
    if !["doc", "listItem"].contains(&kind) && !inline.contains(&kind) && !blocks.contains(&kind) {
        return Err(format!("Unsupported rich text node: {kind}"));
    }
    if kind == "text"
        && node
            .get("text")
            .and_then(Value::as_str)
            .is_none_or(str::is_empty)
    {
        return Err("Invalid text node".into());
    }
    if let Some(marks) = node.get("marks") {
        for mark in marks.as_array().ok_or("Invalid text marks")? {
            if !["bold", "italic", "underline", "strike", "code", "link", "textFormat"]
                .contains(&mark.get("type").and_then(Value::as_str).unwrap_or(""))
            {
                return Err("Unsupported text formatting".into());
            }
        }
    }
    let children = match node.get("content") {
        Some(value) => value.as_array().ok_or("Invalid node content")?.as_slice(),
        None => &[],
    };
    if ["doc", "listItem", "bulletList", "orderedList", "blockquote"].contains(&kind)
        && children.is_empty()
    {
        return Err("Empty structural node".into());
    }
    if kind == "listItem" && children[0].get("type").and_then(Value::as_str) != Some("paragraph") {
        return Err("List items must start with a paragraph".into());
    }
    for child in children {
        let child_kind = child.get("type").and_then(Value::as_str).unwrap_or("");
        let allowed = match kind {
            "doc" | "blockquote" | "listItem" => blocks.contains(&child_kind),
            "bulletList" | "orderedList" => child_kind == "listItem",
            "paragraph" | "heading" => inline.contains(&child_kind),
            "codeBlock" => child_kind == "text",
            _ => false,
        };
        if !allowed {
            return Err("Invalid rich text structure".into());
        }
        validate_node(child, depth + 1)?;
    }
    Ok(())
}
pub(crate) fn atomic(path: &Path, bytes: &[u8]) -> Result<()> {
    let temp = path.with_extension(format!("folio-{}.tmp", Uuid::new_v4()));
    let mut file = File::create(&temp).map_err(err)?;
    file.write_all(bytes).map_err(err)?;
    file.sync_all().map_err(err)?;
    fs::rename(&temp, path).map_err(err)?;
    File::open(path.parent().ok_or("Missing parent directory")?)
        .map_err(err)?
        .sync_all()
        .map_err(err)
}

#[cfg(test)]
mod tests {
    use super::*;
    fn project() -> Project {
        let id = Uuid::new_v4().to_string();
        Project {
            id: Uuid::new_v4().to_string(),
            title: "Essay".into(),
            created_at: "2026-10-14".into(),
            updated_at: "2026-10-14".into(),
            revision: 1,
            order: vec![id.clone()],
            extra: Default::default(),
            entries: vec![Entry {
                id,
                kind: "section".into(),
                title: "Opening".into(),
                content: serde_json::json!({"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Keep this."}]}]}),
                text: "Keep this.".into(),
                updated_at: "2026-10-14".into(),
                origin: None,
                extra: Default::default(),
            }],
        }
    }
    fn section(text: &str) -> Entry {
        Entry {
            id: Uuid::new_v4().to_string(),
            kind: "section".into(),
            title: "Another".into(),
            content: serde_json::json!({"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":text}]}]}),
            text: text.into(),
            updated_at: "2026-10-14".into(),
            origin: None,
            extra: Default::default(),
        }
    }
    /// Runs one mirror pass for `id` the way the background task and Retry do.
    fn mirror(s: Store, id: &str) -> (Store, Result<()>) {
        let store = Mutex::new(s);
        let result = sync_mirrors(&store, &Mutex::new(()), Some(id))
            .into_iter()
            .map(|(_, r)| r)
            .collect::<Result<()>>();
        (store.into_inner().unwrap(), result)
    }
    fn count(s: &Store, id: &str, table: &str) -> i64 {
        s.connect(id, false)
            .unwrap()
            .query_row(&format!("SELECT count(*) FROM {table}"), [], |r| r.get(0))
            .unwrap()
    }
    #[test]
    fn restart_mirrors_backup_and_snapshots() {
        let temp = tempfile::tempdir().unwrap();
        let mut s = Store::new(temp.path().into()).unwrap();
        let mut p = project();
        s.save(&p).unwrap();
        let key = s.snapshot(&p.id, "Before workshop").unwrap();
        p.revision += 1;
        p.entries[0].text = "Rewritten".into();
        s.save(&p).unwrap();
        assert!(
            !temp.path().join(&p.id).join("manuscript.txt").exists(),
            "mirrors are written by the background pass, not by each save"
        );
        let (s, mirrored) = mirror(s, &p.id);
        mirrored.unwrap();
        drop(s);
        let mut s = Store::new(temp.path().into()).unwrap();
        assert_eq!(s.load(&p.id).unwrap(), p);
        assert!(temp
            .path()
            .join(&p.id)
            .join("previous-session.sqlite3")
            .exists());
        assert!(
            fs::read_to_string(temp.path().join(&p.id).join("manuscript.txt"))
                .unwrap()
                .contains("Rewritten")
        );
        let json: Project = serde_json::from_slice(
            &fs::read(temp.path().join(&p.id).join("project.json")).unwrap(),
        )
        .unwrap();
        assert_eq!(json, p);
        let mut old = s.version(&p.id, &key, false).unwrap();
        assert_eq!(old.entries[0].text, "Keep this.");
        old.revision = p.revision + 1;
        s.save(&old).unwrap();
        assert_eq!(s.read(&p.id).unwrap(), old);
        assert_eq!(s.versions(&p.id, true).unwrap().len(), 2);
    }
    #[test]
    fn malformed_stale_and_conflicting_writes_preserve_data() {
        let t = tempfile::tempdir().unwrap();
        let mut s = Store::new(t.path().into()).unwrap();
        let p = project();
        s.save(&p).unwrap();
        s.save(&p).unwrap();
        let mut bad = p.clone();
        bad.order.clear();
        bad.revision += 1;
        assert!(s.save(&bad).is_err());
        bad = p.clone();
        bad.title = "Conflict".into();
        assert!(s.save(&bad).is_err());
        bad = p.clone();
        bad.entries[0].text = "Conflict".into();
        assert!(s.save(&bad).is_err());
        assert_eq!(s.read(&p.id).unwrap(), p);
        assert!(s.load("../../other").is_err());
    }
    #[test]
    fn extraction_is_atomic_and_history_retains_source() {
        let t = tempfile::tempdir().unwrap();
        let mut s = Store::new(t.path().into()).unwrap();
        let mut p = project();
        s.save(&p).unwrap();
        let mut fragment = p.entries[0].clone();
        fragment.id = Uuid::new_v4().to_string();
        fragment.kind = "fragment".into();
        fragment.origin = Some(serde_json::json!({"sectionId":p.order[0]}));
        p.entries[0].text = "".into();
        p.entries[0].content = serde_json::json!({"type":"doc","content":[{"type":"paragraph"}]});
        p.entries.push(fragment);
        p.revision += 1;
        s.save(&p).unwrap();
        let actual = s.read(&p.id).unwrap();
        assert_eq!(actual.entries.len(), 2);
        assert_eq!(actual.entries[1].text, "Keep this.");
        assert_eq!(
            s.version(&p.id, "1", true).unwrap().entries[0].text,
            "Keep this."
        );
    }
    #[test]
    fn delta_saves_rebuild_the_project_from_entry_rows() {
        let t = tempfile::tempdir().unwrap();
        let mut s = Store::new(t.path().into()).unwrap();
        let mut p = project();
        let second = section("Second section.");
        p.order.push(second.id.clone());
        p.entries.push(second);
        s.save(&p).unwrap();
        // Only the changed entry travels; the other comes from its own row.
        p.revision = 2;
        p.entries[1].text = "Changed alone.".into();
        let change = |p: &Project, entries: Vec<Entry>, base| Change {
            header: p.header(),
            entries,
            base_revision: base,
        };
        s.save_changes(&change(&p, vec![p.entries[1].clone()], Some(1)))
            .unwrap();
        assert_eq!(s.read(&p.id).unwrap(), p);
        // The header row holds no prose.
        let header: String = s
            .connect(&p.id, false)
            .unwrap()
            .query_row("SELECT data FROM project", [], |r| r.get(0))
            .unwrap();
        assert!(!header.contains("Keep this.") && !header.contains("Changed alone."));
        // Retrying the same delta is a no-op; a different body at that revision is a conflict.
        s.save_changes(&change(&p, vec![p.entries[1].clone()], Some(1)))
            .unwrap();
        let mut other = p.entries[1].clone();
        other.text = "Something else".into();
        assert!(s
            .save_changes(&change(&p, vec![other], Some(1)))
            .unwrap_err()
            .contains("newer revision"));
        // A delta built on a revision the disk never reached is refused.
        p.revision = 3;
        assert!(s
            .save_changes(&change(&p, vec![], Some(7)))
            .unwrap_err()
            .contains("older than"));
        // Dropping an id from the header deletes that entry.
        let removed = p.entries.remove(1);
        p.order.retain(|id| id != &removed.id);
        s.save_changes(&change(&p, vec![], Some(2))).unwrap();
        assert_eq!(s.read(&p.id).unwrap(), p);
        assert_eq!(count(&s, &p.id, "entries"), 1);
        // A header naming an entry nobody sent, or an entry the header does not name, is refused.
        let mut missing = p.clone();
        missing.revision = 4;
        let ghost = section("Never sent.");
        missing.order.push(ghost.id.clone());
        missing.entries.push(ghost.clone());
        assert!(s
            .save_changes(&change(&missing, vec![], Some(3)))
            .unwrap_err()
            .contains("missing"));
        let mut stray = p.clone();
        stray.revision = 4;
        assert!(s
            .save_changes(&change(&stray, vec![ghost], Some(3)))
            .is_err());
        // A brand-new project must arrive whole.
        let fresh = project();
        assert!(s
            .save_changes(&change(&fresh, vec![], None))
            .unwrap_err()
            .contains("missing"));
        assert_eq!(s.read(&p.id).unwrap(), p);
    }
    #[test]
    fn history_shares_unchanged_entries_and_prunes_by_age() {
        let t = tempfile::tempdir().unwrap();
        let mut s = Store::new(t.path().into()).unwrap();
        let mut p = project();
        let second = section("Untouched section.");
        p.order.push(second.id.clone());
        p.entries.push(second);
        s.save(&p).unwrap();
        for revision in 2..=6 {
            p.revision = revision;
            p.entries[0].text = format!("Draft {revision}");
            s.save(&p).unwrap();
        }
        // Revisions 1-5 are history; the untouched section is stored once.
        assert_eq!(count(&s, &p.id, "history"), 5);
        assert_eq!(count(&s, &p.id, "history_blobs"), 6);
        assert_eq!(
            s.version(&p.id, "3", true).unwrap().entries[0].text,
            "Draft 3"
        );
        assert_eq!(
            s.version(&p.id, "3", true).unwrap().entries[1].text,
            "Untouched section."
        );
        // Age revisions 1-4 to two days ago, within one hour: only the newest of them survives.
        let two_days_ago = chrono::Utc::now().timestamp() - 2 * 24 * 3600;
        let hour = two_days_ago - two_days_ago.rem_euclid(3600);
        s.connect(&p.id, false)
            .unwrap()
            .execute(
                "UPDATE history SET saved_at=?1+revision WHERE revision<=4",
                [hour],
            )
            .unwrap();
        p.revision = 7;
        p.entries[0].text = "Draft 7".into();
        s.save(&p).unwrap();
        let kept: Vec<String> = s
            .versions(&p.id, true)
            .unwrap()
            .into_iter()
            .map(|v| v.id)
            .collect();
        assert_eq!(kept, ["6", "5", "4"]);
        // Blobs only used by pruned revisions are gone; shared ones remain.
        assert_eq!(count(&s, &p.id, "history_blobs"), 4);
        assert_eq!(
            s.version(&p.id, "4", true).unwrap().entries[1].text,
            "Untouched section."
        );
        assert!(s.version(&p.id, "2", true).is_err());
    }
    #[test]
    fn retention_keeps_recent_saves_then_thins_by_time() {
        let now: i64 = 1_000_000_000;
        let minute = 60;
        let mut rows = vec![];
        let mut revision = 0;
        let mut at = |t: i64| {
            revision += 1;
            rows.push((revision, t));
            revision
        };
        // Three days ago: four saves inside one clock hour, one in the next hour.
        let old_hour = (now - 3 * 24 * 3600).div_euclid(3600) * 3600;
        let old: Vec<i64> = [5, 20, 40, 55].map(|m| at(old_hour + m * minute)).into();
        let next_hour = at(old_hour + 65 * minute);
        // Two hours ago: three saves in one 5-minute window, one in the next.
        let window = (now - 2 * 3600).div_euclid(300) * 300;
        let day: Vec<i64> = [0, 60, 120].map(|s| at(window + s)).into();
        let next_window = at(window + 300);
        // The last ten minutes: every save, even seconds apart.
        let recent: Vec<i64> = (0..20).map(|i| at(now - 9 * minute + i * 5)).collect();
        let keep = retained(&rows, now);
        assert!(keep.contains(&old[3]) && !old[..3].iter().any(|r| keep.contains(r)));
        assert!(keep.contains(&next_hour));
        assert!(keep.contains(&day[2]) && !day[..2].iter().any(|r| keep.contains(r)));
        assert!(keep.contains(&next_window));
        assert!(recent.iter().all(|r| keep.contains(r)));
        assert_eq!(keep.len(), 2 + 2 + recent.len());
        // Thinning is stable: pruning what is already pruned keeps the same rows.
        let survivors: Vec<_> = rows
            .iter()
            .copied()
            .filter(|(r, _)| keep.contains(r))
            .collect();
        assert_eq!(retained(&survivors, now), keep);
        // The cap keeps the newest saves.
        let flood: Vec<(i64, i64)> = (1..=HISTORY_CAP as i64 + 50).map(|r| (r, now)).collect();
        let capped = retained(&flood, now);
        assert_eq!(capped.len(), HISTORY_CAP);
        assert!(capped.contains(&(HISTORY_CAP as i64 + 50)) && !capped.contains(&50));
    }
    #[test]
    fn migrates_a_version_1_database() {
        let t = tempfile::tempdir().unwrap();
        let id = "6c1f3d4e-1b2a-4c3d-8e9f-0a1b2c3d4e5f";
        fs::create_dir_all(t.path().join(id)).unwrap();
        fs::copy(
            Path::new(env!("CARGO_MANIFEST_DIR")).join("tests/fixtures/v1-project.sqlite3"),
            t.path().join(id).join("project.sqlite3"),
        )
        .unwrap();
        let mut s = Store::new(t.path().into()).unwrap();
        let p = s.load(id).unwrap();
        let version: i64 = s
            .connect(id, false)
            .unwrap()
            .pragma_query_value(None, "user_version", |r| r.get(0))
            .unwrap();
        assert_eq!(version, SCHEMA_VERSION);
        assert_eq!(p.title, "Fixture essay");
        assert_eq!(p.revision, 3);
        assert_eq!(p.entries.len(), 2);
        assert_eq!(p.entries[0].text, "Second pass.");
        assert_eq!(p.entries[1].text, "A fragment.");
        assert_eq!(s.list().unwrap().projects[0].title, "Fixture essay");
        // History survives with entry versions shared between revisions.
        assert_eq!(s.versions(id, true).unwrap().len(), 2);
        assert_eq!(
            s.version(id, "1", true).unwrap().entries[0].text,
            "Keep this."
        );
        assert_eq!(
            s.version(id, "2", true).unwrap().entries[0].text,
            "Second pass."
        );
        assert_eq!(count(&s, id, "history_blobs"), 2);
        let snapshots = s.versions(id, false).unwrap();
        assert_eq!(snapshots[0].name, "First draft");
        assert_eq!(
            s.version(id, &snapshots[0].id, false).unwrap().entries[0].text,
            "Keep this."
        );
        // And the migrated project keeps saving.
        let mut next = p.clone();
        next.revision = 4;
        next.entries[1].text = "Fragment, revised.".into();
        s.save(&next).unwrap();
        assert_eq!(s.read(id).unwrap(), next);
        assert_eq!(s.version(id, "3", true).unwrap(), p);
    }
    #[test]
    fn mirror_failure_can_be_retried_without_losing_commit() {
        let t = tempfile::tempdir().unwrap();
        let mut s = Store::new(t.path().into()).unwrap();
        let p = project();
        let dir = s.dir(&p.id).unwrap();
        fs::create_dir_all(dir.join("manuscript.txt")).unwrap();
        s.save(&p).unwrap();
        let (s, failed) = mirror(s, &p.id);
        assert!(failed.unwrap_err().contains("Database saved"));
        assert_eq!(s.read(&p.id).unwrap(), p);
        fs::remove_dir(dir.join("manuscript.txt")).unwrap();
        // The failed project stays pending, so the next pass (or Retry) repairs it.
        let (s, repaired) = mirror(s, &p.id);
        repaired.unwrap();
        assert!(dir.join("manuscript.txt").is_file());
        let (_, idle) = mirror(s, &p.id);
        idle.unwrap();
    }
    #[test]
    fn failed_sql_write_rolls_back() {
        let t = tempfile::tempdir().unwrap();
        let mut s = Store::new(t.path().into()).unwrap();
        let mut p = project();
        s.save(&p).unwrap();
        let db = s.connect(&p.id, false).unwrap();
        db.execute_batch("CREATE TRIGGER reject_update BEFORE UPDATE ON project BEGIN SELECT RAISE(ABORT,'simulated disk failure'); END;").unwrap();
        p.revision += 1;
        p.entries[0].text = "Do not partially save".into();
        assert!(s.save(&p).is_err());
        assert_eq!(s.read(&p.id).unwrap().revision, 1);
        let stored: String = db
            .query_row("SELECT data FROM entries", [], |r| r.get(0))
            .unwrap();
        assert!(!stored.contains("Do not partially save"));
        assert_eq!(count(&s, &p.id, "history"), 0);
    }

    #[test]
    fn one_damaged_folder_does_not_hide_healthy_projects() {
        let t = tempfile::tempdir().unwrap();
        let mut s = Store::new(t.path().into()).unwrap();
        let p = project();
        s.save(&p).unwrap();
        let broken = Uuid::new_v4().to_string();
        fs::create_dir(t.path().join(&broken)).unwrap();
        let listing = s.list().unwrap();
        assert_eq!(listing.projects.len(), 1);
        assert_eq!(listing.projects[0].id, p.id);
        assert_eq!(listing.damaged, vec![broken]);
    }
    #[test]
    fn delete_sets_the_folder_aside_instead_of_erasing_it() {
        let t = tempfile::tempdir().unwrap();
        let mut s = Store::new(t.path().into()).unwrap();
        let p = project();
        s.save(&p).unwrap();
        s.delete(&p.id).unwrap();
        assert!(s.list().unwrap().projects.is_empty());
        assert!(t
            .path()
            .join(format!("{}.deleted", p.id))
            .join("project.sqlite3")
            .is_file());
        assert!(s.delete(&p.id).is_err());
    }
    #[test]
    fn deleting_a_project_with_pending_copies_does_not_block_quit() {
        let t = tempfile::tempdir().unwrap();
        let mut s = Store::new(t.path().into()).unwrap();
        let p = project();
        s.save(&p).unwrap();
        s.delete(&p.id).unwrap();
        let (_, result) = mirror(s, &p.id);
        assert!(result.is_ok(), "{}", result.unwrap_err());
    }
    #[test]
    fn rejects_newer_schemas_and_malformed_rich_text() {
        let t = tempfile::tempdir().unwrap();
        let mut store = Store::new(t.path().into()).unwrap();
        let mut p = project();
        store.save(&p).unwrap();
        p.revision += 1;
        p.entries[0].content = serde_json::json!({"type":"doc","content":[{"type":"unknown"}]});
        assert!(store.save(&p).is_err());
        assert_eq!(store.read(&p.id).unwrap().revision, 1);
        let db = store.connect(&p.id, false).unwrap();
        db.pragma_update(None, "user_version", 99).unwrap();
        assert!(store.load(&p.id).unwrap_err().contains("newer version"));
    }
    fn big_project() -> Project {
        let mut p = project();
        let sentence = "The quiet river carried every word we wrote far downstream.";
        p.entries = (0..100)
            .map(|s| {
                let paras: Vec<String> = (0..100)
                    .map(|i| sentence.replace("river", &format!("river{s}.{i}")))
                    .collect();
                Entry {
                    id: Uuid::new_v4().to_string(),
                    kind: "section".into(),
                    title: format!("Section {s}"),
                    content: serde_json::json!({"type":"doc","content": paras.iter().map(|t| serde_json::json!({"type":"paragraph","content":[{"type":"text","text":t}]})).collect::<Vec<_>>()}),
                    text: paras.join("\n"),
                    updated_at: "2026-10-16".into(),
                    origin: None,
                extra: Default::default(),
                }
            })
            .collect();
        p.order = p.entries.iter().map(|e| e.id.clone()).collect();
        p
    }
    /// `cargo test --release --manifest-path src-tauri/Cargo.toml bench_save -- --ignored --nocapture`
    #[test]
    fn extended_project_metadata_survives_save_and_restart() {
        let t = tempfile::tempdir().unwrap();
        let mut store = Store::new(t.path().into()).unwrap();
        let mut p = project();
        p.extra.insert("research".into(), serde_json::json!({"sources":[],"notes":[],"footnotes":[{"id":"note-1","text":"Evidence"}]}));
        p.extra.insert("pageLayout".into(), serde_json::json!({"mode":"pages","paper":"letter","margin":96,"zoom":100}));
        p.extra.insert("sidebarOrder".into(), serde_json::json!(["research","manuscript"]));
        p.entries[0].extra.insert("tags".into(), serde_json::json!(["keep"]));
        p.entries[0].content = serde_json::json!({"type":"doc","content":[{"type":"paragraph","attrs":{"lineHeight":"2"},"content":[{"type":"text","text":"Evidence","marks":[{"type":"textFormat","attrs":{"fontFamily":"Arial","fontSize":"12pt"}}]},{"type":"footnoteReference","attrs":{"id":"note-1"}}]},{"type":"pageBreak"},{"type":"paragraph"}]});
        store.save(&p).unwrap();
        let fresh = Store::new(t.path().into()).unwrap();
        assert_eq!(fresh.load(&p.id).unwrap(), p);
    }
    #[test]
    #[ignore]
    fn bench_save_100k_words() {
        let t = tempfile::tempdir().unwrap();
        let mut s = Store::new(t.path().into()).unwrap();
        let mut p = big_project();
        s.save(&p).unwrap();
        let runs = 50;
        let start = std::time::Instant::now();
        for _ in 0..runs {
            p.revision += 1;
            p.entries[50].text.push('x');
            s.save_changes(&Change {
                header: p.header(),
                entries: vec![p.entries[50].clone()],
                base_revision: Some(p.revision - 1),
            })
            .unwrap();
        }
        let per = start.elapsed().as_secs_f64() * 1000.0 / runs as f64;
        println!("BENCH per-save (one section changed, 100k words): {per:.2} ms");
        let start = std::time::Instant::now();
        let (s, mirrored) = mirror(s, &p.id);
        mirrored.unwrap();
        let pass = start.elapsed().as_secs_f64() * 1000.0;
        println!("BENCH background mirror pass (project.json + 2 text files): {pass:.2} ms");
        let start = std::time::Instant::now();
        s.read(&p.id).unwrap();
        let read = start.elapsed().as_secs_f64() * 1000.0;
        println!("BENCH read (rebuild from entries): {read:.2} ms");
    }
}
