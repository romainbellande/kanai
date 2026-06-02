---
description: Solve a GitHub issue on a dedicated branch and open a PR
agent: build
---

Solve the GitHub issue URL passed as `$1`.

Workflow:

1. Validate that `$1` is a GitHub issue URL. If missing or invalid, stop and ask for a valid issue URL.
2. Load the `github` skill when available.
3. Inspect the issue with `gh issue view` and extract the issue number.
4. Check the current branch and worktree state once. Preserve unrelated changes.
5. Create a dedicated branch before code changes. Use a concise name that includes the issue number.
6. Inspect repository instructions and relevant code before editing.
7. Implement the smallest correct fix.
8. Run verification commands relevant to changed files.
9. Commit only intended files. Use a Conventional Commit message and include the issue reference as a footer:

```text
Refs: #123
```

10. Push the branch and open a PR against `main`.

Final response:

- Issue number
- Branch
- Commit SHA
- PR URL
- Verification commands and outcomes
