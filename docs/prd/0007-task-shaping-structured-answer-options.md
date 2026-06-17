# Task Shaping Structured Answer Options

## Problem Statement

Task Shaping Chat is planned to ask one focused question at a time, but a prose-only recommended answer leaves the frontend without a deterministic way to render suggested responses as selectable controls. Project Members need fast, low-friction answers when a suggestion fits, while still retaining a free-form path when none of the suggestions match their intent.

## Solution

Extend Task Shaping Chat turns so the active Task Shaping Interview Question includes structured Task Shaping Answer Options. The UI renders those options as a single-select radio group, marks the recommended option without auto-selecting it, and always includes a custom response option that reveals a free textarea. Sending an answer remains explicit, and the selected option's response text or the custom text becomes the Project Member's next transcript answer.

## User Stories

1. As a Project Member, I want each active Task Shaping Interview Question to show suggested answers as radio button items, so that I can answer quickly when a suggestion fits.
2. As a Project Member, I want exactly one suggested answer to be visibly recommended, so that I know which answer the agent thinks is most likely useful.
3. As a Project Member, I want the recommended answer to remain unselected by default, so that I still intentionally choose what to send.
4. As a Project Member, I want every active question to include a custom response radio option, so that I can answer in my own words.
5. As a Project Member, I want selecting the custom response option to reveal a textarea, so that I can provide a free-form answer only when needed.
6. As a Project Member, I want predefined answer options to be fixed choices, so that selecting one is quick and unambiguous.
7. As a Project Member, I want to modify or combine suggested ideas through the custom response option, so that I am not limited by the predefined choices.
8. As a Project Member, I want choosing a radio option not to call the agent immediately, so that I can review my choice before spending a model turn.
9. As a Project Member, I want an explicit Send answer action after choosing a predefined option, so that I control when the next Task Shaping Chat turn starts.
10. As a Project Member, I want Send answer to be enabled when a predefined option is selected, so that I do not have to type anything extra.
11. As a Project Member, I want Send answer to require non-empty text when custom response is selected, so that accidental blank answers are not sent.
12. As a Project Member, I want only the latest active Task Shaping Interview Question to show interactive radio options, so that the conversation remains one-question-at-a-time.
13. As a Project Member, I want earlier questions and answers to remain visible as transcript history, so that I can understand how the current draft was shaped.
14. As a Project Member, I want ready Task Shaping Chat turns to focus on applyable field drafts without requiring another question, so that the interview can stop when the Project Task is sufficiently shaped.
15. As a Project Member, I want a turn to be able to include both partial field drafts and a next question, so that I can apply useful draft content while continuing to refine uncertain details.
16. As a Project Member, I want suggested answer labels and details to make clear what will be sent, so that hidden response text does not commit me to something I did not see.
17. As a Project Member starting from a blank create form, I want the first structured question to ask about the desired outcome, so that Task Shaping Chat starts with useful intent rather than title wording.
18. As a Project Member editing an existing Project Task, I want structured questions to focus on the weakest or most uncertain part of the current draft, so that the interview improves existing content rather than restarting blindly.
19. As a Project Member working with a partially filled form, I want structured questions to ask the next domain-relevant clarification, so that Task Shaping Chat does not mechanically ask for the first blank field.
20. As a frontend maintainer, I want answer options to arrive in a typed structured field, so that the UI does not parse arbitrary assistant prose into controls.
21. As a frontend maintainer, I want the answer option contract to replace the older prose recommendation field, so that there is one source of truth for recommendations.
22. As a frontend maintainer, I want predictable option identifiers, so that radio group state is stable and testable.
23. As a frontend maintainer, I want the custom response option to use a reserved identifier, so that custom textarea behavior is deterministic.
24. As a backend maintainer, I want the backend to normalize answer option identifiers, so that model-provided IDs cannot leak unsafe or inconsistent UI values.
25. As a backend maintainer, I want the backend to enforce the presence of the custom response option, so that the product invariant does not depend only on prompt compliance.
26. As a backend maintainer, I want the frontend to defensively preserve the custom response option if the response is imperfect, so that users are not trapped by malformed suggestions.
27. As a backend maintainer, I want malformed structured model output to fail retryably, so that the UI does not render partial or misleading controls.
28. As an integrator, I want the structured answer-option contract to remain inside the existing Task Shaping Chat A2A turn artifact, so that the A2A boundary stays consistent.
29. As an integrator, I want selected predefined options to be sent back as transcript answer text, so that external clients do not need to preserve UI-only option identifiers.
30. As a tester, I want the structured option contract covered through backend, client helper, and form behavior tests, so that regressions are caught at externally visible seams.

## Implementation Decisions

- Build this as a refinement of Task Shaping Chat rather than a separate agent capability.
- Use the canonical terms Task Shaping Interview Question, Task Shaping Answer Option, and Task Shaping Transcript.
- Keep the active interview question separate from assistant framing text.
- The turn output contract includes an assistant message, an optional question, optional field drafts, and readiness metadata.
- The question contains question text and a list of Task Shaping Answer Options.
- Each active question includes 2-4 model-proposed answer options plus the required custom response option.
- Each model-proposed answer option contains an identifier, visible label, optional detail, response text, and optional recommended marker.
- The response text is the answer appended to the Task Shaping Transcript when a predefined option is sent.
- Response text must not contain hidden meaning beyond the visible label and detail.
- Exactly one model-proposed answer option is marked recommended when a question is present.
- The recommended option is displayed with a recommendation affordance but is not auto-selected.
- The custom response option is product-controlled, not model-controlled.
- The custom response option uses the reserved identifier `custom_response`.
- The backend normalizes model-proposed option identifiers into stable UI-safe values.
- The backend enforces the custom response option, and the frontend defensively preserves the custom path.
- Predefined answer options are not editable before send.
- Selecting the custom response option reveals a textarea with product-controlled copy.
- Selecting a radio option does not start the next A2A invocation.
- The next A2A invocation starts only from an explicit Send answer action.
- Send answer is enabled for a selected predefined option or for a selected custom response with non-whitespace text.
- Only the latest active Task Shaping Interview Question renders interactive radio options.
- Past transcript entries remain read-only and preserve assistant framing plus the exact question text.
- User transcript entries contain the selected option response text or custom response text, not UI-only option metadata.
- A ready turn may omit the next question and focus on applyable field drafts.
- A non-ready turn may include both partial field drafts and a next question.
- Use native structured output at the model boundary for Task Shaping turns instead of wrapping prose output after the model call.
- Malformed structured model output fails retryably after validation instead of rendering partial controls.
- Render answer options with a shadcn RadioGroup using the project's Base UI style.
- Do not add database tables or migrations for this refinement.

## Testing Decisions

- Test externally visible behavior at the highest practical seams and avoid asserting SDK internals.
- Backend tests should cover parsing and returning a turn with a structured question and answer options.
- Backend tests should cover backend normalization of option identifiers.
- Backend tests should cover required custom response option enforcement.
- Backend tests should cover exactly one recommended model-proposed option when a question is present.
- Backend tests should cover malformed structured output failing retryably rather than producing partial controls.
- Frontend A2A client tests should cover extracting `question.answerOptions` from the Task Shaping Chat turn artifact.
- Frontend A2A client tests should cover the absence of the older prose recommendation field from the normalized contract.
- Frontend form tests should cover answer options rendered as radio button items for the latest active question.
- Frontend form tests should cover the recommended option being marked but not auto-selected.
- Frontend form tests should cover predefined option selection enabling Send answer without requiring textarea text.
- Frontend form tests should cover custom response selection revealing the textarea and requiring non-empty text.
- Frontend form tests should cover Send answer appending predefined response text to the transcript.
- Frontend form tests should cover Send answer appending custom textarea text to the transcript.
- Frontend form tests should cover past questions being read-only while only the latest question remains interactive.
- Frontend form tests should cover ready turns that omit a next question and leave draft application available.
- Existing Task Shaping Chat A2A route tests, frontend A2A client tests, and task form tests are the closest prior art.

## Out of Scope

- Persisting Task Shaping Chat transcripts.
- Adding durable A2A Task history.
- Supporting multi-select answers or checkbox-style questions.
- Letting the agent define arbitrary UI control types.
- Letting answer options represent product actions such as Apply drafts, Reset chat, Retry turn, Create, or Save.
- Editing predefined answer options inline.
- Sending selected option identifiers or full option metadata back to the agent.
- Adding separate staleness warnings for answer options.
- Replacing draft staleness warnings.
- Changing the existing Project Task Create or Save persistence boundary.
- Replacing the existing Acceptance Criteria one-shot helper.
- Adding end-to-end browser tests in this slice.

## Further Notes

- This PRD builds on the Task Shaping Chat PRD and narrows the earlier “recommended answer or direction” language into a deterministic structured option contract.
- The A2A agent exposure and SDK protocol boundary ADRs still apply: public agent card discovery, protected invocation, Project access checks, and SDK-owned protocol handling remain unchanged.
- The domain glossary distinguishes Project Task, Task Shaping Chat, Task Shaping Interview Question, Task Shaping Answer Option, Task Shaping Transcript, and A2A Task.
