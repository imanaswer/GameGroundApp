# GameGround Mobile Design System v1 (DESIGN_SYSTEM.md)

**Version:** 1.0 · **Status:** BINDING (Decision 9) · **Scope:** every reusable component, foundation token, layout rule, and interaction binding for the v1 app.
**Source-of-truth hierarchy:** (1) this document for component anatomy/props/states/foundations · (2) `docs/MOTION.md` for anything that moves, celebrates, or vibrates · (3) the reference builds (`GameGround_Mobile_App.html` kit + `GameGround_Design_Excellence_v3.html`) for pixel disputes this doc doesn't settle. If this doc and a reference build disagree, flag it — don't pick silently.
**Hard rule:** new screens are COMPOSED from this library. A screen that needs a brand-new component triggers §10 governance, not improvisation.

---

## 1. Color

All colors live in `src/lib/tokens.ts`. Nothing else may contain a color literal (lint-enforced).

### 1.1 Core

| Token | Value | Use |
|---|---|---|
| bg | #050505 | app background |
| card | #0a0a0a | cards, chips-bg, sheets content rows |
| elev | #0d0d0d | bottom sheets, toasts, elevated surfaces |
| border | rgba(255,255,255,.06) | hairline borders (rest) |
| border2 | rgba(255,255,255,.12) | emphasized borders, pressed/focus, grab handles |
| text | #e7e9ee | primary text |
| dim | rgba(231,233,238,.62) | secondary text |
| dim2 | rgba(231,233,238,.40) | tertiary/hints — never for body copy |

### 1.2 Brand & semantic

| Token | Value | Use |
|---|---|---|
| red | #e63946 | primary actions, active states, brand accents |
| redLight | #ff6b74 | links, elite-tier text, up-rank arrows in red contexts |
| redDeep | #b91c2d | pressed primary |
| gold | #eab308 | prices, ratings, gold tier, hot slot bars |
| goldLight | #fbbf24 | gold gradients end-stop |
| success | #4ade80 | free labels, confirmations, done states, up-arrows |
| infoSurface | #1a2230 | informational cards (setup card) |

### 1.3 Tier palette

| Tier | Text/accent | Chip bg |
|---|---|---|
| Bronze | #d99a5b | rgba(205,127,50,.15) |
| Silver | #c8cdd7 | rgba(200,205,215,.14) |
| Gold | gold token | rgba(234,179,8,.16) |
| Elite | redLight | rgba(230,57,70,.16) |
| Pro | white #fff | rgba(255,255,255,.14) |

Avatar identity colors (initials fallback rotation): #e63946 · #eab308 · #4ade80 · #6c8cff · #a78bfa · #f472b6 · #38bdf8 · #fb923c. User's own avatar: gradient 135° #6c8cff→#a78bfa.

### 1.4 Gradients & overlays (the only permitted ones)

| Name | Spec | Use |
|---|---|---|
| imageScrim | transparent 40% → rgba(0,0,0,.55) | every card image bottom |
| heroScrim | rgba(0,0,0,.32) → transparent 30–50% → rgba(5,5,5,.98) | detail heroes |
| heroSide | 100°, rgba(5,5,5,.9) 32% → rgba(5,5,5,.22) 78% | Home UpNext hero |
| ctaFade | transparent → rgba(5,5,5,.95) 42% | sticky CTA backdrop |
| tierSweep | shine sweeps per MOTION.md §8 | badges/heroes only |

Contrast gates: body ≥ `text` on bg; nothing below `dim` on cards; `dim2` for hints/timestamps only.

---

## 2. Typography

Two families only. Serif is the personality; it is rationed.

| Role | Family | Size | Weight | Notes |
|---|---|---|---|---|
| display | Instrument Serif | 38–40 | 400 | onboarding headlines only; -0.5px tracking; italic = red accent word |
| title1 | Instrument Serif | 27 | 400 | screen/detail titles, greeting; line-height 1.08 |
| title2 | Instrument Serif | 21–23 | 400 | brand wordmark, hero card titles, celebration headlines |
| amount | Instrument Serif | 33 | 400 | checkout amount only |
| heading | Inter | 14.5–15 | 700 | card titles, sheet headers |
| body | Inter | 12.5–13.5 | 400–600 | paragraphs, meta rows, inputs |
| caption | Inter | 10.5–11.5 | 400–600 | card meta, timestamps, helper text (`dim`) |
| label | Inter | 10.5 | 700 | SECTION LABELS: uppercase, .14em tracking, `dim` |
| micro | Inter | 8.5–9.5 | 800 | tier chips, live chips, tab labels; uppercase where chip-like |

Rules: serif never below 20px and never for UI controls; numerals that change live use `tabular-nums`; italic serif exists only as the red accent word inside a serif line; no all-caps body text.

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

### Chip / ChipRow
Pill radius 999, 12px/600, padding 7×14; rest = border+dim; active = red bg/border, white text, red glow.
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
Padding 48 top (safe area) / 18 sides. Left: serif brand (21px; wordmark on Home, screen name at 24px elsewhere). Right: icon buttons (34pt circles, card bg) + MeAvatar → profile.

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
Floating icon tile (66pt circle, card bg, red icon, idle float, tap-reacts) + serif 20px headline + 12px dim body + primary CTA (+ optional secondary). Copy from MOTION.md §6 catalog — exact strings, not improvised.

### MapPreview
96pt card, dark blue-gray gradient, grid overlay, road stroke, bouncing pin, red "Directions" mini-button bottom-right. Placeholder in prototype; static map image + intent link in app.

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
| UpNextHeroCard | 176pt, heroSide scrim, parallax image, shine sweep, UPNEXT eyebrow + pulse dot, serif title, meta + weather chip?, AvatarStack pop-in, countdown cells, SlotRing | Home only; the flagship |
| Ticker | 26pt pill, live dot pulse, rotating 10.5px message ~3.4s | Home |
| SetupCard | infoSurface bg, info border, icon tile + bold lead/body + chevron | dismissible one-time |

Countdown cells: white .09 bg tiles, border2, radius 9, 13px/800 tabular-nums + 7.5px unit caption.

---

## 7. Component library — commerce & feedback

### CheckoutSheet
Bottom sheet: elev bg, radius 28 top, grab handle (38×4, border2), physics per MOTION.md §2 (drag, rubber band, velocity dismiss; **dismissal blocked during verification** — warning haptic).
Internal states✱: `methods` (header + serif amount + PaymentMethodRows + Pay button + server-authoritative footnote) → `processing` (VerificationTimeline — no spinner) → `success` (extended sequence, MOTION.md §5) / `failure` (message + Try again) / `reconciling` (per dev PRD §9.4).

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
PlayerHeroCard: cover image (118pt, dark-filtered, fades to bg) over gradient card (radius 24) with ambient red radial pulse; 64pt avatar with shine; serif name + @handle·city; TierBadge; RankProgress (7px bronze→silver gradient bar + shine) with pts count-up.
StatStrip: 4 equal cells, hairline dividers, 16/800 count-up values + 9px uppercase labels.
WeekStrip: 10 bars, red .7, staggered scaleY growth, opacity encodes intensity. Attendance data only (v1) — not an achievements surface (Decision 6).

---

## 9. Layout & composition rules

- Screen template: Header → (chips/seg?) → scroller with 18px side padding → TabBar. Detail template: hero → dbody(18) → StickyCTA. List bottom padding ≥ 90 (CTA) / 70 (tabs).
- Rails: horizontal FlashList, 12 gap, 18 inset, compact cards only; a rail with no items renders nothing.
- Density: max one ambient loop pair per screen (MOTION.md §10); one serif title per viewport region; FILLING FAST appears only when data says so.
- Every screen ships loading (skeleton), empty (§6 catalog), error (server `error` verbatim + retry), and offline states — a happy-path-only screen is incomplete.
- Copy: sentence case; verbs on buttons ("Join game", "Pay ₹120", never "Submit"); action names stay identical through their flow ("Pay" → toast "Payment confirmed"); errors say what happened and what to do next; empty states invite action.

## 10. Governance

1. **Adding a component:** justify why composition can't cover it → spec it in this doc (anatomy/props/states/motion refs) → build in `_dev/components.tsx` → Anain sign-off → then use in screens. One PR.
2. **Changing a token:** decision-log entry required; tokens are cross-app blast radius.
3. **The catalog screen (`app/_dev/components.tsx`) is this document made executable** — every component in every ✱ state, permanently maintained. Doc and catalog must never disagree; if they do, fix in the same PR.
4. Milestone binding: foundations+chrome+cards = M3 · commerce = M6 · social/profile = M10/M11 · UpNextHero/Ticker/SetupCard = M9A.
