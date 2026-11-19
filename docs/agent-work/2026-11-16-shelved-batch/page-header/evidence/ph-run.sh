#!/bin/bash
# usage: ph-run.sh spec logfile
cd "/Users/ethansiegel/Local Projects/VC Projects/Project 13 - Word Processor"
export PATH="$PWD/node_modules/.cache/personal-word-alpha-review/tools/node-v22.23.3-darwin-x64/bin:$PATH"
L=node_modules/.cache/personal-word-beta/serial-check.lock
until mkdir $L 2>/dev/null; do sleep 20; done
echo "page-header worker" > $L/owner.txt
PLAYWRIGHT_PORT=1441 npx playwright test "$1" --trace off --output test-results/sb-page-header > "$2" 2>&1
echo "EXIT $?" >> "$2"
rm -rf $L
