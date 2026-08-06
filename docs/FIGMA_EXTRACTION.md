# Reference Figma — extraction report

Source: the reference sportswear-app community file, `ARFuxrQIE8GgZzbyy6osiU`.
Extracted 2 Aug 2026 via the Figma MCP. Two pages: `2:7312` Template (164 screens), `1:2` Component.

**This is a report, not a decision.** Nothing here has been applied to the app. Read the
"Blockers" section before planning any port — two of the four are product-level, not styling.

---

## 1. Typography

Family is **`Helvetica Now Text`** across every style. Three weights: Regular 400, Medium 500,
Bold 700. No second family — no display/serif face anywhere in the file.

Tracking in the variables is reported as a bare number but is **percent**, confirmed by the layer
labels ("Tracking: -4%"). React Native's `letterSpacing` is in px, so it must be converted:
`px = size × pct / 100`. Copying `-4` literally onto 24px text would overlap the glyphs.

| Style | Size | LH multiple | LH px | Tracking | RN letterSpacing |
|---|---|---|---|---|---|
| Display 2xl | 32 | 1.2 | 38.4 | −3% | −0.96 |
| Display xl | 28 | 1.2 | 33.6 | −0.6% | −0.17 |
| Display lg | 28 | 1.1 | 30.8 | −2.5% | −0.70 |
| Display md | 24 | 1.2 | 28.8 | −4% | −0.96 |
| Display sm | 20 | 1.2 | 24.0 | 0% | 0 |
| Text 2xl | 16 | 1.0 | 16.0 | −2.5% | −0.40 |
| Text xl | 16 | 1.2 | 19.2 | 0% | 0 |
| Text lg | 16 | 1.5 | 24.0 | −2.4% | −0.38 |
| Text md | 14 | 1.2 | 16.8 | −1% | −0.14 |
| Text sm | 12 | 1.0 | 12.0 | −2.5% | −0.30 |
| Text xs | 10 | 1.0 | 10.0 | −2% | −0.20 |

Each size exists in Regular / Medium / Bold, plus underline variants at Text 2xl.

### Defects in the source file — do not port blindly

- **`Text md/Bold` is not bold.** It is defined `style: Medium, weight: 500`, identical to
  `Text md/Medium`. Porting as-is makes 14px bold text silently render medium.
- **Line-height 1.0 on `Text 2xl` (16px), `Text sm` (12px), `Text xs` (10px).** Safe in a mockup
  where text never wraps; on a phone with dynamic type, wrapped lines collide. Our current body
  role uses ~1.38. Keep their sizes and tracking, lift the leading on any multi-line role.
- **`Gray/500` has two different values** depending on which node you query — `#667085` from the
  Typography frame, `#8C8C8C` from the Colors frame. Two collections disagree. Resolve before use.

---

## 2. Color

**The palette is a LIGHT theme.** Surfaces are white/near-white, text is near-black.

| Token | Value |
|---|---|
| Primary/white | `#FFFFFF` |
| Primary/black | `#000000` |
| Gray/100 | `#F6F6F6` |
| Gray/200 | `#E4E4E4` |
| Gray/300 | `#CDCDCD` |
| Gray/400 | `#BABABA` |
| Gray/500 | `#8C8C8C` *(conflicts with `#667085` — see defects)* |
| Gray/600 | `#767676` |
| Gray/700 | `#57595B` |
| Gray/800 | `#1F1F1F` |
| Gray/900 | `#101828` |

Semantic ramps, 100→800 each:

- **Success** `#CFF2D8 · #9DE5B0 · #6ED989 · #35C75A · #2AA147 · #32862B · #19612B · #11401D`
- **Warning** `#FFE1C8 · #FFBF8C · #FF9E4F · #FF821D · #FC5100 · #D94601 · #A33501 · #622001`
- **Error** `#F8E2DD · #EDB7AA · #E79A88 · #DC6E57 · #CA462A · #99351F · #662415 · #44180E`

**There is no brand accent colour.** No red, no signature hue — the system is black, white, grey,
plus semantic states. The source's brand presence comes from its logo mark and photography, not
from a palette accent. GameGround's `#e63946` red has no counterpart here.

## 3. Elevation

| Token | Shadow |
|---|---|
| xs | `0 1 2` @ `#1018280D` |
| sm | `0 1 2` @ `#1018280F` + `0 1 3` @ `#1018281A` |
| md | `0 2 4 -2` @ `#1018280F` + `0 4 8 -2` @ `#1018281A` |
| lg | `0 4 6 -2` @ `#10182808` + `0 12 16 -4` @ `#10182814` + `0 4 4` @ `#00000040` |
| xl | `0 8 8 -4` @ `#10182808` + `0 20 24 -4` @ `#10182814` |
| 2xl | `0 24 48 -12` @ `#1018282E` |
| 3xl | `0 32 64 -12` @ `#10182824` |

Shadows are tuned for light surfaces. On our `#050505` background they are invisible — dark UIs
separate surfaces with elevation *tint*, not drop shadow.

## 4. Components

Buttons: `color=black|white` × `size=sm|md`, fully-rounded pills, `Text xl/Medium` labels.
Also present: text inputs (`status=placeholder|typed`, with/without icon, single/multi-line,
with/without title/hints), checkboxes and radios (`status=normal|hover`, `checked=on|off`,
`with label=on|off`), sheet headers, selection rows, 1-action and 2-action modals.

---

## 5. Screen inventory vs. GameGround

164 screen-sized frames. Grouped:

| Source group | Count | GameGround counterpart |
|---|---|---|
| Sign up 01–09 | 9 | `app/(auth)/signup.tsx` ✅ |
| Login 01–07 | 7 | `app/(auth)/login.tsx` ✅ |
| Account Setup 1–18 | 18 | partial — onboarding/profile setup ⚠️ |
| Profile 01–26 | 26 | `app/profile/*` ⚠️ partial |
| Home 01–07 | 7 | `app/(tabs)/home.tsx` ⚠️ different content model |
| Loading | 3 | our skeletons ✅ |
| **Shop 01–07** | 7 | ❌ none |
| **Product Detail 1–6** | 6 | ❌ none |
| **Bag 01–22** | 22 | ❌ none |
| **Order 01** | 1 | ❌ none |
| **Favourites 01–03** | 3 | ❌ none |

**The source app is e-commerce; GameGround is bookings.** Roughly 40 of the 164 screens — the
entire Shop → Product → Bag → Order spine — model buying physical products and have no GameGround
equivalent. Conversely, GameGround's core has **no counterpart in the source at all**: games
browse/detail/create, coaches and batches, camps, workshops, events, the leaderboard and tier
system, slot selection, and Razorpay checkout.

Tab bars differ too: the source is Home · Shop · Favourites · Bag · Profile; ours is
Home · Games · Coaches · Discover · Leaders (Decision 5).

---

## 6. Blockers

1. **Font licensing.** `Helvetica Now Text` is Monotype-licensed. Referencing it in Figma is not a
   license to ship it in an app. Either buy a Monotype app license or substitute — Inter (already
   bundled) is the standard Helvetica substitute, and metrics (size/leading/tracking) are not
   copyrightable, so the scale above can be adopted regardless of which family renders it.
2. **Light vs dark.** Adopting this palette means inverting the entire app. Every screen, every
   card, every scrim, the status bar, the splash, the photographic treatment, and all 11 shadow
   and gradient tokens assume a dark ground today. This is a product decision, not a restyle.
3. **No brand accent.** Adopting the palette wholesale discards GameGround red, which currently
   carries tier states, CTAs, live badges, and the leaderboard.
4. **Coverage.** ~25% of the source's screens map to something we have; our highest-traffic screens map
   to nothing. A literal "redesign everything with the Figma" is not achievable — most of our app
   would still have to be designed, just in a new visual language.

---

## 7. What is worth taking

Ranked by value-to-risk:

1. **The type scale** (§1) — coherent, well-tempered, portable to any family. Highest value.
2. **The grey ramp and semantic ramps** (§2) — usable as-is in a light theme, invertible for dark.
3. **The component inventory** (§4) — button/input/checkbox/radio states are a superset of ours
   and worth matching state-for-state even without adopting the visual style.
4. **Auth + Account Setup** (§5) — 34 screens of direct reference for flows we already have.

What should not be taken wholesale: the light palette (blocker 2), the shadow scale (built for
light surfaces), and the commerce information architecture (no counterpart).
