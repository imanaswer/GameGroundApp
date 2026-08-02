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

/* ── Registerable entities: camps / workshops / events (§3.3, §9.1) ─────────
 * One shared shape so the directory card, detail screen, and registration engine
 * are entity-agnostic. Adding a 4th entity is a config entry, not new screens. */

export type RegisterableKind = "camp" | "workshop" | "event";

export interface RegisterableSummary {
  id: string;
  kind: RegisterableKind;
  title: string;
  /** ISO 8601 start. */
  startsAt: string;
  /** Human date range from the server ("July 20 – August 3, 2026"), for cards/detail. */
  dateLabel: string | null;
  pricePaise: number | null;
  imageUrl: string | null;
  registered: number;
  capacity: number;
  /** Server-flagged highlight — surfaces a "Featured" badge on cards (matches web). */
  featured: boolean;
}

export interface Announcement {
  id: string;
  title: string;
  body: string;
  createdAt: string;
}

/** Workshop instructor / clinic lead. */
export interface RegisterableInstructor {
  name: string;
  bio: string | null;
  credentials: string | null;
  imageUrl: string | null;
}

export interface RegisterableDetail extends RegisterableSummary {
  description: string;
  sport: string | null;
  location: string | null;
  address: string | null;
  /** "2 Weeks" / "3 Hours". */
  duration: string | null;
  ageGroup: string | null;
  skillLevel: string | null;
  /** ISO 8601 — last day to register. */
  registrationDeadline: string | null;
  organizer: string | null;
  organizerContact: string | null;
  /** Selling points, "what's included", "what to bring"/"requirements" — string bullet lists. */
  highlights: string[];
  included: string[];
  whatToBring: string[];
  requirements: string[];
  /** Workshops carry an instructor; camps/events may omit it. */
  instructor: RegisterableInstructor | null;
  /** Events carry an announcements feed (§9); camps/workshops omit it. */
  announcements?: Announcement[];
  /** The viewer's own registration, when signed in and registered. Null otherwise. */
  viewerRegistration: ViewerRegistration | null;
}

/**
 * The viewer's registration on a camp / workshop / event (server `userRegistration`).
 * Events run a manual-approval mode, so a registration can sit `pending` or come back `rejected`
 * with a reason — a paid registration is NOT automatically a confirmed place.
 */
export interface ViewerRegistration {
  id: string;
  paymentStatus: string;
  /** Events only: "pending" | "approved" | "rejected". Absent for camps/workshops. */
  status: string | null;
  /** Events only: why a registration was turned down. */
  rejectionReason: string | null;
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
  /** Session price range (paise). min null → "on request"; max null/≤min → single price. */
  pricePaise: number | null;
  pricePaiseMax: number | null;
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
  /**
   * Whether "pay & book" is available. False for coaches with a price range or no price — those
   * are request-only, and the server refuses their checkout.
   */
  instantPayEligible: boolean;
}

/* ── Profiles (§3.3, product 6.6) ──────────────────────────────────────────*/

export interface RankProgress {
  tier: Tier;
  points: number;
  /** Points at which the next tier unlocks; null when already at the top tier. */
  nextTierAt: number | null;
}

export interface ProfileStats {
  games: number;
  organized: number;
  attendance: number;
  /** Reliability score, 0–5. */
  reliability: number;
}

export interface ActivityItem {
  id: string;
  /** "joined" | "created" | "attended" | "booked" | "tier_up" … rendered by kind. */
  kind: string;
  title: string;
  at: string;
  /** Server-computed reputation delta for this event, when present → renders a "+N REP" chip. */
  points: number | null;
}

/** A game on the profile's Games tab (the user's played/organized games). */
export interface ProfileGame {
  id: string;
  title: string;
  sport: string;
  venue: string | null;
  startsAt: string;
  status: GameStatus;
  /** The viewer's role in this game: "player" | "organizer". */
  role: string;
}

export interface UserProfile {
  id: string;
  name: string;
  username: string;
  /** Free-text "about" line, editable on the profile. */
  bio: string | null;
  city: string | null;
  /** WhatsApp number — required by the server before a user can host a game. */
  phone: string | null;
  avatarUrl: string | null;
  sports: string[];
  tier: Tier | null;
  progress: RankProgress | null;
  stats: ProfileStats;
  /** Last-10 attendance intensities 0–1 for the WeekStrip (attendance only, Decision 6). */
  seasonStrip: number[];
  /** The user's games (played + organized), newest-relevant first. */
  games: ProfileGame[];
}

export interface UpdateProfileInput {
  name?: string;
  /** Server rejects a taken handle with 409; only send when non-empty. */
  username?: string;
  bio?: string;
  /** Server stores this as `location` (the read maps it back to `city`); the write must match. */
  location?: string;
  phone?: string;
  sports?: string[];
  /** Avatar image URL; "" clears it back to the initials fallback. */
  avatarUrl?: string;
}

/* ── Leaderboard (§3.3) ────────────────────────────────────────────────────*/

export type LeaderScope = "players" | "organizers";
export type LeaderWindow = "all" | "30d";

export interface LeaderRow {
  rank: number;
  user: PlayerRef & { tier: Tier | null };
  score: number;
  /** Rank movement since the previous period: +up / −down / 0 flat. */
  /**
   * Rank movement since the last period. The web `/leaderboard` route does NOT compute this, so
   * it is null in practice — typed honestly rather than faked as 0, which read as "no movement".
   * The row simply omits the indicator until the server sends one.
   */
  delta: number | null;
}

export interface Leaderboard {
  rows: LeaderRow[];
  /** The signed-in user's row, present when they're outside the returned top-N (§ pinned rank). */
  viewerRank: LeaderRow | null;
}

/* ── Search (§3.3) ─────────────────────────────────────────────────────────*/

export interface SearchHit {
  id: string;
  title: string;
  subtitle: string | null;
  /**
   * ISO end date, sent for camp and event hits only (added server-side 2 Aug 2026). Lets the app
   * drop hits that have already ended instead of trusting the server's status sweep — the same
   * backstop the Discover lists have. Absent for games and coaches, which have no end date here.
   */
  endDate?: string | null;
}

/** Grouped results — each group renders under its own header (web ⌘K parity). */
/**
 * What `/search` actually returns. Workshops and players are deliberately absent — the web route
 * doesn't index them, and declaring them here let the UI advertise groups that never populate.
 */
export interface SearchResults {
  games: SearchHit[];
  coaches: SearchHit[];
  camps: SearchHit[];
  events: SearchHit[];
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
  /** Session length in minutes — shown in the "When" row. */
  durationMin: number | null;
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
