/**
 * Deep-link → app-route resolver (Developer PRD §11). Maps both the custom scheme
 * (gameground://game/abc) and the web https URLs (gameground.net/games/abc — note the web
 * uses PLURAL paths, the app routes are singular) onto Expo Router paths.
 *
 * M12 uses this for notification-tap routing. M13 hardens it: zod cuid validation of the id,
 * auth-gated stash-and-resume, and the universal-links config. A route this can't parse
 * returns null and the caller falls back to home — never a crash.
 */

/** web path segment → app route builder. */
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
    // Normalize the custom scheme so URL() gives a usable pathname.
    const normalized = url.startsWith("gameground://")
      ? url.replace("gameground://", "https://gameground.net/")
      : url;
    return new URL(normalized).pathname.split("/").filter(Boolean);
  } catch {
    return null;
  }
}

/**
 * Resolve a deep link to an Expo Router path, or null when it can't be mapped.
 * The caller decides the fallback (home) so this stays a pure function.
 */
export function resolveDeepLink(url: string): string | null {
  const segments = segmentsOf(url);
  if (!segments || segments.length === 0) return null;

  const [head, id] = segments;
  if (id && ENTITY_ROUTE[head]) return ENTITY_ROUTE[head](id);
  if (!id && STATIC_ROUTE[head]) return STATIC_ROUTE[head];
  return null;
}
