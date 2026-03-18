#!/usr/bin/env bash
set -euo pipefail

if [ -z "${VERCEL_GIT_PREVIOUS_SHA:-}" ]; then
  echo "VERCEL_GIT_PREVIOUS_SHA missing; forcing build"
  exit 1
fi

changed_files="$(git diff --name-only "$VERCEL_GIT_PREVIOUS_SHA" HEAD 2>/dev/null || true)"
if [ -z "$changed_files" ]; then
  echo "No changed files detected; forcing build"
  exit 1
fi

if echo "$changed_files" | grep -qv "^paperclip/"; then
  echo "Non-paperclip changes detected; running build"
  exit 1
fi

echo "Only paperclip/ changes detected; skipping build"
exit 0
