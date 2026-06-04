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
parallelism="$(ralph_parallelism_cap)"

for ((i=1; i<=$1; i++)); do
  assignment="$(ralph_claim_ready_afk_issues "$parallelism")"

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

  ralph_require_tools opencode-sandbox

  commits=$(git log -n 5 --format="%H%n%ad%n%B---" --date=short 2>/dev/null || echo "No commits found")
  prompt=$(cat ralph/prompt.md)
  merge_prompt=$(cat ralph/merge-prompt.md)
  if ! wave_output="$(ralph_run_worker_wave . "$assignment" "$commits" "$prompt")"; then
    echo "$wave_output"
    echo "Ralph worker wave failed." >&2
    exit 1
  fi
  echo "$wave_output"

  complete_workers=0
  while IFS= read -r line; do
    [[ "$line" == finished\|* ]] || continue
    worker_record="${line#finished|}"
    IFS='|' read -r issue_id _ _ _ result <<< "$worker_record"
    if [ "$result" = complete ]; then
      complete_workers=$((complete_workers + 1))
    else
      echo "Ralph worker did not complete assigned issue $issue_id: $result" >&2
    fi
  done <<< "$wave_output"

  if [ "$complete_workers" -eq 0 ]; then
    echo "Ralph worker wave produced no completed branches." >&2
    exit 1
  fi

  if ! merge_output="$(ralph_run_merge_agent . "$wave_output" "$commits" "$merge_prompt")"; then
    echo "$merge_output"
    echo "Ralph merge agent failed." >&2
    exit 1
  fi
  echo "$merge_output"

  if [[ "$merge_output" == *'merge_finished|'*'|partial'* ]]; then
    ralph_require_clean_checkout .
  fi
done
