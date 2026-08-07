/**
 * The launch feed, composed server-side in one request (`GET /api/home`, hand-off C3).
 *
 * The app used to assemble this from `/games` + `/coaches` and stitch the sections together in
 * `useHome`. That worked, but it made the product PRD's single-request p95 target unmeasurable —
 * there was no single request — and it put the section rules (what counts as "up next", how many
 * coaches, which games are near) in the client, where the web and the app could disagree about
 * the same screen.
 *
 * **`useHome` keeps the old client composition as a fallback.** This endpoint is authed and can
 * 401, and an older deployment 404s it; Home is the launch tab, so it must not be the screen that
 * proves the server is down. See the note there.
 *
 * The rows here are the same selects `/games` and `/coaches` return, so both mappers are reused
 * rather than re-implemented — a second mapper for the same rows is a second thing to drift.
 */
import { toSummary as toCoachSummary } from "./coaches";
import { api } from "./client";
import { toSummary as toGameSummary } from "./games";
import type { CoachSummary, GameSummary } from "./types";

/** A game row as it arrives inside the composed feed, plus the two per-viewer extras. */
type RawHomeGame = Parameters<typeof toGameSummary>[0] & {
  /** Present on `upcoming` only: the viewer's host-collected payment state for that game. */
  myPaymentStatus?: string | null;
  /** Present on `waitlisted` only: 1-based queue position. */
  waitlistPosition?: number | null;
};

export interface HomePayload {
  /** Games the viewer has joined or is hosting, soonest first. */
  upcoming: GameSummary[];
  /** Games the viewer is queued for — surfaced because they read as "full" everywhere else. */
  waitlisted: (GameSummary & { waitlistPosition: number | null })[];
  openGames: GameSummary[];
  coaches: CoachSummary[];
  /** Server-composed and returned, but not yet rendered by any Home section — see useHome. */
  campsCount: number;
  eventsCount: number;
}

/**
 * Every section is defended independently. A malformed or missing section must cost that rail, not
 * the screen: `sections.coaches` arriving as null should not blank the games the same response
 * carried. `.filter(Boolean)` guards a null row inside an otherwise valid array for the same reason.
 */
function rows<T>(value: unknown, map: (r: never) => T): T[] {
  if (!Array.isArray(value)) return [];
  return value.filter(Boolean).map((r) => map(r as never));
}

export async function getHome(): Promise<HomePayload> {
  const raw = await api.get<{ sections?: Record<string, unknown> }>("/home");
  const s = raw?.sections ?? {};

  return {
    upcoming: rows<GameSummary>(s.upcoming, (r: RawHomeGame) => toGameSummary(r)),
    waitlisted: rows(s.waitlisted, (r: RawHomeGame) => ({
      ...toGameSummary(r),
      waitlistPosition: typeof r.waitlistPosition === "number" ? r.waitlistPosition : null,
    })),
    openGames: rows<GameSummary>(s.openGames, (r: RawHomeGame) => toGameSummary(r)),
    coaches: rows<CoachSummary>(s.coaches, (c: Parameters<typeof toCoachSummary>[0]) =>
      toCoachSummary(c),
    ),
    campsCount: Array.isArray(s.camps) ? s.camps.length : 0,
    eventsCount: Array.isArray(s.events) ? s.events.length : 0,
  };
}
