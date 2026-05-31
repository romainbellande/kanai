import { access, mkdir, readFile, rename, writeFile } from "node:fs/promises"
import { basename, isAbsolute, relative, resolve } from "node:path"

import { tool, type Plugin } from "@opencode-ai/plugin"

const VAULT_DIR = ".vault"
const MEMORY_DIR = "memories"
const ARCHIVE_DIR = "archives"
const TEMPLATE_PATH = ".opencode/plugin/memory-template.md"

const MEMORY_INSTRUCTION = `
Automatic memory policy for this user:

- The user wants durable lessons to be remembered automatically in the project Obsidian vault, not OpenMemory.
- At the end of substantial work, briefly check whether the session produced a durable lesson, project convention, workflow preference, recurring technical constraint, or corrected assumption that would improve future assistance.
- Store only concise, reusable memories. Do not store secrets, credentials, one-off command output, temporary debugging state, or details that are unlikely to matter after this task.
- Before storing, search .vault/memories and .vault/archives for similar memories to avoid duplicates. If an accurate existing memory exists, do not create a duplicate.
- Prefer procedural or semantic memories for project conventions and workflow lessons. Include tags such as "kanai-api", "kanai-frontend", or "opencode" when useful.
- Use the memory_write tool for each new memory. It writes Markdown notes under .vault/memories using .opencode/plugin/memory-template.md.
- If the candidate memory is ambiguous, sensitive, or could surprise the user, ask first instead of storing.
- Run /apply-memories when the user wants pending memory notes promoted into AGENTS.md files or agent skills; processed notes are archived under .vault/archives.
`.trim()

const z = tool.schema

function unique(values: string[]) {
  return [...new Set(values)]
}

function slugify(value: string) {
  const slug = value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)

  return slug || "memory"
}

function cleanTag(value: string) {
  return slugify(value).replace(/-/g, "_")
}

function yamlString(value: string) {
  return JSON.stringify(value)
}

function yamlList(values: string[]) {
  if (values.length === 0) return "[]"
  return values.map((value) => `  - ${yamlString(value)}`).join("\n")
}

function markdownList(values: string[]) {
  if (values.length === 0) return "- Not specified"
  return values.map((value) => `- ${value}`).join("\n")
}

function renderTemplate(template: string, values: Record<string, string>) {
  return template.replace(/{{([a-z_]+)}}/g, (_, key: string) => values[key] ?? "")
}

async function exists(path: string) {
  try {
    await access(path)
    return true
  } catch {
    return false
  }
}

async function nextAvailablePath(directory: string, fileName: string) {
  const extensionIndex = fileName.lastIndexOf(".")
  const name = extensionIndex === -1 ? fileName : fileName.slice(0, extensionIndex)
  const extension = extensionIndex === -1 ? "" : fileName.slice(extensionIndex)

  let candidate = resolve(directory, fileName)
  let counter = 2

  while (await exists(candidate)) {
    candidate = resolve(directory, `${name}-${counter}${extension}`)
    counter += 1
  }

  return candidate
}

function assertInside(path: string, parent: string) {
  const relativePath = relative(parent, path)
  if (relativePath.startsWith("..") || relativePath === "" || isAbsolute(relativePath)) {
    throw new Error(`Path must be inside ${parent}`)
  }
}

export default (async ({ directory, worktree }) => {
  const root = worktree || directory
  const vaultRoot = resolve(root, VAULT_DIR)
  const memoriesRoot = resolve(vaultRoot, MEMORY_DIR)
  const archivesRoot = resolve(vaultRoot, ARCHIVE_DIR)
  const templatePath = resolve(root, TEMPLATE_PATH)

  async function ensureVault() {
    await mkdir(memoriesRoot, { recursive: true })
    await mkdir(archivesRoot, { recursive: true })
  }

  return {
    tool: {
      memory_write: tool({
        description:
          "Write a concise durable lesson to the project Obsidian memory vault under .vault/memories.",
        args: {
          title: z.string().min(3).describe("Short memory title."),
          lesson: z.string().min(10).describe("The reusable lesson or instruction to remember."),
          context: z.string().optional().describe("Brief context explaining when the lesson was learned."),
          scope: z
            .string()
            .default("repo")
            .describe("Primary scope, for example repo, kanai-api, kanai-frontend, opencode, or user."),
          appliesTo: z
            .array(z.string())
            .default([])
            .describe("Files, directories, skills, commands, or situations this memory applies to."),
          tags: z.array(z.string()).default([]).describe("Obsidian tags without the leading #."),
        },
        async execute(args, context) {
          await ensureVault()

          const created = new Date().toISOString()
          const tagValues = unique(
            ["memory", "opencode", args.scope, ...args.tags].map(cleanTag).filter(Boolean),
          )
          const template = await readFile(templatePath, "utf8")
          const safeTitle = args.title.trim()
          const fileName = `${created.replace(/[:.]/g, "-")}-${slugify(safeTitle)}.md`
          const filePath = await nextAvailablePath(memoriesRoot, fileName)
          const content = renderTemplate(template, {
            title: safeTitle,
            created,
            session_id: context.sessionID,
            agent: context.agent,
            scope: args.scope,
            tags: yamlList(tagValues),
            lesson: args.lesson.trim(),
            context: args.context?.trim() || "Not specified.",
            applies_to: markdownList(args.appliesTo),
          })

          await writeFile(filePath, content, "utf8")

          const relativePath = relative(root, filePath)
          context.metadata({ title: `Stored memory: ${safeTitle}`, metadata: { path: relativePath } })

          return `Stored memory at ${relativePath}`
        },
      }),
      memory_archive: tool({
        description:
          "Archive processed memory notes by moving them from .vault/memories to .vault/archives.",
        args: {
          files: z
            .array(z.string())
            .min(1)
            .describe("Memory note paths or filenames currently under .vault/memories."),
        },
        async execute(args, context) {
          await ensureVault()

          const archived: string[] = []

          for (const file of args.files) {
            const source = resolve(root, file.includes("/") ? file : `${VAULT_DIR}/${MEMORY_DIR}/${file}`)
            assertInside(source, memoriesRoot)

            const destination = await nextAvailablePath(archivesRoot, basename(source))
            await rename(source, destination)
            archived.push(relative(root, destination))
          }

          context.metadata({ title: `Archived ${archived.length} memory note(s)`, metadata: { archived } })

          return `Archived memory notes:\n${archived.map((file) => `- ${file}`).join("\n")}`
        },
      }),
    },
    "experimental.chat.system.transform": async (_input, output) => {
      output.system.push(MEMORY_INSTRUCTION)
    },
  }
}) satisfies Plugin
