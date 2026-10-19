//! Citation lookup: fetches a web page's HTML for the research panel's metadata reader.
//! The webview cannot fetch arbitrary sites (CORS), so the request runs here, limited to http(s).

use std::io::Read;
use std::time::Duration;

const TIMEOUT: Duration = Duration::from_secs(12);
const MAX_REDIRECTS: u32 = 5;
const MAX_BYTES: u64 = 3 * 1024 * 1024;
const USER_AGENT: &str = "PersonalWord/0.1 (citation lookup)";
const ACCEPT: &str = "text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.5";

fn check_url(url: &str) -> Result<(), String> {
    let rest = if url
        .get(..8)
        .is_some_and(|prefix| prefix.eq_ignore_ascii_case("https://"))
    {
        &url[8..]
    } else if url
        .get(..7)
        .is_some_and(|prefix| prefix.eq_ignore_ascii_case("http://"))
    {
        &url[7..]
    } else {
        return Err("Only http and https addresses can be looked up".into());
    };
    if rest.is_empty() || rest.chars().any(|c| c.is_whitespace() || c.is_control()) {
        return Err("That web address isn't valid".into());
    }
    Ok(())
}

fn fetch(url: &str) -> Result<String, String> {
    let agent = ureq::AgentBuilder::new()
        .timeout(TIMEOUT)
        .redirects(MAX_REDIRECTS)
        .user_agent(USER_AGENT)
        .build();
    let response = match agent.get(url).set("Accept", ACCEPT).call() {
        Ok(response) => response,
        Err(ureq::Error::Status(code, _)) => {
            return Err(format!("The site answered with HTTP {code}"))
        }
        Err(_) => {
            return Err(
                "Couldn't reach that address. Check the web address and your connection.".into(),
            )
        }
    };
    let mut body = Vec::new();
    response
        .into_reader()
        .take(MAX_BYTES)
        .read_to_end(&mut body)
        .map_err(|_| "The page could not be read".to_string())?;
    Ok(String::from_utf8_lossy(&body).into_owned())
}

#[tauri::command]
pub async fn lookup_fetch(url: String) -> Result<String, String> {
    check_url(&url)?;
    tauri::async_runtime::spawn_blocking(move || fetch(&url))
        .await
        .map_err(|e| e.to_string())?
}

#[cfg(test)]
mod tests {
    use super::check_url;

    #[test]
    fn rejects_non_web_schemes_without_network() {
        for url in [
            "file:///etc/passwd",
            "javascript:x",
            "ftp://example.com",
            "data:text/html,hi",
            "http://",
            "https://exa mple.com",
        ] {
            assert!(check_url(url).is_err(), "{url} should be rejected");
        }
    }

    #[test]
    fn accepts_http_and_https() {
        assert!(check_url("https://api.crossref.org/works/10.1/x").is_ok());
        assert!(check_url("HTTP://example.com/page").is_ok());
    }

    #[test]
    fn rejects_malformed_unicode_after_partial_http_schemes_without_panicking() {
        for url in ["https:/é", "http:/é"] {
            assert!(check_url(url).is_err(), "{url} should be rejected");
        }
    }

    #[test]
    fn accepts_mixed_case_https_with_unicode_host_and_path() {
        assert!(check_url("HtTpS://例え.テスト/章/é").is_ok());
    }
}
