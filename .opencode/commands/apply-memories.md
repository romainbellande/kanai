---
description: Apply vault memories to agent docs or skills, then archive them
agent: build
---

Apply pending memories from the project Obsidian vault to agent-facing instructions.

Inputs:

- Active memories live under `.vault/memories/**/*.md`.
- Processed memories live under `.vault/archives/**`; do not process them again.
- `.opencode/plugin/memory-template.md` defines the memory fields.

Workflow:

1. Find active memory notes. If none exist, say so and stop.
2. Read all active notes and identify durable instructions worth promoting.
3. Use the `agents-md` skill before editing `AGENTS.md` files when available.
4. Use the `customize-opencode` skill before editing opencode agent skills or config when available.
5. Update existing `AGENTS.md` files only for broad, stable, high-signal repository instructions.
6. Update or create agent skills under `.agents/skills/<name>/SKILL.md` or `.opencode/skills/<name>/SKILL.md` only for conditional workflow/tooling lessons.
7. Prefer updating existing skills over creating new skills.
8. Preserve unrelated worktree changes.
9. Run relevant lightweight validation for touched files when feasible.
10. After successful updates, archive every reviewed note under `.vault/archives/`, including duplicates or notes intentionally skipped as not actionable. Prefer the `memory_archive` tool if available; otherwise move the files directly.
11. Do not archive notes only when blocked by ambiguity, missing clarification, or a failed update.

Constraints:

- Do not promote secrets, credentials, temporary debugging output, command logs, or one-off context.
- Do not duplicate existing instructions.
- Keep `AGENTS.md` files concise and high-signal.
- Ask one short clarification only if promoting a memory could surprise the user.

Final response:

- List promoted memories.
- List changed files.
- List archived memory notes.
- List deferred notes and why.
