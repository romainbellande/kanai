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

with_fake_opencode_sandbox() {
  local bin_dir
  bin_dir="$(mktemp -d /tmp/opencode/ralph-sandbox.XXXXXX)"

  cat > "$bin_dir/opencode-sandbox" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail

worktree="$1"
shift

printf '%s\n' "$worktree" > "$RALPH_FAKE_SANDBOX_WORKTREE"
printf '%s\n' "$*" > "$RALPH_FAKE_SANDBOX_ARGS"

git -C "$worktree" config user.email ralph@example.test
git -C "$worktree" config user.name Ralph
if [ "${RALPH_FAKE_SANDBOX_COMMIT:-1}" = 1 ]; then
  printf 'worker change\n' > "$worktree/worker.txt"
  git -C "$worktree" add worker.txt
  git -C "$worktree" commit --quiet -m 'worker commit'
fi

printf '%s\n' '{"type":"text","part":{"text":"worker output"}}'
printf '%s\n' '{"type":"text","part":{"text":"<promise>ISSUE COMPLETE</promise>"}}'
EOF
  chmod +x "$bin_dir/opencode-sandbox"

  PATH="$bin_dir:$PATH" "$@"
  local status=$?
  rm -rf "$bin_dir"
  return "$status"
}

runs_single_worker_in_isolated_worktree() {
  [ "$(type -t ralph_run_isolated_worker 2>/dev/null)" = function ] || return 1

  local repo worktree_seen args_seen record issue branch worktree log result
  repo="$(mktemp -d /tmp/opencode/ralph-worker-repo.XXXXXX)"
  worktree_seen="$(mktemp /tmp/opencode/ralph-worker-worktree.XXXXXX)"
  args_seen="$(mktemp /tmp/opencode/ralph-worker-args.XXXXXX)"

  git -C "$repo" init --quiet
  git -C "$repo" config user.email ralph@example.test
  git -C "$repo" config user.name Ralph
  printf '.worktrees/\n.ralph/\n' > "$repo/.git/info/exclude"
  printf 'base\n' > "$repo/base.txt"
  git -C "$repo" add base.txt
  git -C "$repo" commit --quiet -m base

  record="$(RALPH_FAKE_SANDBOX_WORKTREE="$worktree_seen" RALPH_FAKE_SANDBOX_ARGS="$args_seen" \
    with_fake_opencode_sandbox ralph_run_isolated_worker "$repo" kanai-1ra.3 '[{"id":"kanai-1ra.3"}]' 'abc123' 'Prompt body')"

  IFS='|' read -r issue branch worktree log result <<< "$record"
  [ "$issue" = kanai-1ra.3 ] || return 1
  [ "$branch" = ralph/kanai-1ra.3 ] || return 1
  [ "$worktree" = .worktrees/kanai-1ra.3 ] || return 1
  [ "$log" = .ralph/logs/kanai-1ra.3.jsonl ] || return 1
  [ "$result" = complete ] || return 1
  [ "$(cat "$worktree_seen")" = "$repo/.worktrees/kanai-1ra.3" ] || return 1
  grep -Fq 'Assigned AFK issue JSON: [{"id":"kanai-1ra.3"}]' "$args_seen" || return 1
  grep -Fq 'Issue tracking is read-only after assignment' "$args_seen" || return 1
  grep -Fq '<promise>ISSUE COMPLETE</promise>' "$repo/.ralph/logs/kanai-1ra.3.jsonl" || return 1
  [ "$(git -C "$repo" rev-parse ralph/kanai-1ra.3)" != "$(git -C "$repo" rev-parse HEAD)" ] || return 1

  git -C "$repo" worktree remove --force "$repo/.worktrees/kanai-1ra.3" >/dev/null 2>&1 || true
  rm -rf "$repo" "$worktree_seen" "$args_seen"
}

skips_existing_worker_branch_without_sandbox() {
  [ "$(type -t ralph_run_isolated_worker 2>/dev/null)" = function ] || return 1

  local repo record
  repo="$(mktemp -d /tmp/opencode/ralph-worker-skip.XXXXXX)"

  git -C "$repo" init --quiet
  git -C "$repo" config user.email ralph@example.test
  git -C "$repo" config user.name Ralph
  printf 'base\n' > "$repo/base.txt"
  git -C "$repo" add base.txt
  git -C "$repo" commit --quiet -m base
  git -C "$repo" branch ralph/kanai-1ra.3

  record="$(ralph_run_isolated_worker "$repo" kanai-1ra.3 '[{"id":"kanai-1ra.3"}]' 'abc123' 'Prompt body')"

  [ "$record" = 'kanai-1ra.3|ralph/kanai-1ra.3|.worktrees/kanai-1ra.3|.ralph/logs/kanai-1ra.3.jsonl|skipped' ] || return 1
  [ ! -e "$repo/.worktrees/kanai-1ra.3" ] || return 1

  rm -rf "$repo"
}

complete_marker_without_commit_is_not_success() {
  [ "$(type -t ralph_run_isolated_worker 2>/dev/null)" = function ] || return 1

  local repo worktree_seen args_seen record result
  repo="$(mktemp -d /tmp/opencode/ralph-worker-no-commit.XXXXXX)"
  worktree_seen="$(mktemp /tmp/opencode/ralph-worker-worktree.XXXXXX)"
  args_seen="$(mktemp /tmp/opencode/ralph-worker-args.XXXXXX)"

  git -C "$repo" init --quiet
  git -C "$repo" config user.email ralph@example.test
  git -C "$repo" config user.name Ralph
  printf 'base\n' > "$repo/base.txt"
  git -C "$repo" add base.txt
  git -C "$repo" commit --quiet -m base

  record="$(RALPH_FAKE_SANDBOX_COMMIT=0 RALPH_FAKE_SANDBOX_WORKTREE="$worktree_seen" RALPH_FAKE_SANDBOX_ARGS="$args_seen" \
    with_fake_opencode_sandbox ralph_run_isolated_worker "$repo" kanai-1ra.3 '[{"id":"kanai-1ra.3"}]' 'abc123' 'Prompt body')"

  result="${record##*|}"
  [ "$result" = no_commit ] || return 1

  git -C "$repo" worktree remove --force "$repo/.worktrees/kanai-1ra.3" >/dev/null 2>&1 || true
  rm -rf "$repo" "$worktree_seen" "$args_seen"
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
check "single worker runs in deterministic isolated worktree" runs_single_worker_in_isolated_worktree
check "existing worker branch skips sandbox launch" skips_existing_worker_branch_without_sandbox
check "complete marker without worker commit is not success" complete_marker_without_commit_is_not_success
check "afk runner exits without sandbox when no AFK issues remain" afk_exits_without_sandbox_when_no_more_work_remains
check "afk runner exits without sandbox when no ready AFK work exists" afk_exits_without_sandbox_when_no_ready_work_exists
check "afk runner rejects invalid iteration counts" afk_rejects_invalid_iterations

exit "$failures"
