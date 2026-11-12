#!/bin/bash
cd "/Users/ethansiegel/Local Projects/VC Projects/Project 13 - Word Processor"
export PATH="$PWD/node_modules/.cache/personal-word-alpha-review/tools/node-v22.23.3-darwin-x64/bin:$PATH"
N=docs/agent-work/2026-11-11-owner-fixes/notes
(npx tsc -b && npm run build) > $N/VAL-build.log 2>&1; echo "build exit $?" >> $N/VAL-build.log
npm test > $N/VAL-unit.log 2>&1; echo "unit exit $?" >> $N/VAL-unit.log
(cd src-tauri && cargo test) > $N/VAL-cargo.log 2>&1; echo "cargo exit $?" >> $N/VAL-cargo.log
PLAYWRIGHT_PREVIEW=1 PLAYWRIGHT_PORT=1420 npm run test:e2e -- --trace off --output test-results/OF-final > $N/VAL-e2e.log 2>&1; echo "e2e exit $?" >> $N/VAL-e2e.log
echo ALLDONE > $N/VAL-done.flag
