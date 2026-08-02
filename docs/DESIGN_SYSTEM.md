# GameGround Mobile Design System v1 (DESIGN_SYSTEM.md)

**Version:** 2.0 · **Status:** BINDING (Decision 9, foundations superseded by Decision 20) · **Scope:** every reusable component, foundation token, layout rule, and interaction binding for the v1 app.
**Source-of-truth hierarchy:** (1) `src/lib/tokens.ts` — the ported values are the truth and are contrast-tested in CI; this document describes them · (2) this document for component anatomy/props/states · (3) `docs/MOTION.md` for anything that moves, celebrates, or vibrates · (4) `docs/NIKE_FIGMA_EXTRACTION.md` for what the source system actually specified, including the three defects deliberately not inherited.
**v2 (2 Aug 2026):** Decision 20 ported the foundations to the Nike Figma light system and Decision 21 resolved the tier palette. §1–§3 below are rewritten; the old dark values are gone, not deprecated. The pre-port reference builds no longer describe this app and are not a tie-breaker for colour or type.
**Hard rule:** new screens are COMPOSED from this library. A screen that needs a brand-new component triggers §10 governance, not improvisation.

---

## 1. Color

All colors live in `src/lib/tokens.ts`. Nothing else may contain a color literal (lint-enforced).
Ported from the Nike Figma (Decision 20). **The app ground is white.**

Two rules that are not obvious from the tables and that the CI contrast tests enforce:

1. **Fill colours are not text colours.** `success` and `gold` are fills; at 2.2:1 and 3.6:1 on
   white they are illegible as type. Their text counterparts are `successText` / `goldText`. The
   tests assert this in both directions — the fill token must *fail* as text — because folding a
   pair back into one token compiles cleanly and only surfaces when a user cannot read a price.
2. **Names are roles, not hues.** `primary` is black. The system has no brand accent: identity
   comes from the mark and photography, exactly as in the source.

### 1.1 Core

| Token | Value | Use |
|---|---|---|
| bg | #FFFFFF | app background |
| card | Gray/100 #F6F6F6 | grey wash for section separation |
| elev | #FFFFFF | cards, sheets, toasts — separated by shadow + hairline, not by fill |
| border | Gray/200 #E4E4E4 | hairline borders (rest) |
| border2 | Gray/300 #CDCDCD | emphasized borders, pressed/focus, grab handles |
| text | Gray/900 #101828 | primary text |
| dim | Gray/700 #57595B | secondary text |
| dim2 | Gray/600 #767676 | tertiary/hints — **never** body copy (AA-large only) |

`dim` is Gray/700 and **not** the source's Gray/600, which measures 4.20:1 on the `card` surface —
under AA. That pairing is a source defect; see the extraction doc.

### 1.2 Action & semantic

| Token | Value | Use |
|---|---|---|
| primary | #000000 | primary actions, selected states, active indicators |
| primarySoft | Gray/800 #1F1F1F | secondary emphasis |
| primaryDeep | #000000 | pressed primary |
| focusRing | rgba(0,0,0,.40) | input focus ring |
| gold | Warning/500 #FC5100 | **fill only** — chips, pills, gradient stops |
| goldLight | Warning/400 #FF821D | warm pill fills (spots-left, featured) |
| goldText / goldDeep | Warning/700 #A33501 | ratings and warm accents **as text/icons** |
| success | Success/400 #35C75A | **fill only** — dots, bars |
| successText | Success/700 #19612B | success labels and glyphs |
| successSurface | Success/100 #CFF2D8 | confirmation wash |
| errorSurface | Error/100 #F8E2DD | error wash |
| errorWash | rgba(202,70,42,.06) | subtle error tint |
| live | Error/500 #CA462A | live/urgent badge fill (white label) |
| infoSurface | Gray/100 #F6F6F6 | informational cards |

Full Gray/Success/Warning/Error ramps (100–800) are exported as `gray` and `ramp` for component
work. Semantic ramps are the source's, unmodified.

### 1.3 Tier palette (Decision 21)

`fg` does three jobs and each sets a floor: text on its own chip tint (4.5:1), a ring/accent on
white (4.5:1), and a **solid fill under a white trophy glyph** in TierUp (3:1). A silver light
enough to read as silver passes the first and fails the other two — which is why a metallic
palette is unbuildable here, not merely off-brand.

| Tier | Accent (`fg`) | Chip bg (10% tint) |
|---|---|---|
| Bronze | #7A4A21 | rgba(122,74,33,.10) |
| Silver | Gray/700 #57595B | rgba(87,89,91,.10) |
| Gold | Warning/700 #A33501 | rgba(163,53,1,.10) |
| Elite | Gray/900 #101828 | rgba(16,24,40,.08) |
| Pro | #000000 | rgba(0,0,0,.06) |

The three metal tiers keep a hue so they stay nameable; the two beyond metal drop to ink. Rank
reads as "coloured, then absolute".

**Known weakness:** Elite and Pro are near-indistinguishable side by side. Separating them needs a
filled-vs-outlined `TierBadge` variant — a treatment change the `fg`/`bg` token shape cannot
express. Not faked with a colour that would misrepresent the hierarchy.

Avatar identity colours are darkened for legibility on white: #3d5ce0 · #7c4dd8 · #d63c86 ·
#0a86c4 · #d96a10. Own avatar gradient 135° #3d5ce0→#7c4dd8.

### 1.4 Gradients & overlays (the only permitted ones)

| Name | Spec | Use |
|---|---|---|
| imageScrim | transparent 40% → rgba(0,0,0,.55) | every card image bottom |
| heroScrim | rgba(0,0,0,.28) → transparent 40% → rgba(255,255,255,.98) | detail heroes |
| heroSide | 100°, rgba(255,255,255,.92) 32% → rgba(255,255,255,.22) 78% | Home UpNext hero |
| ctaFade | transparent → rgba(255,255,255,.95) 42% | sticky CTA backdrop |
| welcomeScrim | rgba(0,0,0,.45) → transparent 28% → rgba(5,5,5,.72) 70% → rgba(5,5,5,.97) | full-bleed photographic screens (welcome) |
| tierSweep | shine sweeps per MOTION.md §8 | badges/heroes only |

A scrim that meets the PAGE fades to white; a scrim that sits on a PHOTOGRAPH stays dark, because
the copy over a photograph is still white. `imageScrim` and `welcomeScrim` are therefore unchanged
by the light port — they are not page colours and must not be used as such.

Contrast gates: body ≥ `text` on bg; nothing below `dim` on cards; `dim2` for hints/timestamps
only. These are asserted in `__tests__/tokens.test.ts`, not left to review.

---

## 2. Typography

**One family.** The source system is single-family and has no serif; Instrument Serif was removed
from the app entirely by Decision 20 (the Home greeting was its last render site). Emphasis is
carried by weight, not by a second face or an accent colour.

The target family is **`Helvetica Now Text`** (Monotype-licensed, purchase pending). Until those
files exist, **Inter** renders the scale behind the `FAMILY` constant in `tokens.ts`. Metrics are
not copyrightable and carry most of the visible character; swapping is five values plus the
`useFonts` map, nothing else.

Sizes and tracking are the source's exactly. **Leading is deliberately not** — the source sets 1.0
on 16/12/10px roles, which is safe in a mockup where nothing wraps and collides on a device with
dynamic type. Tracking was converted from percentages: `px = size × pct / 100`.

| Role | Size | Line height | Tracking | Weight | Use |
|---|---|---|---|---|---|
| display | 32 | 38 | −0.96 | 700 | onboarding/welcome headlines |
| authTitle | 28 | 31 | −0.70 | 700 | auth headlines |
| title1 | 20 | 24 | 0 | 500 | screen/detail titles, greeting |
| title2 | 16 | 20 | 0 | 500 | nav/detail titles, hero card titles |
| amount | 32 | 38 | −0.96 | 700 | checkout amount |
| heading | 14 | 18 | −0.14 | 700 | card titles, sheet headers |
| body | 14 | 20 | −0.14 | 400 | paragraphs, meta rows, inputs |
| bodyStrong | 14 | 20 | −0.14 | 500 | emphasised body |
| caption | 12 | 16 | −0.30 | 400 | card meta, timestamps, helper text |
| label | 10 | 14 | **+1.4** | 700 | SECTION LABELS: uppercase |
| micro | 10 | 12 | −0.20 | 700 | tier chips, live chips, tab labels |

`heading` forces weight 700: the source's own `Text md/Bold` is defined `style: Medium, weight:
500` — a defect in the file, not a style choice.

`label` inverts the source's −2% to **positive** tracking. Uppercase micro-type needs letters
opened up, not tightened, or it sets as a solid block.

**Rules:** every hardcoded `fontSize` must land on a scale step — 10 / 12 / 14 / 16 / 20 / 28 / 32
— asserted in `__tests__/lint-rules.test.ts`. Prefer a `type.*` role over a raw size; the test is
a backstop for genuine one-offs, not permission to add them. Numerals that change live use
`tabular-nums`. No all-caps body text.

---

## 3. Spacing, radius, elevation, iconography

**Spacing:** 4pt scale via `space(n)`. Screen horizontal padding **18**. Card internal padding 12–14. Rail gap 12. Chip gap 8. MetaRow vertical 11. Section label rhythm: 18 top / 10 bottom.
**Radius:** card 20 · hero 22 · pHero/profile hero 24 · sheet 28 (top) · input 14 · expand/toast 14–16 · minor tiles 9–12 · chips/avatars/bars 999.
**Elevation (dark-theme = borders + glow, not gray shadows):** rest = `border` hairline; raised = `border2` + `0 6–8px 24–28px` colored glow at ~30% for primary CTAs (red) and success states (green); sheets/toasts = elev bg + `0 ±14–18px 40–60px rgba(0,0,0,.55)`; press = shadow tightens with the compress (MOTION.md §3).
**Iconography:** the kit's Lucide-path set in `src/components/ds/icons.tsx` only. Stroke 2, round caps/joins. Sizes: tab 20 · header buttons 15–17 · meta rows 17 · empty states 22–26. Never emoji as icons; never mixed icon families.

---

## 4. Component library — foundations tier

Anatomy → props → states → motion binding. States marked ✱ are mandatory to implement before a component is "done" in M3.

### Button
Primary (red, white text, radius 16, padding 14–15, weight 700, red glow) · Secondary (transparent, border2, text) · Ghost (text-only, dim) · Mini (11.5px/700, padding 9×15, radius 11 — inline contexts like batch Book).
Props: `variant, size, loading, disabled, icon?, onPress`.
States✱: rest / pressed (MOTION.md §3 compress + ripple on primary) / loading (inline spinner — one of only two legal spinners) / disabled (opacity .5) / success-morph (bg→success, check draw-on; see CTA usage).
A11y: role button, min height 44.

**Inverted CTA (photographic surfaces only).** Over a full-bleed photo the red primary loses contrast against warm/dark image content and `border2` (12% white) vanishes — so the welcome screen uses an inverted pair instead: filled = `color.inverse` bg + `onInverse` label; outlined = transparent + 1px `inverseBorder`. Both height 52, radius 999 (fully round, unlike §4's radius-16 family — they sit on photography, not on the app's black), side by side with `space(3)` between. Currently local to `app/onboarding.tsx` and NOT a `Button` variant; promoting it needs §10.1 sign-off. Do not use on a solid background — that is what Primary/Secondary are for.

### Chip / ChipRow
Pill radius 999, 12px/600, padding 7×14; rest = border+dim; active = red-wash fill (`redSurface`) + red-focus border + `redLight` text. (This tinted selection is the shipped kit reality — it reads calmer on the dark surface than a solid-red fill; doc reconciled to code per §10.3.)
ChipRow: horizontal scroll, no scrollbar, 8 gap, screen-padding inset.
States✱: rest / active / pressed (scale .90) / disabled. Selection haptic. Filter changes animate the consuming list (MOTION.md §2).

### Badge / TierBadge
8.5px/800 uppercase, .08em, padding 3×7, radius 6. TierBadge maps tier→§1.3. LiveChip variant: red bg .92, white text, pulsing 4px dot, used for FILLING FAST / live states.
States: static (rest, one pulse animation max).

### Avatar / AvatarStack
Sizes: 22 (stack) / 32 (rows) / 34 (header me) / 44–48 (cards) / 52–66 (podium) / 62–64 (profile). Image → initials fallback on identity color. Stack: −7 overlap, 2px card-color ring, `+N` overflow chip (white .16 bg).
States✱: image-loaded / initials / pop-in (MOTION.md §8 stagger, first mount only).

### Stars
Gold, fractional fill via path geometry from the kit. 10px in cards, 12px in detail headers. Static.

### SlotBar / SlotRing
SlotBar: 5px track (white .08), fill red; >75% → gold gradient + "hot"; width animates on mount; highlight sweep (MOTION.md §8). Paired `slotlab` caption row (10px, dim): "x/y joined · z left".
SlotRing: 52pt SVG circle, 3.5 stroke, red progress on white .14 track, dashoffset animates 1s; center label 10px/800. Home hero only in v1.

### Input
Card bg, radius 14, border → red focus ring at 40% alpha, 13.5px text, placeholder dim2, floating error line (redLight, 10.5px) below.
States✱: rest / focus / error (server 422 details map here) / disabled. Never a bare HTML-ish outline.

### SearchBar
Input variant with leading search icon, radius 16. Header icon → full search morph per MOTION.md §2.

### Skeleton
Shapes mirror the real component (card image block + 2 text lines + bar). Shimmer 1.3–1.4s. First paint <100ms. Never generic boxes of arbitrary size.

---

## 5. Component library — chrome tier

### Header
Padding 48 top (safe area) / 18 sides. Left: brand mark (tinted `primary`, i.e. black on the white header — the source's own treatment) or screen name at `title2`. Right: icon buttons (34pt circles, `card` bg) + MeAvatar → profile.

### HeroNav / SolidNav
HeroNav: transparent over hero, back + share icon buttons. SolidNav: appears at hero-collapse point — bg rgba(5,5,5,.94) + blur 14, hairline bottom border, back + 14px/700 title. Morph interpolated per MOTION.md §2. Collapse thresholds: game detail ~170px, coach ~130px.

### TabBar
5 items (Home, Games, Coaches, Discover, Leaders), 70pt + safe-area, bg rgba(5,5,5,.86–.88) + blur 16–18, hairline top. Item: 20pt icon + 9px/600 label; active = red + icon spring + 24px indicator bar + halo (MOTION.md §2). Selection haptic.

### StickyCTA
Bottom-pinned over ctaFade gradient, safe-area aware. Slots: price block (16px/800 gold + 9px caption, or FREE in success) + Button primary. Success-morph after server confirmation only.

### SegmentedControl (Discover)
Card bg container radius 14, padding 4; sliding red pill (spring.pop) under active 12px/700 segment; content fade-swap. Selection haptic.

### Toast
Top-anchored, elev bg, radius 16, icon tile (32pt, semantic tint) + 12.5px/700 title + 10.5px dim body + 2px progress bar draining over its 2.4s life. Spring in from −100. One at a time; re-trigger resets.

### EmptyState
Floating icon tile (66pt circle, `card` bg, `primary` icon, idle float, tap-reacts) + `title2` headline + `body` dim + primary CTA (+ optional secondary). Copy from MOTION.md §6 catalog — exact strings, not improvised.

### MapPreview
96pt card, dark blue-gray gradient, grid overlay, road stroke, bouncing pin, red "Directions" mini-button bottom-right. Placeholder in prototype; static map image + intent link in app.

### SplashGate (launch)
Full-bleed `bg` field, white brand mark centered at the same width as the native splash (`imageWidth` 140pt, 100 on Android — Android 12+ masks the outer third of its system splash). That puts the artwork at ~28.5% of a 393pt screen, deliberately under the reference's 33.5%: the reference mark is a thin ribbon and ours is a solid arrow, so equal bbox width reads oversized. Note `imageWidth` sizes the square canvas, not the artwork — this asset's alpha bbox is 79.9% of its canvas, so the two are not interchangeable. The value lives in `app.config.js` and `SplashGate.tsx` and must move in both. Mounts opaque, dismisses the native splash on its first layout, holds to a 1200ms floor measured from bundle evaluation, then fades on dur.base + ease.exit and unmounts. Blocks touches while up. Cold start only — no AppState listener, so it never replays on resume. Reduced motion drops the fade, keeps the hold. See Decision 18.

### ExpandCard (accordion)
Card bg, radius 14, 12.5px/600 head + rotating chevron (spring), max-height body reveal. Selection haptic.

---

## 6. Component library — content cards

All cards: card bg, hairline border, card radius, imageScrim on images, press physics (MOTION.md §3), image placeholder-color #141414 → fade-in.

| Card | Size/anatomy | Notes |
|---|---|---|
| GameCard | full-width; image 118 + LiveChip? → title heading + venue·when caption + price/FREE → AvatarStack + TierBadge row → SlotBar + slotlab | the workhorse |
| GameCard `compact` | 210×(88 image) rail variant; title/meta/price/joined-count | Home rails |
| CoachCard | image 100 + overlapping 48pt face avatar → name/sport vs stars/price columns | directory |
| CoachCard `compact` | 150pt centered rail card: facility image, −22 overlap avatar, name, sport, stars | Home rail |
| Camp/Workshop/EventCard | GameCard anatomy, section accents, + registration SlotBar ("x% registered") + FILLING FAST >70% | Discover segments |
| UpNextHeroCard | 176pt, heroSide scrim, parallax image, shine sweep, UPNEXT eyebrow + pulse dot, `title2` title, meta + weather chip?, AvatarStack pop-in, countdown cells, SlotRing | Home only; the flagship |
| Ticker | 26pt pill, live dot pulse, rotating 10.5px message ~3.4s | Home |
| SetupCard | infoSurface bg, info border, icon tile + bold lead/body + chevron | dismissible one-time |

Countdown cells: white .09 bg tiles, border2, radius 9, 13px/800 tabular-nums + 7.5px unit caption.

---

## 7. Component library — commerce & feedback

### CheckoutSheet
Bottom sheet: elev bg, radius 28 top, grab handle (38×4, border2), physics per MOTION.md §2 (drag, rubber band, velocity dismiss; **dismissal blocked during verification** — warning haptic).
Internal states✱: `methods` (header + `amount` + PaymentMethodRows + Pay button + server-authoritative footnote) → `processing` (VerificationTimeline — no spinner) → `success` (extended sequence, MOTION.md §5) / `failure` (message + Try again) / `reconciling` (per dev PRD §9.4).

### PaymentMethodRow
Icon tile 34 + 13px/700 name + 10.5px caption + radio (17pt ring; red dot springs in). Selected: red border + red 6% wash. Press scale .98.

### VerificationTimeline
3 steps (Creating order → Payment received → Verifying with server). Step states: pending (dim2 ring) → active (red ring + pulsing dot) → done (green ✓ tile). Steps flip on **real** state changes, never on timers, in production.

### RepGainCard
Card row: "Reputation / +N pts" (success), progress bar animating toward next tier with shine, "x pts / next tier at y" meta. Data from refetched `me` — never client-computed.

### Celebrations
TierUp overlay, confetti, join-success burst: implement exactly per MOTION.md §5. Confetti: 26 pieces, 5-color set, randomized trajectory/rotation, self-removing.

---

## 8. Component library — social proof & profile

### LeaderRow / PinnedRankRow / Podium
LeaderRow: rank (12/800 tabular) + 32 avatar + name/TierBadge + score (12.5/800) + ▲/▼ delta (9/800, success/redLight). Podium: 1st 66pt gold-ring avatar + shine + bobbing crown + 58pt base; 2nd/3rd 52pt silver/bronze, 42/32pt bases; staggered rise + score count-ups on tab entry (once). PinnedRankRow: red 10% blurred strip above TabBar, slides in once, own rank always visible.

### PlayerHeroCard / StatStrip / WeekStrip
PlayerHeroCard: cover image (118pt, fades to bg) over card (radius 24); 64pt avatar with shine; `title1` name + @handle·city; TierBadge; RankProgress (7px tier-gradient bar + shine) with pts count-up.
StatStrip: 4 equal cells, hairline dividers, 16/800 count-up values + 9px uppercase labels.
WeekStrip: 10 bars, red .7, staggered scaleY growth, opacity encodes intensity. Attendance data only (v1) — not an achievements surface (Decision 6).

---

## 9. Layout & composition rules

- Screen template: Header → (chips/seg?) → scroller with 18px side padding → TabBar. Detail template: hero → dbody(18) → StickyCTA. List bottom padding ≥ 90 (CTA) / 70 (tabs).
- Rails: horizontal FlashList, 12 gap, 18 inset, compact cards only; a rail with no items renders nothing.
- Density: max one ambient loop pair per screen (MOTION.md §10); one `display`/`title1` headline per viewport region; FILLING FAST appears only when data says so.
- Every screen ships loading (skeleton), empty (§6 catalog), error (server `error` verbatim + retry), and offline states — a happy-path-only screen is incomplete.
- Copy: sentence case; verbs on buttons ("Join game", "Pay ₹120", never "Submit"); action names stay identical through their flow ("Pay" → toast "Payment confirmed"); errors say what happened and what to do next; empty states invite action.

## 10. Governance

1. **Adding a component:** justify why composition can't cover it → spec it in this doc (anatomy/props/states/motion refs) → build in `_dev/components.tsx` → Anain sign-off → then use in screens. One PR.
2. **Changing a token:** decision-log entry required; tokens are cross-app blast radius.
3. **The catalog screen (`app/_dev/components.tsx`) is this document made executable** — every component in every ✱ state, permanently maintained. Doc and catalog must never disagree; if they do, fix in the same PR.
4. Milestone binding: foundations+chrome+cards = M3 · commerce = M6 · social/profile = M10/M11 · UpNextHero/Ticker/SetupCard = M9A.
