import { z } from "zod";

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
    })
    .refine((d) => !d.paid || (d.costAmount ?? 0) > 0, {
      message: "Enter an amount above ₹0",
      path: ["costAmount"],
    }),
} as const;

/** The exact POST /games body (web src/lib/api.ts CreateGameSchema). */
export const CreateGameSchema = z.object({
  sport: z.string().min(1),
  title: z.string().min(3).max(80),
  slotId: z.string().min(1),
  slots: z.coerce.number().min(2).max(100),
  skillLevel: z.enum(SKILL_LEVELS),
  cost: z.string().default("Free"),
  costAmount: z.coerce.number().default(0),
  description: z.string().max(1000).optional(),
  rules: z.array(z.string()).optional(),
});

export type LoginInput = z.infer<typeof LoginSchema>;
export type RegisterInput = z.infer<typeof RegisterSchema>;
export type CreateGameInput = z.infer<typeof CreateGameSchema>;
