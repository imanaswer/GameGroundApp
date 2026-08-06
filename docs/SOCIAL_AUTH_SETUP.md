# Social sign-in setup (Google + Apple)

Developer PRD §5.2, **with a scope change for Google** — see below. Apple follows the PRD as written.

| Layer | Google | Apple |
|---|---|---|
| App | `useGoogleLogin` opens the site's OAuth flow in a browser | `loginWithApple` → native sheet |
| Server | `/api/auth/google/handoff` + `/api/auth/google/exchange` | `POST /api/auth/apple/mobile` |
| App-side config | **none** | `EXPO_PUBLIC_APPLE_AUTH_ENABLED=true` |
| Console work | **none** | App ID capability |

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

For Apple:

```
APPLE_BUNDLE_IDS=net.gameground.redesigned,net.gameground.redesigned.dev
```

This is the **audience allowlist**. The identity token's `aud` is the app's bundle id, so every
bundle id you build must be listed. Unset makes the Apple route answer 503 rather than verify
against an empty audience — a token minted for any other developer's app would otherwise pass.

Then apply the migrations (`User.appleId`, `MobileAuthCode`):

```bash
npx prisma migrate deploy
```

Vercel reads env changes only on the next deployment — set, then redeploy.

## Apple Developer

Native Sign in with Apple needs only the App ID capability — no Service ID and no signing key
(those are for the *web* flow, which this app does not use).

1. Certificates, Identifiers & Profiles → Identifiers → the App ID for each bundle id.
2. Enable **Sign in with Apple** → Save.
3. Rebuild. `expo-apple-authentication` (already in `app.config.js` `plugins`) writes the entitlement.

Then flip `EXPO_PUBLIC_APPLE_AUTH_ENABLED` to `true` in `eas.json`, but only **after** the server has
`APPLE_BUNDLE_IDS` deployed, or iPhone users get a button that 503s.

## Verify on a device

Google works in Expo Go and in a dev client, on emulator or hardware — it is only a browser tab.
Apple needs a real iOS build.

- [ ] Google button appears on login and signup, with no configuration
- [ ] Tapping opens a `gameground.net` tab, and completing it returns to the app signed in
- [ ] Closing the tab returns silently, no error banner
- [ ] Signing in with an email that already has a password account lands on **that** account
- [ ] Apple button appears on iOS only, and only with the flag on
- [ ] Cancelling the Apple sheet returns silently (`ERR_REQUEST_CANCELED`)
- [ ] First Apple authorization persists the name; sign out, sign back in, name is still there
- [ ] Apple "Hide My Email" creates a working account on a `@privaterelay.appleid.com` address

The last two fail quietly: Apple releases the name exactly once, so if it is not persisted on first
authorization it is gone for good. Re-testing needs the app removed under Settings → Apple ID →
Sign in with Apple → the app → Stop Using Apple ID.
