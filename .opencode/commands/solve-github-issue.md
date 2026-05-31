# Solve GitHub Issue

Solve the GitHub $1

Workflow:

1. Validate that `$1` is present and is a GitHub issue link. If it is missing or invalid, stop and ask for a valid issue URL.
2. Inspect the issue with `gh issue view` and extract the issue ID/number.
3. Create a dedicated branch for the issue before making code changes. Use a concise branch name that includes the issue number.
4. Understand the repository context and implement the smallest correct fix for the issue.
5. Run the relevant verification commands for the files changed.
6. Commit the changes. The commit message must include the issue ID in the footer, for example:

```text
closes: #123
```

7. Push the branch and create a pull request against the `main` branch.
8. In the final response, include the branch name, commit hash, pull request URL, and any verification results.

Constraints:

- Do not work directly on `main`.
- Do not skip the final commit unless there are no code changes needed.
- Do not create the pull request against any branch other than `main`.
- Preserve unrelated user changes in the working tree.
