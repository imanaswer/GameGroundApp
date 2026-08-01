# Maestro E2E — the 5 flows (Developer PRD §14)

> ## ⚠️ These have never been run
>
> They were written by reading the screens, not by driving a build — no dev client or preview build
> existed at the time. **Treat the first run as a calibration pass, not a test run.** Selector
> drift is expected and is not evidence the app is broken.
>
> They are committed anyway because the flow *structure* (order, waits, assertions, what counts as
> a pass) is the reviewed part, and it is faster to fix selectors against a running app than to
> author flows from scratch during a release crunch.

## The blocker you should fix first: there are no testIDs

`grep -rn testID app src` returns **0**. There are 47 `accessibilityLabel`s, so these flows lean on
visible text and a11y labels, which means:

- Every copy change can break a flow.
- Text matching is ambiguous where the same word appears twice on screen (e.g. "Games" is both a
  tab and a heading).
- `id:` selectors — the stable kind — aren't available at all.

Adding `testID` to the ~20 elements these flows touch (CTAs, tab bar items, the first list card,
form inputs, the delete-account button) would make the suite durable. That is a deliberate app
change, not a test-only one, so it is left as a decision rather than done silently.

## Running

```bash
# install: https://maestro.mobile.dev
maestro test .maestro/                         # whole suite
maestro test .maestro/01-signup-join-free-game.yaml
maestro studio                                 # interactive selector explorer — use this to calibrate
```

Flows read credentials from env, so no secret lives in this directory:

```bash
maestro test .maestro/ \
  -e EMAIL="e2e+$(date +%s)@example.com" \
  -e PASSWORD="..." \
  -e EXISTING_EMAIL="..." \
  -e EXISTING_PASSWORD="..."
```

## What to run it against

The **preview** build (`net.gameground.app.preview`, `eas build --profile preview`). Preview points
at the production API with a **test-mode** Razorpay key, which is what flow 02 assumes. Do not run
the payment flow against a production build — it would take real money.

`appId` is set per-flow to the preview bundle id. Change it if you target a different profile.

## Flow inventory

| # | Flow | Covers | Needs |
|---|---|---|---|
| 01 | signup → browse → join free game | auth write, list, detail, join mutation | fresh email each run |
| 02 | login → book coach (test payment) | Razorpay WebView, checkout machine | test-mode key, a bookable coach |
| 03 | camp registration | the shared registerable form engine | an open camp with slots |
| 04 | profile edit | profile write + optimistic update | existing account |
| 05 | account deletion | GDPR flow, App Review requirement | **a throwaway account — this is destructive** |

Flow 05 permanently deletes its account. Run it last, and only with an account you created for it.

## Known fragilities to expect on first run

- **Native alerts.** Log out and delete-account both go through `Alert.alert`. Maestro taps these
  by button text; if the tap misses, the flow hangs rather than fails cleanly.
- **The Razorpay WebView** (flow 02) is a webview, not native views. Maestro's text matching inside
  webviews is less reliable; that flow may need `extendedWaitUntil` bumps or an explicit webview
  wait.
- **Entrance animations.** The app staggers list entrances (MOTION.md); assertions that fire before
  the stagger settles will flake. The flows use `extendedWaitUntil` where that is likely.
- **Empty states.** 01/02/03 assume live content exists (an open free game, a bookable coach, an
  open camp). Against a quiet production dataset they will fail on an empty list — that is a data
  problem, not a regression. Seed or pick fixtures before wiring into CI.

## CI

Not wired yet. §15 wants a Maestro cloud smoke on `main`. Do that only after a green local run —
a red CI check nobody trusts is worse than no check.
