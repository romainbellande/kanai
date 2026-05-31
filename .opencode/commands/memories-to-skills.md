# Memories To Skills

Turn active project memories into maintained opencode skills, then archive the processed memories.

Follow this workflow exactly:

1. Load the `obsidian` skill before reading or moving memory notes.
2. Inspect active memory notes only under `.vault/memories/` through the Obsidian MCP tools.
3. Exclude `.vault/memories/archives/` and every file below it from all analysis and recommendations.
4. Read all top-level active memory notes in `.vault/memories/`.
5. Inspect existing skills in these locations when they exist:
   - `.opencode/skills/`
   - `.agents/skills/`
   - available session skills listed in the prompt
6. Identify durable memory themes that should become skills, using these criteria:
   - recurring or high-risk project workflow
   - repository-specific convention that future agents may miss
   - repeated verification, routing, tooling, or architecture gotcha
   - enough detail to write actionable skill instructions
7. Update current skills accordingly when a memory theme clearly belongs in an existing skill.
8. Create a new skill only when no existing skill covers the theme well.
9. Prefer project-specific skills over generic programming skills.
10. Keep skill changes small, direct, and actionable.

Skill writing rules:

- Use `apply_patch` for all edits.
- Store new project skills under `.agents/skills/<skill-name>/SKILL.md` unless an existing related skill in `.opencode/skills/` is the better target.
- Use lowercase hyphenated skill folder names.
- Include frontmatter for new opencode skills:
  ```markdown
  ---
  name: skill-name
  description: Use when concrete trigger keywords apply; describe what the skill does in one sentence.
  ---
  ```
- If updating an existing skill that has no frontmatter, preserve its style unless adding frontmatter is necessary for opencode discovery.
- Avoid duplicating existing global, project, or session skills.
- Include concrete paths, commands, known failures, and decision rules from the memories.
- Do not include one-off task progress, stale temporary observations, secrets, or private data.

Archiving rules:

1. Archive only after skill creation or updates are complete.
2. Archive every processed top-level memory note from `.vault/memories/` into `.vault/memories/archives/`.
3. Do not archive files that were already inside `.vault/memories/archives/`.
4. Prefer Obsidian MCP move tools for memory note moves:
   - source path: `memories/<filename>.md`
   - destination path: `memories/archives/<filename>.md`
5. If a destination filename already exists, stop and ask the user how to proceed instead of overwriting.

Verification:

1. Re-list `.vault/memories/` and confirm no processed top-level memory notes remain outside `archives/`.
2. Re-list `.vault/memories/archives/` and confirm the processed notes are present.
3. Summarize which skills were created, which were updated, and which memory files were archived.
4. Tell the user to quit and restart opencode so new or changed skills are loaded.

If there are no active top-level memory notes, do not modify skills and do not move anything. Report that there were no active memories to process.
