#!/bin/bash
set -eo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$script_dir/helpers.sh"

if [ -z "$1" ]; then
  echo "Usage: $0 <iterations>"
  exit 1
fi

ralph_require_positive_integer iterations "$1"
ralph_require_tools bd jq

# jq filter to extract streaming text from opencode JSON events
stream_text='select(.type == "text").part.text // empty | gsub("\n"; "\r\n") | . + "\r\n\n"'

# jq filter to extract final result
final_result='select(.type == "text").part.text // empty'

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

  tmpfile=$(mktemp)
  trap "rm -f $tmpfile" EXIT

  commits=$(git log -n 5 --format="%H%n%ad%n%B---" --date=short 2>/dev/null || echo "No commits found")
  prompt=$(cat ralph/prompt.md)

  opencode-sandbox . run \
    --dangerously-skip-permissions \
    --format json \
    "Previous commits: $commits Assigned AFK issue JSON: $issue_json Work only on assigned issue $issue_id. Do not select or claim another issue. $prompt" \
  | grep --line-buffered '^{' \
  | tee "$tmpfile" \
  | jq --unbuffered -rj "$stream_text"

  result=$(jq -r "$final_result" "$tmpfile")

  if [[ "$result" == *"<promise>NO MORE TASKS</promise>"* ]]; then
    echo "Ralph complete after $i iterations."
    exit 0
  fi
done
