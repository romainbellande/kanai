# Update Skills

Analyze this repository and recommend new opencode agent skills that would improve agent efficiency.

Follow this workflow:

1. Scan the current project skills under `.opencode/skills/`.
2. Summarize the existing skills by name, trigger intent, and any obvious coverage gaps.
3. Analyze the repository structure, documentation, tooling, tests, workflows, and repeated development patterns.
4. Identify opportunities where a dedicated skill would reduce repeated context gathering, prevent common mistakes, or encode repository-specific workflows.
5. Propose a prioritized list of agent skills to add.

For each proposed skill, include:

- Priority rank.
- Skill name in lowercase hyphenated form.
- One-sentence description suitable for skill frontmatter.
- When the skill should trigger.
- Why it would improve opencode efficiency in this repository.
- Key instructions or checklist items the skill should contain.
- Any repository files the skill should reference.

Constraints:

- Do not create or edit skill files unless explicitly asked after presenting the proposal.
- Prefer repository-specific skills over generic programming skills.
- Avoid duplicating existing skills or global skills already available in the session.
- Order recommendations by expected impact and frequency of use.
