#!/usr/bin/env bash
# Release secret-grep (Developer PRD §2.4 / S1.5). Exports the JS bundle and greps it for
# anything that must never ship: live Razorpay keys, auth/key secrets, and long token-shaped
# blobs. Nonzero exit blocks the release cut. Wire into CI for release branches.
set -euo pipefail

DIST="${1:-dist}"

echo "▸ Exporting bundle to $DIST …"
rm -rf "$DIST"
npx expo export --platform all --output-dir "$DIST" >/dev/null

echo "▸ Scanning $DIST for secrets …"
# High-signal patterns only (a generic length-based base64 match false-positives across the
# minified/Hermes bundle). -a scans the Hermes bytecode string table too. Covers live Razorpay
# and Stripe keys, the server secret env names, and JWT-shaped tokens.
PATTERN='rzp_live_[A-Za-z0-9]+|sk_live_[A-Za-z0-9]+|AUTH_SECRET|key_secret|eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]+'

if grep -raoE "$PATTERN" "$DIST" >/tmp/gg-secret-hits 2>/dev/null; then
  echo "✖ Potential secret(s) found in the bundle:"
  cut -c1-80 /tmp/gg-secret-hits | sort -u | head -20
  echo "Release blocked. Remove the secret or move it server-side."
  exit 1
fi

echo "✓ No secrets found. Bundle is clean."
