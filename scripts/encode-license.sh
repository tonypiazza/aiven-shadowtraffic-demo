#!/usr/bin/env bash
# Encode a ShadowTraffic license.env into the single base64 blob the Aiven Console
# wants for the LICENSE_ENV_B64 secret, and copy it to the clipboard.
#
# Why: the Console adds env vars one at a time (no bulk paste), and license.env is
# gitignored (it's a secret — never committed, never baked into the public image).
# So each operator injects the license at deploy time as ONE secret. Run this, then
# paste into Console → your app → Environment → new SECRET var `LICENSE_ENV_B64`.
#
# Usage:  ./scripts/encode-license.sh [path/to/license.env]   (defaults to ./license.env)
set -euo pipefail

LICENSE_FILE="${1:-license.env}"

if [[ ! -f "$LICENSE_FILE" ]]; then
  echo "ERROR: $LICENSE_FILE not found." >&2
  echo "Obtain a ShadowTraffic license.env (see scripts/provision-aiven.md) and pass its path." >&2
  exit 1
fi

# Sanity: make sure it actually looks like a license.env.
if ! grep -q '^LICENSE_' "$LICENSE_FILE"; then
  echo "ERROR: $LICENSE_FILE has no LICENSE_* lines — is this the right file?" >&2
  exit 1
fi

# Warn if the license is already expired or expiring soon (trial licenses lapse).
EXP="$(grep '^LICENSE_EXPIRATION=' "$LICENSE_FILE" | head -1 | cut -d= -f2- || true)"
if [[ -n "$EXP" ]]; then
  echo "License edition: $(grep '^LICENSE_EDITION=' "$LICENSE_FILE" | cut -d= -f2-)"
  echo "License expires:  $EXP"
fi

B64="$(base64 -i "$LICENSE_FILE" 2>/dev/null || base64 < "$LICENSE_FILE")"

# Copy to clipboard when a clipboard tool is available; always echo as fallback.
if command -v pbcopy >/dev/null 2>&1; then
  printf '%s' "$B64" | pbcopy
  echo "✓ base64 blob copied to clipboard — paste it as the LICENSE_ENV_B64 secret."
elif command -v xclip >/dev/null 2>&1; then
  printf '%s' "$B64" | xclip -selection clipboard
  echo "✓ base64 blob copied to clipboard (xclip) — paste it as the LICENSE_ENV_B64 secret."
else
  echo "No clipboard tool found. Copy the blob below into the LICENSE_ENV_B64 secret:"
  echo
  printf '%s\n' "$B64"
fi
