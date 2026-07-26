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
 * web src/lib/api.ts CreateGameSchema (§3.3). Split per stepper step so each step
 * validates independently before advancing (§7). Server is still the referee on slots.
 */
export const CreateGameStep = {
  basics: z.object({
    title: z.string().min(3, "Give it a title").max(80, "Keep it under 80 characters"),
    sport: z.string().min(1, "Pick a sport"),
  }),
  venue: z.object({
    venueId: z.string().min(1, "Pick a venue"),
    slotId: z.string().min(1, "Pick a time slot"),
  }),
  size: z.object({
    slotsTotal: z.coerce.number().int().min(2, "At least 2 players").max(50, "At most 50"),
    skillLevel: z.string().optional(),
  }),
  details: z.object({
    description: z.string().max(500, "Keep it under 500 characters").optional(),
  }),
} as const;

export const CreateGameSchema = CreateGameStep.basics
  .and(CreateGameStep.venue)
  .and(CreateGameStep.size)
  .and(CreateGameStep.details);

export type LoginInput = z.infer<typeof LoginSchema>;
export type RegisterInput = z.infer<typeof RegisterSchema>;
export type CreateGameInput = z.infer<typeof CreateGameSchema>;
