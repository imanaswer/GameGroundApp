/** Users endpoints (§3.3). Profile read/edit + GDPR delete (rotates identifiers). */
import { nextTier, progressRatio } from "@/lib/tierLadder";

import { api } from "./client";
import type {
  ActivityItem,
  GameStatus,
  RankProgress,
  RawRankProgress,
  Tier,
  UpdateProfileInput,
  UserProfile,
} from "./types";

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

export interface RawUserProfile {
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
  /** Not sent today. Preferred over the local ladder the moment it is — see toProgress. */
  progress?: RawRankProgress | null;
}

/**
 * Rank progress, server-first.
 *
 * The server owns the tier ladder (`GG/src/lib/reputation.ts` → `TIER_THRESHOLDS`) and already
 * computes this exact block in `progressToNextTier()`; it just isn't serialised on `/users/:id`
 * yet. So: use its numbers when they arrive, fall back to the mirrored ladder in
 * `lib/tierLadder.ts` until then, and record which happened in `source`.
 *
 * The point of doing it here rather than in the component is that the day the server starts
 * sending `progress`, this function is the ONLY thing that changes behaviour — no screen, no
 * hook, and no app release beyond the one already installed.
 */
export function toProgress(raw: RawUserProfile): RankProgress {
  const tier = raw.progress?.current ?? raw.tier ?? "bronze";
  const points = raw.reputationScore ?? 0;

  // Read the two server numbers up front rather than narrowing `raw.progress` inside a branch:
  // each is used only if it is genuinely a number, so a `progress: {}` (or a null field) falls
  // through to the local ladder instead of producing a zero-length bar.
  const serverNextAt = typeof raw.progress?.nextAt === "number" ? raw.progress.nextAt : null;
  const serverPct = typeof raw.progress?.pct === "number" ? raw.progress.pct : null;

  if (serverNextAt !== null || serverPct !== null) {
    return {
      tier,
      points,
      nextTierAt: serverNextAt,
      // Prefer the server's own percentage; if it sent only a threshold, measure the span here.
      ratio: serverPct !== null ? Math.max(0, Math.min(100, serverPct)) / 100 : progressRatio(points, tier),
      source: "server",
    };
  }

  return {
    tier,
    points,
    nextTierAt: nextTier(tier)?.at ?? null,
    ratio: progressRatio(points, tier),
    source: "fallback",
  };
}

function toUserProfile(raw: RawUserProfile): UserProfile {
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
    progress: toProgress(raw),
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
 * the app must hard-logout after. Never auto-retried on a 429 or a dropped connection; a 401
 * still refreshes and replays, since the rejected attempt deleted nothing.
 * DELETE /users/:id (owner only).
 */
export function deleteAccount(id: string): Promise<{ deleted: true }> {
  return api.del<{ deleted: true }>(`/users/${id}`);
}
