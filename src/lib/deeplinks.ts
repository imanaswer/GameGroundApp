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

/**
 * Any custom (non-http) scheme: `ggredesign://`, `gameground://`, `exp+something://`.
 * Matched by SHAPE rather than by name — see `segmentsOf`.
 */
const CUSTOM_SCHEME = /^[a-z][a-z0-9+.-]*:\/\//i;

/**
 * Parse a URL (custom scheme or https) into its path segments; null if unusable.
 *
 * **Every non-http scheme is rewritten, not one hardcoded name.** This used to special-case
 * `gameground://` — which is the ORIGINAL app's scheme. This app deliberately registers
 * `ggredesign` instead (`app.config.js`: two apps claiming one scheme makes which one opens a link
 * undefined), so the only custom scheme the resolver handled was one it could never receive, while
 * the one it does receive fell through to `new URL()` unrewritten.
 *
 * That failure was silent and total. `new URL("ggredesign://game/abc")` reads the first segment as
 * the HOST — host `game`, pathname `/abc` — so the segments came out as `["abc"]`, matched no
 * entity and no static route, and resolved to null. **Every custom-scheme link routed to Home.**
 * Nothing threw, and the suite stayed green because it only ever asserted `gameground://`.
 *
 * It reaches production through push: payloads carry `data.url` (§10.1) straight into `route()`,
 * so whatever the server emits has to resolve here.
 *
 * The rewrite maps `<scheme>://<first>/<rest>` onto `https://gameground.net/<first>/<rest>`, which
 * puts that first segment back in the path where the route tables expect it. Matching on "not
 * http(s)" rather than on a scheme name is what keeps this from breaking again the next time the
 * scheme changes — the app's scheme lives in `app.config.js` and this module stays pure.
 */
function segmentsOf(url: string): string[] | null {
  try {
    const isWeb = /^https?:\/\//i.test(url);
    const normalized =
      !isWeb && CUSTOM_SCHEME.test(url)
        ? url.replace(CUSTOM_SCHEME, "https://gameground.net/")
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
