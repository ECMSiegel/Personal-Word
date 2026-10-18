# Security policy

Personal Word is early software and is not yet a signed or notarized macOS distribution. This repository does not publish a dedicated security contact or a response-time commitment.

## Reporting a vulnerability

If this repository is hosted on GitHub and private vulnerability reporting is enabled, use the repository's **Security → Report a vulnerability** flow. Otherwise, use a private reporting channel that the maintainers have explicitly published. If no private channel is available, do not post exploit details, affected user data, credentials, or a working proof of concept in a public issue; ask through an established maintainer contact for a private route first.

Please include the affected version or source revision, macOS version, reproduction steps, expected and actual behavior, and potential impact. Use synthetic project data. Do not attach a real Personal Word project folder, database, journal, or manuscript. There is no promised response or remediation timeline at this stage.

## Scope notes

Personal Word stores projects locally. Citation lookup is opt-in: when a user requests a lookup, the typed DOI, ISBN, or web address is sent to the selected external source as described in [the architecture](docs/architecture.md). The browser development preview uses separate browser storage and is not the native SQLite backend. Findings should identify which environment and storage path were involved.
