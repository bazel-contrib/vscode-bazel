#!/bin/bash

# Script to check if PR title follows the Conventional Commit format
# Usage: .github/scripts/enforce-conventional-commit-message.sh [pr_title]

set -euo pipefail

# Conventional commit pattern - supports breaking changes (!), case-insensitive types, and custom types
PATTERN='^[a-zA-Z]+(\(.+\))?!?: .+$'

# Get PR title from argument
PR_TITLE_TO_CHECK="$1"

if [[ ! "$PR_TITLE_TO_CHECK" =~ $PATTERN ]]; then
  echo ""
  echo "❌ Validation failed!"
  echo ""
  echo "Given PR title: '$PR_TITLE_TO_CHECK'"
  echo ""
  echo "PR title must follow the Conventional Commit format:"
  echo "  <type>[optional scope][!]: <description>"
  echo ""
  echo "Examples:"
  echo "  feat: add new feature"
  echo "  fix(parser): resolve parsing issue"
  echo "  feat!: breaking change"
  echo "  fix(scope)!: breaking change in scope"
  echo ""
  echo "Notes:"
  echo "  - Types are case-insensitive (feat, Feat, FEAT are all valid)"
  echo "  - Custom types are allowed (security: patch vulnerability)"
  echo "  - Use ! before colon to indicate breaking changes"
  echo "  - See https://www.conventionalcommits.org/ for more details"
  echo ""
  exit 1
else
  echo "✅ Valid PR title: '$PR_TITLE_TO_CHECK'"
fi
