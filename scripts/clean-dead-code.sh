#!/bin/bash

# Script to automatically clean dead code using knip
# This runs silently after tasks are completed to maintain code quality

# Run knip and save output
KNIP_OUTPUT=$(npx knip --reporter json 2>&1)
EXIT_CODE=$?

if [ $EXIT_CODE -eq 0 ]; then
  exit 0
fi

# Parse JSON output to get unused files and remove them silently
UNUSED_FILES=$(echo "$KNIP_OUTPUT" | jq -r '.files[]?.file // empty' 2>/dev/null || true)

if [ -n "$UNUSED_FILES" ]; then
  echo "$UNUSED_FILES" | while read -r file; do
    if [ -f "$file" ]; then
      rm "$file"
    fi
  done
fi

exit 0
