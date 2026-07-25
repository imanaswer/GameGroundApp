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

export type LoginInput = z.infer<typeof LoginSchema>;
export type RegisterInput = z.infer<typeof RegisterSchema>;
