/**
 * Builds a zod schema from a field spec (M9). Pure + testable — the same field list drives
 * validation here and the rendered inputs in RegistrationForm, so the two can never drift.
 */
import { z, type ZodTypeAny } from "zod";

import type { Field } from "./entities";

export function schemaFromFields(fields: Field[]): z.ZodObject<Record<string, ZodTypeAny>> {
  const shape: Record<string, ZodTypeAny> = {};
  for (const f of fields) {
    if (f.type === "number") {
      let n = z.coerce.number({ message: `${f.label} is required` }).int();
      if (f.min !== undefined) n = n.min(f.min, `${f.label} must be at least ${f.min}`);
      if (f.max !== undefined) n = n.max(f.max, `${f.label} must be at most ${f.max}`);
      shape[f.key] = f.required ? n : n.optional();
    } else if (f.type === "select") {
      const base = z.enum(f.options as [string, ...string[]]);
      shape[f.key] = f.required ? base : base.optional();
    } else {
      const base = z.string();
      shape[f.key] = f.required ? base.trim().min(1, `${f.label} is required`) : base.optional();
    }
  }
  return z.object(shape);
}
