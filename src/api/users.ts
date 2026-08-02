/** Users endpoints (§3.3). Profile read/edit + GDPR delete (rotates identifiers). */
import { nextTier } from "@/lib/tierLadder";

import { api } from "./client";
import type { ActivityItem, GameStatus, Tier, UpdateProfileInput, UserProfile } from "./types";

/**
 * Raw server profile (flat record from the web `/users/:id` select). It returns stats inline
 * (gamesPlayed / attendanceRate / reputationScore) and `location` rather than `city`, and carries
 * no `progress` / `seasonStrip`. We adapt to the app's UserProfile here (§4.2) so the DS
 * components (StatStrip, PlayerHeroCard, WeekStrip) receive the nested shape they expect.
 */
interface RawProfileGame {
  id: string;
  sport: string;
  title: string;
  location: string | null;
  scheduledAt: string;
  status: GameStatus;
  role: string;
}

interface RawUserProfile {
  id: string;
  name: string;
  username: string;
  bio?: string | null;
  phone?: string | null;
  avatarUrl: string | null;
  location: string | null;
  sports: string[] | null;
  tier: Tier | null;
  gamesPlayed: number;
  gamesOrganized: number;
  attendanceRate: number;
  reputationScore: number;
  reliabilityScore?: number | null;
  playerRank?: number | null;
  games?: RawProfileGame[];
}

function toUserProfile(raw: RawUserProfile): UserProfile {
  const tier = raw.tier ?? "bronze";
  const nt = nextTier(tier);
  return {
    id: raw.id,
    name: raw.name,
    username: raw.username,
    bio: raw.bio ?? null,
    city: raw.location || null,
    phone: raw.phone ?? null,
    avatarUrl: raw.avatarUrl ?? null,
    sports: raw.sports ?? [],
    tier: raw.tier ?? null,
    // Points are the server's reputationScore; the per-tier thresholds come from the provisional
    // client ladder (the server exposes tier but no thresholds — see lib/tierLadder).
    progress: {
      tier,
      points: raw.reputationScore ?? 0,
      nextTierAt: nt?.at ?? null,
    },
    stats: {
      games: raw.gamesPlayed ?? 0,
      organized: raw.gamesOrganized ?? 0,
      attendance: raw.attendanceRate ?? 0,
      reliability: raw.reliabilityScore ?? 0,
    },
    seasonStrip: [],
    games: (raw.games ?? []).map((g) => ({
      id: g.id,
      title: g.title,
      sport: g.sport,
      venue: g.location,
      startsAt: g.scheduledAt,
      status: g.status,
      role: g.role,
    })),
  };
}

export async function profile(id: string): Promise<UserProfile> {
  return toUserProfile(await api.get<RawUserProfile>(`/users/${id}`));
}

/**
 * Server wraps the feed as `{ items, streakWeeks, heatmap }`, and each item uses `text`/`ts`
 * (+ kind/icon/href) — not the app's `title`/`at`. Reconcile here so the Overview rows render.
 */
interface RawActivity {
  items: {
    id: string;
    kind: string;
    text: string;
    ts: string;
    icon?: string;
    href?: string;
    /** Reputation delta — the web feed labels it `points`/`rep`/`reputation` across routes. */
    points?: number | null;
    rep?: number | null;
    reputation?: number | null;
  }[];
}

export async function activity(id: string): Promise<ActivityItem[]> {
  const raw = await api.get<RawActivity>(`/users/${id}/activity`);
  return (raw.items ?? []).map((it) => ({
    id: it.id,
    kind: it.kind,
    title: it.text,
    at: it.ts,
    points: it.points ?? it.rep ?? it.reputation ?? null,
  }));
}

/**
 * Profile edit — PATCH /users/:id (the server checks it matches the session; there is no `/me`
 * route or POST handler, so both must target the owner's id). Returns the raw user row (no derived
 * stats), so callers should refetch the full profile rather than trust this for stat fields.
 */
export async function update(id: string, input: UpdateProfileInput): Promise<UserProfile> {
  return toUserProfile(await api.patch<RawUserProfile>(`/users/${id}`, input));
}

/**
 * GDPR account deletion (§3.3 / product 6.6). Server rotates identifiers and blocks re-login;
 * the app must hard-logout after. Never auto-retried. DELETE /users/:id (owner only).
 */
export function deleteAccount(id: string): Promise<{ deleted: true }> {
  return api.del<{ deleted: true }>(`/users/${id}`, { retry401: false });
}
