cd "/Users/ethansiegel/Local Projects/VC Projects/Project 13 - Word Processor"
export PATH="$PWD/node_modules/.cache/personal-word-alpha-review/tools/node-v22.23.3-darwin-x64/bin:$PATH"
L=node_modules/.cache/personal-word-beta/serial-check.lock
until mkdir $L 2>/dev/null; do sleep 20; done; echo "agent-6794 T286" > $L/owner.txt
PLAYWRIGHT_PORT=1453 npx playwright test tests/of3-rulers.spec.ts --output test-results/T286 > docs/agent-work/2026-11-11-owner-fixes/notes/OF3-fail-first.txt 2>&1
rm $L/owner.txt; rmdir $L
echo DONE >> docs/agent-work/2026-11-11-owner-fixes/notes/OF3-fail-first.txt
