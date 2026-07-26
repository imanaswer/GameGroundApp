# App icon & splash assets

`app.config.js` points at the four files below. Replace the placeholder PNGs in this folder
with the Game Ground logos (keep the exact filenames), then rebuild (`npx expo run:ios` /
`--platform android`, or `npx expo prebuild --clean` for a fresh native project).

| File | Purpose | Spec | Which logo |
|---|---|---|---|
| `icon.png` | iOS + base app icon | **1024×1024, opaque (NO transparency), square**, no rounded corners (the OS rounds it) | Black mark on white/cream **or** red mark on #050505 — a full-bleed square |
| `splash-icon.png` | Launch splash mark (bg is #050505, dark) | **transparent PNG**, ≥ 512px, mark centered | **Red** mark on transparent (a black mark would vanish on the dark splash) |
| `android-icon-foreground.png` | Android adaptive-icon foreground (bg #050505 set in config) | **1024×1024, transparent**, mark inside the centre ~66% "safe zone" with transparent padding | Red mark on transparent |
| `android-icon-monochrome.png` | Android themed icon **and the notification icon** | **1024×1024, transparent**, mark as a **solid white silhouette** (Android tints it) | White silhouette of the mark |

Notes:
- iOS rejects icons with an alpha channel — `icon.png` must be fully opaque.
- The notification icon (via the `expo-notifications` plugin) reuses `android-icon-monochrome.png`;
  it must be a flat white silhouette on transparent or it renders as a grey square.
- `favicon.png` is web-only (unused in the app); leave or replace, doesn't matter.
- The in-app wordmark ("Game Ground" in Instrument Serif) is rendered as text per DESIGN_SYSTEM
  §5 — it does not use an image file. If you'd prefer the logo mark in-app (splash animation,
  onboarding, header), ask and it can be added as an SVG component.
