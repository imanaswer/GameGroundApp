/**
 * Absolutises image URLs coming off the API.
 *
 * The web app and the mobile app do not read `imageUrl` the same way. `/api/games` sends the sport
 * backdrops as ROOT-RELATIVE paths — `"/sports/football-01.webp"` — which the browser resolves
 * against the page origin for free. React Native has no page and no origin: `expo-image` given
 * `{ uri: "/sports/football-01.webp" }` fails the fetch silently, so the card renders as a bare
 * `color.imagePlaceholder` rectangle with nothing logged. Coaches and workshops send absolute
 * Cloudinary URLs, which is why only *some* images were missing — the failure looked like a
 * flaky loader when it was actually a missing host.
 *
 * Every image field mapped in `src/api/*` goes through here. Absolute URLs pass through untouched,
 * so this stays a no-op for Cloudinary, Google avatars, dicebear and the Unsplash fallbacks in
 * `sportImages.ts`.
 */
import { env } from "./env";

/**
 * `env.apiUrl` is the site origin (`https://www.gameground.net`) — `client.ts` appends the `/api`
 * itself. The static images live at the origin ROOT (`/sports/...`), not under `/api`, so a trailing
 * `/api` would send every request one path segment too deep. Tolerated here rather than assumed
 * away: the var is set per EAS profile and a future profile may well include it.
 */
const ORIGIN = env.apiUrl.replace(/\/+$/, "").replace(/\/api$/, "");

/** Matches any `scheme:` prefix — `https:`, `data:`, `file:` — i.e. already-resolvable URLs. */
const HAS_SCHEME = /^[a-z][a-z0-9+.\-]*:/i;

/**
 * An absolute, loadable URL for `value` — or null when there is no image.
 *
 * Null-ish AND empty-string both collapse to null. The API sends `""` for "no image" at least as
 * often as it sends the field absent (every workshop without a cover), and `?? null` lets that
 * empty string through to callers that then have to re-test it.
 */
export function resolveImageUrl(value: string | null | undefined): string | null {
  const s = (value ?? "").trim();
  if (!s) return null;
  if (HAS_SCHEME.test(s)) return s;
  // Protocol-relative (`//res.cloudinary.com/...`). Rare from this API, cheap to survive.
  if (s.startsWith("//")) return `https:${s}`;
  return `${ORIGIN}/${s.replace(/^\/+/, "")}`;
}
