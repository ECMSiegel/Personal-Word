use rusqlite::{params, Connection, OptionalExtension};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::{
    collections::HashSet,
    fs::{self, File},
    io::Write,
    path::{Path, PathBuf},
};
use uuid::Uuid;

type Result<T> = std::result::Result<T, String>;
fn err(e: impl std::fmt::Display) -> String {
    e.to_string()
}
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
}
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Summary {
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

pub struct Store {
    pub root: PathBuf,
}
impl Store {
    pub fn new(root: PathBuf) -> Result<Self> {
        fs::create_dir_all(&root).map_err(err)?;
        Ok(Self { root })
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
        let db = Connection::open(dir.join("project.sqlite3")).map_err(err)?;
        db.busy_timeout(std::time::Duration::from_secs(5))
            .map_err(err)?;
        let version: i64 = db
            .pragma_query_value(None, "user_version", |r| r.get(0))
            .map_err(err)?;
        if version > 1 {
            return Err("This project needs a newer version of Folio.".into());
        }
        db.execute_batch(
            "PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA foreign_keys=ON;",
        )
        .map_err(err)?;
        if version == 0 {
            db.execute_batch("BEGIN IMMEDIATE;
    CREATE TABLE project (id TEXT PRIMARY KEY, revision INTEGER NOT NULL, data TEXT NOT NULL);
    CREATE TABLE entries (id TEXT PRIMARY KEY, data TEXT NOT NULL);
    CREATE TABLE snapshots (id TEXT PRIMARY KEY, name TEXT NOT NULL, created_at TEXT NOT NULL, data TEXT NOT NULL);
    CREATE TABLE history (revision INTEGER PRIMARY KEY, created_at TEXT NOT NULL, data TEXT NOT NULL);
    PRAGMA user_version=1; COMMIT;").map_err(err)?;
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
            match self.read(&id) {
                Ok(p) => projects.push(Summary {
                    id: p.id,
                    title: p.title,
                    updated_at: p.updated_at,
                }),
                Err(_) => damaged.push(id),
            }
        }
        projects.sort_by(|a, b| b.updated_at.cmp(&a.updated_at));
        damaged.sort();
        Ok(Listing { projects, damaged })
    }
    pub fn delete(&self, id: &str) -> Result<()> {
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
        fs::rename(&dir, &target).map_err(err)
    }
    pub fn read(&self, id: &str) -> Result<Project> {
        let db = self.connect(id, false)?;
        let data: String = db
            .query_row("SELECT data FROM project WHERE id=?1", [id], |r| r.get(0))
            .map_err(err)?;
        let p: Project = serde_json::from_str(&data).map_err(err)?;
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
    pub fn save(&self, project: &Project) -> Result<()> {
        validate(project)?;
        let mut db = self.connect(&project.id, true)?;
        let tx = db.transaction().map_err(err)?;
        let old: Option<(i64, String)> = tx
            .query_row(
                "SELECT revision,data FROM project WHERE id=?1",
                [&project.id],
                |r| Ok((r.get(0)?, r.get(1)?)),
            )
            .optional()
            .map_err(err)?;
        let data = serde_json::to_string(project).map_err(err)?;
        if let Some((revision, ref previous)) = old {
            if project.revision < revision || (project.revision == revision && previous != &data) {
                return Err(
                    "A newer revision is already on disk. Your recovery journal has been kept."
                        .into(),
                );
            }
            if project.revision > revision {
                tx.execute(
                    "INSERT OR IGNORE INTO history VALUES (?1,?2,?3)",
                    params![revision, project.updated_at, previous],
                )
                .map_err(err)?;
                tx.execute("DELETE FROM history WHERE revision NOT IN (SELECT revision FROM history ORDER BY revision DESC LIMIT 100)", []).map_err(err)?;
            }
        }
        for entry in &project.entries {
            let data = serde_json::to_string(entry).map_err(err)?;
            tx.execute("INSERT INTO entries VALUES (?1,?2) ON CONFLICT(id) DO UPDATE SET data=excluded.data WHERE data<>excluded.data", params![entry.id,data]).map_err(err)?;
        }
        let ids: HashSet<_> = project.entries.iter().map(|e| e.id.as_str()).collect();
        let existing: Vec<String> = {
            let mut q = tx.prepare("SELECT id FROM entries").map_err(err)?;
            let rows = q.query_map([], |r| r.get(0)).map_err(err)?;
            rows.collect::<std::result::Result<_, _>>().map_err(err)?
        };
        for id in existing {
            if !ids.contains(id.as_str()) {
                tx.execute("DELETE FROM entries WHERE id=?1", [id])
                    .map_err(err)?;
            }
        }
        tx.execute("INSERT INTO project VALUES (?1,?2,?3) ON CONFLICT(id) DO UPDATE SET revision=excluded.revision,data=excluded.data", params![project.id,project.revision,data]).map_err(err)?;
        tx.commit().map_err(err)?;
        self.mirror(project).map_err(|e| {
            format!("Database saved, but portable copy failed: {e}. Retry to repair it.")
        })
    }
    fn mirror(&self, p: &Project) -> Result<()> {
        let dir = self.dir(&p.id)?;
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
        let sql = if history {
            "SELECT CAST(revision AS TEXT), 'Automatic recovery', created_at FROM history ORDER BY revision DESC"
        } else {
            "SELECT id,name,created_at FROM snapshots ORDER BY rowid DESC"
        };
        let mut q = db.prepare(sql).map_err(err)?;
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
        let sql = if history {
            "SELECT data FROM history WHERE revision=?1"
        } else {
            "SELECT data FROM snapshots WHERE id=?1"
        };
        let data: String = db.query_row(sql, [key], |r| r.get(0)).map_err(err)?;
        serde_json::from_str(&data).map_err(err)
    }
}
pub fn validate(p: &Project) -> Result<()> {
    Uuid::parse_str(&p.id).map_err(err)?;
    if p.title.trim().is_empty() || p.revision < 1 {
        return Err("Invalid project title or revision".into());
    }
    let mut ids = HashSet::new();
    let mut sections = HashSet::new();
    for e in &p.entries {
        Uuid::parse_str(&e.id).map_err(err)?;
        if !ids.insert(&e.id)
            || !["section", "fragment"].contains(&e.kind.as_str())
            || e.title.trim().is_empty()
            || e.content.get("type").and_then(Value::as_str) != Some("doc")
            || !e.content.get("content").is_some_and(Value::is_array)
        {
            return Err("Invalid entry; nothing was saved".into());
        }
        validate_node(&e.content, 0)?;
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
fn validate_node(node: &Value, depth: usize) -> Result<()> {
    if depth > 100 {
        return Err("Rich text nesting is too deep".into());
    }
    let kind = node
        .get("type")
        .and_then(Value::as_str)
        .ok_or("Missing rich text node type")?;
    let inline = ["text", "hardBreak"];
    let blocks = [
        "paragraph",
        "heading",
        "blockquote",
        "bulletList",
        "orderedList",
        "codeBlock",
        "horizontalRule",
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
            if !["bold", "italic", "underline", "strike", "code", "link"]
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
            entries: vec![Entry {
                id,
                kind: "section".into(),
                title: "Opening".into(),
                content: serde_json::json!({"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Keep this."}]}]}),
                text: "Keep this.".into(),
                updated_at: "2026-10-14".into(),
                origin: None,
            }],
        }
    }
    #[test]
    fn restart_mirrors_backup_and_snapshots() {
        let temp = tempfile::tempdir().unwrap();
        let s = Store::new(temp.path().into()).unwrap();
        let mut p = project();
        s.save(&p).unwrap();
        let key = s.snapshot(&p.id, "Before workshop").unwrap();
        p.revision += 1;
        p.entries[0].text = "Rewritten".into();
        s.save(&p).unwrap();
        drop(s);
        let s = Store::new(temp.path().into()).unwrap();
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
        let s = Store::new(t.path().into()).unwrap();
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
        assert_eq!(s.read(&p.id).unwrap(), p);
        assert!(s.load("../../other").is_err());
    }
    #[test]
    fn extraction_is_atomic_and_history_retains_source() {
        let t = tempfile::tempdir().unwrap();
        let s = Store::new(t.path().into()).unwrap();
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
    fn mirror_failure_can_be_retried_without_losing_commit() {
        let t = tempfile::tempdir().unwrap();
        let s = Store::new(t.path().into()).unwrap();
        let p = project();
        let dir = s.dir(&p.id).unwrap();
        fs::create_dir_all(dir.join("manuscript.txt")).unwrap();
        assert!(s.save(&p).unwrap_err().contains("Database saved"));
        assert_eq!(s.read(&p.id).unwrap(), p);
        fs::remove_dir(dir.join("manuscript.txt")).unwrap();
        s.save(&p).unwrap();
    }
    #[test]
    fn failed_sql_write_rolls_back() {
        let t = tempfile::tempdir().unwrap();
        let s = Store::new(t.path().into()).unwrap();
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
    }

    #[test]
    fn one_damaged_folder_does_not_hide_healthy_projects() {
        let t = tempfile::tempdir().unwrap();
        let s = Store::new(t.path().into()).unwrap();
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
        let s = Store::new(t.path().into()).unwrap();
        let p = project();
        s.save(&p).unwrap();
        s.delete(&p.id).unwrap();
        assert!(s.list().unwrap().projects.is_empty());
        assert!(t
            .path()
            .join(format!("{}.deleted", p.id))
            .join("project.json")
            .is_file());
        assert!(s.delete(&p.id).is_err());
    }
    #[test]
    fn rejects_newer_schemas_and_malformed_rich_text() {
        let t = tempfile::tempdir().unwrap();
        let store = Store::new(t.path().into()).unwrap();
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
}
