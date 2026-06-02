---
description: Review recent opencode sessions and promote workflow lessons
agent: build
---

Review recent opencode interactions from the last `$1` hours. If `$1` is empty, use 24 hours.

Purpose:

- Find recurring problems, inefficient tool use, user corrections, failed commands, and agent workflow gaps.
- Convert durable lessons directly into `AGENTS.md` files, instruction docs, or skills.
- This command replaces the old Kanai written-memory promotion workflow.

Workflow:

1. Query `~/.local/share/opencode/opencode.db` directly with `sqlite3`; do not broad-glob `/home`.
2. Summarize recent sessions, user prompts, failed tool calls, repeated bash commands, and high-volume tool usage.
3. Inspect current repository instructions and skills before editing.
4. Update or create concise `AGENTS.md` files only for broad, stable repo instructions.
5. Update or create skills under `.agents/skills/<name>/SKILL.md` for conditional workflow/tooling lessons.
6. Update global opencode commands under `~/.config/opencode/commands/` only for cross-repository workflow improvements.
7. Do not store secrets, temporary command output, or one-off debugging context.
8. Run lightweight validation for touched Markdown/config files when feasible.

Preferred SQLite probes:

```bash
sqlite3 -header -column "$HOME/.local/share/opencode/opencode.db" \
  "select id, datetime(time_created/1000,'unixepoch','localtime') created, datetime(time_updated/1000,'unixepoch','localtime') updated, directory, title, agent, tokens_input, tokens_output from session where time_updated >= (strftime('%s','now','-24 hours')*1000) order by time_updated desc;"

sqlite3 -header -column "$HOME/.local/share/opencode/opencode.db" \
  "select json_extract(data,'$.tool') tool, count(*) count from part where time_created >= (strftime('%s','now','-24 hours')*1000) and json_extract(data,'$.type')='tool' group by tool order by count desc;"

sqlite3 -header -column "$HOME/.local/share/opencode/opencode.db" \
  "select substr(json_extract(data,'$.state.input.command'),1,160) command, count(*) count from part where time_created >= (strftime('%s','now','-24 hours')*1000) and json_extract(data,'$.type')='tool' and json_extract(data,'$.tool')='bash' group by command order by count desc limit 40;"
```

Final response:

- Problems found
- Instructions or skills changed
- Global commands changed
- Residual risks or follow-ups
