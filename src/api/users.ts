/** Users endpoints (§3.3). Profile read/edit + GDPR delete (rotates identifiers). */
import { api } from "./client";
import type { ActivityItem, Tier, UpdateProfileInput, UserProfile } from "./types";

/**
 * Raw server profile (flat record from the web `/users/:id` select). It returns stats inline
 * (gamesPlayed / attendanceRate / reputationScore) and `location` rather than `city`, and carries
 * no `progress` / `seasonStrip`. We adapt to the app's UserProfile here (§4.2) so the DS
 * components (StatStrip, PlayerHeroCard, WeekStrip) receive the nested shape they expect.
 */
interface RawUserProfile {
  id: string;
  name: string;
  username: string;
  avatarUrl: string | null;
  location: string | null;
  sports: string[] | null;
  tier: Tier | null;
  gamesPlayed: number;
  gamesOrganized: number;
  attendanceRate: number;
  reputationScore: number;
}

function toUserProfile(raw: RawUserProfile): UserProfile {
  return {
    id: raw.id,
    name: raw.name,
    username: raw.username,
    city: raw.location || null,
    avatarUrl: raw.avatarUrl ?? null,
    sports: raw.sports ?? [],
    tier: raw.tier ?? null,
    // Server profile carries no tier-progress thresholds or attendance strip yet — omit rather
    // than fabricate (the app never computes these; RankProgress/WeekStrip hide when absent).
    progress: null,
    stats: {
      games: raw.gamesPlayed ?? 0,
      attendance: raw.attendanceRate ?? 0,
      reputation: raw.reputationScore ?? 0,
      rank: null,
    },
    seasonStrip: [],
  };
}

export async function profile(id: string): Promise<UserProfile> {
  return toUserProfile(await api.get<RawUserProfile>(`/users/${id}`));
}

/** Server wraps the feed as `{ items, streakWeeks, heatmap }`; the app consumes the items list. */
interface RawActivity {
  items: ActivityItem[];
}

export async function activity(id: string): Promise<ActivityItem[]> {
  const raw = await api.get<RawActivity>(`/users/${id}/activity`);
  return raw.items ?? [];
}

export async function update(input: UpdateProfileInput): Promise<UserProfile> {
  return toUserProfile(await api.post<RawUserProfile>("/users/me", input));
}

/**
 * GDPR account deletion (§3.3 / product 6.6). Server rotates identifiers and blocks re-login;
 * the app must hard-logout after. Never auto-retried.
 */
export function deleteAccount(): Promise<{ deleted: true }> {
  return api.del<{ deleted: true }>("/users/me", { retry401: false });
}
