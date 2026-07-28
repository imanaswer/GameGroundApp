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

function toLeaderRow(r: RawLeaderRow): LeaderRow {
  return {
    rank: r.rank,
    user: { id: r.id, name: r.name, avatarUrl: r.avatarUrl ?? null, tier: r.tier ?? null },
    // Reputation is the ranking metric the server orders by; delta isn't yet returned.
    score: r.reputationScore ?? 0,
    delta: 0,
  };
}

export async function get(scope: LeaderScope, window: LeaderWindow): Promise<Leaderboard> {
  const raw = await api.get<RawLeaderboard>(`/leaderboard?scope=${scope}&window=${window}`);
  return {
    rows: (raw.rows ?? []).map(toLeaderRow),
    viewerRank: raw.viewerRank ? toLeaderRow(raw.viewerRank) : null,
  };
}
