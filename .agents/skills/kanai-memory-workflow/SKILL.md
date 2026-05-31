---
name: kanai-memory-workflow
description: Use when maintaining Kanai opencode memories, the memory plugin, or the memories-to-skills archival command.
---

# Kanai Memory Workflow

Use this skill when the user asks about project memories, `.opencode/plugins/memory.ts`, `.opencode/commands/memories-to-skills.md`, or converting memory notes into skills.

## Memory Storage

- Persistent project memories are stored as Obsidian notes under `.vault/memories/`.
- Use the `obsidian` skill and Obsidian MCP tools for reading, writing, and moving memory notes; do not inspect or modify memory notes through shell or direct filesystem writes.
- New memory notes use timestamped paths like `memories/2026-05-31T07-26-52-878Z.md` with frontmatter containing `type: memory`, `project: "kanai"`, `source: opencode`, and tags `memory` and `opencode`.
- Memory backlinks should only point to previous memories with a clear shared subject, such as the same subsystem, workflow, tool, convention, or recurring problem. Use `- None yet` when no prior memory shares a subject.

## Memory Plugin

- `.opencode/plugins/memory.ts` injects persistent-memory instructions into the system prompt.
- The plugin detects the project Obsidian MCP server named `obsidian`; if unavailable, agents should not write memories and should report that limitation.
- The plugin uses a `chat.message` hook to search `.vault/memories/` with `grep` before the assistant responds, then injects relevant snippets as synthetic context.
- Search term extraction includes path-like strings and up to 10 non-stopword terms; injected results are capped by `MAX_MEMORY_MATCHES` and `MAX_MATCH_LENGTH`.

## Memories To Skills

- `.opencode/commands/memories-to-skills.md` turns active top-level `.vault/memories/` notes into maintained skills, then archives processed memories.
- Always load the `obsidian` skill before reading or moving memory notes for this workflow.
- Analyze only top-level files under `.vault/memories/`; exclude `.vault/memories/archives/` and all files below it.
- Prefer updating existing relevant skills before creating new project skills under `.agents/skills/<skill-name>/SKILL.md`.
- Archive processed notes with Obsidian MCP moves from `memories/<filename>.md` to `memories/archives/<filename>.md` only after skill edits are complete.
- If an archive destination already exists, stop and ask before overwriting.
