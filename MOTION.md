# GameGround Motion Design System (MOTION.md)

**Version:** 1.1 · **Status:** BINDING (Decision 7) · **Approved reference build:** `docs/GameGround_Design_Excellence_v3.html`
The kit defines how screens LOOK. This file defines how the app MOVES. Both are contracts. When a row here is ambiguous, match the reference build.

## 1. Timing & spring tokens (`src/theme/animations.ts` exports these — nothing inline, ever)

| Token | Value | Used for |
|---|---|---|
| dur.instant | 100ms | press feedback, chip toggle |
| dur.fast | 150ms | tab cross-fade, small fades |
| dur.base | 280ms | screen push, sheet snap |
| dur.slow | 420ms | success draw-on, hero settle |
| dur.moment | 900ms | tier-up takeover (one-shot moments only) |
| spring.press | damping 18, stiffness 320 | button/card compress-release |
| spring.pop | damping 14, stiffness 220, slight overshoot | badges, avatars, counters, dots, segment pill |
| spring.sheet | damping 22, stiffness 260 | bottom sheets, drag-release |
| spring.layout | damping 20, stiffness 200 | list reflow, filter changes |
| ease.exit | Easing.out(cubic) | anything leaving/settling |

Rule: no duration or spring config anywhere except these tokens.

## 2. Transition catalog

| Journey | Spec |
|---|---|
| Card → detail | SHARED ELEMENT: card image expands into the detail hero (`sharedTransitionTag`); title cross-fades; dur.base. The app's signature move — Games, Coaches, and all Discover segments. |
| Detail hero on scroll | Collapsing header: hero parallaxes at ~0.32x scroll, gradient deepens, transparent HeroNav morphs to solid blurred bar + title at the collapse point. Interpolated, never stepped. Detail entry: hero settles scale 1.14→1 over dur.slow. |
| Parent view during push | Recedes: translateX −22%, scale .97, dim to ~45% opacity (reference build behavior). |
| Tab switch | Content cross-fade dur.fast + icon spring.pop 1→1.15 + indicator-bar width spring + halo scale-in. No horizontal slide. |
| Modal (create-game, search) | Search MORPHS from the header icon: blur overlay fades in, input scales .92→1 with spring.pop. Create-game slides up full-sheet dur.base. |
| Discover segments | Animated pill slides under the active segment (spring.pop); content fade-swaps (dur.base, translateY 10→0). |
| Bottom sheets | Physics: drag-follows-finger, rubber-band above rest (×0.18), velocity-aware dismiss (dy>120px or v>0.55px/ms), backdrop fade tied to position. NEVER dismissible while payment verification is in flight — blocked drag answers with a warning haptic. |
| List entrance | First page only: 30ms stagger, translateY 12–14 → 0 + fade. Never on pagination or back-nav restore. |
| Filter/leaderboard change | Layout animation + keep-previous-data. No spinner, no blank flash. |
| Scroll reveals | Detail-page sections reveal on intersection (translateY 18→0 + fade, .55s), once per mount. |

## 3. Touch feedback (universal)

- Every Pressable: 3D compress — perspective tilt (~2.4° rotateX) + scale .965 via spring.press; release springs back. Cards add border-brighten (border → 12% white). Icon buttons scale .90.
- Primary CTAs additionally emit a touch-point ripple (white 35%, 500ms expand-fade).
- Destructive actions: confirm sheets. Swipe: back-swipe iOS-native, sheet drag everywhere; no hidden swipe actions in v1.

## 4. Haptics map (`src/lib/haptics.ts` — the only expo-haptics import site)

| Event | Haptic |
|---|---|
| selection (chips, tabs, toggles, segments, stepper) | selectionAsync |
| button primary press | impactAsync(Light) |
| join / booking success | notificationAsync(Success) |
| payment success | notificationAsync(Success) + impactAsync(Medium) 120ms later (double-beat) |
| tier-up | impactAsync(Heavy) at badge landing |
| warning / cutoff rejection / blocked sheet-dismiss mid-verify | notificationAsync(Warning) |
| delete confirm | notificationAsync(Error) |
| pull-to-refresh trigger | impactAsync(Light) |

Nothing else vibrates. Haptics on scroll or per-cell = review-blocker.

## 5. Celebration moments (one-shots, skippable on tap, reduced-motion safe)

| Moment | Spec |
|---|---|
| Extended payment success | Sequence: check-circle spring-in + SVG path draw-on (dur.slow) → 26-piece confetti burst (gold/success/red-light/white/violet; randomized trajectory + rotation, 0.7–1.2s) → reputation-gain card fades up (+N pts, animated progress bar toward next tier from real `me` data) → user avatar pops into the entity's AvatarStack → Done. Never begins before `/payments/verify` (or 409/reconciled) confirms. |
| Checkout verification | Vertical timeline: Creating order → Payment received → Verifying with server; steps flip pending→active(pulsing dot)→done(✓) as real states complete. |
| Tier-up | Full-screen scrim + blur → TierBadge spring.pop with shine sweep + confetti double-burst → serif "You just hit {Tier}" → stat line → tap-to-dismiss hint; staged fade-ups; dur.moment; haptic Heavy. Once per tier (stored last-seen). |
| Join success (free/instant) | Check pop + micro particle burst on CTA + Success haptic; ≤600ms, non-blocking; avatar pops into stack. |
| First booking ever | Payment-success variant + "Your first booking 🎉" line (client-detected). |

## 6. Empty-state catalog (kit iconography enlarged + tinted, floating idle animation, icon reacts to tap)

| Screen | Copy | CTA |
|---|---|---|
| Games (none) | "No games tonight — yet." | "Create one" |
| Games (filtered) | "No games for {sport} — yet." / "Someone has to go first. Why not you?" | "Create one" / clear filters |
| Coaches (filtered) | "No {sport} coaches here yet." | "Try another sport" |
| Discover segments | "Nothing scheduled — check back soon." | "Notify me" (→ push prefs) |
| Search (no results) | "No matches for '{q}'." / "Try a sport, a venue, or a coach's name." | trending chips below |
| Profile games (new) | "Your games will live here." | "Find a game" |
| Home rails | Empty rail = rail hidden entirely. Never an empty rail. |
| Offline | Banner + cached content; full-screen only at zero cache: "You're offline — reconnect to play." |

## 7. Loading rules

Skeletons (shimmer, 1.3–1.4s cycle) shaped like the real components, first paint <100ms. Images: blurhash/placeholder-color → fade dur.fast. Spinners allowed in exactly two places: inside a pressed Button and nowhere else (checkout uses the timeline, not a spinner). Anything else = review-blocker.

## 8. Live-data animation

| Element | Spec |
|---|---|
| Count-ups | Stats, leaderboard scores, slot numbers, reputation pts: cubic-out count-up 700–900ms on first visibility, tabular-nums to prevent layout shift. |
| Countdown (Home hero) | HH/MM/SS cells ticking 1s, Asia/Kolkata, tabular-nums. |
| Slot-fill ring | SVG circle, stroke-dashoffset animates to fill over 1s ease on mount. |
| Activity ticker | One-line pill, live dot pulse, message fade-swap every ~3.4s from real platform events. |
| Slot bars | Width animates .8s ease on mount; >75% switches to gold gradient; subtle highlight sweep. |
| Avatar stacks | Staggered pop-in (spring.pop, ~120–140ms apart) on first mount only. |
| Rank movement | ▲/▼ delta markers (success/red-light); own-rank pin slides in from below (spring, once). Podium: staggered rise, gold shine sweep, crown bob. |
| Hero parallax | Home hero image translateY ×0.18 of scroll; detail hero ×0.32. |
| Ambient shine | Hero card light-sweep every ~5.5s; slot-bar sweep; badge shines. Ambient loops are subtle (≤10% white) and never on more than 2 elements per screen. |

## 9. Accessibility gates (every screen, every PR)

Dynamic type to 120% without breakage · reduced-motion: transitions→fades, celebrations→static, loops/staggers/parallax disabled · VoiceOver/TalkBack labels on all interactive elements · targets ≥44pt · body text ≥ token `text` on `bg`; nothing below `textDim` on cards.

## 10. Effects budget (restraint is the aesthetic)

Allowed: hero gradient overlays (black 0→60%), card elevation via border-brighten + subtle shadow, blur behind sheets/search/tier-up overlays only, edge-light/shine on tier elements, live-status chips with pulse dots. Banned: glassmorphism on cards/lists, glow spam, animated background gradients, parallax outside heroes, more than 2 ambient loops per screen. When in doubt: the kit's flat #0a0a0a card is right.

## 11. Performance floor

Worklets only (zero JS-thread animation). ≥60fps measured on the reference Android for every row above; ambient loops must not wake the JS thread. Any row that can't hold 60fps ships simplified, logged in DECISIONS.md.
