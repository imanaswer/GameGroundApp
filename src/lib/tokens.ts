/**
 * Design tokens — the ONLY place colors, radii, and type sizes live.
 * Sources: Developer PRD §8.1 + DESIGN_SYSTEM.md §1–3 (binding).
 * Lint forbids color literals anywhere in `app/`.
 */

export const color = {
  // core (DS §1.1)
  bg: "#050505",
  card: "#0a0a0a",
  elev: "#0d0d0d",
  border: "rgba(255,255,255,0.06)",
  border2: "rgba(255,255,255,0.12)",
  text: "#e7e9ee",
  dim: "rgba(231,233,238,0.62)",
  dim2: "rgba(231,233,238,0.40)",

  // brand & semantic (DS §1.2)
  red: "#e63946",
  redLight: "#ff6b74",
  redDeep: "#b91c2d",
  /** DS §4 Input — focus ring: red at 40% alpha. */
  redFocus: "rgba(230,57,70,0.4)",
  gold: "#eab308",
  goldLight: "#fbbf24",
  goldDeep: "#a16207",
  success: "#4ade80",
  infoSurface: "#1a2230",

  // semantic surfaces (DS §1.2/§4 — tinted chip/wash backgrounds)
  successSurface: "rgba(74,222,128,0.16)",
  redSurface: "rgba(230,57,70,0.16)",
  redWash: "rgba(230,57,70,0.06)",
  liveRed: "rgba(230,57,70,0.92)",
  /** DS §5 — TabBar/nav chrome translucent fill over blur (rgba(5,5,5,.86–.88)). */
  tabBarBg: "rgba(5,5,5,0.88)",
  navBlurBg: "rgba(5,5,5,0.94)",
  // SlotBar/Skeleton tracks (DS §4)
  track: "rgba(255,255,255,0.08)",
  overflowChip: "rgba(255,255,255,0.16)",
  countdownTile: "rgba(255,255,255,0.09)",
  imagePlaceholder: "#141414",
  /** Modal/sheet backdrop scrim (DS §10 permitted overlay). */
  scrim: "rgba(0,0,0,0.6)",
} as const;

/** Avatar identity ring + own-avatar gradient stops (DS §1.3). */
export const avatarIdentity = {
  blue: "#6c8cff",
  violet: "#a78bfa",
  pink: "#f472b6",
  sky: "#38bdf8",
  orange: "#fb923c",
} as const;

/** DS §1.3 — tier accent + chip background. */
export const tier = {
  bronze: { fg: "#d99a5b", bg: "rgba(205,127,50,0.15)" },
  silver: { fg: "#c8cdd7", bg: "rgba(200,205,215,0.14)" },
  gold: { fg: color.gold, bg: "rgba(234,179,8,0.16)" },
  elite: { fg: color.redLight, bg: "rgba(230,57,70,0.16)" },
  pro: { fg: "#ffffff", bg: "rgba(255,255,255,0.14)" },
} as const;

export type Tier = keyof typeof tier;

/** DS §1.3 — initials-fallback rotation. Index by a stable hash of the user id. */
export const avatarColors = [
  "#e63946",
  "#eab308",
  "#4ade80",
  "#6c8cff",
  "#a78bfa",
  "#f472b6",
  "#38bdf8",
  "#fb923c",
] as const;

/** The user's own avatar: 135° gradient. */
export const ownAvatarGradient = ["#6c8cff", "#a78bfa"] as const;

/** MOTION.md §5 — the confetti 5-color set (gold · success · red-light · white · violet). */
export const confetti = ["#eab308", "#4ade80", "#ff6b74", "#ffffff", "#a78bfa"] as const;

/** DS §1.4 — the only permitted gradients/overlays. */
export const gradient = {
  imageScrim: { colors: ["transparent", "rgba(0,0,0,0.55)"], locations: [0.4, 1] },
  heroScrim: {
    colors: ["rgba(0,0,0,0.32)", "transparent", "rgba(5,5,5,0.98)"],
    locations: [0, 0.4, 1],
  },
  heroSide: {
    colors: ["rgba(5,5,5,0.9)", "rgba(5,5,5,0.22)"],
    locations: [0.32, 0.78],
    angle: 100,
  },
  ctaFade: { colors: ["transparent", "rgba(5,5,5,0.95)"], locations: [0, 0.42] },
} as const;

/** DS §3 */
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

/** DS §3 — screen horizontal padding is 18, not on the 4pt scale. */
export const layout = {
  screenX: 18,
  cardPad: 14,
  railGap: 12,
  chipGap: 8,
  metaRowY: 11,
  sectionLabelTop: 18,
  sectionLabelBottom: 10,
} as const;

/** Loaded in app/_layout.tsx via expo-font. `sans` maps to Inter. */
export const font = {
  serif: "InstrumentSerif_400Regular",
  sans: "Inter_400Regular",
  sansMedium: "Inter_500Medium",
  sansSemi: "Inter_600SemiBold",
  sansBold: "Inter_700Bold",
  sansExtra: "Inter_800ExtraBold",
} as const;

/** DS §2 — serif never below 20 and never for UI controls. */
export const type = {
  display: { fontFamily: font.serif, fontSize: 39, lineHeight: 42, letterSpacing: -0.5 },
  title1: { fontFamily: font.serif, fontSize: 27, lineHeight: 29 },
  title2: { fontFamily: font.serif, fontSize: 22, lineHeight: 25 },
  amount: { fontFamily: font.serif, fontSize: 33, lineHeight: 36 },
  heading: { fontFamily: font.sansBold, fontSize: 15, lineHeight: 20 },
  body: { fontFamily: font.sans, fontSize: 13, lineHeight: 18 },
  bodyStrong: { fontFamily: font.sansSemi, fontSize: 13, lineHeight: 18 },
  caption: { fontFamily: font.sans, fontSize: 11, lineHeight: 15 },
  label: {
    fontFamily: font.sansBold,
    fontSize: 10.5,
    lineHeight: 14,
    letterSpacing: 1.47, // .14em
    textTransform: "uppercase",
  },
  micro: { fontFamily: font.sansExtra, fontSize: 9, lineHeight: 12 },
} as const;

/**
 * DS §3 — dark theme elevation is borders + colored glow, never gray shadows.
 * ponytail: RN maps these to iOS shadow props; Android needs `elevation`, added per-component.
 */
export const shadow = {
  ctaRed: { shadowColor: color.red, shadowOpacity: 0.3, shadowRadius: 26, shadowOffset: { width: 0, height: 7 } },
  ctaSuccess: { shadowColor: color.success, shadowOpacity: 0.3, shadowRadius: 26, shadowOffset: { width: 0, height: 7 } },
  sheet: { shadowColor: "#000000", shadowOpacity: 0.55, shadowRadius: 50, shadowOffset: { width: 0, height: 16 } },
} as const;

/** DS §3 — icon sizes (Lucide set, stroke 2, round caps). */
export const icon = { tab: 20, header: 16, meta: 17, empty: 24 } as const;
