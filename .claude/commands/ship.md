Build the app, run tests, then commit and push all changes to GitHub. If anything fails, diagnose and fix the issue before retrying.

## Steps

### 1. Build

Run:
```
npm run build
```

If the build fails:
- Read the error output carefully
- Fix TypeScript errors, missing imports, or broken syntax in the relevant files
- Re-run the build until it passes
- Do not proceed to tests while the build is red

### 2. Test

Run:
```
npm test
```

If tests fail:
- Read each failing test and the error message
- Fix the production code (or the test if the test itself is wrong)
- Re-run until all tests pass
- Do not proceed to commit while tests are red

### 3. Commit

- Run `git status` and `git diff` to see what changed
- Stage only the files relevant to the work (never `git add -A` blindly — check for accidental files like `.env`)
- Write a concise commit message focused on *why*, not *what*
- Always append the co-author trailer:
  ```
  Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
  ```
- Use a HEREDOC to pass the message:
  ```bash
  git commit -m "$(cat <<'EOF'
  <message here>

  Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
  EOF
  )"
  ```

If the commit is rejected by a pre-commit hook:
- Read the hook output
- Fix the underlying issue (lint errors, formatting, etc.)
- Create a **new** commit — never amend after a hook failure

### 4. Push

Run:
```
git push
```

If the push fails because the remote is ahead:
- Run `git pull --rebase`
- Resolve any conflicts
- Push again

If the push is rejected for any other reason, report the error to the user and stop — do not force-push.

## Done

Report: what was committed (one-line summary), the commit hash, and that it was pushed successfully.
