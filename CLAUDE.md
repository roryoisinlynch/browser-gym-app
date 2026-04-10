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

## Backup format compatibility

User backups are exported as JSON from `src/pages/BackupPage.tsx` and restored by a blind `store.put()` with no validation or migration. This means breaking changes to `src/domain/models.ts` can silently corrupt a restore — old backup files won't have new required fields, and renamed or removed fields will be written back as stale data.

When making a breaking change to the data model (renaming or removing a field, changing a record's key structure, adding a field that the app requires to be present), you must:

1. Bump `BACKUP_VERSION` in `src/pages/BackupPage.tsx`.
2. Add a migration or rejection step to `handleRestore` that either transforms old backup data to the new shape or rejects backups below the new version with a clear error message.

Non-breaking additions (new optional fields with sensible `undefined`/`null` fallbacks in the app) do not require a version bump.
