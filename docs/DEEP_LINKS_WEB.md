# Deep Links — Web Repo Handoff (M13)

Universal/App Links need two static files served from the **web repo** (`gameground.net`,
`public/.well-known/`), with `Content-Type: application/json` and **no redirect**. The mobile
side (associatedDomains + Android intentFilters with autoVerify) is already configured in
`app.config.ts`. Coordinate this with a web deploy.

## 1. `public/.well-known/apple-app-site-association`

Replace `TEAMID` with the Apple Developer Team ID (from EAS credentials / the Apple portal).
No `.json` extension. Served at `https://www.gameground.net/.well-known/apple-app-site-association`.

```json
{
  "applinks": {
    "apps": [],
    "details": [
      {
        "appID": "TEAMID.net.gameground.app",
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
      "package_name": "net.gameground.app",
      "sha256_cert_fingerprints": [
        "AA:BB:CC:DD:...:FF"
      ]
    }
  }
]
```

## Verification (post-deploy, on device)

- `curl -sI https://www.gameground.net/.well-known/apple-app-site-association` → 200, JSON, no redirect.
- Android: `adb shell pm get-app-links net.gameground.app` shows `verified` for the hosts.
- Tap a `https://www.gameground.net/games/<id>` link in WhatsApp on each platform → app opens to that game (no browser hop). Same link without the app → website.
