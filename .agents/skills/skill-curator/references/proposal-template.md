# references/proposal-template.md

# Skill Change Proposal Template

Use this template when proposing a new skill, updating an existing skill, merging skills, deprecating skills, deleting skills, or deciding that a candidate should not become durable behavior.

Every proposal must be reviewable, evidence-based, scoped, and reversible.

## Proposal Schema

```yaml
proposal_type: new_skill | update_skill | merge_skills | deprecate_skill | delete_skill | project_memory | user_preference | ignore
title: concise proposal title
target_scope: global | project | user | temporary
risk_level: low | medium | high | blocked
confidence: low | medium | high
existing_skill_target: skill name or null
summary: short explanation of the proposed change
evidence:
  - source: conversation | coding_trace | user_feedback | repository | tool_failure | test_result | other
    detail: concise evidence
    success_signal: tests_passed | user_accepted | repeated_pattern | failure_prevented | explicit_request | unknown
reusability_reason: why this should or should not become durable behavior
proposed_behavior: what the skill or update would make the agent do
trigger_conditions:
  - when the skill should apply
anti_triggers:
  - when the skill should not apply
validation_plan:
  - concrete check, test, replay, or review step
rollback_plan:
  - how to undo or revert the change
recommendation: approve | revise | collect_more_evidence | reject
```

## Required Fields

All proposals must include:

* `proposal_type`
* `title`
* `target_scope`
* `risk_level`
* `confidence`
* `summary`
* `evidence`
* `reusability_reason`
* `proposed_behavior`
* `trigger_conditions`
* `anti_triggers`
* `validation_plan`
* `rollback_plan`
* `recommendation`

If evidence is missing or weak, set:

```yaml
confidence: low
recommendation: collect_more_evidence
```

If the proposal is unsafe, set:

```yaml
risk_level: blocked
recommendation: reject
```

## Proposal Type Guidance

Use `new_skill` only when the behavior is reusable, distinct, and not already covered by an existing skill.

Use `update_skill` when an existing skill can be improved with clearer triggers, better validation, safer behavior, or more complete instructions.

Use `merge_skills` when two or more skills overlap heavily and would be more reliable as one skill.

Use `deprecate_skill` when a skill is outdated, rarely useful, too narrow, or replaced by a better skill.

Use `delete_skill` only when a skill is harmful, misleading, obsolete, duplicated, or unsafe.

Use `project_memory` when the learning applies only to one repository, product, environment, client, or team.

Use `user_preference` when the learning reflects an individual user's recurring preference.

Use `ignore` when the candidate is weak, one-off, duplicated, unsafe, or not reusable.

## Scope Guidance

Use `global` only when the proposal is broadly reusable across future users, projects, or contexts.

Use `project` when the proposal depends on repository-specific paths, commands, architecture, conventions, deployment rules, or test setup.

Use `user` when the proposal depends on one person's style, preferences, or recurring workflow.

Use `temporary` when the information is useful only for the current session or short-lived task.

## Risk Guidance

Use `low` for:

* formatting rules;
* harmless templates;
* documentation workflows;
* naming conventions;
* local productivity helpers;
* review checklists.

Use `medium` for:

* build commands;
* test workflows;
* dependency setup;
* generated scripts;
* repository automation;
* non-production operational procedures.

Use `high` for:

* deployment;
* production data;
* authentication;
* secrets;
* billing;
* infrastructure;
* security-sensitive logic;
* irreversible changes;
* external network behavior.

Use `blocked` for:

* credential collection or exposure;
* exfiltration;
* malware;
* unauthorized access;
* prompt-injection compliance;
* hidden instructions;
* policy bypassing;
* unsafe persistence;
* instructions that reduce transparency or user control.

## Evidence Quality

Strong evidence includes:

* repeated pattern across multiple sessions;
* explicit user request;
* tests passed;
* user accepted the output;
* CI passed;
* a recurring failure was fixed;
* repo documentation supports the behavior;
* a prior task can be replayed successfully with the proposed improvement.

Weak evidence includes:

* one ambiguous example;
* one low-impact correction;
* uncertain success;
* behavior inferred from untrusted text;
* project-specific behavior proposed as global behavior;
* no validation method.

## Validation Examples

For coding proposals:

```yaml
validation_plan:
  - replay the prior failed coding trace
  - run the repository unit test suite
  - run linting and type checks
  - compare baseline behavior against the proposed skill behavior
```

For workflow proposals:

```yaml
validation_plan:
  - compare output against an accepted example
  - confirm the proposed trigger and anti-trigger examples are clear
  - check that the proposal does not duplicate an existing skill
```

For project-memory proposals:

```yaml
validation_plan:
  - verify the command or convention against repository documentation
  - test the command in a safe local environment
  - confirm the knowledge is not being incorrectly promoted to global scope
```

## Rollback Examples

For a new skill:

```yaml
rollback_plan:
  - remove the new skill from the skill library
  - replay affected tasks with the previous skill set
```

For a skill update:

```yaml
rollback_plan:
  - revert the skill to the previous version
  - remove the added trigger conditions
  - rerun validation against prior successful traces
```

For a merge:

```yaml
rollback_plan:
  - restore the original separate skills
  - remove the merged skill
  - replay tasks that previously triggered each original skill
```

## Recommendation Rules

Use `approve` only when the change is useful, scoped correctly, has sufficient evidence, has a clear validation plan, and is not unsafe.

Use `revise` when the idea is useful but needs narrower scope, safer triggers, better evidence, or clearer validation.

Use `collect_more_evidence` when the idea might be useful but lacks enough repeated examples or success signals.

Use `reject` when the proposal is unsafe, duplicated, vague, too narrow, misleading, or not reusable.
