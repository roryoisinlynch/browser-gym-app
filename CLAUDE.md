# Claude Code Instructions

## Workflow

After completing any code changes, run the entire build → commit → push → poll sequence as a **single chained bash command** so it only requires one approval. Use `&&` throughout so the chain aborts on any failure (a broken build will never commit, a failed commit will never push).

Skip the deploy check entirely if the only changed files are `*.md` files with no code changes whatsoever. Any commit that touches source code — even a one-line string change — must go through the full build and poll sequence.

Template (non-MD changes):

```bash
npm run build 2>&1 | tail -8 && \
git add <files> && \
git commit -m "$(cat <<'EOF'
<message>

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)" && \
git push && \
sleep 15 && \
for i in $(seq 1 20); do
  result=$(curl -s "https://api.github.com/repos/roryoisinlynch/browser-gym-app/actions/runs?per_page=1" \
    | python3 -c "import sys,json; r=json.load(sys.stdin)['workflow_runs'][0]; print(r['status'], r['conclusion'], r['html_url'])")
  status=$(echo $result | cut -d' ' -f1)
  if [ "$status" = "completed" ]; then echo "Deploy complete: $result"; break; fi
  if [ "$i" = "20" ]; then echo "Poll cap reached: $result"; fi
  sleep 15
done
```

Template (MD-only changes):

```bash
git add <files> && git commit -m "$(cat <<'EOF'
<message>

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)" && git push
```

Poll notes: wait 15s before the first request; cap at 20 attempts (~5 minutes, at most 20 API requests). The unauthenticated rate limit is 60 requests/hour — if the cap is hit on multiple consecutive deploys, pause and flag rather than continuing to poll.
