---
date: 2026-06-20
topic: project-level-task-shaping
---

# Project-Level Task Shaping

## Summary

Kanai will add a Backlog-level project shaping flow that turns a project manager's new idea into multiple small-deliverable Backlog tasks. A grill-me-style chat reaches explicit shared understanding first, the user edits that understanding in a textarea, then Kanai generates editable draft tasks with dependency links before anything is saved.

---

## Problem Frame

Project managers often start with ideas at a higher level than a single task, such as “implement authentication.” Breaking that idea into useful work takes time, and the first pass often misses clean task boundaries, acceptance criteria, or dependency relationships.

Today that shaping work happens outside Kanai or through manual task creation. The result is slow backlog creation and tasks that may be too large, poorly described, or presented as independent when one actually depends on another.

---

## Actors

- A1. Project Manager: Shapes a new project idea into backlog-ready work.
- A2. Kanai Shaping Agent: Interviews the Project Manager, challenges vague boundaries, and drafts shared understanding and task candidates.

---

## Key Flows

- F1. Shape an idea into shared understanding
  - **Trigger:** A Project Manager starts project-level shaping from the Backlog with a new idea.
  - **Actors:** A1, A2
  - **Steps:** The Project Manager enters the idea; the agent asks one focused question at a time; the agent keeps probing until task boundaries and dependency relationships are explicit; the agent outputs an editable shared-understanding textarea.
  - **Outcome:** The Project Manager has an editable text summary that captures the agreed scope, boundaries, and dependency assumptions.
  - **Covered by:** R1, R2, R3, R4, R5

- F2. Generate and save reviewed task drafts
  - **Trigger:** The Project Manager accepts or edits the shared understanding and asks Kanai to generate tasks.
  - **Actors:** A1, A2
  - **Steps:** Kanai generates draft tasks from the shared understanding; the Project Manager reviews and edits titles, descriptions, acceptance criteria, and dependency links; the Project Manager saves the reviewed drafts.
  - **Outcome:** The Backlog receives the new tasks and their dependency relationships only after explicit review.
  - **Covered by:** R6, R7, R8, R9, R10, R11

---

## Requirements

**Entry and chat**
- R1. The project-level shaping flow starts from the Backlog, not from an individual task form.
- R2. The flow accepts a project-level idea that may require multiple tasks, such as “implement authentication.”
- R3. The shaping chat must ask one focused question at a time in a grill-me-style interview.
- R4. The shaping chat must continue until task boundaries and dependency relationships are explicit enough for review.
- R5. The flow must output the reached shared understanding into an editable textarea before task drafts are generated.

**Task draft review**
- R6. Task drafts are generated from the user-reviewed shared understanding.
- R7. Each draft task must have an editable title, description, acceptance criteria, and dependency links.
- R8. Draft tasks should be small deliverables: each task has a clear outcome someone can complete and review on its own, even when it depends on another task.
- R9. The draft list must remain editable before saving.

**Saving to Backlog**
- R10. No generated task is saved until the Project Manager explicitly saves the reviewed draft list.
- R11. Saved tasks land in the Backlog.
- R12. Dependency links between saved tasks are persisted as real task relationships, not only as notes in task descriptions.

---

## Acceptance Examples

- AE1. **Covers R1, R2, R5.** Given a Project Manager starts shaping from the Backlog with “implement authentication,” when the interview reaches shared understanding, Kanai shows that understanding in an editable textarea before generating tasks.
- AE2. **Covers R6, R7, R9, R10.** Given the shared understanding has been reviewed, when Kanai generates task drafts, the Project Manager can edit each draft’s title, description, acceptance criteria, and dependency links before saving anything.
- AE3. **Covers R8, R12.** Given one generated task cannot be completed before another, when the draft list is reviewed and saved, Kanai preserves that dependency as a real relationship while keeping each task scoped as a small deliverable.

---

## Success Criteria

- A Project Manager can turn a broad idea into reviewed Backlog tasks without doing the full breakdown manually outside Kanai.
- Generated tasks are clearer, smaller, and more dependency-aware than a flat one-shot list.
- A downstream planner can implement the flow without inventing product behavior around review gates, editable fields, or persistence boundaries.

---

## Scope Boundaries

- The first slice does not save tasks before the Project Manager reviews the draft list.
- The first slice does not treat this as an extension of single-task shaping; it is a fresh project-level flow.
- The first slice does not require every task to be parallelizable; dependency links are allowed when the work requires them.
- The first slice does not replace manual Backlog task creation.

---

## Key Decisions

- Start from Backlog: Project-level shaping creates Backlog work, so the entry point should match where the output lands.
- Use two review gates: The shared understanding is editable before draft generation, and task drafts are editable before saving.
- Persist real dependencies: Dependency relationships are part of the work breakdown value and must survive beyond the draft review screen.
- Favor small deliverables: The goal is independently completable and reviewable work, not artificial parallelism.

---

## Dependencies / Assumptions

- Kanai will need a durable way to represent dependency links between tasks.
- The grill-style interview may take more turns than the existing single-task shaping flow because it must make boundaries and dependencies explicit.
- The generated task set is intended for Backlog triage, not immediate sprint commitment.
