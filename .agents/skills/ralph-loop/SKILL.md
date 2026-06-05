---
name: ralph-loop
description: Use ONLY when the user explicitly asks for Ralph, AFK, Ralph AFK, or unattended issue-solving loops; orchestrates bd ready issues through isolated worker worktrees and merge integration.
---

# Ralph Loop

Use this skill only for explicit Ralph or AFK requests, such as "run Ralph", "Ralph AFK", "AFK loop", or "let Ralph work on ready issues". Do not trigger it for ordinary issue work, background cleanup, or general automation requests.

Ralph is a primary-agent orchestration loop. The primary agent performs planning, dry-run previews, bd claims, branch/worktree setup, worker dispatch, merge dispatch, notes, and cleanup. Workers implement one assigned issue inside one assigned worktree. The merge agent integrates completed worker branches into the main checkout.

Do not push. Do not add slash commands or plugins for this workflow.

## Modes

- Dry-run mode previews the exact eligible issues, parallelism, computed iteration count, waves, branch names, and worktree paths without mutating bd, git branches, worktrees, or files.
- Real-run mode may mutate bd and git only after the main checkout is clean and on `main`.
- If the user does not clearly request a real run, ask one short question or perform a dry-run preview.

## Inputs

- Parallelism comes from `RALPH_PARALLELISM` when it is a positive integer; otherwise use `4`.
- Ready issues come from `bd ready --json` in returned order.
- Eligible issues exclude any ready issue whose local branch `ralph/<safe-id>` already exists or whose worktree path `.worktrees/<safe-id>` already exists.
- A safe id is the issue id with every character outside `A-Za-z0-9._-` replaced by `-`.
- Iterations are `ceil(eligible_ready_count / parallelism * 1.3)`, with a minimum of `1`.

## Preflight

For dry-run:

- Read `bd ready --json`.
- Inspect local branches and `.worktrees/` paths only enough to compute eligibility.
- Print the dry-run plan and stop.

For real runs, before claiming anything:

- Confirm the checkout is on `main`.
- Confirm `git status --porcelain --untracked-files=all` is empty.
- Confirm required tools are available: `bd`, `git`, and `opencode`.
- Compute parallelism, eligible ready count, and iterations.
- Stop before mutation if any preflight check fails.

## Wave Loop

Run up to the computed iteration count:

1. Refresh `bd ready --json`.
2. Filter out ineligible issues with existing `ralph/<safe-id>` branches or `.worktrees/<safe-id>` paths.
3. Select the next wave in bd ready order, up to parallelism.
4. Stop cleanly if no eligible ready issues remain.
5. Claim selected issues wave-by-wave with `bd update <id> --claim --json`.
6. For each successful claim, create branch `ralph/<safe-id>` and worktree `.worktrees/<safe-id>` from the current main `HEAD` before launching any worker.
7. Launch one `ralph-worker` subagent per assignment, passing issue id, issue JSON, branch, worktree, base commit, and the log path.
8. Write a markdown worker summary under `.ralph/logs/<safe-id>.md` for each assignment.
9. If a worker is failed, incomplete, missing its promise marker, or has no commit, append concise notes with `bd update <id> --append-notes "Ralph worker <status>: <one-line reason>. Branch: ralph/<safe-id>. Worktree: .worktrees/<safe-id>. Log: .ralph/logs/<safe-id>.md" --json`.
10. Stop the full loop if the wave has zero completed workers.
11. Launch `ralph-merge` for completed workers only.
12. Write a markdown merge summary under `.ralph/logs/merge-<short-main-head>.md`.
13. Continue after a partial merge only if the main checkout is clean.
14. Clean only successfully integrated worker worktrees and local branches.

Workers are complete only when both are true:

- The worker branch has at least one commit beyond its base commit.
- The worker final output contains `<promise>ISSUE COMPLETE</promise>`.

Treat `<promise>ISSUE INCOMPLETE</promise>`, missing promise markers, failed workers, skipped workers, and no-commit workers as not completed.

## Worker Dispatch

Use the `ralph-worker` subagent for each assigned issue. Workers inherit the default model.

Pass this contract in the task prompt:

- Work only inside the assigned worktree path.
- Work only on the assigned issue id and issue JSON.
- Do not mutate bd.
- Do not create, delete, merge, or clean branches/worktrees.
- Do not push.
- Make the smallest correct implementation.
- Run task-relevant verification before committing.
- Commit completed work on the assigned branch.
- Report follow-up work in a `Follow-ups:` section instead of creating issues.
- End with `<promise>ISSUE COMPLETE</promise>` only when the issue is complete and committed.
- End with `<promise>ISSUE INCOMPLETE</promise>` when work remains or verification is blocked.

## Merge Dispatch

Use the `ralph-merge` subagent after a wave has at least one completed worker. The merge agent uses `openai/gpt-5.5`.

Pass this contract in the task prompt:

- Work only in the main checkout.
- Integrate only completed workers.
- Merge one branch at a time using `git merge --no-ff`.
- After each merge, verify the integrated checkout, preferring `just pre-commit` when available.
- Create linked follow-up bd issues after successful parent integration when worker output includes follow-ups.
- Close the parent issue only after its branch is merged and verification passes.
- Do not push.
- Preserve unmerged or failed branches, worktrees, and logs.
- Clean only successfully integrated worker worktrees and branches.
- Continue after partial merge only if the main checkout is clean.
- End with `<promise>MERGE COMPLETE</promise>`, `<promise>MERGE PARTIAL</promise>`, or `<promise>MERGE FAILED</promise>`.

## Markdown Logs

Keep runtime logs under `.ralph/logs/` as markdown summaries, not JSONL.

Worker summaries should include:

- Issue id, branch, worktree, base commit, head commit, and status.
- Promise marker observed.
- Verification run and result.
- Commit hash or no-commit reason.
- Concise failure or blocker notes.
- Follow-ups reported by the worker.

Merge summaries should include:

- Main base commit and final commit.
- Completed worker candidates.
- Merge result per issue.
- Verification command and result per merge.
- Follow-up issues created.
- Issues closed.
- Cleaned branches/worktrees.
- Preserved branches/worktrees and reasons.

## Safety Rules

- Real run requires clean `main` before the first claim.
- Primary orchestrator creates branches and worktrees before worker launch.
- Workers never mutate bd.
- Workers never merge, clean, or push.
- Merge never pushes.
- Merge closes issues only after successful merge and verification.
- Merge creates follow-up bd issues only after the parent branch is integrated.
- Failed or incomplete claimed workers receive concise `bd update --append-notes` notes.
- Stop if a wave has zero completed workers.
- Do not clean failed, incomplete, unmerged, skipped, no-commit, or missing-marker worker artifacts.

## Final Report

Report:

- Mode, parallelism, eligible count, and iteration count.
- Issues claimed and their worker status.
- Issues merged and closed.
- Follow-up issues created.
- Preserved branches/worktrees and why.
- Log files written under `.ralph/logs/`.
- Explicitly state that no push was performed.
