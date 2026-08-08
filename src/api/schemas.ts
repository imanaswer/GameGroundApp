import { z } from "zod";

import { HOST_PAYMENT_METHODS, canCollect, isValidUpiId } from "@/lib/hostPayment";

/**
 * Zod schemas copied from web src/lib/api.ts (Developer PRD §4.5).
 * Pre-flight form validation ONLY — the server remains the referee.
 * Each schema notes its web source so drift is auditable.
 */

/** web src/lib/api.ts LoginSchema */
export const LoginSchema = z.object({
  email: z.email("Enter a valid email"),
  password: z.string().min(1, "Enter your password"),
});

/** web src/lib/api.ts RegisterSchema — username ^[a-z0-9_]+$ 3–20, password min 8 (§3.2) */
export const RegisterSchema = z.object({
  name: z.string().min(1, "Enter your name"),
  username: z
    .string()
    .min(3, "At least 3 characters")
    .max(20, "At most 20 characters")
    .regex(/^[a-z0-9_]+$/, "Lowercase letters, numbers and _ only"),
  email: z.email("Enter a valid email"),
  password: z.string().min(8, "At least 8 characters"),
});

/**
 * Create-game form validation, split per stepper step (§7). The server (web
 * src/lib/api.ts CreateGameSchema + src/app/api/games/route.ts) is the referee:
 * it derives venue/time from `slotId` (never reads `venueId`), requires `slots`
 * (player capacity) + a `skillLevel` enum, and takes `cost`/`costAmount`.
 */
const SKILL_LEVELS = ["Beginner", "Intermediate", "Advanced", "All Levels"] as const;

export const CreateGameStep = {
  basics: z.object({
    title: z.string().min(3, "Give it a title").max(80, "Keep it under 80 characters"),
    sport: z.string().min(1, "Pick a sport"),
  }),
  venue: z.object({
    // Client-only: drives the slot query. The server resolves the venue from the slot.
    venueId: z.string().min(1, "Pick a venue"),
    slotId: z.string().min(1, "Pick a time slot"),
  }),
  size: z.object({
    slots: z.coerce.number().int().min(2, "At least 2 players").max(100, "At most 100"),
    skillLevel: z.enum(SKILL_LEVELS, { message: "Pick a skill level" }),
  }),
  details: z
    .object({
      description: z.string().max(1000, "Keep it under 1000 characters").optional(),
      paid: z.boolean().optional(),
      costAmount: z.coerce.number().optional(),
      // Payment terms. All optional at the type level and made conditionally required by the
      // refinements below, because a free game must carry none of them — the server nulls the
      // whole block when `costAmount` is 0, so requiring them unconditionally would block the
      // commonest case (a free game) on fields the server is about to discard.
      paymentMethod: z.enum(HOST_PAYMENT_METHODS).optional(),
      hostUpiId: z.string().optional(),
      hostQrUrl: z.string().optional(),
      paymentNote: z.string().max(300, "Keep it under 300 characters").optional(),
      venueNote: z.string().max(300, "Keep it under 300 characters").optional(),
    })
    .refine((d) => !d.paid || (d.costAmount ?? 0) > 0, {
      message: "Enter an amount above ₹0",
      path: ["costAmount"],
    })
    // Mirrors the server's own refine on CreateGameSchema, message and all. Catching it here is
    // what turns the 422 that shipped as a bare "Validation error" toast into an inline error on
    // the chip row the host can actually act on.
    .refine((d) => !d.paid || !!d.paymentMethod, {
      message: "Choose how players pay you",
      path: ["paymentMethod"],
    })
    // A typo'd id is worth catching before submit: the server accepts "" but rejects a malformed
    // value, and a host who fat-fingers their handle would otherwise learn about it from a 422.
    // Gated on `paid` like the rest: the form keeps what was typed when the host toggles back to
    // Free (so switching to Paid again doesn't lose it), and a half-typed id left behind that way
    // must not block a free game that will never send the field.
    .refine((d) => !d.paid || !d.hostUpiId?.trim() || isValidUpiId(d.hostUpiId), {
      message: "That doesn’t look like a UPI ID — they look like name@bank",
      path: ["hostUpiId"],
    })
    // The stricter-than-server rule (see `canCollect`): a UPI game with neither an id nor a QR
    // would tell players to pay by UPI and give them nothing to pay to.
    .refine((d) => !d.paid || canCollect(d.paymentMethod, d.hostUpiId ?? "", d.hostQrUrl ?? ""), {
      message: "Add a UPI ID or a QR code so players can pay you",
      path: ["hostUpiId"],
    }),
} as const;

/** The exact POST /games body (web src/lib/api.ts CreateGameSchema). */
export const CreateGameSchema = z
  .object({
    sport: z.string().min(1),
    title: z.string().min(3).max(80),
    slotId: z.string().min(1),
    slots: z.coerce.number().min(2).max(100),
    skillLevel: z.enum(SKILL_LEVELS),
    cost: z.string().default("Free"),
    // The server caps this at 100000; matched so an over-cap amount fails here rather than at
    // the API with a field the stepper would have to map back to a step.
    costAmount: z.coerce.number().min(0).max(100000).default(0),
    paymentMethod: z.enum(HOST_PAYMENT_METHODS).optional(),
    hostUpiId: z
      .string()
      .trim()
      .refine((v) => v === "" || isValidUpiId(v), "Enter a valid UPI ID, e.g. name@bank")
      .optional(),
    /**
     * Deliberately STRICTER than the server, which takes a bare `z.string().url()` — and that
     * accepts `file:///…`, the exact value a picker hands back. A local uri would pass validation,
     * persist, and render as a broken image for every player on a game that can never be edited.
     * The only legitimate value here is an https URL returned by `POST /upload`.
     */
    hostQrUrl: z
      .url()
      .refine((v) => /^https?:\/\//i.test(v), "Upload the QR first — a local file path won’t load")
      .optional(),
    paymentNote: z.string().max(300).optional(),
    venueNote: z.string().max(300).optional(),
    description: z.string().max(1000).optional(),
    rules: z.array(z.string()).optional(),
  })
  // Server-identical: a paid game must say how players pay; a free one carries no payment block.
  .refine((g) => g.costAmount === 0 || !!g.paymentMethod, {
    message: "Choose how players pay you",
    path: ["paymentMethod"],
  });

export type LoginInput = z.infer<typeof LoginSchema>;
export type RegisterInput = z.infer<typeof RegisterSchema>;
export type CreateGameInput = z.infer<typeof CreateGameSchema>;
