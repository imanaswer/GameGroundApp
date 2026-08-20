# Deep Links — Web Repo Handoff (M13)

Universal/App Links need two static files served from the **web repo** (`gameground.net`,
`public/.well-known/`), with `Content-Type: application/json` and **no redirect**. The mobile
side (associatedDomains + Android intentFilters with autoVerify) is already configured in
`app.config.js`. Coordinate this with a web deploy.

> **The bundle id below changed on 7 Aug 2026 — do not publish from an older copy of this file.**
> It used to say `net.gameground.app`, which is the ORIGINAL app's id. This app ships
> `net.gameground.redesigned`. Publishing the wrong id does not error anywhere: iOS simply never
> associates the domain and every link keeps opening the browser, with no signal on either side.
> The authority is `app.config.js` → `variant.id`, not this document.

> **Both hosts must serve both files.** `app.config.js` declares `www.gameground.net` *and* the
> apex `gameground.net` on iOS and Android alike. An apex that 301s to `www` does **not** count —
> the spec requires no redirect, so the apex must serve the file directly or apex links stay
> unverified while `www` links work, which is a maddening bug to chase.

## 1. `public/.well-known/apple-app-site-association`

Replace `TEAMID` with the Apple Developer Team ID (from EAS credentials / the Apple portal).
No `.json` extension. Served at `https://www.gameground.net/.well-known/apple-app-site-association`.

```json
{
  "applinks": {
    "apps": [],
    "details": [
      {
        "appID": "TEAMID.net.gameground.redesigned",
        "paths": [
          "/games/*",
          "/coaches/*",
          "/camps/*",
          "/workshops/*",
          "/events/*",
          "/leaderboard"
        ]
      }
    ]
  }
}
```

## 2. `public/.well-known/assetlinks.json`

Replace the fingerprint with the **release** SHA-256 signing cert fingerprint(s) from
`eas credentials` (Android). Include both the Play App Signing key and the upload key if they
differ. Served at `https://www.gameground.net/.well-known/assetlinks.json`.

```json
[
  {
    "relation": ["delegate_permission/common.handle_all_urls"],
    "target": {
      "namespace": "android_app",
      "package_name": "net.gameground.redesigned",
      "sha256_cert_fingerprints": [
        "AA:BB:CC:DD:...:FF"
      ]
    }
  }
]
```

## Verification (post-deploy, on device)

Run the curl checks against **both** hosts — the apex is the one that silently fails.

```bash
for host in www.gameground.net gameground.net; do
  echo "── $host"
  curl -sI "https://$host/.well-known/apple-app-site-association" | head -3   # 200, application/json, NO 3xx
  curl -sI "https://$host/.well-known/assetlinks.json"            | head -3
done
```

- Android: `adb shell pm get-app-links net.gameground.redesigned` shows `verified` for **both** hosts.
- Tap a `https://www.gameground.net/games/<id>` link in WhatsApp on each platform → app opens to that game (no browser hop). Same link without the app → website.
- Repeat that tap with the apex form `https://gameground.net/games/<id>`. Before 7 Aug 2026 Android declared only `www`, so this case opened the browser on Android and the app on iOS — it is the regression most likely to come back.
