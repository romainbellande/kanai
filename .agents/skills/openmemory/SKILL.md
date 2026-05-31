---
name: openmemory
description: Use OpenMemory MCP when the user asks about remembered information, wants something remembered or forgotten, or when opencode identifies durable context that would improve future assistance; ask for approval first when the user did not initiate the memory action.
---

# OpenMemory

Use OpenMemory MCP to retrieve and maintain durable user context across conversations. Keep memory operations intentional, minimal, and privacy-preserving.

## When to Use

- The user asks what you remember, asks about their name or preferences, or references prior context.
- The user explicitly says to remember, forget, update, or correct something.
- opencode identifies that a durable preference, identity fact, workflow, or recurring project convention would improve future help.
- A memory may be stale, duplicated, sensitive, or no longer useful.

## Approval Gate

- If the user directly asks for a memory action or their request clearly depends on remembered context, use the OpenMemory MCP tools without an extra approval prompt unless the information is ambiguous or potentially sensitive.
- If opencode identifies a memory opportunity on its own, ask for explicit approval before using OpenMemory MCP to query, store, reinforce, update, or delete anything.
- Keep proactive approval prompts short and specific, such as `Should I check OpenMemory for relevant preferences?` or `Should I remember this preference for future conversations?`.
- If approval is denied or unclear, do not call OpenMemory MCP tools for that proactive opportunity.

## When Not to Use

- Do not store one-off task details, transient debugging state, command outputs, secrets, credentials, tokens, or private data that is not useful long term.
- Do not store inferred sensitive attributes such as health, political views, religion, financial status, or exact location unless the user explicitly asks and it is clearly useful.
- Do not query memory for every request. Query only when remembered context could materially change the answer or action.

## Tool Map

- `openmemory_openmemory_query`: Search contextual memories, temporal facts, or both. Use this first when answering questions about remembered information.
- `openmemory_openmemory_store`: Store new contextual memories and/or temporal facts. Use only for durable information.
- `openmemory_openmemory_list`: Inspect recent memories, optionally by sector, when auditing or looking for duplicates.
- `openmemory_openmemory_get`: Fetch a specific memory by ID before reinforcing, deleting, or resolving ambiguity.
- `openmemory_openmemory_delete`: Delete a memory by ID when the user asks to forget it or it is clearly wrong.
- `openmemory_openmemory_reinforce`: Boost salience for a still-useful existing memory instead of storing duplicates.

## Query Strategy

- Use `type: "unified"` when both semantic memories and temporal facts might answer the question.
- Use `type: "contextual"` for preferences, workflows, explanations, and prior conversational context.
- Use `type: "factual"` for structured facts with subject, predicate, and object patterns.
- Set `k` small by default, usually `3` to `8`.
- Use a specific `user_id` when available; otherwise use the current default consistently.
- Prefer broad fact patterns with only the known fields set. Leave unknown fields blank rather than guessing.

## Storage Strategy

- Store concise, self-contained memories written as facts, not transcripts.
- Use `type: "both"` when a memory has a useful natural-language form and a structured fact form.
- Use `type: "contextual"` for nuanced preferences, procedures, and project-specific guidance.
- Use `type: "factual"` for clear temporal facts like `user` `name` `Naimor`.
- Include tags such as `preference`, `identity`, `workflow`, `project`, or `correction` when helpful.
- Before storing, query for similar memories. Reinforce or update by deleting the incorrect memory and storing the corrected one rather than creating duplicates.

## Memory Sectors

- `semantic`: Stable facts, preferences, names, project conventions, and reusable knowledge.
- `procedural`: Repeatable workflows, command preferences, and how the user wants tasks handled.
- `episodic`: Specific past events worth remembering, used sparingly.
- `emotional`: User sentiment or trust context, only when explicitly useful and non-sensitive.
- `reflective`: Lessons learned about collaboration or recurring decision patterns.

## Safe Defaults

- If the user asks what is remembered, query first and answer from retrieved memories only.
- If the user asks to forget something, list or query to identify the exact memory, delete only matching IDs, and report what was removed.
- If a memory conflicts with the user’s current statement, treat the user’s current statement as authoritative.
- Ask one short clarification question before storing ambiguous or potentially sensitive information.
- Never expose raw memory IDs unless they are useful for audit, deletion, or debugging.

## Common Workflows

### Answer From Memory

1. Query with `type: "unified"` and a targeted search phrase.
2. Answer only what the memory supports.
3. If nothing relevant is found, say you do not have that stored.

### Remember New Information

1. Confirm the information is durable and appropriate to store.
2. Query for similar memories to avoid duplicates.
3. Store a concise memory with useful tags and, when applicable, structured facts.

### Correct Existing Memory

1. Query or list memories that may conflict.
2. Delete the wrong or stale memory by ID.
3. Store the corrected memory.
4. Tell the user the memory was updated.

### Reinforce Existing Memory

1. Query for the memory.
2. If it already captures the durable fact accurately, reinforce it instead of storing a duplicate.

## Response Style

- Be explicit about memory actions: `I stored this`, `I found this remembered`, or `I deleted that memory`.
- Keep explanations brief unless the user asks for an audit trail.
- Do not pretend memory is complete; say when nothing relevant was found.
