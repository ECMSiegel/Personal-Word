//! Zotero local API reader.
//! Bounded strictly to loopback HTTP on port 23119 (http://127.0.0.1:23119/api/...).
//! GET only, redirects disabled (redirects=0), 12s timeout, 5 MiB payload cap.

use std::io::Read;
use std::time::Duration;

pub const TIMEOUT: Duration = Duration::from_secs(12);
pub const MAX_BYTES: u64 = 5 * 1024 * 1024;
pub const USER_AGENT: &str = "PersonalWord/0.1 (zotero refresh)";

#[derive(Debug, Clone, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ZoteroReadRequest {
    pub resource: String,
    pub since: Option<u64>,
    pub start: Option<u32>,
    pub limit: Option<u32>,
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ZoteroReadResponse {
    pub items: Vec<serde_json::Value>,
    pub version: Option<u64>,
    pub server_id: Option<String>,
    pub next_start: Option<u32>,
    pub total_results: Option<u32>,
    pub not_modified: bool,
}

pub fn validate_zotero_url(url: &str) -> Result<(), String> {
    if !url.starts_with("http://") {
        return Err("Only unencrypted HTTP is supported for Zotero local API".into());
    }
    let rest = &url[7..];
    let slash_idx = rest.find('/').unwrap_or(rest.len());
    let authority = &rest[..slash_idx];
    if authority.contains('@') {
        return Err("Credentials in URL authority are forbidden".into());
    }
    if authority != "127.0.0.1:23119" {
        return Err("Only 127.0.0.1:23119 is permitted for Zotero local API".into());
    }
    let path_and_query = &rest[slash_idx..];
    if !path_and_query.starts_with("/api/") && path_and_query != "/api" {
        return Err("Path must start with /api/".into());
    }
    let path = match path_and_query.find('?') {
        Some(idx) => &path_and_query[..idx],
        None => path_and_query,
    };
    if path.contains("/..")
        || path.ends_with("/..")
        || path.contains("/./")
        || path.ends_with("/.")
        || path.contains('\\')
        || path.to_lowercase().contains("%2e%2e")
    {
        return Err("Path traversal is forbidden".into());
    }
    if path_and_query.chars().any(|c| c.is_whitespace() || c.is_control()) {
        return Err("URL contains whitespace or control characters".into());
    }
    Ok(())
}

pub fn execute_zotero_read(request: ZoteroReadRequest) -> Result<ZoteroReadResponse, String> {
    let mut url = if request.resource.starts_with("http://") {
        request.resource
    } else if request.resource.starts_with("/api/") {
        format!("http://127.0.0.1:23119{}", request.resource)
    } else if request.resource.starts_with("api/") {
        format!("http://127.0.0.1:23119/{}", request.resource)
    } else {
        format!("http://127.0.0.1:23119/api/{}", request.resource.trim_start_matches('/'))
    };

    let mut query_params: Vec<String> = Vec::new();
    if !url.contains("format=") {
        query_params.push("format=csljson".into());
    }
    if let Some(start) = request.start {
        if !url.contains("start=") {
            query_params.push(format!("start={start}"));
        }
    }
    if let Some(limit) = request.limit {
        if !url.contains("limit=") {
            let capped = limit.min(100);
            query_params.push(format!("limit={capped}"));
        }
    }
    if let Some(since) = request.since {
        if !url.contains("since=") {
            query_params.push(format!("since={since}"));
        }
    }

    if !query_params.is_empty() {
        let separator = if url.contains('?') { "&" } else { "?" };
        url.push_str(separator);
        url.push_str(&query_params.join("&"));
    }

    validate_zotero_url(&url)?;

    fetch_zotero(&build_agent(TIMEOUT), &url, request.since)
}

/// The HTTP client used for every Zotero read: no redirects, one overall timeout.
pub fn build_agent(timeout: Duration) -> ureq::Agent {
    ureq::AgentBuilder::new()
        .timeout(timeout)
        .redirects(0)
        .user_agent(USER_AGENT)
        .build()
}

/// Reads at most `max` bytes; a longer body is an error, never a silent truncation.
fn read_capped(reader: impl Read, max: u64) -> Result<Vec<u8>, String> {
    let mut body = Vec::new();
    reader
        .take(max + 1)
        .read_to_end(&mut body)
        .map_err(|e| format!("Failed to read response body: {e}"))?;
    if body.len() as u64 > max {
        return Err("Zotero sent more than 5 MiB in one response, so the refresh was stopped.".into());
    }
    Ok(body)
}

/// GET an already validated URL. Separate from `execute_zotero_read` so tests can
/// point it at an ephemeral loopback port instead of Zotero's 23119.
fn fetch_zotero(
    agent: &ureq::Agent,
    url: &str,
    since: Option<u64>,
) -> Result<ZoteroReadResponse, String> {
    let mut req = agent.get(url).set("Accept", "application/json");
    if let Some(since) = since {
        req = req.set("If-Modified-Since-Version", &since.to_string());
    }

    let response = match req.call() {
        Ok(resp) => resp,
        Err(ureq::Error::Status(code, _)) => {
            return Err(format!("Zotero answered with HTTP {code}"));
        }
        Err(e) => {
            return Err(format!(
                "Could not reach Zotero on 127.0.0.1:23119 ({e}). Make sure Zotero is running."
            ));
        }
    };

    // ureq only turns >= 400 into an error, so 304 and redirects arrive here.
    if response.status() == 304 {
        return Ok(ZoteroReadResponse {
            items: Vec::new(),
            version: since,
            server_id: None,
            next_start: None,
            total_results: None,
            not_modified: true,
        });
    }
    // With redirects(0) any other 3xx is handed back unfollowed: refuse it.
    if response.status() != 200 {
        return Err(format!(
            "Zotero answered with HTTP {} (redirects are not followed)",
            response.status()
        ));
    }

    let version = response
        .header("Last-Modified-Version")
        .and_then(|v| v.parse::<u64>().ok());
    let server_id = response.header("Zotero-Server-ID").map(|s| s.to_string());
    let total_results = response
        .header("Total-Results")
        .and_then(|v| v.parse::<u32>().ok());

    let mut next_start = None;
    if let Some(link_header) = response.header("Link") {
        for link in link_header.split(',') {
            if link.contains("rel=\"next\"") || link.contains("rel=next") {
                if let Some(start_pos) = link.find("start=") {
                    let rest = &link[start_pos + 6..];
                    let end_pos = rest.find(|c: char| !c.is_ascii_digit()).unwrap_or(rest.len());
                    if let Ok(n) = rest[..end_pos].parse::<u32>() {
                        next_start = Some(n);
                    }
                }
            }
        }
    }

    let body = read_capped(response.into_reader(), MAX_BYTES)?;

    let parsed: serde_json::Value = serde_json::from_slice(&body)
        .map_err(|e| format!("Invalid JSON received from Zotero: {e}"))?;

    let items = match parsed {
        serde_json::Value::Array(arr) => arr,
        serde_json::Value::Object(ref obj) => {
            if let Some(serde_json::Value::Array(arr)) = obj.get("items") {
                arr.clone()
            } else {
                vec![parsed]
            }
        }
        _ => Vec::new(),
    };

    Ok(ZoteroReadResponse {
        items,
        version,
        server_id,
        next_start,
        total_results,
        not_modified: false,
    })
}

#[tauri::command]
pub async fn zotero_read(request: ZoteroReadRequest) -> Result<ZoteroReadResponse, String> {
    tauri::async_runtime::spawn_blocking(move || execute_zotero_read(request))
        .await
        .map_err(|e| e.to_string())?
}

#[cfg(test)]
mod tests {
    use super::{
        build_agent, fetch_zotero, read_capped, validate_zotero_url, MAX_BYTES, TIMEOUT,
    };
    use std::io::{BufRead, BufReader, Cursor, Write};
    use std::net::TcpListener;
    use std::sync::atomic::{AtomicUsize, Ordering};
    use std::sync::Arc;
    use std::thread;
    use std::time::{Duration, Instant};

    /// Serves one canned response (built from the server's base URL) to up to
    /// `connections` connections on an ephemeral 127.0.0.1 port (never 23119),
    /// counting the requests it receives.
    fn serve(
        response: impl FnOnce(&str) -> Vec<u8>,
        connections: usize,
    ) -> (String, Arc<AtomicUsize>) {
        let listener = TcpListener::bind("127.0.0.1:0").unwrap();
        let base = format!("http://{}", listener.local_addr().unwrap());
        let response = response(&base);
        let hits = Arc::new(AtomicUsize::new(0));
        let counter = hits.clone();
        thread::spawn(move || {
            for stream in listener.incoming().take(connections) {
                let Ok(mut stream) = stream else { return };
                let mut reader = BufReader::new(stream.try_clone().unwrap());
                let mut line = String::new();
                while reader.read_line(&mut line).map(|n| n > 0).unwrap_or(false) {
                    if line == "\r\n" {
                        break;
                    }
                    line.clear();
                }
                counter.fetch_add(1, Ordering::SeqCst);
                let _ = stream.write_all(&response);
            }
        });
        (base, hits)
    }

    #[test]
    fn rejects_non_loopback_hosts() {
        for url in [
            "http://google.com/api/users/0/items",
            "http://localhost:23119/api/users/0/items",
            "http://192.168.0.1:23119/api/users/0/items",
            "http://[::1]:23119/api/users/0/items",
            "http://127.0.0.2:23119/api/users/0/items",
        ] {
            assert!(validate_zotero_url(url).is_err(), "{url} should be rejected");
        }
    }

    #[test]
    fn rejects_non_http_schemes() {
        for url in [
            "https://127.0.0.1:23119/api/users/0/items",
            "file:///etc/passwd",
            "ftp://127.0.0.1:23119/api/users/0/items",
            "javascript:alert(1)",
        ] {
            assert!(validate_zotero_url(url).is_err(), "{url} should be rejected");
        }
    }

    #[test]
    fn rejects_invalid_ports() {
        for url in [
            "http://127.0.0.1:80/api/users/0/items",
            "http://127.0.0.1:8080/api/users/0/items",
            "http://127.0.0.1:23120/api/users/0/items",
            "http://127.0.0.1/api/users/0/items",
        ] {
            assert!(validate_zotero_url(url).is_err(), "{url} should be rejected");
        }
    }

    #[test]
    fn rejects_credentials_in_authority() {
        for url in [
            "http://admin:secret@127.0.0.1:23119/api/users/0/items",
            "http://user@127.0.0.1:23119/api/users/0/items",
        ] {
            assert!(validate_zotero_url(url).is_err(), "{url} should be rejected");
        }
    }

    #[test]
    fn rejects_path_traversal_and_malformed_chars() {
        for url in [
            "http://127.0.0.1:23119/api/../items",
            "http://127.0.0.1:23119/api/..",
            "http://127.0.0.1:23119/api/%2e%2e/items",
            "http://127.0.0.1:23119/api/users/0/items with spaces",
            "http://127.0.0.1:23119/not-api/items",
        ] {
            assert!(validate_zotero_url(url).is_err(), "{url} should be rejected");
        }
    }

    #[test]
    fn accepts_exact_localhost_zotero_api() {
        for url in [
            "http://127.0.0.1:23119/api/users/0/items",
            "http://127.0.0.1:23119/api/users/0/items?format=csljson",
            "http://127.0.0.1:23119/api/users/0/collections/ABC/items?limit=50",
        ] {
            assert!(validate_zotero_url(url).is_ok(), "{url} should be accepted");
        }
    }

    #[test]
    fn agent_is_configured_with_no_redirects_and_12s_timeout() {
        assert_eq!(TIMEOUT, Duration::from_secs(12));
        assert_eq!(MAX_BYTES, 5 * 1024 * 1024);
        let debug = format!("{:?}", build_agent(TIMEOUT));
        assert!(debug.contains("redirects: 0,"), "{debug}");
        assert!(debug.contains("timeout: Some(12s)"), "{debug}");
    }

    #[test]
    fn reads_a_normal_loopback_response() {
        let body = r#"[{"id":"A","title":"T"}]"#;
        let response = format!(
            "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nLast-Modified-Version: 7\r\nTotal-Results: 3\r\nLink: <http://127.0.0.1:23119/api/users/0/items?start=1>; rel=\"next\"\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{body}",
            body.len()
        );
        let (base, hits) = serve(|_| response.into_bytes(), 1);
        let read = fetch_zotero(&build_agent(TIMEOUT), &format!("{base}/api/users/0/items"), None)
            .expect("plain 200 is read");
        assert_eq!(read.items.len(), 1);
        assert_eq!(read.version, Some(7));
        assert_eq!(read.total_results, Some(3));
        assert_eq!(read.next_start, Some(1));
        assert_eq!(hits.load(Ordering::SeqCst), 1);
    }

    #[test]
    fn reports_not_modified_for_a_304() {
        let (base, _) = serve(
            |_| b"HTTP/1.1 304 Not Modified\r\nContent-Length: 0\r\nConnection: close\r\n\r\n".to_vec(),
            1,
        );
        let read = fetch_zotero(&build_agent(TIMEOUT), &format!("{base}/api/users/0/items"), Some(5))
            .expect("304 is not an error");
        assert!(read.not_modified);
        assert_eq!(read.version, Some(5));
        assert!(read.items.is_empty());
    }

    #[test]
    fn refuses_redirects_without_following_them() {
        // The redirect points back at the same server; a followed redirect
        // would be a second request and would then succeed with a JSON body.
        let (base, hits) = serve(
            |base| {
                format!(
                    "HTTP/1.1 302 Found\r\nLocation: {base}/api/elsewhere\r\nContent-Type: application/json\r\nContent-Length: 2\r\nConnection: close\r\n\r\n[]"
                )
                .into_bytes()
            },
            2,
        );
        let result = fetch_zotero(&build_agent(TIMEOUT), &format!("{base}/api/users/0/items"), None);
        let error = result.expect_err("a 302 must not be accepted");
        assert!(error.contains("HTTP 302"), "{error}");
        thread::sleep(Duration::from_millis(200));
        assert_eq!(hits.load(Ordering::SeqCst), 1, "the redirect was followed");
    }

    #[test]
    fn times_out_when_the_server_never_answers() {
        // Accepts the connection but never writes. The 12 s value itself is
        // asserted by configuration above; here a short timeout proves the
        // same builder enforces it.
        let listener = TcpListener::bind("127.0.0.1:0").unwrap();
        let base = format!("http://{}", listener.local_addr().unwrap());
        thread::spawn(move || {
            let held: Vec<_> = listener.incoming().take(1).collect();
            thread::sleep(Duration::from_secs(5));
            drop(held);
        });
        let started = Instant::now();
        let result = fetch_zotero(
            &build_agent(Duration::from_millis(300)),
            &format!("{base}/api/users/0/items"),
            None,
        );
        assert!(result.is_err(), "a silent server must time out");
        assert!(started.elapsed() < Duration::from_secs(4), "took {:?}", started.elapsed());
    }

    #[test]
    fn size_cap_is_an_error_not_a_truncation() {
        let max = 16;
        assert_eq!(read_capped(Cursor::new(vec![b'x'; 16]), max).unwrap().len(), 16);
        let error = read_capped(Cursor::new(vec![b'x'; 17]), max).expect_err("17 > 16 bytes");
        assert!(error.contains("5 MiB"), "{error}");
    }

    #[test]
    fn refuses_a_loopback_body_over_5_mib() {
        // Valid JSON, so only the cap can make this fail.
        let body = format!("[\"{}\"]", "a".repeat(MAX_BYTES as usize));
        let mut response = format!(
            "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n",
            body.len()
        )
        .into_bytes();
        response.extend_from_slice(body.as_bytes());
        let (base, _) = serve(|_| response, 1);
        let error = fetch_zotero(&build_agent(TIMEOUT), &format!("{base}/api/users/0/items"), None)
            .expect_err("a body over 5 MiB must be refused");
        assert!(error.contains("5 MiB"), "{error}");
    }
}
