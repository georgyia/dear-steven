#!/usr/bin/env bash
# Creates or updates every label in .github/labels.json on the current GitHub repository.
# Needs: gh (authenticated) and node. Usage: bash scripts/sync-labels.sh
set -euo pipefail
cd "$(dirname "$0")/.."
node -e '
  const { labels } = require("./.github/labels.json");
  for (const l of labels) console.log([l.name, l.color, l.description].join("\t"));
' | while IFS=$'\t' read -r name color description; do
  gh label create "$name" --color "$color" --description "$description" --force
done
