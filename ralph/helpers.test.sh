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

with_fake_bd() {
  local scenario="$1"
  shift

  local bin_dir
  bin_dir="$(mktemp -d /tmp/opencode/ralph-bd.XXXXXX)"

  cat > "$bin_dir/bd" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail

printf '%s\n' "$*" >> "$RALPH_FAKE_BD_CALLS"

case "$RALPH_FAKE_BD_SCENARIO:$*" in
  "ready:ready --json --label afk --exclude-label hitl")
    printf '[{"id":"kanai-a","labels":["afk"],"dependencies":[{"depends_on_id":"done"}]},{"id":"kanai-b","labels":["afk"]}]\n'
    ;;
  "ready:update kanai-a --claim --json")
    printf '[{"id":"kanai-a","status":"in_progress"}]\n'
    ;;
  "ready:update kanai-b --claim --json")
    printf '[{"id":"kanai-b","status":"in_progress"}]\n'
    ;;
  "claim-failure:ready --json --label afk --exclude-label hitl")
    printf '[{"id":"kanai-a"},{"id":"kanai-b"}]\n'
    ;;
  "claim-failure:update kanai-a --claim --json")
    exit 1
    ;;
  "claim-failure:update kanai-b --claim --json")
    printf '[{"id":"kanai-b","status":"in_progress"}]\n'
    ;;
  "no-more:ready --json --label afk --exclude-label hitl")
    printf '[]\n'
    ;;
  "no-more:list --json --status open,in_progress,blocked --label afk --exclude-label hitl")
    printf '[]\n'
    ;;
  "no-ready:ready --json --label afk --exclude-label hitl")
    printf '[]\n'
    ;;
  "no-ready:list --json --status open,in_progress,blocked --label afk --exclude-label hitl")
    printf '[{"id":"kanai-blocked","status":"blocked"}]\n'
    ;;
  *)
    printf 'unexpected bd call for %s: %s\n' "$RALPH_FAKE_BD_SCENARIO" "$*" >&2
    exit 64
    ;;
esac
EOF
  chmod +x "$bin_dir/bd"

  RALPH_FAKE_BD_SCENARIO="$scenario" PATH="$bin_dir:$PATH" "$@"
  local status=$?
  rm -rf "$bin_dir"
  return "$status"
}

claims_ready_afk_issues_in_bd_order() {
  [ "$(type -t ralph_claim_ready_afk_issues 2>/dev/null)" = function ] || return 1

  local calls output
  calls="$(mktemp /tmp/opencode/ralph-bd-calls.XXXXXX)"
  output="$(RALPH_FAKE_BD_CALLS="$calls" with_fake_bd ready ralph_claim_ready_afk_issues 2)"

  [[ "$output" == $'assigned|kanai-a|[{"id":"kanai-a","status":"in_progress"}]'* ]]
  [[ "$output" == *$'assigned|kanai-b|[{"id":"kanai-b","status":"in_progress"}]'* ]]
  [ "$(sed -n '1p' "$calls")" = 'ready --json --label afk --exclude-label hitl' ]
  [ "$(sed -n '2p' "$calls")" = 'update kanai-a --claim --json' ]
  [ "$(sed -n '3p' "$calls")" = 'update kanai-b --claim --json' ]
  rm -f "$calls"
}

skips_failed_claims_without_duplicates() {
  [ "$(type -t ralph_claim_ready_afk_issues 2>/dev/null)" = function ] || return 1

  local calls output
  calls="$(mktemp /tmp/opencode/ralph-bd-calls.XXXXXX)"
  output="$(RALPH_FAKE_BD_CALLS="$calls" with_fake_bd claim-failure ralph_claim_ready_afk_issues 2)"

  [[ "$output" != *'assigned|kanai-a|'* ]]
  [[ "$output" == 'assigned|kanai-b|[{"id":"kanai-b","status":"in_progress"}]' ]]
  rm -f "$calls"
}

reports_no_more_work_when_no_afk_issues_remain() {
  [ "$(type -t ralph_claim_ready_afk_issues 2>/dev/null)" = function ] || return 1

  local calls output
  calls="$(mktemp /tmp/opencode/ralph-bd-calls.XXXXXX)"
  output="$(RALPH_FAKE_BD_CALLS="$calls" with_fake_bd no-more ralph_claim_ready_afk_issues 1)"

  [ "$output" = 'no_more_tasks' ]
  rm -f "$calls"
}

reports_no_ready_work_when_afk_issues_remain() {
  [ "$(type -t ralph_claim_ready_afk_issues 2>/dev/null)" = function ] || return 1

  local calls output
  calls="$(mktemp /tmp/opencode/ralph-bd-calls.XXXXXX)"
  output="$(RALPH_FAKE_BD_CALLS="$calls" with_fake_bd no-ready ralph_claim_ready_afk_issues 1)"

  [ "$output" = 'no_ready_tasks|[{"id":"kanai-blocked","status":"blocked"}]' ]
  rm -f "$calls"
}

afk_exits_without_sandbox_when_no_more_work_remains() {
  local calls output
  calls="$(mktemp /tmp/opencode/ralph-bd-calls.XXXXXX)"
  output="$(RALPH_FAKE_BD_CALLS="$calls" with_fake_bd no-more bash "$ROOT_DIR/ralph/afk.sh" 1)"

  [[ "$output" == *'Ralph complete after 1 iterations.'* ]]
  ! grep -q 'opencode-sandbox' "$calls"
  rm -f "$calls"
}

afk_exits_without_sandbox_when_no_ready_work_exists() {
  local calls output
  calls="$(mktemp /tmp/opencode/ralph-bd-calls.XXXXXX)"
  output="$(RALPH_FAKE_BD_CALLS="$calls" with_fake_bd no-ready bash "$ROOT_DIR/ralph/afk.sh" 1)"

  [[ "$output" == *'Ralph has no ready AFK tasks.'* ]]
  [[ "$output" == *'no_ready_tasks|[{"id":"kanai-blocked","status":"blocked"}]'* ]]
  ! grep -q 'opencode-sandbox' "$calls"
  rm -f "$calls"
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
check "ready AFK issues are claimed in bd output order" claims_ready_afk_issues_in_bd_order
check "failed claims are skipped without duplicate assignments" skips_failed_claims_without_duplicates
check "no remaining AFK issues reports no more tasks" reports_no_more_work_when_no_afk_issues_remain
check "blocked AFK issues report no ready tasks" reports_no_ready_work_when_afk_issues_remain
check "afk runner exits without sandbox when no AFK issues remain" afk_exits_without_sandbox_when_no_more_work_remains
check "afk runner exits without sandbox when no ready AFK work exists" afk_exits_without_sandbox_when_no_ready_work_exists
check "afk runner rejects invalid iteration counts" afk_rejects_invalid_iterations

exit "$failures"
