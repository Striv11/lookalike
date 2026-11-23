#!/usr/bin/env bash
# Single quality gate used by CI and by build-lab before every push:
# format check, lint (eslint + tsc), tests.
set -euo pipefail
cd "$(dirname "$0")"
[ -d node_modules ] || npm ci
npx prettier --check .
npx eslint .
npx tsc --noEmit
npx vitest run
