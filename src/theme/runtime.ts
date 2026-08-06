/**
 * Theme runtime — how a token knows which palette answers it, and how a component learns that the
 * answer changed.
 *
 * **Why this is a proxy and not 599 edits.** Screens build their styles once at module load
 * (`const styles = StyleSheet.create({...})`), so a palette read at that moment is frozen for the
 * life of the process — which is exactly why a theme switch cannot work by swapping an object.
 * The two mechanisms here fix that without touching a single call site:
 *
 *   - `color` / `tier` / `gradient` / `shadow` are PROXIES. `color.bg` resolves against the
 *     active scheme at the moment it is read, so every existing `color.x` — in a style, in a
 *     prop, in a default parameter — follows the theme with no edit at all.
 *   - `themed(() => ({...}))` replaces `StyleSheet.create({...})` at module scope. It builds one
 *     real StyleSheet per scheme, lazily, and hands back a proxy that picks the active one. The
 *     factory is what makes it work: the object literal is evaluated per scheme instead of once.
 *
 * What is left for the call site is the one thing a proxy cannot do: make React re-render. A
 * component that doesn't re-render keeps the styles it already rendered, whatever the proxy would
 * now say. So every COMPONENT that reads a themed token calls `useThemeTick()`. Helpers don't
 * need it — they are called during a render that already happened, and read through the same
 * proxy — which is why the rule is "components subscribe", not "files subscribe".
 */
import { useSyncExternalStore } from "react";
import { Appearance, StyleSheet, type ImageStyle, type TextStyle, type ViewStyle } from "react-native";

import { THEMES, type Gradients, type Palette, type Scheme, type ShadowScale, type Theme, type TierPalette } from "./palette";

/**
 * The active scheme, held in a module rather than in React state. It has to be readable from
 * outside a component — a style factory is not in a render — and it is the single source both the
 * proxies and the subscription read.
 *
 * **Seeded from the OS at import**, not hardcoded, and that is what keeps `setActiveScheme` out of
 * the render phase entirely. "System" is the default mode, so for most launches the module is
 * already right before React starts and the provider has nothing to correct. Seeding it from
 * `ThemeProvider`'s render instead notified subscribers mid-render — `RootLayout` subscribes
 * before it ever renders the provider (it returns null while fonts load, but its hook has already
 * run), so React saw a setState on one component while rendering another. Reported on device.
 */
let scheme: Scheme = Appearance.getColorScheme() === "dark" ? "dark" : "light";
const listeners = new Set<() => void>();

export const activeScheme = (): Scheme => scheme;
export const activeTheme = (): Theme => THEMES[scheme];

export function setActiveScheme(next: Scheme): void {
  if (next === scheme) return;
  scheme = next;
  for (const l of listeners) l();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Per-scheme sheet accessor, hidden behind a symbol so it cannot collide with a style name.
 */
const SHEET_FOR = Symbol("themed.for");

/**
 * Subscribe this component to the theme. Call it in any component that reads a themed token; it
 * returns the scheme for the rare caller that wants to branch on it.
 *
 * `useSyncExternalStore` rather than a context so it works in any component without a provider in
 * the way, and so a theme change is a single synchronous, tearing-free update rather than a
 * cascade of context re-renders.
 */
export function useThemeTick(): Scheme {
  return useSyncExternalStore(subscribe, activeScheme, activeScheme);
}

function dynamic<T extends object>(pick: (t: Theme) => T): T {
  const target = {} as T;
  return new Proxy(target, {
    get: (_t, key) => Reflect.get(pick(activeTheme()) as object, key),
    has: (_t, key) => Reflect.has(pick(activeTheme()) as object, key),
    // Object.entries(color) is how the contrast tests enumerate the palette, so the proxy has to
    // answer key queries too — a `get` trap alone leaves it looking empty.
    ownKeys: () => Reflect.ownKeys(pick(activeTheme()) as object),
    getOwnPropertyDescriptor: (_t, key) => {
      const d = Reflect.getOwnPropertyDescriptor(pick(activeTheme()) as object, key);
      return d && { ...d, configurable: true };
    },
  });
}

/** The themed token surfaces. Re-exported by `@/lib/tokens`, which is what screens import. */
export const color = dynamic<Palette>((t) => t.color);
export const tier = dynamic<TierPalette>((t) => t.tier);
export const gradient = dynamic<Gradients>((t) => t.gradient);
export const shadow = dynamic<ShadowScale>((t) => t.shadow);

/**
 * A function, not a proxy: an array proxy is a trap-heavy way to say "read this at render".
 *
 * Takes the scheme explicitly so a memoised caller can DECLARE it as a dependency — the hooks lint
 * cannot see through a zero-argument call, and a dependency it can't see is one it will tell you
 * to delete.
 */
export const confettiColors = (s: Scheme = activeScheme()): readonly string[] => THEMES[s].confetti;

/**
 * React Native's own `StyleSheet.create` signature, verbatim. It is what gives a style literal its
 * contextual type — without it `alignItems: "center"` widens to `string` and every View in the app
 * stops type-checking, which is exactly what happened the first time this was typed loosely.
 */
type NamedStyles<T> = { [P in keyof T]: ViewStyle | TextStyle | ImageStyle };

/**
 * Module-scope stylesheet that follows the theme. Drop-in for `StyleSheet.create`, except it takes
 * a FACTORY — that is the whole difference, and the reason it can be re-evaluated per scheme.
 *
 * Each scheme's sheet is built once, on first use, with that scheme temporarily active so the
 * `color` proxy inside the factory resolves to the right palette. `StyleSheet.create` still runs,
 * so dev-time style validation is not lost.
 */
// `any` here is load-bearing and is RN's own choice in this exact position: it is what makes a
// style literal narrow instead of widen.
export function themed<T extends NamedStyles<T> | NamedStyles<any>>(factory: () => T & NamedStyles<any>): T {
  const sheets: Partial<Record<Scheme, T>> = {};
  const sheetFor = (s: Scheme): T => {
    let built = sheets[s];
    if (!built) {
      const previous = scheme;
      scheme = s;
      try {
        built = StyleSheet.create(factory());
      } finally {
        scheme = previous;
      }
      sheets[s] = built;
    }
    return built;
  };
  return new Proxy({} as T, {
    get: (_t, key) => (key === SHEET_FOR ? sheetFor : Reflect.get(sheetFor(scheme) as object, key)),
    has: (_t, key) => Reflect.has(sheetFor(scheme) as object, key),
    ownKeys: () => Reflect.ownKeys(sheetFor(scheme) as object),
    getOwnPropertyDescriptor: (_t, key) => {
      const d = Reflect.getOwnPropertyDescriptor(sheetFor(scheme) as object, key);
      return d && { ...d, configurable: true };
    },
  });
}

/* ── Reactive reads ───────────────────────────────────────────────────────────
 *
 * The proxies above are always CURRENT, which is not the same as being reactive, and under the
 * React Compiler (`experiments.reactCompiler`) the difference is the whole ballgame. The compiler
 * treats a module-scope binding — `styles`, `color` — as non-reactive, so it is free to compute
 * `[styles.row, styles.on]`, or the JSX element holding it, once per component instance and reuse
 * that forever. The component then re-renders on a theme change and hands React back its cached,
 * previous-palette output. That is why a switch applied to some screens and not others: compiled
 * components froze, ones the compiler bailed out of updated.
 *
 * These hooks close it. Each derives its value directly from `useThemeTick()`'s return, so the
 * compiler sees a reactive dependency and invalidates everything downstream of it.
 */
export function useThemedStyles<T extends object>(sheets: T): T {
  const s = useThemeTick();
  return (sheets as unknown as Record<symbol, (scheme: Scheme) => T>)[SHEET_FOR](s);
}

export const usePalette = (): Palette => THEMES[useThemeTick()].color;
export const useTierPalette = (): TierPalette => THEMES[useThemeTick()].tier;
export const useGradients = (): Gradients => THEMES[useThemeTick()].gradient;
export const useShadows = (): ShadowScale => THEMES[useThemeTick()].shadow;
