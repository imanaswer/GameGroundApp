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

## Selector contract

The app now carries `testID`s on everything these flows touch, so the suite matches on stable ids
rather than copy. **Renaming or removing one of these breaks E2E** — treat them as API.

| testID | Where |
|---|---|
| `tab-home` `tab-games` `tab-coaches` `tab-discover` `tab-leaders` | `chrome/TabBar` — derived from the route name, not the label |
| `auth-email` `auth-password` `auth-submit` | login **and** signup (shared ids — the subflow works on either) |
| `signup-name` `signup-username` | signup only |
| `game-card` `coach-card` `registerable-card` | list cards; select with `index:` |
| `game-cta` `registerable-cta` | the detail `StickyCTA` — one id, label varies by state |
| `coach-book` | per-batch mini Button; only rendered when `coach.instantPayEligible` |
| `checkout-pay` | `CheckoutSheet` "Pay ₹X" |
| `registration-<fieldKey>` `registration-submit` | form engine; keys come from `entities.ts` |
| `profile-edit-entry` `profile-name` `profile-bio` `profile-phone` `profile-save` `profile-delete` `profile-delete-confirm` | profile + edit |

`Press` forwards `testID` natively (it extends `PressableProps`) and `Input` forwards it through
`TextInputProps`; `Button`, `StickyCTA` and `TabBar` needed the prop added explicitly.

Where a CTA's label carries meaning (Join game vs Leave game vs Fully booked), the flows tap the
**id** and assert the **label** separately — so a copy change fails on a clear assertion instead of
silently failing to find a button.

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

- **The Razorpay WebView** (flow 02) is a webview, not native views. Maestro's text matching inside
  webviews is less reliable; that flow may need `extendedWaitUntil` bumps or an explicit webview
  wait. It is the least reliable section of the suite by some margin.
- **Flow 02 needs an instant-pay-eligible coach.** The per-batch Book button only renders when
  `coach.instantPayEligible` is true — ranged-price coaches are request-only. Index 0 of the coach
  list is not guaranteed to qualify; pin a known-good coach by name once you have one.
- **Log out** still goes through a native `Alert.alert` (`app/profile/index.tsx`). No flow depends
  on it today; if you add one, note Maestro taps alert buttons by text and a missed tap hangs the
  run rather than failing it. Account deletion does **not** use an Alert — it is an inline
  two-step confirm.
- **Entrance animations.** The app staggers list entrances (MOTION.md); assertions that fire before
  the stagger settles will flake. The flows use `extendedWaitUntil` where that is likely.
- **Empty states.** 01/02/03 assume live content exists (an open free game, a bookable coach, an
  open camp). Against a quiet production dataset they will fail on an empty list — that is a data
  problem, not a regression. Seed or pick fixtures before wiring into CI.

## CI

Not wired yet. §15 wants a Maestro cloud smoke on `main`. Do that only after a green local run —
a red CI check nobody trusts is worse than no check.
