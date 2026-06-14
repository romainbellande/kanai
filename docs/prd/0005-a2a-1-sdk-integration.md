# A2A 1.0 SDK Integration

## Problem Statement

Kanai currently exposes the Acceptance Criteria helper through hand-written A2A-shaped JSON-RPC routes and local client stream parsing. This gives Project Members the assisted generation workflow they need, but it leaves Kanai owning protocol details that should belong to the official A2A SDKs, uses local A2A types where SDK types are available, and conflicts with the A2A 1.0 streaming model that represents progressive work as an A2A Task lifecycle rather than repeated message chunks.

## Solution

Migrate the Acceptance Criteria agent to A2A 1.0 end-to-end using the official A2A SDKs: `a2a-python` route factories and executor boundaries on the API, and the A2A JavaScript SDK client on the frontend. Preserve Kanai's Project Member experience, agent-scoped URLs, bearer authentication, Project access checks, and editable Acceptance Criteria workflow while moving protocol cards, messages, A2A Task streaming, and stream event handling to SDK-owned types and behavior.

## User Stories

1. As a Project Member, I want Acceptance Criteria generation to keep working from the existing Task form, so that the SDK migration does not disrupt my workflow.
2. As a Project Member, I want generated Acceptance Criteria to continue appearing in the editable Acceptance Criteria field, so that I can review and revise the output before saving.
3. As a Project Member, I want generation to remain available from both create and edit Task views, so that assistance works across Project Task shaping workflows.
4. As a Project Member, I want the generated criteria to stream progressively, so that I can see the agent working instead of waiting for a single final response.
5. As a Project Member, I want streamed criteria to appear as Markdown bullet text, so that the output remains easy to scan and edit.
6. As a Project Member, I want generated criteria to remain unsaved until I create or save the Project Task, so that AI assistance does not bypass my review.
7. As a Project Member, I want regeneration to replace the current Acceptance Criteria value after I explicitly ask for it, so that the field contains one coherent criteria list.
8. As a Project Member, I want existing Acceptance Criteria to be included as Project Task context during regeneration, so that the agent can improve or replace what I already have.
9. As a Project Member, I want generation to require at least a title or description, so that the agent has meaningful Project Task context.
10. As a Project Member, I want cancellation to remain available while text is streaming, so that I can stop a slow or unhelpful response.
11. As a Project Member, I want canceled generation to keep already-streamed partial text, so that I can decide whether it is useful.
12. As a Project Member, I want failed generation to restore the previous Acceptance Criteria value, so that an error does not overwrite my work.
13. As a Project Member, I want failed generation to show a non-blocking error, so that I can continue editing the Project Task manually.
14. As a Project Member, I want the Acceptance Criteria field to remain protected from edit races while generation is streaming, so that incoming text and my typing do not conflict.
15. As a Project Member, I want the generated criteria to use the same language as the Project Task context when possible, so that the Project Task remains linguistically consistent.
16. As a Project Member, I want generated criteria to stay concise and testable, so that they help judge whether a Project Task is ready to become a Finished Task.
17. As a Project Member, I want generated criteria to avoid generic boilerplate, so that the output reflects the actual Project Task context.
18. As a Project Member, I want generated criteria to avoid new implementation details unless the Project Task already includes them, so that Acceptance Criteria remain outcome-focused.
19. As a Project Member, I want only Project participants to invoke generation for a Project, so that Project context and model usage remain access-controlled.
20. As a Project Owner, I want A2A invocation to keep respecting Project access, so that adding interoperability does not weaken Project boundaries.
21. As an integrator, I want the Acceptance Criteria agent to advertise an A2A 1.0 agent card, so that clients can discover the protocol surface correctly.
22. As an integrator, I want the public agent card to remain available without bearer authentication, so that discovery works before invocation.
23. As an integrator, I want agent invocation to require Kanai bearer authentication, so that private Project context is not exposed through public discovery.
24. As an integrator, I want the agent card to advertise JSON-RPC as the supported interface, so that clients know which A2A transport to use.
25. As an integrator, I want the agent card to advertise absolute interface URLs, so that non-Kanai A2A clients can invoke the agent reliably.
26. As an integrator, I want the agent card to describe structured JSON input and plain text output, so that clients understand how to send Project Task context and consume Markdown criteria.
27. As an integrator, I want Kanai to preserve the agent-scoped URL convention, so that `/a2a/acceptance-criteria` remains the stable invocation surface.
28. As an integrator, I want the card path to remain `/a2a/acceptance-criteria/.well-known/agent-card.json`, so that existing discovery expectations remain valid.
29. As an integrator, I want A2A protocol objects to use SDK types where possible, so that Kanai does not maintain duplicate protocol definitions.
30. As an integrator, I want structured Project Task context to be carried as A2A data parts, so that the request is interoperable instead of relying on Kanai-specific message metadata.
31. As an integrator, I want the Project Task context field to be named `projectTask`, so that it cannot be confused with an A2A Task lifecycle object.
32. As an integrator, I want malformed A2A messages to produce protocol-shaped errors, so that clients receive errors consistent with A2A expectations.
33. As an integrator, I want authentication failures to preserve Kanai HTTP authentication semantics, so that bearer-token handling remains consistent with the rest of the API.
34. As an integrator, I want Project authorization failures to happen before model invocation, so that inaccessible Project context never reaches the generator.
35. As an operator, I want Kanai to target A2A 1.0 only, so that the protocol surface does not include unneeded v0.3 compatibility behavior.
36. As an operator, I want A2A protocol execution state to remain in memory, so that this migration does not add database tables or migration requirements.
37. As an operator, I want the API to require a public API base URL setting, so that advertised agent-card URLs are explicit and deployment misconfiguration fails early.
38. As an operator, I want the existing Pydantic AI model boundary to remain in place, so that the protocol migration does not change the model provider integration.
39. As an operator, I want generated criteria streaming to use A2A artifact updates, so that the A2A Task lifecycle has clear output semantics.
40. As an operator, I want the completed A2A Task to expose a final full Acceptance Criteria artifact when feasible, so that generic A2A clients can inspect the completed output.
41. As a frontend maintainer, I want the client to use the A2A JavaScript SDK for discovery, sending, and stream consumption, so that custom protocol parsing is minimized.
42. As a frontend maintainer, I want SDK client creation to reuse Kanai bearer-token refresh behavior, so that A2A calls behave like other authenticated client calls.
43. As a frontend maintainer, I want the A2A client to be cached per browser session and API base URL, so that repeated generation does not rediscover the public card each time.
44. As a frontend maintainer, I want Kanai UI code to continue calling a local generation helper, so that UI components do not depend directly on SDK protocol details.
45. As a backend maintainer, I want the API to use `a2a-python` route factories and an AgentExecutor, so that route/card/streaming behavior follows the SDK.
46. As a backend maintainer, I want Project access checks to live in the executor path, so that validation can use the authenticated user and parsed Project Task context.
47. As a backend maintainer, I want local helpers around noisy SDK or protobuf construction, so that feature code stays readable while still using SDK boundary types.
48. As a backend maintainer, I want unknown Project Task context fields rejected, so that prompt construction receives only the explicit domain contract.
49. As a tester, I want tests to assert externally visible behavior rather than SDK internals, so that the code can evolve with SDK implementation details.
50. As a tester, I want stream tests to assert A2A Task and artifact event behavior rather than the old NDJSON message chunk shape, so that tests reflect the A2A 1.0 contract.

## Implementation Decisions

- Target A2A protocol 1.0 end-to-end.
- Use the official Python A2A SDK for API route creation, agent cards, JSON-RPC handling, executor invocation, A2A Task lifecycle streaming, and in-memory A2A Task state.
- Use the official JavaScript A2A SDK on the client for agent-card discovery, authenticated invocation, and stream event consumption.
- Use minimum compatible dependency ranges consistent with the existing dependency style.
- Use the JavaScript SDK 1.0 alpha or `next` channel until a stable JavaScript SDK release supports A2A 1.0.
- Preserve the stable `acceptance-criteria` agent slug.
- Preserve the agent-scoped invocation URL and public agent-card URL.
- Advertise only JSON-RPC transport for this feature.
- Do not enable A2A v0.3 compatibility mode.
- Keep the public basic agent card as the only advertised card; do not add an authenticated extended card in this slice.
- Add a required backend public API base URL setting and use it to produce absolute interface URLs in the agent card.
- Keep A2A routes visible in FastAPI OpenAPI output when the SDK helper supports that cleanly.
- Stop relying on generated OpenAPI client types for A2A protocol contracts on the frontend.
- Use SDK types at protocol boundaries and local helper functions where SDK or protobuf construction would otherwise make feature code noisy.
- Preserve Kanai bearer authentication for invocation and keep public card discovery unauthenticated.
- Reuse the frontend's existing token retrieval and refresh-on-401 behavior through A2A SDK authentication or fetch hooks.
- Enforce Project access inside the A2A executor before invoking the model.
- Keep the existing Pydantic AI/OpenAI-compatible generator boundary; A2A replaces protocol handling, not model-provider integration.
- Model progressive generation as an A2A Task lifecycle, not as repeated message chunks.
- Use in-memory A2A Task storage for short-lived protocol execution state.
- Implement A2A cancellation as cooperative best effort while preserving the current UI abort behavior.
- Send Project Task context as structured A2A data parts rather than custom message metadata.
- Name the structured domain payload `projectTask` to distinguish it from A2A Task lifecycle state.
- Keep local Kanai schemas for Project Task context carried inside A2A data parts.
- Include only the current form context in the Project Task payload: title, description, existing Acceptance Criteria, priority, Story Points, tag, selected workflow column, and create/edit mode.
- Reject unknown Project Task context fields.
- Continue requiring a title or description before generation.
- Advertise structured JSON input and plain text output for the Acceptance Criteria skill.
- Stream generated Acceptance Criteria text as artifact delta updates.
- Use status updates only for A2A Task lifecycle state.
- Use stable artifact identifiers or names to distinguish streamed delta artifacts from the final full Acceptance Criteria artifact.
- Publish a final full Acceptance Criteria artifact on the completed A2A Task when feasible.
- Have the Kanai client append only delta artifact text to the textarea and avoid blindly appending the final full artifact.
- Cache the A2A SDK client per browser session and API base URL.
- Keep UI components behind a local Kanai generation helper rather than importing SDK client details directly.
- Preserve current UI behavior for field clearing, streamed append, cancellation, failure rollback, and manual save boundaries.
- Do not add a database migration for this migration.

## Testing Decisions

- Good tests should assert external behavior at the highest practical seam and avoid asserting SDK internals or exact SDK serialization details.
- Backend route tests should cover the public agent card remaining reachable without bearer authentication.
- Backend route tests should cover invocation requiring bearer authentication.
- Backend tests should cover Project access validation before model invocation.
- Backend tests should cover malformed A2A requests or invalid Project Task context producing safe protocol-shaped errors where appropriate.
- Backend tests should cover unknown Project Task context fields being rejected.
- Backend tests should cover structured data-part Project Task context being accepted and passed to the generator boundary.
- Backend tests should cover generated text being emitted through A2A Task lifecycle artifact updates from a stubbed generator.
- Backend tests should cover final full artifact behavior when feasible.
- Backend tests should cover cancellation or stream closure as best-effort behavior without requiring durable cancellation state.
- Backend settings tests should cover required public API base URL behavior.
- Backend settings tests should preserve coverage for required AI configuration behavior.
- Backend tests should avoid live model calls by stubbing the Pydantic AI generator boundary.
- Backend tests should use the existing authenticated router and A2A feature tests as prior art.
- Frontend API client tests should cover SDK client/card discovery using the agent-scoped card path.
- Frontend API client tests should cover bearer-token injection and refresh-on-401 behavior through SDK hooks.
- Frontend API client tests should cover structured `projectTask` data-part payload construction.
- Frontend API client tests should cover extracting delta artifact text from SDK stream events.
- Frontend API client tests should cover ignoring or not appending the final full artifact to avoid duplicated textarea content.
- Frontend API client tests should cover cancellation forwarding through the SDK call signal where supported.
- Frontend page and hook tests should preserve current behavior for the generate control, streaming text into the Acceptance Criteria field, field locking, cancellation, failure rollback, and manual persistence.
- Frontend tests should use existing Task form and Task detail generation tests as prior art.
- Dependency or lockfile changes should be verified with the repo's existing frontend and backend checks when feasible.

## Out of Scope

- Adding new A2A agents beyond the existing Acceptance Criteria agent.
- Adding a reusable multi-agent registry before there is a second agent.
- Supporting A2A v0.3 compatibility mode.
- Exposing HTTP+JSON/REST or gRPC A2A transports.
- Adding an authenticated extended agent card.
- Persisting A2A Task history or generation metadata.
- Adding database tables or migrations.
- Replacing the Pydantic AI/OpenAI-compatible model provider boundary.
- Changing the Project Task create/save persistence workflow.
- Generating Project Task fields other than Acceptance Criteria.
- Sending broad Project, Sprint, Backlog, related Project Task, or Sprint History context to the agent.
- Adding a persistent AI-generated marker to saved Project Tasks.
- Adding end-to-end browser tests in this slice.

## Further Notes

- `Acceptance Criteria`, `Project Task`, `A2A Task`, `Project Member`, `Project Owner`, `Finished Task`, and related planning terms are defined in the root domain glossary.
- ADR 0004 records the original A2A exposure decision: public card discovery, protected invocation, and required AI startup configuration.
- ADR 0005 records the new decision to target A2A 1.0 and let the official A2A SDKs own the protocol boundary.
- The highest testing seams are the API A2A route/executor boundary, the frontend A2A generation helper boundary, and existing Task form UI behavior. New low-level seams should be added only where SDK/protobuf construction would otherwise make behavior hard to test.
