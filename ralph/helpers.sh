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

ralph_compact_json() {
  jq -c .
}

ralph_claim_ready_afk_issues() {
  local limit="$1"
  ralph_require_positive_integer limit "$limit" || return 1

  local ready_json ready_count
  ready_json="$(bd ready --json --label afk --exclude-label hitl)" || return 1
  ready_count="$(printf '%s' "$ready_json" | jq 'length')" || return 1

  if [ "$ready_count" -eq 0 ]; then
    local remaining_json remaining_count
    remaining_json="$(bd list --json --status open,in_progress,blocked --label afk --exclude-label hitl)" || return 1
    remaining_count="$(printf '%s' "$remaining_json" | jq 'length')" || return 1

    if [ "$remaining_count" -eq 0 ]; then
      printf 'no_more_tasks\n'
    else
      printf 'no_ready_tasks|%s\n' "$(printf '%s' "$remaining_json" | ralph_compact_json)"
    fi
    return 0
  fi

  local index=0
  local assigned=0
  while [ "$index" -lt "$ready_count" ] && [ "$assigned" -lt "$limit" ]; do
    local issue_json issue_id claim_json
    issue_json="$(printf '%s' "$ready_json" | jq -c ".[$index]")" || return 1
    issue_id="$(printf '%s' "$issue_json" | jq -r '.id')" || return 1

    if claim_json="$(bd update "$issue_id" --claim --json 2>/dev/null)"; then
      printf 'assigned|%s|%s\n' "$issue_id" "$(printf '%s' "$claim_json" | ralph_compact_json)"
      assigned=$((assigned + 1))
    fi

    index=$((index + 1))
  done

  if [ "$assigned" -eq 0 ]; then
    printf 'no_ready_tasks|[]\n'
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

ralph_safe_issue_path() {
  printf '%s' "$1" | tr -c 'A-Za-z0-9._-' '-'
}

ralph_run_isolated_worker() {
  local repo="$1"
  local issue_id="$2"
  local issue_json="$3"
  local commits="$4"
  local prompt="$5"

  local safe_id branch worktree_rel worktree_abs log_rel log_abs base_commit
  safe_id="$(ralph_safe_issue_path "$issue_id")"
  branch="ralph/$safe_id"
  worktree_rel=".worktrees/$safe_id"
  worktree_abs="$repo/$worktree_rel"
  log_rel=".ralph/logs/$safe_id.jsonl"
  log_abs="$repo/$log_rel"
  base_commit="$(git -C "$repo" rev-parse HEAD)" || return 1

  if git -C "$repo" show-ref --verify --quiet "refs/heads/$branch" || [ -e "$worktree_abs" ]; then
    printf '%s|%s|%s|%s|skipped\n' "$issue_id" "$branch" "$worktree_rel" "$log_rel"
    return 0
  fi

  mkdir -p "$(dirname "$log_abs")"
  git -C "$repo" worktree add --quiet -b "$branch" "$worktree_abs" "$base_commit" || return 1

  local tmpfile exit_code output result head_commit
  tmpfile="$(mktemp)"

  set +e
  opencode-sandbox "$worktree_abs" run \
    --dangerously-skip-permissions \
    --format json \
    "Previous commits: $commits Assigned AFK issue JSON: $issue_json Work only on assigned issue $issue_id. Do not select or claim another issue. Issue tracking is read-only after assignment; do not run bd update, bd close, or bd create. $prompt" \
    | grep --line-buffered '^{' \
    | tee "$log_abs" "$tmpfile" \
    | jq --unbuffered -rj 'select(.type == "text").part.text // empty | gsub("\\n"; "\\r\\n") | . + "\\r\\n\n"' >&2
  exit_code=${PIPESTATUS[0]}
  set -e

  output="$(jq -r 'select(.type == "text").part.text // empty' "$tmpfile")"
  rm -f "$tmpfile"

  result="$(ralph_worker_result "$exit_code" "$output")"
  head_commit="$(git -C "$repo" rev-parse "$branch")" || return 1
  if [ "$result" = complete ] && [ "$head_commit" = "$base_commit" ]; then
    result="no_commit"
  fi

  printf '%s|%s|%s|%s|%s\n' "$issue_id" "$branch" "$worktree_rel" "$log_rel" "$result"
}

ralph_run_worker_wave() {
  local repo="$1"
  local assignments="$2"
  local commits="$3"
  local prompt="$4"

  local tmpdir
  tmpdir="$(mktemp -d)"

  local -a pids issues outputs
  local assignment issue_id issue_json safe_id stderr_log
  while IFS= read -r assignment; do
    [ -n "$assignment" ] || continue
    if [[ "$assignment" != assigned\|* ]]; then
      printf 'Unexpected Ralph assignment result: %s\n' "$assignment" >&2
      rm -rf "$tmpdir"
      return 1
    fi

    issue_id="${assignment#assigned|}"
    issue_id="${issue_id%%|*}"
    issue_json="${assignment#assigned|$issue_id|}"
    safe_id="$(ralph_safe_issue_path "$issue_id")"
    stderr_log="$repo/.ralph/logs/$safe_id.stderr.log"
    mkdir -p "$(dirname "$stderr_log")"

    printf 'started|%s\n' "$issue_id"
    ralph_run_isolated_worker "$repo" "$issue_id" "$issue_json" "$commits" "$prompt" \
      > "$tmpdir/$safe_id.out" 2> "$stderr_log" &
    pids+=("$!")
    issues+=("$issue_id")
    outputs+=("$tmpdir/$safe_id.out")
  done <<< "$assignments"

  local index status record failed=0
  for index in "${!pids[@]}"; do
    if wait "${pids[$index]}"; then
      status=0
    else
      status=$?
    fi

    record="$(cat "${outputs[$index]}" 2>/dev/null || true)"
    if [ "$status" -ne 0 ]; then
      failed=1
      if [ -z "$record" ]; then
        record="${issues[$index]}||||failed"
      fi
    fi

    printf 'finished|%s\n' "$record"
  done

  rm -rf "$tmpdir"
  [ "$failed" -eq 0 ]
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
