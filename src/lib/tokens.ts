/**
 * Design tokens — the ONLY place colors, radii, and type sizes live.
 * Lint forbids color literals anywhere in `app/`.
 *
 * DECISION 20 — ported to the reference Figma's light system (`docs/FIGMA_EXTRACTION.md`).
 * DECISION 24 — that palette is now one of TWO. `color`, `tier`, `gradient` and `shadow` are
 * re-exported from the theme runtime, where each resolves against whichever scheme is active at
 * the moment it is read. Nothing about a call site changes: `color.bg` is still `color.bg`.
 *
 * Everything defined below is theme-INVARIANT by definition — radii, spacing, type, icon sizes,
 * and the brand and decorative palettes. A radius has no light and dark value, and Google's blue
 * is Google's blue on any ground.
 *
 * Names describe a ROLE, not a hue. `color.primary` is the primary-action colour: black in light,
 * white in dark, in both cases the maximum-contrast surface against the page.
 */

import { gray } from "@/theme/palette";

export { color, gradient, shadow, tier } from "@/theme/runtime";
export { gray, ramp } from "@/theme/palette";
export type { Gradients, Palette, Scheme, ShadowScale, Theme, TierPalette } from "@/theme/palette";

/** Tier names — the key set every tier map is keyed on. Values live in the palette. */
export type Tier = "bronze" | "silver" | "gold" | "elite" | "pro";

/** Avatar identity ring + own-avatar gradient stops. Darkened for legibility on white. */
export const avatarIdentity = {
  blue: "#3d5ce0",
  violet: "#7c4dd8",
  pink: "#d63c86",
  sky: "#0a86c4",
  orange: "#d96a10",
} as const;

/**
 * Initials-fallback avatar fills. Index by a stable hash of the user id, so a given user always
 * gets the same colour.
 *
 * **Theme-invariant, and that is a result rather than a decision.** These carry white initials, so
 * every fill is held to 4.5:1 against white — and a fill dark enough for that is automatically
 * ~4:1 against the near-black page, so one set clears both grounds. Which is the better outcome
 * anyway: a user's identity colour should not change when the app does.
 *
 * Re-derived once already: the light port turned the initials near-black against fills chosen for
 * white text, and four of the original hues were 3.3–4.4:1 under white. Both floors are asserted
 * per theme in `__tests__/tokens.test.ts`; changing a value here without running that is how the
 * first version shipped invisible.
 */
export const avatarColors = [
  "#333333",
  "#57595B",
  "#23863B",
  "#3D5CE0",
  "#7C4DD8",
  "#CD3A81",
  "#097BB4",
  "#D04301",
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
 * The raw Figma elevation scale. Theme-invariant BY SHAPE — the offsets and radii are the
 * source's — but `shadowColor` is ink in both themes because a shadow is an absence of light, not
 * a colour. On the dark ground these barely render, which is why `elev` and `border` carry
 * separation there; see the palette's `shadow` note.
 */
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
