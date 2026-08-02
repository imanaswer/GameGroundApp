/** Leaderboard endpoint (§3.3). okCached on the server — send only scope + window. */
import { api } from "./client";
import type { Leaderboard, LeaderRow, LeaderScope, LeaderWindow, Tier } from "./types";

/**
 * Raw server row (flat user record). The web `/leaderboard` route returns the user fields
 * inline — no nested `user`, no `score`/`delta` — so we adapt to the app's LeaderRow here
 * (§4.2: the api layer is the single place shape adaptation lives).
 */
interface RawLeaderRow {
  id: string;
  name: string;
  username: string;
  avatarUrl: string | null;
  location: string | null;
  tier: Tier | null;
  reputationScore: number;
  gamesPlayed: number;
  gamesOrganized: number;
  attendanceRate: number;
  reliabilityScore: number;
  rank: number;
}

interface RawLeaderboard {
  type: string;
  period: string;
  generatedAt: string;
  rows: RawLeaderRow[];
  /** Present (when authed) for the pinned own-rank strip; absent otherwise. */
  viewerRank?: RawLeaderRow | null;
}

function toLeaderRow(r: RawLeaderRow, scope: LeaderScope): LeaderRow {
  return {
    rank: r.rank,
    user: { id: r.id, name: r.name, avatarUrl: r.avatarUrl ?? null, tier: r.tier ?? null },
    // The server orders (and the web displays) organizers by games organized, players by
    // reputation — showing reputation for organizers contradicts their rank order. Delta isn't returned.
    score: scope === "organizers" ? (r.gamesOrganized ?? 0) : (r.reputationScore ?? 0),
    // Not returned by the route — see LeaderRow.delta. Null, not 0.
    delta: null,
  };
}

/**
 * The web route keys off `type` + `period` (not scope/window); unknown params are silently
 * ignored server-side and fall back to players/all-time — which is why the toggles looked dead.
 * "Last 30 days" is the server's `month` bucket ("30d" isn't a recognized token → always empty).
 */
const PERIOD_PARAM: Record<LeaderWindow, string> = { all: "all", "30d": "month" };

export async function get(scope: LeaderScope, window: LeaderWindow): Promise<Leaderboard> {
  const raw = await api.get<RawLeaderboard>(`/leaderboard?type=${scope}&period=${PERIOD_PARAM[window]}`);
  return {
    rows: (raw.rows ?? []).map((r) => toLeaderRow(r, scope)),
    viewerRank: raw.viewerRank ? toLeaderRow(raw.viewerRank, scope) : null,
  };
}
