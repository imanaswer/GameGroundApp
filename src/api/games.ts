/**
 * Games endpoints (Developer PRD §3.3). Response types in api/types.ts — the single
 * place to reconcile when the web route select changes.
 */
import { api } from "./client";
import type { GameDetail, GameStatus, GameSummary, Tier } from "./types";

export type GameListParams = {
  q?: string;
  sport?: string;
  status?: "open" | "completed" | "all";
};

/**
 * The live web `/games` route returns a different field vocabulary than the app's view types
 * (location vs venueName, scheduledAt vs startsAt, costAmount rupees vs pricePaise, slots/slotsLeft
 * vs slotsTotal/slotsFilled). This is the single reconciliation point (§4.2): the raw shape stays
 * here and everything downstream consumes GameSummary/GameDetail.
 */
type RawGame = {
  id: string;
  title: string;
  sport: string;
  location: string | null;
  address?: string | null;
  scheduledAt: string;
  status: GameStatus;
  costAmount: number | null;
  imageUrl: string | null;
  slots: number;
  slotsLeft: number;
  duration?: number | null;
  skillLevel?: string | null;
  description?: string;
  lat?: number | null;
  lng?: number | null;
  organizerId?: string;
  organizerName?: string | null;
  organizerAvatar?: string | null;
  organizer?: {
    name?: string;
    avatarUrl?: string | null;
    tier?: Tier | null;
    reliabilityScore?: number | null;
    gamesOrganized?: number | null;
  } | null;
  /**
   * `id` here is the PARTICIPATION record id, not the user — `userId` is the player. Everything
   * downstream (attendance, profile links) wants the user, so toSummary maps `id` from `userId`.
   */
  players?: { id: string; userId?: string; name: string; avatarUrl: string | null }[];
  // Viewer-relationship + org tier arrive only on authed detail responses; default when absent.
  organizerTier?: Tier | null;
  organizerRating?: number | null;
  organizerGames?: number | null;
  viewerJoined?: boolean;
  viewerWaitlisted?: boolean;
  viewerIsOrganizer?: boolean;
  leaveDeadlinePassed?: boolean;
};

/**
 * PROVISIONAL host tier. The web API returns no organizer tier yet — only the raw reputation
 * signals reliabilityScore (0–5) and gamesOrganized. We blend them for the "GOLD HOST" badge until
 * the server owns this: reliability sets the floor, games hosted push higher. The mappers always
 * prefer a server-sent tier, so this is a no-op the moment the backend ships one.
 */
function hostTier(reliabilityScore: number, gamesOrganized: number): Tier {
  const rel = Math.max(0, Math.min(5, reliabilityScore));
  const score = rel * 12 + Math.min(Math.max(0, gamesOrganized), 40) * 2;
  if (score >= 100) return "pro";
  if (score >= 80) return "elite";
  if (score >= 55) return "gold";
  if (score >= 30) return "silver";
  return "bronze";
}

function toSummary(r: RawGame): GameSummary {
  const rel = r.organizer?.reliabilityScore ?? r.organizerRating ?? 0;
  const games = r.organizer?.gamesOrganized ?? r.organizerGames ?? 0;
  return {
    id: r.id,
    title: r.title,
    sport: r.sport,
    venueName: r.location ?? "",
    startsAt: r.scheduledAt,
    status: r.status,
    // costAmount is whole rupees; the app renders paise. 0/absent → null → "FREE".
    pricePaise: r.costAmount ? r.costAmount * 100 : null,
    imageUrl: r.imageUrl,
    slotsTotal: r.slots ?? 0,
    slotsFilled: Math.max(0, (r.slots ?? 0) - (r.slotsLeft ?? 0)),
    players: (r.players ?? []).map((p) => ({
      id: p.userId ?? p.id,
      name: p.name,
      avatarUrl: p.avatarUrl,
    })),
    organizerTier: r.organizerTier ?? r.organizer?.tier ?? hostTier(rel, games),
  };
}

/**
 * The server refuses a leave inside this window of kick-off (web route: CANCEL_CUTOFF_MS).
 * A fixed published rule, not a server-side eligibility computation — so the client mirrors it to
 * explain the block up front instead of firing a request guaranteed to 403.
 */
export const LEAVE_CUTOFF_MS = 90 * 60_000;

/**
 * `viewerId` is the signed-in user's id (null when signed out).
 *
 * The live `/games/:id` route sends no viewer-relationship flags — it sends the raw facts
 * (`organizerId`, `players[].userId`) and expects the caller to resolve them. Without this the
 * flags defaulted to false forever, which made "Leave game" unreachable and hid the organizer's
 * attendance panel. A server-sent flag always wins, so this becomes a no-op if the API adds them.
 *
 * `viewerWaitlisted` and `leaveDeadlinePassed` stay server-only: the payload carries no waitlist
 * membership, and inventing a leave cutoff client-side would put the app in the business of
 * deciding eligibility — the server owns that (CLAUDE.md). The server rejects a late leave and the
 * screen surfaces the error.
 */
function toDetail(r: RawGame, viewerId?: string | null): GameDetail {
  const base = toSummary(r);
  const isOrganizer = r.viewerIsOrganizer ?? (!!viewerId && r.organizerId === viewerId);
  return {
    ...base,
    description: r.description ?? "",
    durationMin: r.duration ?? null,
    organizer: {
      id: r.organizerId ?? "",
      name: r.organizer?.name ?? r.organizerName ?? "",
      avatarUrl: r.organizer?.avatarUrl ?? r.organizerAvatar ?? null,
      tier: base.organizerTier,
    },
    venueAddress: r.address ?? null,
    latitude: r.lat ?? null,
    longitude: r.lng ?? null,
    skillLevel: r.skillLevel ?? null,
    // An organizer is not a "joined player" — they host it. Keeps the CTA off "Leave game" for them.
    viewerJoined:
      r.viewerJoined ?? (!!viewerId && !isOrganizer && base.players.some((p) => p.id === viewerId)),
    viewerWaitlisted: r.viewerWaitlisted ?? false,
    viewerIsOrganizer: isOrganizer,
    leaveDeadlinePassed:
      r.leaveDeadlinePassed ??
      new Date(r.scheduledAt).getTime() - Date.now() < LEAVE_CUTOFF_MS,
  };
}

/** The web `/games` sport filter is case-sensitive ("Football", not "football"). Title-case each
 *  word so any casing from the UI still matches the server's stored value. */
function titleCase(s: string): string {
  return s.replace(/\b\w/g, (c) => c.toUpperCase());
}

function toQuery(params: GameListParams): string {
  const sp = new URLSearchParams();
  if (params.q) sp.set("q", params.q);
  if (params.sport && params.sport !== "all") sp.set("sport", titleCase(params.sport));
  if (params.status) sp.set("status", params.status);
  const s = sp.toString();
  return s ? `?${s}` : "";
}

export async function list(params: GameListParams = {}): Promise<GameSummary[]> {
  const rows = await api.get<RawGame[]>(`/games${toQuery(params)}`);
  return rows.map(toSummary);
}

export async function detail(id: string, viewerId?: string | null): Promise<GameDetail> {
  return toDetail(await api.get<RawGame>(`/games/${id}`), viewerId);
}

export type GameAction = "join" | "leave" | "waitlist";

/**
 * The server's action receipts (web `api/games/[id]/route.ts`). These are NOT game objects —
 * mapping them through toDetail() produces a game with no title, no venue and zero slots.
 */
type JoinReceipt = {
  joined?: true;
  slotsLeft?: number;
  status?: GameStatus;
  waitlisted?: true;
  position?: number;
};

export type GameActionResult =
  | { kind: "joined"; slotsLeft: number; status: GameStatus }
  /** Capacity went while the request was in flight — the server waitlists rather than failing. */
  | { kind: "waitlisted"; position: number }
  | { kind: "left" };

/**
 * Join / leave / waitlist (§3.3).
 *
 * The verbs are NOT symmetric, and getting this wrong is silent: the server ignores any `action`
 * field and treats **every POST as a join**, so a POSTed "leave" came back 409 "already joined".
 *   join      → POST   /games/:id   (no body)
 *   waitlist  → POST   /games/:id   — same call; the server auto-waitlists when capacity is gone,
 *                                     so the client cannot choose between them
 *   leave     → DELETE /games/:id
 *
 * Returns the receipt, never a GameDetail. Callers refetch for the new truth (§6.1) — the receipt
 * is an acknowledgement, not the game.
 */
export async function act(id: string, action: GameAction): Promise<GameActionResult> {
  if (action === "leave") {
    await api.del<{ left: true }>(`/games/${id}`);
    return { kind: "left" };
  }
  const r = await api.post<JoinReceipt>(`/games/${id}`);
  return r.waitlisted
    ? { kind: "waitlisted", position: r.position ?? 0 }
    : { kind: "joined", slotsLeft: r.slotsLeft ?? 0, status: r.status ?? "open" };
}

/**
 * POST /games body — must match the web CreateGameSchema exactly (src/lib/api.ts).
 * The server derives venue/location/time from `slotId`; it never reads a venueId.
 * `slots` is player capacity (2–100); `cost` is a label ("Free" / "₹120") and
 * `costAmount` is whole rupees. `skillLevel` is required.
 */
export type CreateGamePayload = {
  title: string;
  sport: string;
  slotId: string;
  slots: number;
  skillLevel: "Beginner" | "Intermediate" | "Advanced" | "All Levels";
  cost?: string;
  costAmount?: number;
  description?: string;
  rules?: string[];
};

export async function create(
  payload: CreateGamePayload,
  viewerId?: string | null,
): Promise<GameDetail> {
  return toDetail(await api.post<RawGame>("/games", payload), viewerId);
}

/**
 * Organizer cancels their own game — `POST /games/:id/cancel`.
 *
 * The server allows this ONLY while nobody has joined (403 otherwise: players are already
 * committed, so unwinding becomes an admin matter). Cancelling releases the venue slot, so it
 * becomes bookable again. Never auto-retried — it's destructive and not idempotent from the
 * user's point of view (a second call 400s with "already cancelled").
 */
export function cancel(id: string): Promise<{ cancelled: true }> {
  return api.post<{ cancelled: true }>(`/games/${id}/cancel`, undefined, { retry401: false });
}

/** userId → showed up. Send an entry for EVERY player so nobody is left at a DB default. */
export type AttendanceMap = Record<string, boolean>;

export type CompleteResult = {
  completed: true;
  /** Always false here — the host records attendance; an admin grants the rewards. */
  pointsAwarded: boolean;
  awaitingAdminReview: boolean;
};

/**
 * Host closes out a played game — `POST /games/:id/complete` (§7).
 *
 * There is no per-player attendance endpoint; `/games/:id/attendance` never existed. Attendance is
 * a BATCH submitted with the completion, and the call does three things at once:
 *   1. marks the game `completed`  2. writes the attendance flags  3. hands off to admin review
 *
 * It is ONE-SHOT and irreversible: a second call gets 400 "Game already completed". Rewards
 * (gamesPlayed, reliability, reputation) are NOT granted here — only at admin finalization, which
 * reads these flags. Never auto-retried, for the same reason as any non-idempotent write.
 */
export function complete(id: string, attendance: AttendanceMap): Promise<CompleteResult> {
  return api.post<CompleteResult>(`/games/${id}/complete`, { attendance }, { retry401: false });
}
