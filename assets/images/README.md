# App icon & splash assets

`app.config.js` points at the four files below. Replace the placeholder PNGs in this folder
with the Game Ground logos (keep the exact filenames), then rebuild (`npx expo run:ios` /
`--platform android`, or `npx expo prebuild --clean` for a fresh native project).

**Editing a file here changes nothing on its own.** `android/` is a generated, gitignored native
project holding its own copies (`res/mipmap-*/ic_launcher*.webp`, and `app_name` in
`res/values/strings.xml`), and that is what a build reads. Run `npx expo prebuild --platform android`
to push `app.config.js` + these assets into it, then rebuild — an already-installed app keeps its old
icon and name until a new binary is installed.

| File | Purpose | Spec | Which logo |
|---|---|---|---|
| `icon.png` | iOS + base app icon | **1024×1024, opaque (NO transparency), square**, no rounded corners (the OS rounds it) | **White** mark on #050505, inset — the mark spans ~56% of the square, not full-bleed |
| `splash-icon.png` | Launch splash mark (bg is #050505, dark) | **transparent PNG**, ≥ 512px, mark centered | **White** mark on transparent — the launch is deliberately monochrome, no brand red |
| `android-icon-foreground.png` | Android adaptive-icon foreground (bg #050505 set in config) | **1024×1024, transparent**, mark inside the centre ~66% "safe zone" with transparent padding | **White** mark on transparent |
| `android-icon-monochrome.png` | Android themed icon **and the notification icon** | **1024×1024, transparent**, mark as a **solid white silhouette** (Android tints it) | White silhouette of the mark |

Notes:
- **The launcher icon carries no brand red.** The mark is white on the same #050505 field as the
  splash, so home screen → splash → the black setup/loader screens read as one sequence. The red
  source marks were recoloured by solving each pixel's field/mark blend and recomposing it against
  white, so the silhouette and its antialiased edges are unchanged (same treatment as
  `splash-icon.png` in Decision 18). Any replacement should keep that polarity.
- **The mark is inset, and the safe zone is why.** On a 1024 canvas Android shows a circle of radius
  ~341px and reserves a 313px safe zone (66dp of 108dp); at full size the wing's tips reached 371px,
  so the launcher was cutting them off. The artwork is scaled to 0.78, putting the tips at ~289px.
  Measure the *radius* of a replacement, not its bounding box — this mark is wide and shallow, so
  its width looks safe while its tips are not.
- iOS rejects icons with an alpha channel — `icon.png` must be fully opaque.
- The notification icon (via the `expo-notifications` plugin) reuses `android-icon-monochrome.png`;
  it must be a flat white silhouette on transparent or it renders as a grey square.
- `favicon.png` is web-only (unused in the app); recoloured with the rest for consistency.
- `apple-icon.png` and `icon-192.png` are unreferenced leftovers, already black-on-white.
- **In-app, the mark is `logo-mark.png` rendered with `tintColor={color.primary}`** (`Header`
  wordmark, `AuthShell`), so it is black on the light theme and white on dark and follows the token
  rather than the baked asset hue — the red still in that file never reaches the screen. The
  wordmark beside it is plain text ("GameGround"); the serif left the app with Decision 20.
