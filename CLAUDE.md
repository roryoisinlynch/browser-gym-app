# Claude Code Instructions

## Workflow

After completing any code changes, always:

1. Stage the relevant files with `git add`
2. Draft a commit message that summarises the changes
3. Run `git commit` with that message
4. Run `git push`
5. Poll the GitHub Actions API until the deploy completes, then report the outcome

To poll the deploy status, fetch the latest run after pushing and check until `status` is `completed`:

```bash
curl -s "https://api.github.com/repos/roryoisinlynch/browser-gym-app/actions/runs?per_page=1" \
  | python3 -c "import sys,json; r=json.load(sys.stdin)['workflow_runs'][0]; print(r['status'], r['conclusion'])"
```

Poll every 15 seconds. Report success when `conclusion` is `success`, or flag the run URL if it fails.
