---
date: 2026-06-20
topic: generic-404-redirect
---

# Generic 404 Redirect

## Summary

Kanai will provide one canonical generic not-found experience at `/404`. Missing Project pages, missing Project Task pages, and unmatched URLs will all land there, with a primary action that returns users to Projects.

---

## Problem Frame

Users can arrive at invalid or stale app URLs when a project or task no longer exists, an ID is mistyped, or a route is unknown. Those cases should not leave users on inconsistent inline missing-resource states or unclear router fallbacks. The recovery path should be predictable and easy to escape.

---

## Actors

- A1. User: Navigates to Kanai project, task, or arbitrary app URLs.

---

## Key Flows

- F1. Missing project recovery
  - **Trigger:** A user opens a Project page for a project that cannot be found.
  - **Actors:** A1
  - **Steps:** The app detects the missing Project, sends the user to `/404`, and shows the generic not-found page.
  - **Outcome:** The user sees one clear recovery action back to Projects.
  - **Covered by:** R1, R2, R4

- F2. Missing task recovery
  - **Trigger:** A user opens a Project Task page for a task that cannot be found.
  - **Actors:** A1
  - **Steps:** The app detects the missing Project Task, sends the user to `/404`, and shows the generic not-found page.
  - **Outcome:** The user sees the same not-found experience as other missing resources.
  - **Covered by:** R1, R2, R4

- F3. Unknown route recovery
  - **Trigger:** A user opens an unmatched app URL.
  - **Actors:** A1
  - **Steps:** The app sends the user to `/404` and shows the generic not-found page.
  - **Outcome:** Unknown URLs have the same recovery path as missing resources.
  - **Covered by:** R1, R3, R4

---

## Requirements

**Canonical not-found experience**
- R1. The app must provide a generic 404 page at canonical path `/404`.
- R2. Missing Project and Project Task pages must redirect to the generic 404 page.
- R3. Unknown or unmatched app URLs must end up on the generic 404 page.
- R4. The generic 404 page must include a primary “Go to Projects” action that navigates to `/`.

**Navigation behavior**
- R5. Redirects to `/404` must replace browser history so the back button does not loop through the missing or unmatched URL.

---

## Acceptance Examples

- AE1. **Covers R1, R2, R4, R5.** Given a user opens a URL for a Project that cannot be found, when the app handles the missing Project, the browser lands on `/404`, the page shows a “Go to Projects” action, and pressing back does not return to the missing Project URL.
- AE2. **Covers R1, R2, R4, R5.** Given a user opens a URL for a Project Task that cannot be found, when the app handles the missing Project Task, the browser lands on `/404`, the page shows a “Go to Projects” action, and pressing back does not return to the missing task URL.
- AE3. **Covers R1, R3, R4, R5.** Given a user opens an unmatched app URL, when the app handles the route, the browser lands on `/404`, the page shows a “Go to Projects” action, and pressing back does not loop back to the unmatched URL.

---

## Success Criteria

- Users see one consistent, understandable not-found page for stale Project URLs, stale Project Task URLs, and unknown URLs.
- A downstream implementer can build the change without inventing redirect targets, recovery actions, or history behavior.

---

## Scope Boundaries

- No `CONTEXT.md` update; this is routing/UI behavior, not domain language.
- No ADR unless the design changes into a hard-to-reverse architectural decision.
- No broader error-handling redesign.
- No custom per-resource missing-page copy in this scope.

---

## Key Decisions

- Use one canonical `/404` destination: keeps missing-resource and unknown-route recovery consistent.
- Replace history during redirects: prevents back-button loops.
- Use “Go to Projects” as the primary action: gives users a simple recovery path to the app home.

---

## Dependencies / Assumptions

- The app has a Projects landing page at `/`.
- Planning or implementation should verify the current router behavior before changing unmatched-route handling.
