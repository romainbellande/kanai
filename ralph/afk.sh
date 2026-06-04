#!/bin/bash
set -eo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$script_dir/helpers.sh"

if [ -z "$1" ]; then
  echo "Usage: $0 <iterations>"
  exit 1
fi

ralph_require_positive_integer iterations "$1"
ralph_require_tools bd git jq

for ((i=1; i<=$1; i++)); do
  assignment="$(ralph_claim_ready_afk_issues 1)"

  if [ "$assignment" = "no_more_tasks" ]; then
    echo "Ralph complete after $i iterations."
    exit 0
  fi

  if [[ "$assignment" == no_ready_tasks* ]]; then
    echo "Ralph has no ready AFK tasks."
    echo "$assignment"
    exit 0
  fi

  if [[ "$assignment" != assigned\|* ]]; then
    echo "Unexpected Ralph assignment result: $assignment" >&2
    exit 1
  fi

  issue_id="${assignment#assigned|}"
  issue_id="${issue_id%%|*}"
  issue_json="${assignment#assigned|$issue_id|}"

  ralph_require_tools opencode-sandbox

  commits=$(git log -n 5 --format="%H%n%ad%n%B---" --date=short 2>/dev/null || echo "No commits found")
  prompt=$(cat ralph/prompt.md)
  worker_record="$(ralph_run_isolated_worker . "$issue_id" "$issue_json" "$commits" "$prompt")"
  echo "$worker_record"

  IFS='|' read -r _ _ _ _ result <<< "$worker_record"

  if [ "$result" != complete ]; then
    echo "Ralph worker did not complete assigned issue $issue_id: $result" >&2
    exit 1
  fi
done
