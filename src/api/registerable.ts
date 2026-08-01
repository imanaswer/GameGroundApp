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
