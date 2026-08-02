/**
 * Design tokens — the ONLY place colors, radii, and type sizes live.
 * Lint forbids color literals anywhere in `app/`.
 *
 * DECISION 20 — ported to the Nike Figma light system (`docs/NIKE_FIGMA_EXTRACTION.md`).
 * This supersedes the dark palette from DESIGN_SYSTEM §1 and Decisions 7/8.
 *
 * Phase 1 of the port deliberately keeps every token NAME unchanged while replacing its value.
 * 194 call sites across 48 files consume these; renaming them in the same pass as re-valuing them
 * would make every downstream diff unreviewable. Names get rationalised in a later phase, once
 * the light system is actually on screen and correct.
 *
 * Consequence to expect: names now describe a ROLE, not a hue. `color.red` is the primary-action
 * colour and is black, because the source system has no brand accent — Nike's identity comes from
 * the swoosh and photography. Anything still reading as "red" is a Phase 2+ cleanup, not a bug.
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

export const color = {
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
   * Primary action. BLACK, not red — see the file header. Kept under the `red*` names for this
   * phase so ~100 call sites keep compiling; they mean "primary", "primary-hover", "primary-deep".
   */
  red: "#000000",
  redLight: gray[800],
  redDeep: "#000000",
  /** Input focus ring. */
  redFocus: "rgba(0,0,0,0.40)",

  /** Tier/rating accents ride the Warning ramp — the source has no gold. See Decision 20. */
  /** FILL only (chips, pills, gradient stops). ~3.6:1 on white — not legible as text. */
  gold: ramp.warning[500],
  goldLight: ramp.warning[400],
  goldDeep: ramp.warning[700],
  /** Gold as TEXT or an ICON on a light surface. Same fill-vs-text split as `successText`. */
  goldText: ramp.warning[700],

  /** Success as a FILL (dots, bars, chips). Not legible as text — see `successText`. */
  success: ramp.success[400],
  /**
   * Success as TEXT or an ICON on a light surface. `success` (ramp 400, #35C75A) measures 2.2:1
   * on white — fine on the old #050505 ground, and below both the 4.5:1 text bar and the 3:1
   * non-text bar now. Any success glyph or label on `bg`/`card` must use this instead.
   */
  successText: ramp.success[700],
  infoSurface: gray[100],

  // Tinted surfaces. On white these are the ramp's 100 step, not an alpha wash of the accent.
  successSurface: ramp.success[100],
  redSurface: ramp.error[100],
  redWash: "rgba(202,70,42,0.06)",
  /** "Live"/urgent badge — the Error ramp, since primary is now black and cannot signal urgency. */
  liveRed: ramp.error[500],

  /** Nav chrome: translucent WHITE over blur (was translucent black). */
  tabBarBg: "rgba(255,255,255,0.88)",
  navBlurBg: "rgba(255,255,255,0.94)",
  /** Ambient shine sweep. Inverted: a highlight on white must be dark, not white-on-white. */
  shineWhite: "rgba(0,0,0,0.05)",

  // Tracks / placeholders
  track: gray[200],
  overflowChip: gray[200],
  countdownTile: gray[100],
  imagePlaceholder: gray[200],
  /** Modal/sheet backdrop. Still black — a scrim darkens whatever is behind it, light UI or not. */
  scrim: "rgba(0,0,0,0.6)",

  /**
   * Photographic surfaces. UNCHANGED by the light port on purpose: photographs are still dark,
   * so copy over them is still white. These are not page colours and must not be used as such.
   */
  inverse: "#FFFFFF",
  onInverse: "#000000",
  inverseBorder: "rgba(255,255,255,0.55)",
} as const;

/** Avatar identity ring + own-avatar gradient stops. Darkened for legibility on white. */
export const avatarIdentity = {
  blue: "#3d5ce0",
  violet: "#7c4dd8",
  pink: "#d63c86",
  sky: "#0a86c4",
  orange: "#d96a10",
} as const;

/**
 * Tier accent + chip background (Decision 20 follow-up — resolves the gap left by the port).
 *
 * `fg` does three jobs at once, which is what constrains the whole design:
 *   1. text on its own `bg` (TierBadge)      → needs ≥ 4.5:1 against `bg`
 *   2. a ring/accent on the page (Leaderboard, Profile gradient) → needs ≥ 4.5:1 on white
 *   3. a SOLID FILL under a white trophy glyph (TierUp) → needs ≥ 3:1 against white
 * A light "silver" or "bronze" satisfies (1) and fails (2) and (3) outright — which is why the
 * obvious metallic palette cannot work here, not merely why it looks wrong.
 *
 * The encoding: the three metal tiers keep a HUE (brown / grey / amber) so they stay nameable,
 * and the two tiers beyond metal drop to ink — near-black, then black. Rank therefore reads as
 * "coloured, then absolute", which is the only ordinal move available in a system whose whole
 * accent vocabulary is black, white and grey. `bg` is a 10% tint of `fg` in every case.
 *
 * KNOWN WEAKNESS: elite (#101828) and pro (#000000) are nearly indistinguishable side by side.
 * Separating them needs a treatment difference — a filled chip versus an outlined one — which
 * this token shape (fg/bg only) cannot express. Fixing it properly means giving TierBadge a
 * variant, not picking different colours. Left as-is rather than faked with a colour that would
 * misrepresent the hierarchy.
 */
export const tier = {
  bronze: { fg: "#7A4A21", bg: "rgba(122,74,33,0.10)" },
  silver: { fg: gray[700], bg: "rgba(87,89,91,0.10)" },
  gold: { fg: ramp.warning[700], bg: "rgba(163,53,1,0.10)" },
  elite: { fg: gray[900], bg: "rgba(16,24,40,0.08)" },
  pro: { fg: "#000000", bg: "rgba(0,0,0,0.06)" },
} as const;

export type Tier = keyof typeof tier;

/** Initials-fallback rotation. Index by a stable hash of the user id. Tuned for white text on fill. */
export const avatarColors = [
  "#1F1F1F",
  "#57595B",
  "#2AA147",
  "#3d5ce0",
  "#7c4dd8",
  "#d63c86",
  "#0a86c4",
  "#D94601",
] as const;

/** The user's own avatar: 135° gradient. */
export const ownAvatarGradient = ["#3d5ce0", "#7c4dd8"] as const;

/**
 * Google brand palette — Google's own marks, not part of the DS ramp. Unchanged by the port.
 */
export const google = {
  blue: "#4285F4",
  green: "#34A853",
  yellow: "#FBBC05",
  red: "#EA4335",
  surface: "#ffffff",
  onSurface: "#1f1f1f",
} as const;

/** Celebration confetti. Re-picked for visibility against white. */
export const confetti = ["#FC5100", "#2AA147", "#000000", "#3d5ce0", "#d63c86"] as const;

/** The only permitted gradients/overlays. Scrims that meet the PAGE now fade to white. */
export const gradient = {
  /** Over photography — still dark: it exists to carry white copy on an image. */
  imageScrim: { colors: ["transparent", "rgba(0,0,0,0.55)"], locations: [0.4, 1] },
  heroScrim: {
    colors: ["rgba(0,0,0,0.28)", "transparent", "rgba(255,255,255,0.98)"],
    locations: [0, 0.4, 1],
  },
  heroSide: {
    colors: ["rgba(255,255,255,0.92)", "rgba(255,255,255,0.22)"],
    locations: [0.32, 0.78],
    angle: 100,
  },
  ctaFade: { colors: ["transparent", "rgba(255,255,255,0.95)"], locations: [0, 0.42] },
  /**
   * Full-bleed photographic screen (welcome). Still dark — the photo underneath is dark and the
   * copy on it is white. Revisit in Phase 4 if the welcome screen itself goes light.
   */
  welcomeScrim: {
    colors: ["rgba(0,0,0,0.45)", "transparent", "rgba(5,5,5,0.72)", "rgba(5,5,5,0.97)"],
    locations: [0, 0.28, 0.7, 1],
  },
} as const;

export const radius = {
  card: 20,
  hero: 22,
  profileHero: 24,
  sheet: 28,
  input: 14,
  expand: 14,
  toast: 16,
  tile: 12,
  tileSm: 9,
  chip: 999,
} as const;

/** 4pt scale. `space(4)` → 16. */
export const space = (n: number) => n * 4;

export const layout = {
  screenX: 18,
  cardPad: 14,
  railGap: 12,
  chipGap: 8,
  metaRowY: 11,
  sectionLabelTop: 18,
  sectionLabelBottom: 10,
} as const;

/**
 * THE FONT SWAP POINT (Decision 20).
 *
 * The target family is `Helvetica Now Text` — Monotype-licensed, purchase pending. No font file
 * for it may land in this repo before that licence exists.
 *
 * Until then Inter renders the scale. That is a deliberate substitution, not a placeholder to
 * forget: the metrics below (size / leading / tracking) are lifted exactly from the Figma and
 * carry most of the visible character, and metrics are not copyrightable. Inter is the standard
 * Helvetica substitute — it runs slightly wider with more open apertures.
 *
 * To swap: add the licensed .ttf files, change the five values here, and update the `useFonts`
 * map in `app/_layout.tsx`. Nothing downstream names a family directly, so that is the whole job.
 */
const FAMILY = {
  regular: "Inter_400Regular",
  medium: "Inter_500Medium",
  semi: "Inter_600SemiBold",
  bold: "Inter_700Bold",
  extra: "Inter_800ExtraBold",
} as const;

export const font = {
  sans: FAMILY.regular,
  sansMedium: FAMILY.medium,
  sansSemi: FAMILY.semi,
  sansBold: FAMILY.bold,
  sansExtra: FAMILY.extra,
} as const;

/**
 * Type scale — ported from the Figma (see extraction §1).
 *
 * Two deliberate departures from the source, both documented in Decision 20:
 *
 * 1. Line height is lifted on every role that can wrap. The source sets 1.0 on 16/12/10px text,
 *    which is fine in a mockup where nothing wraps and collides on a real device with dynamic
 *    type. Sizes and tracking are exact; leading is not.
 * 2. `label` keeps POSITIVE tracking. The source's −2% is for lowercase; uppercase micro-type
 *    needs letters opened up, not tightened, or it sets as a solid block.
 *
 * Tracking was converted from the source's percentages: px = size × pct / 100.
 */
export const type = {
  /** Figma Display 2xl / Bold — 32, 1.2, −3%. */
  display: { fontFamily: FAMILY.bold, fontSize: 32, lineHeight: 38, letterSpacing: -0.96 },
  /** Figma Display lg / Bold — 28, 1.1, −2.5%. */
  authTitle: { fontFamily: FAMILY.bold, fontSize: 28, lineHeight: 31, letterSpacing: -0.7 },
  /** Figma Display sm / Medium — 20, 1.2, 0%. */
  title1: { fontFamily: FAMILY.medium, fontSize: 20, lineHeight: 24, letterSpacing: 0 },
  /** Figma Text xl / Medium — 16, 1.2, 0%. */
  title2: { fontFamily: FAMILY.medium, fontSize: 16, lineHeight: 20, letterSpacing: 0 },
  /** Figma Display 2xl / Bold — money keeps the largest role now that the serif is gone. */
  amount: { fontFamily: FAMILY.bold, fontSize: 32, lineHeight: 38, letterSpacing: -0.96 },
  /** Figma Text md, forced to 700 — the source's `Text md/Bold` is defined Medium/500 (a bug). */
  heading: { fontFamily: FAMILY.bold, fontSize: 14, lineHeight: 18, letterSpacing: -0.14 },
  /** Figma Text md / Regular — leading lifted 1.2 → 1.43 for wrapping body copy. */
  body: { fontFamily: FAMILY.regular, fontSize: 14, lineHeight: 20, letterSpacing: -0.14 },
  bodyStrong: { fontFamily: FAMILY.medium, fontSize: 14, lineHeight: 20, letterSpacing: -0.14 },
  /** Figma Text sm / Regular — leading lifted 1.0 → 1.33. */
  caption: { fontFamily: FAMILY.regular, fontSize: 12, lineHeight: 16, letterSpacing: -0.3 },
  /** Figma Text xs, uppercased. Tracking inverted to positive — see note 2 above. */
  label: {
    fontFamily: FAMILY.bold,
    fontSize: 10,
    lineHeight: 14,
    letterSpacing: 1.4,
    textTransform: "uppercase",
  },
  /** Figma Text xs / Bold — 10, 1.0, −2%. The one role that genuinely never wraps. */
  micro: { fontFamily: FAMILY.bold, fontSize: 10, lineHeight: 12, letterSpacing: -0.2 },
} as const;

/**
 * Elevation — ported from the Figma `xs`–`3xl` scale (extraction §3).
 *
 * This is the change the light port makes possible: the dark theme could not use drop shadows at
 * all (invisible on `#050505`) and separated surfaces with borders and coloured glow instead. On
 * white, shadow is the primary separator and borders become secondary.
 *
 * Keys keep their old names this phase; `ctaRed` is the primary-button shadow and is no longer red.
 * RN maps these to iOS shadow props — Android needs `elevation`, added per component.
 */
export const shadow = {
  /** Figma `md`. */
  ctaRed: { shadowColor: gray[900], shadowOpacity: 0.16, shadowRadius: 8, shadowOffset: { width: 0, height: 4 } },
  ctaSuccess: { shadowColor: ramp.success[600], shadowOpacity: 0.22, shadowRadius: 10, shadowOffset: { width: 0, height: 4 } },
  /** Figma `2xl`. */
  sheet: { shadowColor: gray[900], shadowOpacity: 0.18, shadowRadius: 48, shadowOffset: { width: 0, height: 24 } },
} as const;

/** The full source elevation scale, for Phase 2 components. */
export const elevation = {
  xs: { shadowColor: gray[900], shadowOpacity: 0.05, shadowRadius: 2, shadowOffset: { width: 0, height: 1 } },
  sm: { shadowColor: gray[900], shadowOpacity: 0.10, shadowRadius: 3, shadowOffset: { width: 0, height: 1 } },
  md: { shadowColor: gray[900], shadowOpacity: 0.10, shadowRadius: 8, shadowOffset: { width: 0, height: 4 } },
  lg: { shadowColor: gray[900], shadowOpacity: 0.08, shadowRadius: 16, shadowOffset: { width: 0, height: 12 } },
  xl: { shadowColor: gray[900], shadowOpacity: 0.08, shadowRadius: 24, shadowOffset: { width: 0, height: 20 } },
  "2xl": { shadowColor: gray[900], shadowOpacity: 0.18, shadowRadius: 48, shadowOffset: { width: 0, height: 24 } },
  "3xl": { shadowColor: gray[900], shadowOpacity: 0.14, shadowRadius: 64, shadowOffset: { width: 0, height: 32 } },
} as const;

/** Icon sizes (Lucide set, stroke 2, round caps). */
export const icon = { tab: 20, header: 16, meta: 17, empty: 24 } as const;
