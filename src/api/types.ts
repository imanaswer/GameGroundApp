/**
 * Response types mirrored from the web repo's route selects (Developer PRD §4.4).
 * When the web response shape changes, this file is the single place to update.
 */

/** JWT claims / `GET /auth/me` payload (web src/lib/auth.ts SessionUser). */
export interface SessionUser {
  id: string;
  email: string;
  name: string;
  username: string;
  role: string;
  avatarUrl: string | null;
}

/** `POST /auth/login|register|google/mobile|apple/mobile` body. refreshToken arrives once M1 ships. */
export interface AuthPayload {
  user: SessionUser;
  token: string;
  refreshToken?: string;
}

/** `POST /auth/refresh` (Developer PRD §5.3). */
export interface RefreshPayload {
  token: string;
  refreshToken: string;
}

/* ── Games (§3.3) ──────────────────────────────────────────────────────────
 * Transcribed from the web `/games` route selects. If the web shape changes,
 * this is the single file to update (§4.2). Amounts are server-computed paise. */

export type Tier = "bronze" | "silver" | "gold" | "elite" | "pro";
export type GameStatus = "open" | "full" | "completed" | "cancelled";

export interface PlayerRef {
  id: string;
  name: string;
  avatarUrl: string | null;
}

/** `GET /games` list item. */
export interface GameSummary {
  id: string;
  title: string;
  sport: string;
  venueName: string;
  /** ISO 8601, server tz-aware. */
  startsAt: string;
  status: GameStatus;
  /** null → a free game (renders FREE). */
  pricePaise: number | null;
  imageUrl: string | null;
  slotsTotal: number;
  slotsFilled: number;
  players: PlayerRef[];
  organizerTier: Tier | null;
}

/** `GET /games/:id` — list fields plus the detail-only surface. */
export interface GameDetail extends GameSummary {
  description: string;
  organizer: PlayerRef & { tier: Tier | null };
  venueAddress: string | null;
  latitude: number | null;
  longitude: number | null;
  skillLevel: string | null;
  /** Server truth for the current user's relationship to this game. */
  viewerJoined: boolean;
  viewerWaitlisted: boolean;
}
