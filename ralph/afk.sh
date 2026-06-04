#!/bin/bash
set -eo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$script_dir/helpers.sh"

if [ -z "$1" ]; then
  echo "Usage: $0 <iterations>"
  exit 1
fi

ralph_run_afk_loop "$1" .
