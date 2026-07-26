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

/* ── Coaches (§3.3) ────────────────────────────────────────────────────────*/

export interface CoachSummary {
  id: string;
  name: string;
  sport: string;
  facilityImageUrl: string | null;
  avatarUrl: string | null;
  rating: number;
  reviewCount: number;
  /** null → "on request"; else server-computed paise for the base batch. */
  pricePaise: number | null;
  area: string | null;
}

export interface CoachBatch {
  id: string;
  name: string;
  schedule: string;
  pricePaise: number;
  spotsLeft: number;
}

export interface CoachReview {
  id: string;
  author: PlayerRef;
  rating: number;
  body: string;
  createdAt: string;
}

export interface CoachDetail extends CoachSummary {
  bio: string;
  batches: CoachBatch[];
  photos: string[];
  reviews: CoachReview[];
  whatsapp: string | null;
  /** Server eligibility: can the viewer post a review right now? */
  viewerCanReview: boolean;
}

/* ── Venues (§3.3 — create-game picker) ────────────────────────────────────*/

export interface Venue {
  id: string;
  name: string;
  area: string | null;
}

export interface VenueSlot {
  id: string;
  /** ISO 8601. */
  startsAt: string;
  endsAt: string;
  available: boolean;
}

/* ── Payments (§9) ─────────────────────────────────────────────────────────
 * The client NEVER sends an amount. create-order derives paise server-side;
 * verify re-asserts the order↔user↔entity↔amount binding. */

export type EntityType = "game" | "coach" | "camp" | "workshop" | "event";

/** `POST /payments/create-order` response — amount is server-computed. */
export interface CreatedOrder {
  orderId: string;
  amountPaise: number;
  currency: string;
  keyId: string;
}

/** The Razorpay SDK success payload passed straight back to verify. */
export interface RazorpayResult {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

export type PaymentStatus = "created" | "attempted" | "paid" | "failed";

/** `GET /payments/history` row — the reconciliation poll reads `status` for its order. */
export interface PaymentRecord {
  orderId: string;
  entityType: EntityType;
  entityId: string;
  amountPaise: number;
  status: PaymentStatus;
  createdAt: string;
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
  viewerIsOrganizer: boolean;
  /** Leave cutoff has passed — the client surfaces this; the server enforces it (§7). */
  leaveDeadlinePassed: boolean;
}
