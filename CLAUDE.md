# Claude Code Instructions

## Workflow

After completing any code changes, run the entire build → commit → push sequence as a **single chained bash command** so it only requires one approval. Use `&&` throughout so the chain aborts on any failure (a broken build will never commit, a failed commit will never push).

Skip the build entirely if the only changed files are `*.md` files with no code changes whatsoever. Any commit that touches source code — even a one-line string change — must go through the full build sequence.

Template (non-MD changes):

```bash
npm run build 2>&1 | tail -8 && \
git add <files> && \
git commit -m "$(cat <<'EOF'
<message>

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)" && \
git push
```

Template (MD-only changes):

```bash
git add <files> && git commit -m "$(cat <<'EOF'
<message>

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)" && git push
```
