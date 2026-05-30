import { randomUUID } from "node:crypto"
import { homedir } from "node:os"
import { basename, isAbsolute, join, relative } from "node:path"
import type { Plugin } from "@opencode-ai/plugin"

const MARKER = "opencode-memory-plugin"
const READ_MARKER = "opencode-memory-read-context"
const MEMORY_FOLDER = "memories"
const DEFAULT_VAULT_PATH = ".vault"
const MAX_SEARCH_TERMS = 10
const MAX_MEMORY_MATCHES = 12
const MAX_MATCH_LENGTH = 220

const STOP_WORDS = new Set([
  "about",
  "after",
  "also",
  "before",
  "could",
  "find",
  "from",
  "have",
  "help",
  "into",
  "memory",
  "must",
  "opencode",
  "please",
  "read",
  "request",
  "respond",
  "responding",
  "should",
  "something",
  "thanks",
  "that",
  "this",
  "update",
  "user",
  "want",
  "which",
  "will",
  "with",
])

type Shell = Parameters<Plugin>[0]["$"]

function timestampForPath(value: string) {
  return value.replace(/[:.]/g, "-")
}

function resolvePath(path: string, base: string) {
  if (path.startsWith("~/")) return join(homedir(), path.slice(2))
  if (isAbsolute(path)) return path

  return join(base, path)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object"
}

function getObsidianVaultPath(config: { mcp?: Record<string, unknown> }) {
  const obsidian = config.mcp?.obsidian
  if (!isRecord(obsidian) || !Array.isArray(obsidian.command)) return DEFAULT_VAULT_PATH

  for (let index = obsidian.command.length - 1; index >= 0; index--) {
    const arg = obsidian.command[index]
    if (typeof arg !== "string") continue
    if (arg === "." || arg.startsWith("./") || arg.startsWith("../") || arg.startsWith("/") || arg.startsWith("~/")) return arg
  }

  return DEFAULT_VAULT_PATH
}

function getTextFromParts(parts: Array<{ type: string; text?: unknown }>) {
  return parts
    .filter((part) => part.type === "text" && typeof part.text === "string")
    .map((part) => part.text)
    .join("\n")
}

function extractSearchTerms(text: string) {
  const terms = new Set<string>()
  const paths = text.match(/@?[\w.-]+(?:\/[\w.-]+)+/g) ?? []

  for (const path of paths) {
    terms.add(path.replace(/^@/, ""))
  }

  const words = text.toLowerCase().match(/[a-z0-9][a-z0-9_-]{2,}/g) ?? []
  for (const word of words) {
    if (terms.size >= MAX_SEARCH_TERMS) break
    if (word.length < 4 || STOP_WORDS.has(word)) continue

    terms.add(word)
  }

  return [...terms].slice(0, MAX_SEARCH_TERMS)
}

function isLowValueMemoryLine(text: string) {
  return (
    text === "---" ||
    text === "tags:" ||
    text === "- memory" ||
    text === "- opencode" ||
    text.startsWith("type:") ||
    text.startsWith("source:") ||
    text.startsWith("session:") ||
    text.startsWith("project:") ||
    text.startsWith("created:")
  )
}

function truncate(value: string, maxLength: number) {
  if (value.length <= maxLength) return value

  return `${value.slice(0, maxLength - 1)}...`
}

function formatMemoryMatches(raw: string, memoryDirectory: string) {
  const matches: string[] = []
  const seen = new Set<string>()

  for (const line of raw.split(/\r?\n/)) {
    if (matches.length >= MAX_MEMORY_MATCHES) break

    const match = /^(.*?):(\d+):(.*)$/.exec(line)
    if (!match) continue

    const [, file, lineNumber, content] = match
    const text = content.trim()
    if (!text || isLowValueMemoryLine(text)) continue

    const noteRelativePath = relative(memoryDirectory, file)
    const notePath = noteRelativePath.startsWith("..") ? file : `${MEMORY_FOLDER}/${noteRelativePath}`
    const formatted = `${notePath}:${lineNumber}: ${truncate(text, MAX_MATCH_LENGTH)}`
    if (seen.has(formatted)) continue

    seen.add(formatted)
    matches.push(formatted)
  }

  if (matches.length === 0) return undefined

  return `<!-- ${READ_MARKER} -->
Relevant memory snippets found for this user request:
${matches.map((match) => `- ${match}`).join("\n")}

Use these memory snippets only when they help answer the request. Do not mention the memory search unless it is directly relevant.`
}

async function readMemoryContext(input: { $: Shell; memoryDirectory: string; userText: string }) {
  const terms = extractSearchTerms(input.userText)
  if (terms.length === 0) return undefined

  const grepArgs = terms.flatMap((term) => ["-e", term])
  const result = await input
    .$`grep -R -i -n -F -m 3 --include=*.md ${grepArgs} ${input.memoryDirectory}`
    .nothrow()
    .quiet()

  if (result.exitCode !== 0) return undefined

  return formatMemoryMatches(result.text(), input.memoryDirectory)
}

function buildMemoryInstructions(input: {
  projectName: string
  sessionID?: string
  hasObsidianMcp: boolean
}) {
  const now = new Date().toISOString()
  const notePath = `${MEMORY_FOLDER}/${timestampForPath(now)}.md`
  const mcpStatus = input.hasObsidianMcp
    ? "The project config includes an Obsidian MCP server named `obsidian`."
    : "The plugin did not detect `mcp.obsidian`; if Obsidian MCP tools are unavailable, do not write memories and report that in the final response."

  return `<!-- ${MARKER} -->
Persistent memory is enabled for this project.

${mcpStatus}

Use the \`obsidian\` skill for memory operations, and follow its MCP-first policy. Memory notes must be created through the current project's Obsidian MCP tools, not by shell or direct filesystem writes.

When to create a memory:
- Create a memory only when you learn durable, reusable information that can improve future agent behavior in this project or with this user.
- Good memory candidates include repository-specific workflow quirks, recurring commands, project conventions, stable user preferences, debugging discoveries, tool gotchas, and decisions that affect future work.
- Do not create memories for one-off task progress, transient observations, secrets, credentials, tokens, private personal data, or anything the user asked not to store.

How to create a memory:
- First use Obsidian MCP search/list/read tools to inspect existing memories under \`${MEMORY_FOLDER}/\` and identify related notes.
- Create a new timestamped note with the Obsidian MCP write-note tool.
- Use this path format: \`${notePath}\`, recomputing the timestamp at write time when possible.
- Use this frontmatter shape:

~~~yaml
type: memory
created: "${now}"
project: "${input.projectName}"
source: opencode
session: "${input.sessionID ?? "unknown"}"
tags:
  - memory
  - opencode
~~~

- Use this body shape:

~~~markdown
# Memory - <short title>

## Insight
<one concise durable lesson>

## Use When
<concrete future trigger or context>

## Backlinks
- [[memories/<related-previous-note-without-.md>|<short label>]]
~~~

Backlink rules:
- Backlinks must point to previous memories that share a clear subject with the new insight, such as the same subsystem, workflow, tool, convention, or recurring problem.
- Inspect previous memories through the Obsidian MCP tools before choosing backlinks; do not inspect or modify memory notes through shell or direct filesystem writes.
- Link to 1-5 relevant previous memory notes when a shared subject exists.
- If previous memories exist but none share a clear subject, write \`- None yet\` instead of adding a continuity backlink.
- If this is the first memory, write \`- None yet\` in the Backlinks section.
- If a new memory supersedes an older memory, link the older memory and state what changed.

Timing:
- Write the memory during the same session once the durable lesson is clear.
- If memory writing would interrupt urgent user-facing work, finish that work first, then write the memory before the final response.
- Ask before writing only when the information may be sensitive or private.`
}

export default (async ({ project, worktree, directory, $ }) => {
  let hasObsidianMcp = false
  const projectDirectory = worktree || project.worktree || directory
  let memoryDirectory = join(projectDirectory, DEFAULT_VAULT_PATH, MEMORY_FOLDER)
  const projectName = basename(projectDirectory)

  return {
    async config(config) {
      const mcp = (config as { mcp?: Record<string, unknown> }).mcp
      hasObsidianMcp = Boolean(mcp?.obsidian)
      memoryDirectory = join(resolvePath(getObsidianVaultPath({ mcp }), projectDirectory), MEMORY_FOLDER)
    },
    async "chat.message"(_, output) {
      if (output.parts.some((part) => part.type === "text" && part.text.includes(READ_MARKER))) return

      const userText = getTextFromParts(output.parts)
      const memoryContext = await readMemoryContext({ $, memoryDirectory, userText })
      if (!memoryContext) return

      output.parts.push({
        id: `memory-${randomUUID()}`,
        sessionID: output.message.sessionID,
        messageID: output.message.id,
        type: "text",
        text: memoryContext,
        synthetic: true,
        metadata: { source: MARKER },
      })
    },
    async "experimental.chat.system.transform"(input, output) {
      if (output.system.some((message) => message.includes(MARKER))) return

      output.system.push(
        buildMemoryInstructions({
          projectName,
          sessionID: input.sessionID,
          hasObsidianMcp,
        }),
      )
    },
  }
}) satisfies Plugin
