#!/bin/sh
# Builds a 100,000-word project (100 sections x 1,000 words) and reports
# per-keystroke and per-save cost on both sides of the IPC boundary.
set -e
cd "$(dirname "$0")/.."
echo "== Frontend: keystroke (mutate + journal + sidebar) and save (diff + IPC JSON)"
npx vitest bench --run src/save.bench.ts
echo "== Rust: per-save SQLite commit, background mirror pass, full read (release build)"
cargo test --release --manifest-path src-tauri/Cargo.toml bench_save -- --ignored --nocapture 2>&1 | grep BENCH
