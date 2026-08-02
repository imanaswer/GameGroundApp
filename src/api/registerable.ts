/**
 * Shared reconciliation for the registerable entities (camps / workshops / events). The live web
 * routes name fields differently than the app's view types (startDate vs startsAt, price rupees vs
 * pricePaise, participants/maxParticipants vs registered/capacity) and carry rich detail content
 * (highlights, included, whatToBring, requirements, instructor). One mapper serves all three (§4.2).
 */
import { api } from "./client";
import type {
  Announcement,
  RegisterableDetail,
  RegisterableInstructor,
  RegisterableKind,
  RegisterableSummary,
} from "./types";

export type RawRegisterable = {
  id: string;
  title: string;
  sport?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  dates?: string | null;
  duration?: string | null;
  registrationDeadline?: string | null;
  location?: string | null;
  address?: string | null;
  price?: number | null;
  ageGroup?: string | null;
  skillLevel?: string | null;
  participants?: number | null;
  maxParticipants?: number | null;
  imageUrl?: string | null;
  featured?: boolean | null;
  description?: string;
  highlights?: string[];
  included?: string[];
  whatToBring?: string[];
  requirements?: string[];
  instructor?: { name?: string; bio?: string; credentials?: string; imageUrl?: string } | null;
  organizer?: string | null;
  organizerContact?: string | null;
  announcements?: Announcement[];
  /** Derived from the registration rows — authoritative over the legacy `participants` counter. */
  registeredCount?: number | null;
  /** Present only for an authenticated viewer who has registered. */
  userRegistration?: {
    id: string;
    paymentStatus?: string;
    status?: string | null;
    rejectionReason?: string | null;
  } | null;
};

/**
 * Drops anything whose end date has passed.
 *
 * The server is meant to do this, and now does (`endDate >= now` on the list routes, plus the
 * nightly completion cron). This is a client-side backstop, added 2 Aug 2026 after four workshops
 * that ended in July were listed in Discover well into August: the cron had never covered
 * workshops, so nothing ever moved them off `status: "open"`.
 *
 * The rule matches the server's exactly — filter on END date, so an in-progress item (a camp
 * running 20 Jul–3 Aug) stays listed throughout. Items with no usable date are kept rather than
 * guessed at; hiding real content is the worse failure.
 */
/**
 * `endDate` is a date-only stamp at midnight UTC ("2026-08-03T00:00:00.000Z"), and it means the
 * item runs THROUGH that day. Comparing it directly to `now` treats it as exclusive and hides a
 * camp at 05:30 IST on its own final day. One day of grace makes the end date inclusive.
 *
 * Errs toward showing: a listing that lingers a few hours past its last day is a much smaller
 * failure than one that vanishes while it is still running.
 */
const END_DATE_GRACE_MS = 24 * 60 * 60_000;

export function hasEnded(r: RawRegisterable, now: number = Date.now()): boolean {
  const end = r.endDate ?? r.startDate;
  if (!end) return false;
  const t = new Date(end).getTime();
  return Number.isFinite(t) && t + END_DATE_GRACE_MS < now;
}

/** True once the registration deadline has passed — the item still runs, you just can't join. */
export function registrationClosed(r: RawRegisterable, now: number = Date.now()): boolean {
  if (!r.registrationDeadline) return false;
  const t = new Date(r.registrationDeadline).getTime();
  return Number.isFinite(t) && t < now;
}

/**
 * How far ahead Discover looks. Anything starting beyond this is real but not yet actionable, and
 * pushes the things happening soon down the feed.
 */
export const DISCOVER_WINDOW_DAYS = 31;

/** True when the item starts further out than the Discover window. */
export function startsBeyondWindow(r: RawRegisterable, now: number = Date.now()): boolean {
  if (!r.startDate) return false;
  const t = new Date(r.startDate).getTime();
  if (!Number.isFinite(t)) return false;
  return t > now + DISCOVER_WINDOW_DAYS * 24 * 60 * 60_000;
}

/**
 * The list endpoints map only what Discover should show: nothing that has ended, and nothing
 * starting more than a month out.
 *
 * Registration-closed items are deliberately KEPT — Discover is the only surface for camps,
 * workshops and events (the profile lists games only), so hiding them would strand anyone already
 * registered, with no route to the schedule, venue, announcements or the cancel action. They are
 * flagged instead, and the card and detail CTA say so.
 */
export function toSummaryList(rows: RawRegisterable[], kind: RegisterableKind) {
  return rows
    .filter((r) => !hasEnded(r) && !startsBeyondWindow(r))
    .map((r) => toSummary(r, kind));
}

export function toSummary(r: RawRegisterable, kind: RegisterableKind): RegisterableSummary {
  return {
    id: r.id,
    kind,
    title: r.title,
    startsAt: r.startDate ?? "",
    dateLabel: r.dates ?? null,
    // price is whole rupees; 0/absent → null → "FREE".
    pricePaise: r.price ? r.price * 100 : null,
    imageUrl: r.imageUrl ?? null,
    // `registeredCount` is derived from the actual rows on the detail route; `participants` is the
    // denormalized counter and the only thing the list route sends. Prefer the derived one.
    registered: r.registeredCount ?? r.participants ?? 0,
    capacity: r.maxParticipants ?? 0,
    featured: r.featured ?? false,
    registrationClosed: registrationClosed(r),
  };
}

function toInstructor(i: RawRegisterable["instructor"]): RegisterableInstructor | null {
  if (!i?.name) return null;
  return {
    name: i.name,
    bio: i.bio || null,
    credentials: i.credentials || null,
    imageUrl: i.imageUrl || null,
  };
}

export function toDetail(r: RawRegisterable, kind: RegisterableKind): RegisterableDetail {
  return {
    ...toSummary(r, kind),
    description: r.description ?? "",
    sport: r.sport ?? null,
    location: r.location ?? null,
    address: r.address ?? null,
    duration: r.duration ?? null,
    ageGroup: r.ageGroup ?? null,
    skillLevel: r.skillLevel ?? null,
    registrationDeadline: r.registrationDeadline ?? null,
    organizer: r.organizer ?? null,
    organizerContact: r.organizerContact ?? null,
    highlights: r.highlights ?? [],
    included: r.included ?? [],
    whatToBring: r.whatToBring ?? [],
    requirements: r.requirements ?? [],
    instructor: toInstructor(r.instructor),
    announcements: r.announcements,
    viewerRegistration: r.userRegistration
      ? {
          id: r.userRegistration.id,
          paymentStatus: r.userRegistration.paymentStatus ?? "",
          status: r.userRegistration.status ?? null,
          rejectionReason: r.userRegistration.rejectionReason ?? null,
        }
      : null,
  };
}

/**
 * Free registration — `POST /camps|workshops|events/:id`.
 *
 * A genuinely separate path from checkout, not a ₹0 variant of it: the server's charge helpers
 * throw `NotPayableError` on a ₹0 amount, so a free entity can never reach the gateway. This
 * endpoint is the only way to register for one. It returns 402 if the entity is actually paid,
 * so the two paths can't be confused.
 *
 * Not auto-retried — a repeat is a duplicate-registration attempt, not a safe replay.
 */
export function registerFree(
  path: string,
  id: string,
  fields: Record<string, unknown>,
): Promise<{ registered: true }> {
  return api.post<{ registered: true }>(`/${path}/${id}`, fields, { retry401: false });
}

/**
 * Cancel a registration — `DELETE /camps|workshops|events/:id`.
 * Same 90-minute pre-start cutoff as games (403 inside it).
 */
export function cancelRegistration(path: string, id: string): Promise<{ cancelled: true }> {
  return api.del<{ cancelled: true }>(`/${path}/${id}`, { retry401: false });
}
