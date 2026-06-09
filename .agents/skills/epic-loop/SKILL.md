---
name: epic-loop
description: Use ONLY when the user explicitly asks for `epic loop`, `run epic loop`, or looping ready bd tasks for selected epics; orchestrates sequential workers until selected epics have no ready tasks.
---

# Epic Loop

Use this skill only for explicit epic-loop requests, such as `epic loop`, `run epic loop`, or `loop ready tasks for selected epics`. Do not trigger it for ordinary bd work, one-off issue solving, or general epic planning.

Epic Loop is a primary-agent orchestration workflow. The primary agent displays selectable epics, previews scoped ready work, claims one ready task at a time, dispatches one worker subagent, closes completed tasks, creates linked follow-ups, and repeats until no scoped ready tasks remain or the configured max task count is reached.

This workflow is intentionally sequential. Do not create worker branches, worktrees, merge agents, or commits.

## Fixed Contract

- Scope is selected bd epics plus their recursive parent/children descendants.
- Readiness comes only from `bd ready --json`.
- Task order is exactly the order returned by `bd ready --json` after filtering to selected epic descendants.
- Workers run in the main checkout, one at a time.
- Workers do not commit.
- The primary agent owns all bd mutations.
- The worker agent is `epic-loop-worker`.
- Worker model is pinned in the worker agent file.
- Stop and preserve the working tree on failure or incomplete work.

## Epic Selection

1. Query candidate epics with `bd query "type=epic AND status!=closed AND status!=deferred" --json --limit 0`.
2. Sort epics by priority, then title, then id.
3. If no epics are returned, stop cleanly and report that there are no open non-deferred epics.
4. If more than 20 epics are returned, do not run the loop. Report the count and the first 20 sorted epics so the user can narrow the request.
5. Display the candidate epics through the OpenCode question UI with multi-select enabled.
6. Each option should include the epic id, title, priority, status, and current ready descendant count when computable.

Open epics means any epic whose status is not `closed` or `deferred`.

## Scope Computation

For each selected epic:

1. Add the epic id to the selected epic set.
2. Build a recursive descendant closure using bd parent/children membership. Prefer `bd children <id> --json` for each frontier id.
3. Exclude descendant issues whose type is `epic` unless that epic was explicitly selected.
4. De-duplicate descendant ids across all selected epics.

The scoped ready set for each loop iteration is:

```text
ids returned by bd ready --json intersected with recursive selected-epic descendants
```

Do not traverse blocker/dependency edges from `bd dep` for epic membership. bd dependency edges affect readiness through `bd ready`; they do not define epic scope.

## Run Options And Preview

After epic selection:

1. Ask for the max task count for this run. Use `25` when the user accepts the default or gives an invalid/non-positive value.
2. Refresh scope and `bd ready --json`.
3. Show a preview containing selected epics, current scoped ready tasks in bd ready order, max task count, and the no-commit behavior.
4. Ask for confirmation before mutating files or bd.

If the user does not confirm, stop without mutation.

## Preflight For Real Runs

Before claiming any issue or launching any worker:

- Confirm required tools are available: `bd` and `git`.
- Confirm the checkout is clean with `git status --porcelain --untracked-files=all`.
- Stop before mutation if the checkout is dirty.

Cleanliness is required only at run start. Completed tasks intentionally leave uncommitted working-tree changes.

## Sequential Loop

Repeat until the max task count is reached or no scoped ready tasks remain:

1. Refresh selected epic descendant closure.
2. Refresh `bd ready --json`.
3. Filter ready issues to scoped descendant ids.
4. Stop cleanly if no scoped ready tasks remain.
5. Select the first scoped ready task in bd ready order.
6. Capture `git status --porcelain --untracked-files=all` before dispatch.
7. Claim the task with `bd update <id> --claim --json`.
8. Launch the `epic-loop-worker` subagent with the assigned issue id, issue JSON, selected epic ids, current descendant scope summary, before-status snapshot, and intended log path.
9. Treat the worker as complete only if its final output satisfies the strict completion contract.
10. Capture `git status --porcelain --untracked-files=all` after dispatch.
11. Write a per-task markdown log under `.epic-loop/logs/`.
12. If complete, close the assigned issue with `bd close <id> --reason "Completed by epic-loop" --json`.
13. If complete and the worker reported structured follow-ups, create linked bd issues from those follow-ups after closing the parent task.
14. Continue to the next iteration.

Newly created follow-up issues are eligible in the same run if they become ready and are within the selected epic descendant closure.

## Worker Dispatch Contract

Use the `epic-loop-worker` subagent for each assigned task. Pass this contract in the task prompt:

- Work in the main checkout only.
- Work only on the assigned bd issue id and issue JSON.
- Do not select other ready work.
- Do not mutate bd.
- Do not create, delete, switch, merge, or rebase git branches.
- Do not create or delete worktrees.
- Do not commit.
- Do not push.
- Make the smallest correct implementation for the assigned issue.
- Run task-relevant verification before reporting completion.
- Report follow-up work in a structured `Follow-ups:` section.
- End with `<promise>ISSUE COMPLETE</promise>` only when the assigned issue is complete, relevant verification has passed, and no known work remains.
- End with `<promise>ISSUE INCOMPLETE</promise>` when work remains, verification fails, verification is blocked, or completion is uncertain.

## Strict Completion Contract

The primary may close an issue only when the worker final output contains all of:

- `<promise>ISSUE COMPLETE</promise>`.
- A concise summary of changes.
- The verification command or commands run and their result.
- An explicit statement that no known work remains for the assigned issue.

Treat all of these as incomplete:

- `<promise>ISSUE INCOMPLETE</promise>`.
- Missing promise marker.
- Missing verification result.
- Missing no-known-work-remains statement.
- Failed or blocked verification.
- Worker tool failure or interrupted output.

## Failure Policy

On incomplete work, failed worker execution, failed or blocked verification, missing strict completion details, or any uncertainty:

1. Stop the full loop immediately.
2. Append a concise note to the assigned issue with `bd update <id> --append-notes "Epic Loop worker incomplete: <one-line reason>. Log: <path>" --json`.
3. Write the per-task log.
4. Leave the working tree exactly as-is for inspection.
5. Do not close the assigned issue.
6. Do not continue to another task.

Do not attempt automatic rollback. No-commit mode has no safe per-task rollback boundary.

## Follow-ups

Workers may report follow-ups in this shape:

```text
Follow-ups:
- Title: <short title>
  Type: bug|feature|task|chore
  Priority: 0|1|2|3|4
  Description: <specific context>
```

After the parent task is verified complete and closed, the primary creates each follow-up with `bd create ... --json` and links it to the completed parent with a discovered-from dependency when supported by the local bd command shape.

If follow-up creation fails, report the failure in the log and final response, then stop and preserve the working tree. Do not silently drop follow-ups.

## Epic Closure

At the end of a successful run, attempt to auto-close eligible selected epics. Because `bd epic close-eligible` does not accept explicit epic ids, first run `bd epic close-eligible --dry-run --json`.

- If the dry-run would close only selected epics, run `bd epic close-eligible --json`.
- If the dry-run would close any unselected epic, do not run it. Report selected epics that appear eligible and the unselected epics that prevented safe auto-close.
- If no selected epics are eligible, report that none were auto-closed.

If epic auto-closure fails or is skipped for safety, report it and leave completed child task closures intact.

## Logs

Write markdown logs under `.epic-loop/logs/`.

Per-task logs should include:

- Run timestamp.
- Selected epic ids.
- Issue id, title, type, priority, and status.
- Before and after git status snapshots.
- Worker promise marker observed.
- Worker summary.
- Verification command and result reported by the worker.
- Follow-ups reported and created.
- bd mutations performed by the primary.
- Final task status.

The final run summary should include:

- Selected epics.
- Max task count.
- Tasks claimed and closed.
- Follow-ups created.
- Epics auto-closed or auto-close failures.
- Stop reason.
- Log files written.
- Final `git status --porcelain --untracked-files=all`.

## Final Report

Report:

- Selected epics.
- Number of tasks processed and max task count.
- Issues claimed and closed.
- Follow-up issues created.
- Epics auto-closed.
- Stop reason.
- Log paths.
- Final working-tree status.
- Explicitly state that no commits, branches, worktrees, merges, or pushes were performed.
