# Claude Code Instructions

## Workflow

After completing any code changes, always:

1. Stage the relevant files with `git add`
2. Draft a commit message that summarises the changes
3. Run `git commit` with that message
4. Run `git push`
5. Poll the GitHub Actions API until the deploy completes, then report the outcome

Skip the deploy check entirely if the only changed files are `*.md`. Those changes do not affect the build.

Otherwise, wait 15 seconds after pushing before sending the first poll request (the workflow will not have started yet at push time). Then poll every 15 seconds:

```bash
curl -s "https://api.github.com/repos/roryoisinlynch/browser-gym-app/actions/runs?per_page=1" \
  | python3 -c "import sys,json; r=json.load(sys.stdin)['workflow_runs'][0]; print(r['status'], r['conclusion'])"
```

Use a hard cap of 20 attempts (~5 minutes). A normal deploy completes in ~4 requests; the cap only applies if the deploy hangs. The unauthenticated rate limit is 60 requests/hour — if the cap is hit on multiple consecutive deploys, pause and flag the situation rather than continuing to poll. If the cap is reached without a `completed` status, report the run URL and stop — do not keep polling.
