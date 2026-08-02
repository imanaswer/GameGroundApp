#!/usr/bin/env bash
# Release secret-grep (Developer PRD §2.4 / S1.5). Exports the JS bundle and greps it for anything
# that must never ship: auth/key secrets, live Stripe keys, and token-shaped blobs. Nonzero exit
# blocks the release cut. Wired into CI for main/release* branches.
#
# Razorpay: EXPO_PUBLIC_RAZORPAY_KEY_ID is a *publishable* key id. It is supposed to be in the
# bundle — Checkout cannot run without it — so a bare `rzp_live_` grep would fail every production
# cut and train people to bypass the gate. What is actually dangerous is the key *secret* (no
# prefix, server-side only), a `key_id:key_secret` basic-auth pair, an unreplaced placeholder, or a
# key from the wrong environment. Those are what this checks.
#
# Usage:
#   bash scripts/release-check.sh                                  # development export
#   APP_ENV=production EXPO_PUBLIC_RAZORPAY_KEY_ID=rzp_live_xxx \
#     bash scripts/release-check.sh                                # the real release gate
#   SKIP_EXPORT=1 bash scripts/release-check.sh dist               # rescan an existing export
set -euo pipefail

DIST="${1:-dist}"
APP_ENV="${APP_ENV:-development}"
EXPECTED_KEY="${EXPO_PUBLIC_RAZORPAY_KEY_ID:-}"

if [ "${SKIP_EXPORT:-}" = "1" ]; then
  echo "▸ SKIP_EXPORT=1 — scanning existing $DIST …"
  [ -d "$DIST" ] || { echo "✖ $DIST does not exist."; exit 1; }
else
  echo "▸ Exporting bundle to $DIST (APP_ENV=$APP_ENV) …"
  rm -rf "$DIST"
  # --clear is not optional. EXPO_PUBLIC_* values are inlined at transform time and Metro will
  # happily reuse a cached module carrying a *previous* run's value — verified 2026-08-02: an
  # export with no .env present still emitted `rzp_test_replace_me` from cache. Without this the
  # gate can scan a bundle that is not the one that ships.
  npx expo export --platform all --output-dir "$DIST" --clear >/dev/null
fi

HITS="$(mktemp)"
trap 'rm -f "$HITS"' EXIT
fail=0

# --- 1. Unambiguous secrets ---------------------------------------------------------------------
# High-signal patterns only (a generic length-based base64 match false-positives across the
# minified/Hermes bundle). -a scans the Hermes bytecode string table too. Covers live Stripe keys,
# the server secret env names, a Razorpay key_id:key_secret pair, and JWT-shaped tokens.
echo "▸ Scanning $DIST for secrets …"
PATTERN='sk_live_[A-Za-z0-9]+'
PATTERN="$PATTERN"'|AUTH_SECRET|key_secret|KEY_SECRET|keySecret'
PATTERN="$PATTERN"'|rzp_(live|test)_[A-Za-z0-9]+:[A-Za-z0-9]{8,}'
PATTERN="$PATTERN"'|eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]+'

if grep -raoE "$PATTERN" "$DIST" >"$HITS" 2>/dev/null; then
  echo "✖ Potential secret(s) found in the bundle:"
  cut -c1-80 "$HITS" | sort -u | head -20
  echo "  Remove the secret or move it server-side."
  fail=1
fi

# --- 2. Razorpay key id sanity ------------------------------------------------------------------
# Matches run past the key: Hermes packs its string table contiguously, so the bytecode yields
# `rzp_test_abc123measureResponderRegion…`. Every comparison below is therefore prefix-based —
# an exact-equality check would false-fail on every real device bundle.
echo "▸ Checking Razorpay key id …"
KEYS="$(grep -raoE 'rzp_(live|test)_[A-Za-z0-9_]+' "$DIST" 2>/dev/null | sed 's/^.*://' | sort -u || true)"

if [ -z "$KEYS" ]; then
  echo "  (no Razorpay key id in the bundle)"
else
  # One source key surfaces as several matches (clean copy in the JS bundle, run-on copies in the
  # Hermes string table). Report lines are normalised and de-duped so that reads as one finding.
  REPORT="$(mktemp)"
  trap 'rm -f "$HITS" "$REPORT"' EXIT
  while IFS= read -r key; do
    [ -n "$key" ] || continue
    case "$key" in
      *_replace_me*)
        disp="$(printf '%s' "$key" | sed -E 's/^(rzp_(live|test)_replace_me).*/\1/')"
        # Fatal for a real cut; expected in development until the Razorpay test key exists.
        if [ "$APP_ENV" = "production" ] || [ "$APP_ENV" = "preview" ]; then
          echo "✖ Placeholder Razorpay key in a $APP_ENV bundle: $disp — put the real key id in eas.json" >>"$REPORT"
          fail=1
        else
          echo "  ⚠ placeholder key ($disp) — fine for $APP_ENV, blocks preview/production" >>"$REPORT"
        fi
        continue
        ;;
    esac
    if [ -n "$EXPECTED_KEY" ]; then
      case "$key" in
        "$EXPECTED_KEY"*) disp="$EXPECTED_KEY" ;;
        *)
          echo "✖ Unexpected Razorpay key id in the bundle: $(printf '%.23s' "$key") (expected $EXPECTED_KEY)" >>"$REPORT"
          fail=1
          continue
          ;;
      esac
    else
      disp="$(printf '%.23s' "$key")"
    fi
    case "$APP_ENV:$key" in
      production:rzp_test_*)
        echo "✖ Test Razorpay key in a production bundle: $disp" >>"$REPORT"
        fail=1
        continue
        ;;
      production:*) ;;
      *:rzp_live_*)
        echo "✖ Live Razorpay key in a non-production bundle ($APP_ENV): $disp" >>"$REPORT"
        fail=1
        continue
        ;;
    esac
    echo "  ✓ $disp — correct for APP_ENV=$APP_ENV" >>"$REPORT"
  done <<EOF
$KEYS
EOF
  sort -u "$REPORT"
fi

if [ "$fail" -ne 0 ]; then
  echo "Release blocked."
  exit 1
fi

echo "✓ No secrets found. Bundle is clean."
