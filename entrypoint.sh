#!/bin/sh
set -e

# If /config has content, overlay it onto /data/shared
# This lets users provide their own schema.md, config.json, etc.
if [ -d "$CONFIG_ROOT" ] && [ "$(ls -A "$CONFIG_ROOT" 2>/dev/null)" ]; then
  echo "Applying config overlay from $CONFIG_ROOT → $DATA_ROOT/shared"
  mkdir -p "$DATA_ROOT/shared"
  # Copy config files, but never overwrite existing data (use -n = no-clobber)
  cp -n "$CONFIG_ROOT"/* "$DATA_ROOT/shared/" 2>/dev/null || true
fi

exec node src/index.js
