# A2A Acceptance Criteria Agent

## Problem Statement

Project Members currently write Acceptance Criteria manually when creating or editing a Task. This slows down task shaping, makes criteria quality inconsistent, and leaves users without an assisted way to turn task context into concise conditions for judging whether a Task is ready to become a Finished Task.

## Solution

Add an A2A-exposed acceptance-criteria agent that uses Pydantic AI with an OpenAI-compatible model to generate concise Markdown Acceptance Criteria from the current task form context. The client adds a field-level `Generate with AI` control on create and edit Task views, streams the agent response into the editable Acceptance Criteria textarea, and keeps the existing create/save workflow responsible for persisting the result.

## User Stories

1. As a Project Member, I want to generate Acceptance Criteria from a Task title, so that I can start shaping a Task without writing criteria from scratch.
2. As a Project Member, I want to generate Acceptance Criteria from a Task description, so that background context can become completion conditions quickly.
3. As a Project Member, I want the generated Acceptance Criteria to appear inside the existing editable field, so that I can revise the text before saving.
4. As a Project Member creating a Task, I want the generated criteria to be included only when I create the Task, so that generation does not persist anything without my create action.
5. As a Project Member editing a Task, I want generated criteria to remain unsaved until I save the Task, so that I can review changes first.
6. As a Project Member, I want the generate control next to the Acceptance Criteria label, so that the action is clearly tied to that field.
7. As a Project Member, I want the generate control enabled when either the Task title or description has text, so that the agent has enough context to produce useful criteria.
8. As a Project Member, I want a clear prompt when there is no title or description, so that I know what context is needed before generation.
9. As a Project Member, I want existing Acceptance Criteria to be sent as context when regenerating, so that the agent can refine from what is already present.
10. As a Project Member, I want regeneration to replace the current field value after an explicit click, so that the field contains one coherent criteria list.
11. As a Project Member, I want generated criteria to stream into the textarea, so that I can see progress while the agent works.
12. As a Project Member, I want the textarea locked while streaming, so that my edits do not race with incoming generated text.
13. As a Project Member, I want to cancel generation while it is streaming, so that I can stop an unhelpful or slow response.
14. As a Project Member, I want canceled generation to keep the partial text that already streamed, so that I can decide whether it is useful.
15. As a Project Member, I want failed generation to restore the original field value, so that a partial failed stream does not overwrite my work.
16. As a Project Member, I want failed generation to show a non-blocking error, so that I can continue editing and saving the Task manually.
17. As a Project Member, I want generated criteria in the same language as the Task context, so that the field remains consistent with my task text.
18. As a Project Member, I want generated criteria as Markdown bullets, so that they are easy to scan and edit in the textarea.
19. As a Project Member, I want generated criteria to be concise and testable, so that they help judge whether the Task is ready to become a Finished Task.
20. As a Project Member, I want generated criteria to avoid generic boilerplate, so that the output reflects the actual Task context.
21. As a Project Member, I want generated criteria to avoid unnecessary implementation details, so that the criteria describe outcomes rather than prescribing how work must be done.
22. As a Project Member, I want the Task form to keep working when generation fails, so that AI assistance never blocks manual task creation or editing.
23. As a Project Member, I want only Project participants to invoke generation for a Project, so that agent-backed workflows respect Project access.
24. As an integrator, I want the acceptance-criteria capability exposed as an A2A agent, so that external A2A clients can discover and invoke it through the protocol.
25. As an integrator, I want the agent card to be public, so that discovery does not require prior authentication.
26. As an integrator, I want agent invocation protected by Kanai bearer authentication, so that model usage and Project context are not exposed publicly.
27. As an operator, I want missing AI configuration to fail startup, so that deployment misconfiguration is detected before users invoke the agent.
28. As an operator, I want the A2A task state to be ephemeral, so that this helper does not introduce a new persistence model or database migration.

## Implementation Decisions

- Expose the first A2A agent with the stable slug `acceptance-criteria`.
- Use A2A JSON-RPC for invocation at `/a2a/acceptance-criteria`.
- Expose the public agent card at `/a2a/acceptance-criteria/.well-known/agent-card.json`.
- Require Kanai bearer authentication for A2A invocation, while allowing unauthenticated access to the agent card.
- Require Project context for invocation and validate that the current user can access the Project before calling the model.
- Use the latest A2A SDK for server protocol handling, agent cards, streaming message handling, and in-memory A2A task state.
- Use Pydantic AI with an OpenAI-compatible model provider configured by required startup settings for model name, base URL, and API key.
- Generate streamed plain text rather than structured final output, because the UI writes progressively into an editable textarea.
- Stream generated Acceptance Criteria through A2A message chunks.
- Use structured A2A message metadata for `projectId` and task form fields, with a short human-readable message summary.
- Send only task form context: title, description, existing Acceptance Criteria, priority, Story Points, tag, selected workflow column, and create/edit mode.
- Do not send broad Project details, Sprint state, Backlog state, related Tasks, or board history in this feature.
- Instruct the agent to produce 3-7 concise Markdown bullet criteria with no preamble.
- Instruct the agent to match the language of the task context, falling back to English if unclear.
- Instruct the agent to avoid generic boilerplate and avoid implementation details unless those details are already part of the task context.
- Keep model behavior consistent rather than creative.
- Put a small field-level `Generate with AI` control beside the Acceptance Criteria label on both create and edit Task views.
- Enable generation only when either title or description has text.
- Replace the existing Acceptance Criteria value on explicit generation, using the previous value as context.
- Lock the Acceptance Criteria textarea while streaming and unlock it when generation ends, is canceled, or fails.
- Change the generation control to a cancel action while streaming.
- Keep partial streamed text when the user cancels generation.
- Restore the original field value if streaming fails after partial text appears.
- Do not add a persistent AI-generated marker to the saved Task content or form UI.
- Do not automatically save generated criteria; the existing create/save action remains the persistence boundary.
- Do not require a database migration for this feature.

## Testing Decisions

- Test external behavior at the highest practical seams rather than testing SDK internals.
- Backend tests should cover the A2A agent card being publicly reachable.
- Backend tests should cover A2A invocation requiring bearer authentication.
- Backend tests should cover Project access validation before model invocation.
- Backend tests should cover malformed or insufficient metadata producing safe client-facing errors.
- Backend tests should cover streamed message chunks producing Markdown criteria from stubbed model output.
- Backend tests should cover unknown agent slugs returning not found behavior.
- Backend tests should avoid live model calls by stubbing the Pydantic AI boundary.
- Backend settings tests should cover required AI configuration behavior at startup or settings construction.
- Frontend page tests should cover the generate control appearing in both create and edit Task views.
- Frontend page tests should cover generation being unavailable until title or description is present.
- Frontend page tests should cover the A2A streaming request including auth and structured metadata from the current task form.
- Frontend page tests should cover streamed chunks replacing the Acceptance Criteria field.
- Frontend page tests should cover the textarea being locked during streaming and editable afterward.
- Frontend page tests should cover cancellation keeping partial streamed text.
- Frontend page tests should cover stream failure restoring the original field value and showing a non-blocking error.
- Frontend page tests should cover generated criteria remaining editable and being persisted only through the existing create/save flow.
- Existing create/edit Task form tests are the closest frontend prior art.
- Existing authenticated router tests and feature-boundary tests are the closest backend prior art.

## Out of Scope

- Generating other Task fields such as title, description, priority, Story Points, tag, assignee, or workflow column.
- Sending broad Project context, Sprint context, Backlog context, or related Task history to the agent.
- Persisting A2A protocol task history.
- Adding database tables or migrations for AI generation metadata.
- Adding a persistent AI-generated label to Tasks.
- Adding non-A2A custom helper endpoints for acceptance criteria generation.
- Supporting multiple agents beyond the first `acceptance-criteria` agent, except for establishing an agent-scoped route convention that can grow later.
- Adding end-to-end browser tests in this slice.

## Further Notes

- `Acceptance Criteria` is defined in the domain glossary as Task-owned, user-editable conditions used to judge whether a Task is ready to become a Finished Task.
- ADR 0004 records the A2A exposure, public-card/protected-invocation boundary, and required AI startup configuration decisions.
