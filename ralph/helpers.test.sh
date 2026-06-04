#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
source "$ROOT_DIR/ralph/helpers.sh"

failures=0

check() {
  local name="$1"
  shift

  if "$@"; then
    printf 'ok - %s\n' "$name"
  else
    printf 'not ok - %s\n' "$name"
    failures=$((failures + 1))
  fi
}

accepts_positive_integer() {
  ralph_require_positive_integer iterations 1 >/dev/null
  ralph_require_positive_integer iterations 42 >/dev/null
}

rejects_invalid_positive_integer() {
  ! ralph_require_positive_integer iterations "" >/dev/null 2>&1
  ! ralph_require_positive_integer iterations 0 >/dev/null 2>&1
  ! ralph_require_positive_integer iterations -1 >/dev/null 2>&1
  ! ralph_require_positive_integer iterations nope >/dev/null 2>&1
}

uses_default_parallelism_cap() {
  local value
  value="$(RALPH_PARALLELISM= ralph_parallelism_cap)"
  [ "$value" = 4 ]
}

accepts_configured_parallelism_cap() {
  local value
  value="$(RALPH_PARALLELISM=2 ralph_parallelism_cap)"
  [ "$value" = 2 ]
}

rejects_invalid_parallelism_cap() {
  ! RALPH_PARALLELISM=0 ralph_parallelism_cap >/dev/null 2>&1
  ! RALPH_PARALLELISM=-1 ralph_parallelism_cap >/dev/null 2>&1
  ! RALPH_PARALLELISM=nope ralph_parallelism_cap >/dev/null 2>&1
}

checks_required_tools() {
  [ "$(type -t ralph_require_tools 2>/dev/null)" = function ] || return 1

  ralph_require_tools sh >/dev/null
  ! ralph_require_tools definitely-not-a-ralph-tool >/dev/null 2>&1
}

checks_clean_checkout() {
  [ "$(type -t ralph_require_clean_checkout 2>/dev/null)" = function ] || return 1

  local repo
  repo="$(mktemp -d /tmp/opencode/ralph-clean.XXXXXX)"

  git -C "$repo" init --quiet
  ralph_require_clean_checkout "$repo" >/dev/null

  printf 'scratch\n' > "$repo/scratch.txt"
  ! ralph_require_clean_checkout "$repo" >/dev/null 2>&1
  rm -rf "$repo"
}

ignores_ignored_runtime_paths_for_clean_checkout() {
  [ "$(type -t ralph_require_clean_checkout 2>/dev/null)" = function ] || return 1

  local repo
  repo="$(mktemp -d /tmp/opencode/ralph-ignored.XXXXXX)"

  git -C "$repo" init --quiet
  printf '.worktrees/\n.ralph/\n' > "$repo/.git/info/exclude"
  mkdir -p "$repo/.worktrees/kanai-1" "$repo/.ralph/logs"
  printf 'runtime\n' > "$repo/.worktrees/kanai-1/output.log"
  printf 'runtime\n' > "$repo/.ralph/logs/output.log"

  ralph_require_clean_checkout "$repo" >/dev/null
  rm -rf "$repo"
}

parses_worker_markers() {
  [ "$(type -t ralph_worker_result 2>/dev/null)" = function ] || return 1

  [ "$(ralph_worker_result 0 'done <promise>ISSUE COMPLETE</promise>')" = complete ]
  [ "$(ralph_worker_result 0 'blocked <promise>ISSUE INCOMPLETE</promise>')" = incomplete ]
  [ "$(ralph_worker_result 0 'no marker')" = missing ]
  [ "$(ralph_worker_result 1 'done <promise>ISSUE COMPLETE</promise>')" = failed ]
}

parses_merge_markers() {
  [ "$(type -t ralph_merge_result 2>/dev/null)" = function ] || return 1

  [ "$(ralph_merge_result 0 '<promise>MERGE COMPLETE</promise>')" = complete ]
  [ "$(ralph_merge_result 0 '<promise>MERGE PARTIAL</promise>')" = partial ]
  [ "$(ralph_merge_result 0 '<promise>MERGE FAILED</promise>')" = failed ]
  [ "$(ralph_merge_result 0 'no marker')" = missing ]
  [ "$(ralph_merge_result 1 '<promise>MERGE COMPLETE</promise>')" = failed ]
}

builds_wave_summary() {
  [ "$(type -t ralph_wave_summary 2>/dev/null)" = function ] || return 1

  local summary
  summary="$(ralph_wave_summary abc123 'kanai-1|ralph/kanai-1|.worktrees/kanai-1|.ralph/logs/kanai-1.log|complete')"

  [[ "$summary" == *'Base commit: abc123'* ]]
  [[ "$summary" == *'issue=kanai-1 branch=ralph/kanai-1 worktree=.worktrees/kanai-1 log=.ralph/logs/kanai-1.log result=complete'* ]]
}

afk_rejects_invalid_iterations() {
  ! bash "$ROOT_DIR/ralph/afk.sh" 0 >/dev/null 2>&1
  ! bash "$ROOT_DIR/ralph/afk.sh" nope >/dev/null 2>&1
}

check "positive integer validation accepts positive values" accepts_positive_integer
check "positive integer validation rejects missing zero negative and non-numeric values" rejects_invalid_positive_integer
check "parallelism cap defaults to four" uses_default_parallelism_cap
check "parallelism cap accepts configured positive value" accepts_configured_parallelism_cap
check "parallelism cap rejects invalid configured values" rejects_invalid_parallelism_cap
check "required tool validation reports missing tools" checks_required_tools
check "clean checkout validation detects untracked files" checks_clean_checkout
check "clean checkout validation ignores runtime paths" ignores_ignored_runtime_paths_for_clean_checkout
check "worker marker parsing distinguishes complete incomplete missing and failed" parses_worker_markers
check "merge marker parsing distinguishes complete partial failed missing and failed exit" parses_merge_markers
check "wave summary includes base commit and worker records" builds_wave_summary
check "afk runner rejects invalid iteration counts" afk_rejects_invalid_iterations

exit "$failures"
