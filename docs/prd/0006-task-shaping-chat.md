# Task Shaping Chat

## Problem Statement

Project Members can currently create and edit Project Tasks by manually filling the Project Task Title, Project Task Description, and Acceptance Criteria fields. This makes early task shaping slower and inconsistent, especially when the user starts from a blank create form or only has a vague idea of the work. Kanai already has an A2A-backed one-shot Acceptance Criteria helper, but it does not interview the user, shape multiple text fields together, or help turn uncertainty into a coherent Project Task draft.

## Solution

Add a Task Shaping Chat: an ephemeral, form-local, A2A-backed agent interaction available from Project Task create and edit views. The chat asks focused one-question-at-a-time interview questions, includes recommended answers or directions, and produces optional structured drafts for Project Task Title, Project Task Description, and Acceptance Criteria. Users can apply each proposed field individually or apply all available drafts, and persistence remains bounded by the existing Create/Save action.

## User Stories

1. As a Project Member creating a Project Task, I want to open Task Shaping Chat from the create view, so that I can shape a useful Project Task from the form I am already using.
2. As a Project Member editing a Project Task, I want to open Task Shaping Chat from the edit view, so that I can improve an existing Project Task without leaving its detail page.
3. As a Project Member, I want Task Shaping Chat to be available even when the create form is blank, so that the agent can help me discover an initial Project Task Title and Description.
4. As a Project Member, I want Task Shaping Chat to ask one focused question at a time, so that the interview is easy to answer.
5. As a Project Member, I want each question to include a recommended answer or direction, so that I can move quickly when I am unsure.
6. As a Project Member, I want the interview to stay focused to roughly 3-6 useful turns, so that task creation does not become a long planning ceremony.
7. As a Project Member, I want Task Shaping Chat to draft a Project Task Title, so that the work item has a concise and useful name.
8. As a Project Member, I want Task Shaping Chat to draft a Project Task Description, so that the task has enough background, scope, and handoff context.
9. As a Project Member, I want Task Shaping Chat to draft Acceptance Criteria, so that the task has clear conditions for judging whether it is ready to become a Finished Task.
10. As a Project Member, I want Task Shaping Chat to exclude Tag from its applyable field drafts, so that short planning metadata is not mixed with narrative task shaping.
11. As a Project Member, I want the agent to return structured field drafts instead of plain prose only, so that the UI can show exactly which fields can be applied.
12. As a Project Member, I want field drafts to be optional per turn, so that the agent can propose a Title before it is confident about Description or Acceptance Criteria.
13. As a Project Member, I want to apply Title, Description, and Acceptance Criteria drafts individually, so that I can accept only the parts that are useful.
14. As a Project Member, I want an Apply all option for available drafts, so that I can quickly accept the complete proposal when it looks good.
15. As a Project Member, I want applying a field draft to update only the unsaved form state, so that I can review changes before Create/Save persists them.
16. As a Project Member creating a Project Task, I want applied drafts to be saved only when I create the Project Task, so that AI assistance does not bypass my review.
17. As a Project Member editing a Project Task, I want applied drafts to remain unsaved until I save changes, so that existing Project Task content is not overwritten without confirmation.
18. As a Project Member, I want applying a draft to replace the target field value, so that the field remains coherent instead of accumulating duplicated AI text.
19. As a Project Member, I want the agent to receive current form values as context, so that it can refine existing Title, Description, or Acceptance Criteria rather than starting over blindly.
20. As a Project Member, I want the chat transcript to remain visible while I am shaping the task, so that I can understand why the draft was produced.
21. As a Project Member, I want the chat drawer to stay available while the form remains visible, so that I can compare the draft with the current task fields.
22. As a Project Member, I want opening the drawer not to invoke the model immediately, so that I do not spend model calls accidentally.
23. As a Project Member, I want an explicit Start shaping action, so that I control when the first A2A request happens.
24. As a Project Member, I want the chat state to survive closing and reopening the drawer while I stay on the page, so that I can temporarily hide it without losing progress.
25. As a Project Member, I want a Reset chat action, so that I can discard a poor interview and start again while keeping my form fields unchanged.
26. As a Project Member, I want failed chat turns to keep my latest message, transcript, and drafts visible, so that transient failures do not lose my work.
27. As a Project Member, I want failed chat turns to show a non-blocking retry path, so that I can continue shaping the task manually or retry the agent.
28. As a Project Member, I want draft staleness to be tracked per field, so that editing the Title only warns about the Title draft and does not over-warn about Description or Acceptance Criteria drafts.
29. As a Project Member, I want to be warned when I am about to apply a stale field draft, so that I know it was based on earlier field context.
30. As a Project Member, I want Task Shaping Chat to produce concise Markdown for Description and Acceptance Criteria where useful, so that generated text remains readable in the existing textareas.
31. As a Project Member, I want Acceptance Criteria drafts to remain concise, testable, and outcome-focused, so that they help judge whether a Project Task is ready to become a Finished Task.
32. As a Project Member, I want Description drafts to include open questions only when unresolved details affect execution, so that uncertainty is visible without cluttering simple tasks.
33. As a Project Member, I want Task Shaping Chat and the existing Acceptance Criteria Generate with AI button to coexist, so that I can choose between a quick criteria-only helper and a deeper multi-field interview.
34. As a Project Member, I want the Task Shaping Chat control to be visually associated with the text-field shaping area, so that I understand which part of the form it helps with.
35. As a Project Member, I want the chat to be distinct from Project chat, so that private task-shaping turns are not mixed with durable project discussion.
36. As a Project Member, I want Task Shaping Chat to use only the current form context and transcript, so that it does not expose unrelated Project, Sprint, Backlog, or board history.
37. As a Project Owner, I want Task Shaping Chat invocation to respect Project access, so that only Project participants can use model-backed task shaping for a Project.
38. As an integrator, I want Task Shaping Chat exposed as an A2A agent with the stable slug `task-shaping`, so that external A2A clients can discover the capability.
39. As an integrator, I want the Task Shaping Chat agent card to be publicly discoverable, so that discovery follows Kanai's existing A2A convention.
40. As an integrator, I want Task Shaping Chat invocation to require Kanai bearer authentication, so that private Project Task context is protected.
41. As an integrator, I want each Task Shaping Chat turn to send structured Project Task form data and chat transcript, so that the protocol payload is explicit.
42. As an integrator, I want the agent response to include a structured assistant message, optional field drafts, and readiness/staleness-relevant metadata, so that the client does not parse arbitrary prose.
43. As a frontend maintainer, I want UI components to call a local Task Shaping Chat helper rather than importing SDK details directly, so that protocol concerns stay out of form components.
44. As a frontend maintainer, I want the A2A client approach to reuse the existing SDK/authentication pattern, so that bearer refresh behavior stays consistent.
45. As a backend maintainer, I want the second A2A agent to use a minimal agent registry, so that multiple agent slugs are not handled by duplicated route conditionals.
46. As a backend maintainer, I want Task Shaping Chat to reuse the existing OpenAI-compatible Pydantic AI configuration, so that deployment settings stay simple.
47. As an operator, I want the feature to avoid new database tables or migrations, so that the chat remains ephemeral and operationally lightweight.
48. As a tester, I want the feature covered through externally visible form, client helper, and A2A route behavior, so that tests remain stable across SDK internals.

## Implementation Decisions

- Use the canonical term **Task Shaping Chat** for the user-facing agent interaction.
- Expose the new A2A agent with the stable slug `task-shaping`.
- Make Task Shaping Chat available in both Project Task create and Project Task edit views.
- Target Project Task Title, Project Task Description, and Acceptance Criteria as applyable text fields.
- Exclude Tag from Task Shaping Chat field application.
- Keep the existing Acceptance Criteria one-shot `Generate with AI` helper in place.
- Add a Task Shaping Chat toggle associated with the text-field shaping area of the form, using a drawer-style chat that keeps the form visible.
- Do not start an A2A invocation merely by opening the drawer; require an explicit Start shaping action.
- Allow Task Shaping Chat to start from a blank create form.
- Keep chat conversation state ephemeral and form-local.
- Keep chat transcript and drafts in client state while the user stays on the form page.
- Discard chat state on navigation or reload unless a later feature introduces explicit draft persistence.
- Provide an explicit Reset chat action that clears transcript and drafts without changing form fields.
- Send current Project Task form fields, current available field drafts, and the visible chat transcript with each A2A turn.
- Do not send broad Project details, Sprint state, Backlog state, related Project Tasks, Project chat messages, or board history in this slice.
- Have the backend remain mostly stateless for interview memory by relying on the client-sent transcript.
- Return structured turn output rather than plain unstructured assistant text.
- A structured turn includes an assistant message, optional Title draft, optional Description draft, optional Acceptance Criteria draft, and flags or reasons that help the UI present readiness and next steps.
- Do not require token-by-token visible streaming for Task Shaping Chat; show a per-turn loading state and render the completed structured turn.
- The agent asks one focused question at a time and includes a recommended answer or direction.
- The agent should generally converge within 3-6 useful turns unless the user continues voluntarily.
- Description drafts should be concise Markdown, using bullets where useful.
- Acceptance Criteria drafts should align with the existing Acceptance Criteria helper style: concise, testable Markdown bullets, no generic boilerplate, and no unnecessary implementation detail.
- Description drafts may include a short Open Questions section only when unresolved details affect execution.
- Field application replaces the target form field value rather than appending.
- Users can apply field drafts individually and can apply all currently available field drafts.
- Applying a field draft updates only unsaved form state and marks the form dirty.
- Existing Create/Save remains the only persistence boundary for generated field content.
- Track draft staleness per field when the corresponding form field changes after the draft was produced.
- Allow applying stale drafts, but warn clearly before or during the apply action.
- On a failed turn, keep the user's latest message, prior transcript, and existing drafts; show a non-blocking error and retry affordance.
- Preserve Kanai bearer authentication for A2A invocation and public unauthenticated discovery for the agent card.
- Enforce Project access before model invocation.
- Use the same OpenAI-compatible Pydantic AI settings as the existing Acceptance Criteria agent.
- Introduce a minimal A2A agent registry now that Kanai has more than one A2A agent.
- Keep protocol handling behind local backend and frontend helpers so SDK/protobuf details do not leak into feature UI code.
- Do not add a database migration for this feature.

## Testing Decisions

- Test external behavior at the highest practical seams and avoid asserting SDK internals.
- Backend route tests should cover the public Task Shaping Chat agent card being reachable without bearer authentication.
- Backend route tests should cover Task Shaping Chat invocation requiring bearer authentication.
- Backend tests should cover Project access validation before model invocation.
- Backend tests should cover malformed Task Shaping Chat payloads producing safe protocol-shaped errors.
- Backend tests should cover blank-start payloads being accepted for Task Shaping Chat, unlike the Acceptance Criteria-only helper.
- Backend tests should cover structured transcript and current form context being parsed and passed to the generator boundary.
- Backend tests should cover the generator boundary returning structured assistant messages and optional field drafts from stubbed model output.
- Backend tests should cover unknown agent slugs returning not-found behavior through the multi-agent registry.
- Backend tests should avoid live model calls by stubbing the Pydantic AI boundary.
- Frontend A2A client tests should cover discovery of `/a2a/task-shaping/.well-known/agent-card.json` and invocation of `/a2a/task-shaping` through the SDK helper.
- Frontend A2A client tests should cover bearer-token injection and refresh-on-401 behavior through the same authentication pattern used by the existing A2A helper.
- Frontend helper tests should cover constructing the structured turn payload from current form fields, current drafts, and transcript.
- Frontend helper tests should cover reading structured turn output into assistant message and optional field drafts without parsing prose.
- Frontend form tests should cover the Task Shaping Chat toggle appearing in both Project Task create and edit views.
- Frontend form tests should cover opening and closing the drawer without starting the model call.
- Frontend form tests should cover explicit Start shaping from a blank create form.
- Frontend form tests should cover one-turn and multi-turn chat progression with recommended answers displayed.
- Frontend form tests should cover applying Title, Description, and Acceptance Criteria drafts individually.
- Frontend form tests should cover applying all available drafts.
- Frontend form tests should cover applied drafts remaining unsaved until the existing Create/Save action.
- Frontend form tests should cover the existing Acceptance Criteria `Generate with AI` button remaining available.
- Frontend form tests should cover Reset chat clearing transcript and drafts without clearing form fields.
- Frontend form tests should cover per-field stale draft warnings after manual edits.
- Frontend form tests should cover failed turns preserving transcript, drafts, and user input while showing retry/error UI.
- Existing Acceptance Criteria A2A tests, Task form hook tests, and create/edit page tests are the closest prior art.

## Out of Scope

- Persisting Task Shaping Chat transcripts.
- Adding database tables, migrations, or durable A2A Task history.
- Replacing the existing Acceptance Criteria one-shot generator.
- Letting Task Shaping Chat apply Tag, priority, Story Points, workflow column, assignee, Sprint Membership, or other planning metadata.
- Sending broad Project, Sprint, Backlog, board, Project chat, or related Project Task context to the agent.
- Adding project-level or user-level model selection.
- Supporting multiple interview depth modes in the first slice.
- Token-by-token visible streaming for Task Shaping Chat turns.
- Adding repository/codebase exploration to the product agent.
- Persisting browser-local draft state across reloads.
- Adding end-to-end browser tests in this slice.

## Further Notes

- The domain glossary now distinguishes Project Task Title, Project Task Description, Acceptance Criteria, Task Shaping Chat, Project Task, and A2A Task.
- ADR 0004 records Kanai's A2A exposure boundary: public agent cards, protected invocation, and startup validation for AI configuration.
- ADR 0005 records the A2A 1.0 SDK protocol boundary and explicitly deferred a multi-agent registry until there was a second agent; Task Shaping Chat is that second agent.
- The preferred implementation should preserve the existing manual task create/edit workflows when AI assistance fails or is unavailable.
