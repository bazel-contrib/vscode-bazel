#!/bin/bash

# Script to check if commit messages follow the Conventional Commit format
# Usage: .github/scripts/enforce-conventional-commit-messages.sh [base_ref] [head_ref]
# If no arguments provided, checks commits in current PR (for GitHub Actions)

set -e

# Conventional commit pattern - supports breaking changes (!), case-insensitive types, and custom types
PATTERN='^[a-zA-Z]+(\(.+\))?!?: .+$'

# Determine commit range
if [ $# -eq 2 ]; then
  # Use provided refs
  BASE_REF="$1"
  HEAD_REF="$2"
  COMMIT_RANGE="${BASE_REF}..${HEAD_REF}"
else
  # Default to origin/master..HEAD
  COMMIT_RANGE="origin/master..HEAD"
fi

echo "Checking commit messages in range: $COMMIT_RANGE"
echo ""

# Get all commits in the range, excluding merge commits
COMMITS=$(git log --format=%s --no-merges "$COMMIT_RANGE")

if [ -z "$COMMITS" ]; then
  echo "ℹ️  No commits found in range $COMMIT_RANGE"
  exit 0
fi

# Check each commit message
INVALID_FOUND=false
while IFS= read -r commit; do
  if [[ ! "$commit" =~ $PATTERN ]]; then
    echo "❌ Invalid commit message: '$commit'"
    INVALID_FOUND=true
  else
    echo "✅ Valid commit message: '$commit'"
  fi
done <<< "$COMMITS"

if [ "$INVALID_FOUND" = true ]; then
  echo ""
  echo "❌ Commit messages must follow the Conventional Commit format:"
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
  echo ""
  echo "✅ All commit messages follow the Conventional Commit format!"
fi
