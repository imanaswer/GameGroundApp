/**
 * Deep-link → app-route resolver + navigation planner (Developer PRD §11, S1.9).
 * Maps the custom scheme (gameground://game/abc) and the web https URLs
 * (gameground.net/games/abc — web is PLURAL, app routes are singular) onto Expo Router paths.
 *
 * Security (S1.9): entity ids are charset/length validated before they ever reach a route, so a
 * malformed or injected link resolves to null → the caller routes home. Nothing is ever
 * interpolated into a path unchecked, and this stays a pure function (no navigation, no I/O).
 */
import { z } from "zod";

/** cuid-shaped id guard — alphanumerics, `_`/`-`, bounded length. Rejects spaces, `/`, `..`, etc. */
const IdSchema = z.string().regex(/^[a-zA-Z0-9_-]{1,64}$/);

/** web path segment → app route builder (id already validated). */
const ENTITY_ROUTE: Record<string, (id: string) => string> = {
  games: (id) => `/game/${id}`,
  game: (id) => `/game/${id}`,
  coaches: (id) => `/coach/${id}`,
  coach: (id) => `/coach/${id}`,
  camps: (id) => `/camp/${id}`,
  camp: (id) => `/camp/${id}`,
  workshops: (id) => `/workshop/${id}`,
  workshop: (id) => `/workshop/${id}`,
  events: (id) => `/event/${id}`,
  event: (id) => `/event/${id}`,
  users: (id) => `/profile?userId=${id}`,
  players: (id) => `/profile?userId=${id}`,
};

const STATIC_ROUTE: Record<string, string> = {
  leaderboard: "/leaders",
  leaders: "/leaders",
  discover: "/discover",
  home: "/home",
};

/** Parse a URL (scheme or https) into its path segments; null if unusable. */
function segmentsOf(url: string): string[] | null {
  try {
    const normalized = url.startsWith("gameground://")
      ? url.replace("gameground://", "https://gameground.net/")
      : url;
    return new URL(normalized).pathname.split("/").filter(Boolean);
  } catch {
    return null;
  }
}

/**
 * Resolve a deep link to an Expo Router path, or null when it can't be mapped / is malformed.
 * The caller decides the fallback (home) so this stays pure.
 */
export function resolveDeepLink(url: string): string | null {
  const segments = segmentsOf(url);
  if (!segments || segments.length === 0) return null;

  const [head, rawId] = segments;

  if (rawId && ENTITY_ROUTE[head]) {
    const id = IdSchema.safeParse(rawId);
    return id.success ? ENTITY_ROUTE[head](id.data) : null; // malformed id → home
  }
  if (!rawId && STATIC_ROUTE[head]) return STATIC_ROUTE[head];
  return null;
}

export type NavPlan =
  | { action: "navigate"; path: string } //         signed in → go straight there
  | { action: "stash-then-login"; path: string } // signed out → resume after login
  | { action: "home" }; //                          unmappable / malformed → home, no crash

/**
 * Decide what to do with an incoming link given auth state (S1.9 stash-and-resume).
 * Pure and testable; the provider performs the I/O the plan implies.
 */
export function planNavigation(url: string, isSignedIn: boolean): NavPlan {
  const path = resolveDeepLink(url);
  if (!path) return { action: "home" };
  return isSignedIn ? { action: "navigate", path } : { action: "stash-then-login", path };
}
