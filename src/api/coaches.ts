/** Coaches endpoints (§3.3). Reviews have server-side eligibility rules. */
import { toWhatsAppNumber } from "@/lib/phone";
import { sportImage } from "@/lib/sportImages";

import { api } from "./client";
import type { CoachBatch, CoachDetail, CoachReview, CoachSummary } from "./types";

/**
 * The live web `/coaches` route names fields differently than the app's view types
 * (imageUrl/coverImageUrl vs facilityImageUrl/avatarUrl, priceMin/priceMax rupees vs pricePaise,
 * location vs area, day/time/seats batches). Single reconciliation point (§4.2).
 */
type RawBatch = { id: string; day?: string; time?: string; level?: string; seats?: number };
type RawReview = {
  id: string;
  rating?: number;
  body?: string;
  comment?: string;
  createdAt?: string;
  userName?: string;
  userAvatar?: string | null;
  author?: { name?: string; avatarUrl?: string | null };
};
type RawCoach = {
  id: string;
  name: string;
  sport: string;
  imageUrl: string | null;
  coverImageUrl?: string | null;
  rating: number;
  reviewCount: number;
  priceMin?: number | null;
  priceMax?: number | null;
  location?: string | null;
  description?: string;
  phone?: string | null;
  photos?: string[];
  batches?: RawBatch[];
  reviews?: RawReview[];
  userBooking?: unknown;
};

function toSummary(c: RawCoach): CoachSummary {
  // Card backdrop = the coach's own cover when set, else a sport-themed image; the coach's photo
  // stays as the avatar so backdrop and face are always distinct. priceMin/priceMax are rupees.
  return {
    id: c.id,
    name: c.name,
    sport: c.sport,
    facilityImageUrl: c.coverImageUrl || sportImage(c.sport),
    avatarUrl: c.imageUrl ?? null,
    rating: c.rating ?? 0,
    reviewCount: c.reviewCount ?? 0,
    pricePaise: c.priceMin ? c.priceMin * 100 : null,
    pricePaiseMax: c.priceMax ? c.priceMax * 100 : null,
    area: c.location ?? null,
  };
}

/**
 * The API carries no batch title — batches are distinguished by their time. Use the time itself as
 * the title (always unique; deriving "Morning/Evening Batch" collides when a coach runs several
 * batches in the same period) and the day as the subtitle. `seats` is the batch capacity — with no
 * per-batch booked count in the API, it doubles as seats-left (accurate until a batch is booked).
 */
function toBatch(b: RawBatch, sessionRupees: number | null | undefined): CoachBatch {
  return {
    id: b.id,
    name: (b.time ?? "Batch").trim(),
    schedule: (b.day ?? "").trim(),
    pricePaise: sessionRupees ? sessionRupees * 100 : 0,
    spotsLeft: b.seats ?? 0,
  };
}

function toReview(r: RawReview): CoachReview {
  return {
    id: r.id,
    author: { id: "", name: r.userName ?? r.author?.name ?? "Player", avatarUrl: r.userAvatar ?? r.author?.avatarUrl ?? null },
    rating: r.rating ?? 0,
    body: r.body ?? r.comment ?? "",
    createdAt: r.createdAt ?? "",
  };
}

// Phone normalization lives in lib/phone (a mirror of the server's rule). The local version this
// replaced kept leading zeros and accepted too-short input, so it could emit a dead wa.me link.

/**
 * Instant "pay & book" is offered only when the coach has ONE fixed price — mirrors the server's
 * `isInstantPayEligible`. The admin form stores a single price either as priceMin === priceMax or
 * as priceMin > 0 with priceMax === 0. A genuine price range stays request-only, and the server
 * rejects its checkout with "This coach is not available for instant pay" — so without this gate
 * the Book button walked ranged coaches all the way to a 400.
 */
function isInstantPayEligible(c: RawCoach): boolean {
  const min = c.priceMin ?? 0;
  const max = c.priceMax ?? 0;
  return min > 0 && (max === 0 || max === min);
}

function toDetail(c: RawCoach): CoachDetail {
  return {
    ...toSummary(c),
    instantPayEligible: isInstantPayEligible(c),
    bio: c.description ?? "",
    batches: (c.batches ?? []).map((b) => toBatch(b, c.priceMin)),
    photos: c.photos ?? [],
    reviews: (c.reviews ?? []).map(toReview),
    whatsapp: toWhatsAppNumber(c.phone),
    viewerCanReview: c.userBooking != null,
  };
}

export async function list(params: { sport?: string; q?: string } = {}): Promise<CoachSummary[]> {
  const sp = new URLSearchParams();
  if (params.q) sp.set("q", params.q);
  const s = sp.toString();
  const rows = await api.get<RawCoach[]>(`/coaches${s ? `?${s}` : ""}`);
  return rows.map(toSummary);
}

export async function detail(id: string): Promise<CoachDetail> {
  return toDetail(await api.get<RawCoach>(`/coaches/${id}`));
}

/** Server enforces eligibility — a 4xx maps to an inline error on the review form. */
export function submitReview(id: string, input: { rating: number; body: string }): Promise<CoachReview> {
  return api.post<CoachReview>(`/coaches/${id}/reviews`, input);
}
