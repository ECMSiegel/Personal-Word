#!/bin/bash
cd "/Users/ethansiegel/Local Projects/VC Projects/Project 13 - Word Processor"
export PATH="$PWD/node_modules/.cache/personal-word-alpha-review/tools/node-v22.23.3-darwin-x64/bin:$PATH"
L=node_modules/.cache/personal-word-beta/serial-check.lock
for s in layout-invariants popover-bounds sb-page-header hs8-page-numbers; do
until mkdir $L 2>/dev/null; do sleep 20; done
echo "page-header worker" > $L/owner.txt
PLAYWRIGHT_PORT=1441 npx playwright test tests/$s.spec.ts --trace off --output test-results/sb-page-header > test-results/sb-page-header-logs/$s.log 2>&1
echo "EXIT $?" >> test-results/sb-page-header-logs/$s.log
rm -rf $L
done
echo done > test-results/sb-page-header-logs/ALLDONE
