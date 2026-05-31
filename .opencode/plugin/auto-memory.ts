import type { Plugin } from "@opencode-ai/plugin"

const MEMORY_INSTRUCTION = `
Automatic memory policy for this user:

- The user wants durable lessons to be remembered automatically; do not ask for approval before using OpenMemory for clearly useful long-term context.
- At the end of substantial work, briefly check whether the session produced a durable lesson, project convention, workflow preference, recurring technical constraint, or corrected assumption that would improve future assistance.
- Store only concise, reusable memories. Do not store secrets, credentials, one-off command output, temporary debugging state, or details that are unlikely to matter after this task.
- Before storing, query OpenMemory for similar memories to avoid duplicates. Reinforce an accurate existing memory instead of creating a duplicate when appropriate.
- Prefer procedural or semantic memories for project conventions and workflow lessons. Include project tags such as "kanai-api", "kanai-frontend", or "opencode" when useful.
- If the candidate memory is ambiguous, sensitive, or could surprise the user, ask first instead of storing.
`.trim()

export default (async () => {
  return {
    "experimental.chat.system.transform": async (_input, output) => {
      output.system.push(MEMORY_INSTRUCTION)
    },
  }
}) satisfies Plugin
