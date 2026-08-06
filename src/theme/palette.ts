/**
 * The two palettes — light (Decision 20's port of the reference system) and dark (Decision 24).
 *
 * Both expose IDENTICAL key sets. That is the contract the whole theming design rests on: call
 * sites read `color.x` and never learn which palette answered, so a token that exists in one
 * theme and not the other is a crash, not a fallback. The type below enforces it.
 *
 * **Dark is derived from the light system, not restored from the pre-port theme.** The old dark
 * ground (#050505 + brand red) is in git history and is NOT the ancestor of this: Decision 20
 * dropped the red outright, and reviving a palette built around an accent the system no longer
 * has would produce a second design language wearing the same components. Dark here is the same
 * ported system with its greys reversed and its semantics re-derived for a dark ground.
 *
 * Two things do NOT flip, and both are deliberate:
 *   - `inverse` / `onInverse` / `inverseBorder` and the photographic scrims. A photograph is dark
 *     in both themes, so copy over it is white in both. These were never page colours.
 *   - The splash and the brand loader. They are black in both themes (DS §5), which is also why
 *     dark's `bg` is #050505 and not a softer near-black: it has to equal the splash background
 *     or the launch handoff shows a step.
 */

/** Source: Figma `Gray/*`. `Gray/500` had two conflicting values; `#8C8C8C` (Colors frame) wins. */
export const gray = {
  100: "#F6F6F6",
  200: "#E4E4E4",
  300: "#CDCDCD",
  400: "#BABABA",
  500: "#8C8C8C",
  600: "#767676",
  700: "#57595B",
  800: "#1F1F1F",
  900: "#101828",
} as const;

/** Source: Figma `Success|Warning|Error/100–800`. */
export const ramp = {
  success: { 100: "#CFF2D8", 200: "#9DE5B0", 300: "#6ED989", 400: "#35C75A", 500: "#2AA147", 600: "#32862B", 700: "#19612B", 800: "#11401D" },
  warning: { 100: "#FFE1C8", 200: "#FFBF8C", 300: "#FF9E4F", 400: "#FF821D", 500: "#FC5100", 600: "#D94601", 700: "#A33501", 800: "#622001" },
  error: { 100: "#F8E2DD", 200: "#EDB7AA", 300: "#E79A88", 400: "#DC6E57", 500: "#CA462A", 600: "#99351F", 700: "#662415", 800: "#44180E" },
} as const;

const lightColor = {
  // Core surfaces. Page is white; `card` is the grey wash used to separate sections; `elev` is a
  // raised white surface that earns its separation from `shadow`, not from being lighter.
  bg: "#FFFFFF",
  card: gray[100],
  elev: "#FFFFFF",
  border: gray[200],
  border2: gray[300],
  text: gray[900],
  /**
   * Secondary text is Gray/700, NOT the source's Gray/600. Gray/600 (#767676) measures 4.20:1 on
   * the `card` surface (#F6F6F6) — under WCAG AA. The source uses it for secondary copy anyway;
   * that pairing is a defect we are not inheriting. Guarded by a contrast test.
   */
  dim: gray[700],
  /** Tertiary. Held to the AA-large bar (3:1) and must never carry body copy. */
  dim2: gray[600],

  /**
   * Primary action — black. The source system has no brand accent; identity comes from the mark
   * and photography. In dark this becomes white, which is the same decision, not its opposite:
   * the primary action is the maximum-contrast surface against the page.
   */
  primary: "#000000",
  primarySoft: gray[800],
  primaryDeep: "#000000",
  /** Copy and glyphs ON a `primary` fill. Follows it: white here, black in dark. */
  onPrimary: "#FFFFFF",
  /** Input focus ring. */
  focusRing: "rgba(0,0,0,0.40)",

  /** Tier/rating accents ride the Warning ramp — the source has no gold. See Decision 20. */
  /** FILL only (chips, pills, gradient stops). ~3.6:1 on white — not legible as text. */
  gold: ramp.warning[500],
  goldLight: ramp.warning[400],
  goldDeep: ramp.warning[700],
  /** Gold as TEXT or an ICON on the page. Same fill-vs-text split as `successText`. */
  goldText: ramp.warning[700],

  /** Success as a FILL (dots, bars, chips). Not legible as text — see `successText`. */
  success: ramp.success[400],
  /**
   * Success as TEXT or an ICON on the page. `success` (ramp 400, #35C75A) measures 2.2:1 on
   * white — below both the 4.5:1 text bar and the 3:1 non-text bar. Any success glyph or label
   * on `bg`/`card` must use this instead.
   */
  successText: ramp.success[700],
  infoSurface: gray[100],

  // Tinted surfaces. On white these are the ramp's 100 step, not an alpha wash of the accent.
  successSurface: ramp.success[100],
  errorSurface: ramp.error[100],
  errorWash: "rgba(202,70,42,0.06)",
  /** Error as TEXT on the page — the ramp's 500 is a fill. */
  errorText: ramp.error[600],
  /** "Live"/urgent badge — the Error ramp, since primary is black and cannot signal urgency. */
  live: ramp.error[500],

  /**
   * Nav chrome. **`tabBarBg` is OPAQUE**, and that is a correction, not a preference: it was
   * `rgba(255,255,255,0.88)`, which only ever made sense as the tint on top of a BlurView. Decision
   * 11 removed the BlurView (expo-blur is native and crashed launch as the initial route) and left
   * the transparency behind, so the bar was 12% see-through with nothing diffusing what showed
   * through — card titles and prices legibly crossing the tab labels. Reported on device by Anaswer.
   * Opaque is also what a Material 3 bottom bar is; translucency is an iOS-with-blur idiom, and the
   * blur is exactly the part this app cannot have. If expo-blur ever returns, this goes back to a
   * tint and the BlurView goes under it.
   *
   * `navBlurBg` is 0.94 and stays translucent for now — same class of thing, but it fades in over a
   * hero image where 6% show-through reads as intended depth rather than as a bug.
   */
  tabBarBg: "#FFFFFF",
  navBlurBg: "rgba(255,255,255,0.94)",
  /**
   * Ambient shine sweep. White in both themes, because its only consumer is the hero card, and the
   * hero is a photograph under a dark scrim in both. It was a 5% BLACK smudge here on the theory
   * that a highlight on a white page must be dark — true of a page, but the hero was never one.
   */
  shineWhite: "rgba(255,255,255,0.06)",

  // Tracks / placeholders
  track: gray[200],
  overflowChip: gray[200],
  countdownTile: gray[100],
  imagePlaceholder: gray[200],
  /** Modal/sheet backdrop. Black in both themes — a scrim darkens what is behind it. */
  scrim: "rgba(0,0,0,0.6)",

  /**
   * Photographic surfaces. Identical in BOTH themes on purpose: photographs are dark whatever the
   * app ground is, so copy over them is white. These are not page colours and must not be used
   * as such — that is exactly the misuse that would make dark mode look "already done".
   */
  inverse: "#FFFFFF",
  onInverse: "#000000",
  inverseBorder: "rgba(255,255,255,0.55)",
  /**
   * Unfilled track of a progress indicator drawn ON a photograph (SlotRing's ring). Dim enough that
   * a solid-white arc reads as progress against it, bright enough that the remainder still shows.
   * `inverseBorder` at 0.55 is too near white to be the thing white gets measured against.
   */
  inverseTrack: "rgba(255,255,255,0.22)",

  /**
   * The launch splash field. Identical in both themes and NOT `bg`: the native splash colour is
   * compiled into the binary by a config plugin, so it cannot follow a runtime theme — it is
   * `#050505` whatever the app is set to. `SplashGate` has to match THAT, not the page, or the
   * white mark it draws is invisible on a white overlay. Pinned to `app.config.js`; the two move
   * together or the launch shows a step.
   */
  splash: "#050505",
} as const;

/** Every palette must answer every key. */
export type Palette = { readonly [K in keyof typeof lightColor]: string };

const darkColor: Palette = {
  /**
   * #050505, not a softer near-black: `bg` must equal the splash background or the launch
   * handoff shows a visible step at the moment the splash fades (Decision 18). Dark mode is the
   * one theme where the app ground and the splash finally agree.
   */
  bg: "#050505",
  /** The wash that separates sections. On dark it is LIGHTER than the page, mirroring `card`. */
  card: "#121214",
  /** Raised surfaces. On white they separate by shadow; on black a shadow is invisible, so this
   *  carries a real lift of its own and `border` does the rest. */
  elev: "#17181B",
  border: "#2A2C30",
  border2: "#3C3F44",
  text: "#F4F5F6",
  /** Secondary — 8.9:1 on `bg` and 8.0:1 on `card`, so it clears AA on both, as `dim` does light. */
  dim: "#B5B9BF",
  /** Tertiary. AA-large only, same contract as light. */
  dim2: "#8A8F96",

  primary: "#FFFFFF",
  primarySoft: gray[200],
  primaryDeep: "#E6E6E6",
  onPrimary: "#000000",
  focusRing: "rgba(255,255,255,0.45)",

  /** Fills keep the ramp's mid steps — they read as colour on black without going neon. */
  gold: ramp.warning[400],
  goldLight: ramp.warning[300],
  goldDeep: ramp.warning[500],
  /** Text/icons move UP the ramp on dark, where light moves down. */
  goldText: ramp.warning[300],

  success: ramp.success[400],
  successText: ramp.success[300],
  infoSurface: "#131417",

  /** Tinted surfaces are alpha washes here, not the ramp's 100 step — a `#CFF2D8` panel on a
   *  black page is a lamp, not a tint. */
  successSurface: "rgba(53,199,90,0.14)",
  errorSurface: "rgba(202,70,42,0.18)",
  errorWash: "rgba(202,70,42,0.10)",
  errorText: ramp.error[300],
  live: ramp.error[500],

  /**
   * Opaque, per the note in light. Lifted OFF the page rather than equal to it (#050505): a bottom
   * bar that is exactly the page colour has no surface of its own, and on dark the hairline alone is
   * too little to say "this is chrome, the content ends here". Sits below `card` (#121214) so the bar
   * never competes with the cards scrolling behind it.
   */
  tabBarBg: "#0E0F11",
  navBlurBg: "rgba(9,9,10,0.94)",
  shineWhite: "rgba(255,255,255,0.06)",

  track: "#26282C",
  overflowChip: "#26282C",
  countdownTile: "#17181B",
  imagePlaceholder: "#1C1E21",
  scrim: "rgba(0,0,0,0.72)",

  inverse: "#FFFFFF",
  onInverse: "#000000",
  inverseBorder: "rgba(255,255,255,0.55)",
  inverseTrack: "rgba(255,255,255,0.22)",

  /**
   * The launch splash field. Identical in both themes and NOT `bg`: the native splash colour is
   * compiled into the binary by a config plugin, so it cannot follow a runtime theme — it is
   * `#050505` whatever the app is set to. `SplashGate` has to match THAT, not the page, or the
   * white mark it draws is invisible on a white overlay. Pinned to `app.config.js`; the two move
   * together or the launch shows a step.
   */
  splash: "#050505",
} as const;

/**
 * Tier accent + chip background.
 *
 * `fg` does three jobs and each sets a floor: text on its own `bg`, a ring/accent on the page
 * (≥4.5:1), and a solid fill under the TierUp trophy (≥3:1 against `onTierFill`). All three are
 * asserted per theme in `__tests__/tokens.test.ts`.
 *
 * The encoding is the same in both: the three metal tiers keep a HUE so they stay nameable, and
 * the two beyond metal drop to the extreme — ink on light, paper on dark. Rank reads as
 * "coloured, then absolute".
 *
 * KNOWN WEAKNESS, mirrored in dark: elite and pro are near-indistinguishable side by side.
 * Separating them needs a filled-vs-outlined TierBadge variant, which the fg/bg token shape
 * cannot express. Not faked with a colour that would misrepresent the hierarchy.
 */
export type TierPalette = Record<"bronze" | "silver" | "gold" | "elite" | "pro", { fg: string; bg: string }>;

const lightTier: TierPalette = {
  bronze: { fg: "#7A4A21", bg: "rgba(122,74,33,0.10)" },
  silver: { fg: gray[700], bg: "rgba(87,89,91,0.10)" },
  gold: { fg: ramp.warning[700], bg: "rgba(163,53,1,0.10)" },
  elite: { fg: gray[900], bg: "rgba(16,24,40,0.08)" },
  pro: { fg: "#000000", bg: "rgba(0,0,0,0.06)" },
};

const darkTier: TierPalette = {
  // Bronze has to be invented rather than inverted: the light #7A4A21 is 2.1:1 on #050505, and
  // every ramp we own is orange, not brown. This is that brown lifted to a legible value.
  bronze: { fg: "#C98A4B", bg: "rgba(201,138,75,0.16)" },
  silver: { fg: gray[300], bg: "rgba(205,205,205,0.14)" },
  gold: { fg: ramp.warning[300], bg: "rgba(255,158,79,0.16)" },
  elite: { fg: gray[100], bg: "rgba(246,246,246,0.12)" },
  pro: { fg: "#FFFFFF", bg: "rgba(255,255,255,0.10)" },
};

/** Tuples, not arrays — expo-linear-gradient's props require at least two stops, and losing that
 *  at the token boundary would move a compile error to a runtime one. */
type Stops = readonly [string, string, ...string[]];
type Locations = readonly [number, number, ...number[]];

export type Gradients = {
  imageScrim: { colors: Stops; locations: Locations };
  heroScrim: { colors: Stops; locations: Locations };
  heroSide: { colors: Stops; locations: Locations; angle: number };
  ctaFade: { colors: Stops; locations: Locations };
  welcomeScrim: { colors: Stops; locations: Locations };
};

/**
 * The only permitted gradients. A scrim that meets the PAGE fades to the page colour and so has a
 * per-theme value; a scrim that sits on a PHOTOGRAPH stays dark in both, because the copy over a
 * photograph is white in both.
 */
const lightGradient: Gradients = {
  imageScrim: { colors: ["transparent", "rgba(0,0,0,0.55)"], locations: [0.4, 1] },
  heroScrim: {
    colors: ["rgba(0,0,0,0.28)", "transparent", "rgba(255,255,255,0.98)"],
    locations: [0, 0.4, 1],
  },
  /**
   * The hero card's side scrim. PHOTOGRAPHIC — dark in both themes, per the rule above, which this
   * one token was breaking: light held a **0.92 white** wash, because the copy over it had been left
   * as page ink. Two things went wrong at once. The wash bleached the photograph to near-white — the
   * player in it barely readable — and the elements that were already correctly `inverse` (the UP
   * NEXT eyebrow, its pulse dot) turned white-on-white. Dark had the mirror problem at **0.94
   * black**: legible, but the picture was gone. Both reported on device by Anaswer.
   *
   * **0.70 → 0.06.** 0.70 is not a taste value: it is the floor that holds white copy at AA over the
   * worst case a photograph can present, a pure-white pixel. Composited, 0.70 of #050505 over #FFF
   * is ≈#4E4E4E, which carries `inverse` at 8.5:1 and `inverse` at 86% opacity at 6.8:1. Everything
   * between 0.70 and 0.94 bought no legibility and cost the image. Asserted per theme in
   * surface-contrast.test.ts so the next person to reach for "a bit more scrim" has to argue with a
   * number.
   *
   * The tail is 0.06 rather than 0.22 for the same reason: nothing on the right side depends on the
   * scrim any more. The countdown tiles carry their own opaque `countdownTile` fill and border, and
   * SlotRing now draws in `inverse` / `inverseTrack` instead of page ink.
   */
  heroSide: {
    colors: ["rgba(5,5,5,0.70)", "rgba(5,5,5,0.06)"],
    locations: [0.34, 0.82],
    angle: 100,
  },
  /**
   * NO CURRENT CONSUMER. StickyCTA drew this and now paints a solid `bg` bar with a hairline instead:
   * a transparent-to-95% ramp over scrolling content showed the content through it half-dissolved,
   * which reads as a smear rather than as depth (the same reason `tabBarBg` went opaque — the blur
   * these tints were designed against was removed in Decision 11). Kept, not deleted, on the same
   * grounds as `spring.sheet` in Decision 14: it is a coherent token and the fade becomes correct
   * again the day there is something real behind it. Do not reintroduce it as chrome-over-content.
   */
  ctaFade: { colors: ["transparent", "rgba(255,255,255,0.95)"], locations: [0, 0.42] },
  welcomeScrim: {
    colors: ["rgba(0,0,0,0.45)", "transparent", "rgba(5,5,5,0.72)", "rgba(5,5,5,0.97)"],
    locations: [0, 0.28, 0.7, 1],
  },
};

const darkGradient: Gradients = {
  imageScrim: lightGradient.imageScrim,
  heroScrim: {
    colors: ["rgba(0,0,0,0.28)", "transparent", "rgba(5,5,5,0.98)"],
    locations: [0, 0.4, 1],
  },
  // Same scrim as light, and that is the point: the hero is a photograph in both themes.
  heroSide: lightGradient.heroSide,
  ctaFade: { colors: ["transparent", "rgba(5,5,5,0.95)"], locations: [0, 0.42] },
  welcomeScrim: lightGradient.welcomeScrim,
};

export type ShadowScale = {
  ctaRed: object;
  ctaSuccess: object;
  sheet: object;
  card: object;
  nav: object;
};

/**
 * Elevation. On white, shadow is the primary separator. **On black it barely renders at all** —
 * a black shadow on a black page is nothing — so dark leans on `elev` and `border` for
 * separation and keeps only a soft, wider shadow for the surfaces that genuinely float. The
 * shapes are kept rather than zeroed so a component's elevation intent survives the theme.
 */
const lightShadow: ShadowScale = {
  ctaRed: { shadowColor: gray[900], shadowOpacity: 0.16, shadowRadius: 8, shadowOffset: { width: 0, height: 4 } },
  ctaSuccess: { shadowColor: ramp.success[600], shadowOpacity: 0.22, shadowRadius: 10, shadowOffset: { width: 0, height: 4 } },
  sheet: { shadowColor: gray[900], shadowOpacity: 0.18, shadowRadius: 48, shadowOffset: { width: 0, height: 24 } },
  card: { shadowColor: gray[900], shadowOpacity: 0.08, shadowRadius: 12, shadowOffset: { width: 0, height: 4 } },
  nav: { shadowColor: gray[900], shadowOpacity: 0.06, shadowRadius: 10, shadowOffset: { width: 0, height: 2 } },
};

const darkShadow: ShadowScale = {
  ctaRed: { shadowColor: "#000000", shadowOpacity: 0.6, shadowRadius: 12, shadowOffset: { width: 0, height: 6 } },
  ctaSuccess: { shadowColor: "#000000", shadowOpacity: 0.6, shadowRadius: 12, shadowOffset: { width: 0, height: 6 } },
  sheet: { shadowColor: "#000000", shadowOpacity: 0.7, shadowRadius: 48, shadowOffset: { width: 0, height: 24 } },
  card: { shadowColor: "#000000", shadowOpacity: 0.5, shadowRadius: 16, shadowOffset: { width: 0, height: 6 } },
  nav: { shadowColor: "#000000", shadowOpacity: 0.5, shadowRadius: 12, shadowOffset: { width: 0, height: 2 } },
};

/**
 * Celebration confetti. Per theme because the light set contains black — invisible against the
 * dark scrim it would fall on. Five pieces either way; the dark set swaps ink for paper and lifts
 * the two darkest hues a step up their ramp.
 */
const lightConfetti = ["#FC5100", "#2AA147", "#000000", "#3d5ce0", "#d63c86"] as const;
const darkConfetti = ["#FF821D", "#35C75A", "#FFFFFF", "#6D8BFF", "#F368A6"] as const;

export type Scheme = "light" | "dark";

export type Theme = {
  scheme: Scheme;
  color: Palette;
  tier: TierPalette;
  gradient: Gradients;
  shadow: ShadowScale;
  confetti: readonly string[];
};

export const THEMES: Record<Scheme, Theme> = {
  light: { scheme: "light", color: lightColor, tier: lightTier, gradient: lightGradient, shadow: lightShadow, confetti: lightConfetti },
  dark: { scheme: "dark", color: darkColor, tier: darkTier, gradient: darkGradient, shadow: darkShadow, confetti: darkConfetti },
};
