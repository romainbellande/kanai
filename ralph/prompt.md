# ISSUES

Use `bd` as the source of truth for issues. Query dependency-aware ready work with:

```bash
bd ready --json --label afk --exclude-label hitl
```

You will work on the AFK issues only, not the HITL ones.

You've also been passed a file containing the last few commits. Review these to understand what work has been done.

If `bd ready` returns no AFK issues, check whether any AFK issues remain open or blocked:

```bash
bd list --json --status open,in_progress,blocked --label afk --exclude-label hitl
```

If no AFK issues remain, output <promise>NO MORE TASKS</promise>.

If AFK issues remain but none are ready, output <promise>NO READY TASKS</promise> and include the blocked issue IDs and blockers.

# TASK SELECTION

Pick the next ready AFK task. Prioritize tasks in this order:

1. Critical bugfixes
2. Development infrastructure

Getting development infrastructure like tests and types and dev scripts ready is an important precursor to building features.

3. Tracer bullets for new features

Tracer bullets are small slices of functionality that go through all layers of the system, allowing you to test and validate your approach early. This helps in identifying potential issues and ensures that the overall architecture is sound before investing significant time in development.

TL;DR - build a tiny, end-to-end slice of the feature first, then expand it out.

4. Polish and quick wins
5. Refactors

Claim the selected issue before implementation:

```bash
bd update <issue-id> --claim --json
```

If claiming fails because another worker claimed it, return to `bd ready --json --label afk --exclude-label hitl` and pick another issue.

# EXPLORATION

Explore the repo.

# IMPLEMENTATION

Use /tdd to complete the task.

# FEEDBACK LOOPS

Before committing, run the feedback loops:

- `just pre-commit` to run pre-commit scripts
- check lefthook.yml to run some scripts independently if needed

# COMMIT

Make a git commit. The commit message must:

1. Include key decisions made
2. Include files changed
3. Blockers or notes for next iteration

# THE ISSUE

If the task is complete, close the issue:

```bash
bd close <issue-id> --reason "Completed: <short summary>" --json
```

If the task is not complete, append notes with what was done, what remains, and any blocker:

```bash
bd update <issue-id> --append-notes "<progress note>" --json
```

If new follow-up work is discovered, create a linked `bd` issue instead of a markdown TODO:

```bash
bd create "<follow-up title>" --description "<context>" --type task --priority 2 --deps discovered-from:<issue-id> --json
```

# FINAL RULES

ONLY WORK ON A SINGLE TASK.
