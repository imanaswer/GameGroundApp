# Social sign-in setup (Google)

Developer PRD §5.2, **with a scope change for Google** — see below. Apple sign-in was removed in
Decision 27; the section at the bottom explains what that costs you at App Store review.

| Layer | Google |
|---|---|
| App | `useGoogleLogin` opens the site's OAuth flow in a browser |
| Server | `/api/auth/google/handoff` + `/api/auth/google/exchange` |
| App-side config | **none** |
| Console work | **none** (one redirect URI per deployment) |

---

## Scope change: Google reuses the website's OAuth client

The PRD specified a native flow — `expo-auth-session` with per-platform Google Cloud clients, posting
an `id_token` to `/api/auth/google/mobile`. That path needs an iOS **and** an Android OAuth client
per bundle id, each Android one pinned to a signing SHA-1, plus the bundle id registered as a URL
scheme (a native rebuild). None of it existed, so the button could not work at all.

**What ships instead:** the app opens the website's existing `/api/auth/google` in a system browser.
The site authenticates exactly as it does on the web — same OAuth client, same callback, same cookie
— then redirects to `/api/auth/google/handoff`, which converts that session into a one-time code and
bounces it to `ggredesign://auth-callback?code=…`. The app exchanges the code over HTTPS at
`/api/auth/google/exchange` for a bearer token.

Consequences, good and bad:

- **No Google Cloud work.** The web client you already configured is the only one involved.
- **No native rebuild.** `ggredesign` was already registered; no new URL scheme.
- **No app-side env vars.** Nothing to be missing, so the button is always shown.
- The user sees a browser tab on `gameground.net` rather than a native account picker.
- More server surface: two routes and a `MobileAuthCode` table.

`/api/auth/google/mobile` and `verifyGoogleIdToken` remain in the codebase, unused. They are the
native path, ready if you later create the platform clients — delete them if you decide not to.

### Why the one-time code is safe over a custom scheme

Any installed app can register `ggredesign://` and receive that redirect, so the code alone must be
worthless. The app generates a random `verifier`, sends only `SHA-256(verifier)` into the flow as
the challenge, and must present the verifier to redeem. That is PKCE applied to our own handoff.

Codes are single-use (an atomic `updateMany` guarded on `usedAt: null`), expire in 90 seconds, and
are stored only as a SHA-256. Redemption burns the code *before* validating the verifier, so an
intercepted code gets exactly one guess — an attacker can deny the user a login, but never obtain a
token. Every failure returns one opaque 401.

## Server env (GG repo, Vercel)

Google needs **nothing new** — `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` already power the web
flow. Optional:

```
MOBILE_APP_SCHEME=ggredesign      # defaults to this; set only if the app scheme changes
```

Then apply the `MobileAuthCode` migration:

```bash
npx prisma migrate deploy
```

Vercel reads env changes only on the next deployment — set, then redeploy.

### One redirect URI per deployment

Because the flow runs the *website's* OAuth client, every hostname the app points at must be
registered on that client, or Google answers `redirect_uri_mismatch` before the consent screen:

```
https://<deployment-host>/api/auth/google/callback
```

Exact match — no trailing slash, and `www` counts as a different host.

## Verify on a device

Google works in Expo Go and in a dev client, on emulator or hardware — it is only a browser tab.

- [ ] Google button appears on login and signup, with no configuration
- [ ] Tapping opens a `gameground.net` tab, and completing it returns to the app signed in
- [ ] Closing the tab returns silently, no error banner
- [ ] Signing in with an email that already has a password account lands on **that** account

---

## Removed: Sign in with Apple (Decision 27)

The app ships Google as its only social login. `loginWithApple`, `useAppleAvailable`, `AppleButton`,
`AppleGlyph`, the `EXPO_PUBLIC_APPLE_AUTH_ENABLED` flag, the `expo-apple-authentication` dependency
and its config plugin are all gone. The flag was already `false` in every EAS profile, so no shipped
build ever rendered the button.

**Server-side Apple support was left intact** — `/api/auth/apple/mobile`, `User.appleId` and
`APPLE_BUNDLE_IDS` are untouched, so restoring this is app-side work only.

### This blocks an iOS App Store submission

App Store Review Guideline 4.8 (Login Services): when an app uses a third-party or social login
service — **Google Sign-In is named explicitly** — to establish the user's primary account, it must
*also* offer an equivalent login service that limits collection to name and email, **lets the user
keep their email address private**, and does not collect in-app interactions for advertising.

The relevant exemption covers apps that use "exclusively your company's own account setup and sign-in
systems". Offering Google forfeits it. Email/password almost certainly fails the email-masking
criterion, so it does not substitute.

Practically: **Android and all dev/preview testing are unaffected.** Before an iOS submission you
must either restore Sign in with Apple, or drop the Google button on iOS. Restoring it means:

1. Re-add `expo-apple-authentication` and the config plugin, and the four deleted symbols.
2. Apple Developer → Certificates, Identifiers & Profiles → Identifiers → the App ID for each bundle
   id → enable **Sign in with Apple** → Save. Native sign-in needs only the App ID capability — no
   Service ID and no signing key (those are for the *web* flow, which this app does not use).
3. Set `APPLE_BUNDLE_IDS=net.gameground.redesigned,net.gameground.redesigned.dev` on the server and
   redeploy. This is the **audience allowlist**: the identity token's `aud` is the app's bundle id,
   so every bundle id you build must be listed. Unset makes the route answer 503 rather than verify
   against an empty audience — a token minted for any other developer's app would otherwise pass.
4. Rebuild (the plugin writes the entitlement) and re-test on real iOS hardware.

Two Apple behaviours that used to bite, worth remembering if you restore it: Apple releases the
user's name exactly once, on first authorization, so it must be persisted immediately or it is gone
for good — re-testing needs the app removed under Settings → Apple ID → Sign in with Apple → the app
→ Stop Using Apple ID. And "Hide My Email" creates the account on a `@privaterelay.appleid.com`
address, so the same person signing in with Google on web and Apple on iPhone gets **two accounts**
unless you build a merge path.
