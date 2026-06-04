#!/usr/bin/env bash

ralph_require_positive_integer() {
  local name="$1"
  local value="${2:-}"

  if [[ ! "$value" =~ ^[1-9][0-9]*$ ]]; then
    printf '%s must be a positive integer\n' "$name" >&2
    return 1
  fi
}

ralph_parallelism_cap() {
  local value="${RALPH_PARALLELISM:-4}"

  ralph_require_positive_integer RALPH_PARALLELISM "$value" || return 1
  printf '%s\n' "$value"
}

ralph_require_tools() {
  local missing=0
  local tool

  for tool in "$@"; do
    if ! command -v "$tool" >/dev/null 2>&1; then
      printf 'Missing required tool: %s\n' "$tool" >&2
      missing=1
    fi
  done

  [ "$missing" -eq 0 ]
}

ralph_require_clean_checkout() {
  local repo="${1:-.}"
  local status

  status="$(git -C "$repo" status --porcelain --untracked-files=all)" || return 1
  if [ -n "$status" ]; then
    printf 'Checkout must be clean before Ralph AFK orchestration starts.\n' >&2
    printf '%s\n' "$status" >&2
    return 1
  fi
}

ralph_worker_result() {
  local exit_code="$1"
  local output="${2:-}"

  if [ "$exit_code" -ne 0 ]; then
    printf 'failed\n'
  elif [[ "$output" == *'<promise>ISSUE COMPLETE</promise>'* ]]; then
    printf 'complete\n'
  elif [[ "$output" == *'<promise>ISSUE INCOMPLETE</promise>'* ]]; then
    printf 'incomplete\n'
  else
    printf 'missing\n'
  fi
}

ralph_merge_result() {
  local exit_code="$1"
  local output="${2:-}"

  if [ "$exit_code" -ne 0 ]; then
    printf 'failed\n'
  elif [[ "$output" == *'<promise>MERGE COMPLETE</promise>'* ]]; then
    printf 'complete\n'
  elif [[ "$output" == *'<promise>MERGE PARTIAL</promise>'* ]]; then
    printf 'partial\n'
  elif [[ "$output" == *'<promise>MERGE FAILED</promise>'* ]]; then
    printf 'failed\n'
  else
    printf 'missing\n'
  fi
}

ralph_wave_summary() {
  local base_commit="$1"
  shift

  printf 'Base commit: %s\n' "$base_commit"
  printf 'Workers:\n'

  local record issue branch worktree log result
  for record in "$@"; do
    IFS='|' read -r issue branch worktree log result <<< "$record"
    printf -- '- issue=%s branch=%s worktree=%s log=%s result=%s\n' \
      "$issue" "$branch" "$worktree" "$log" "$result"
  done
}
