import { z } from "zod";

/**
 * Shared contracts between the web frontend and the api backend.
 * These Zod schemas are the single source of truth for request/response
 * shapes: the backend validates incoming payloads against them, and the
 * frontend can reuse them for form validation and typed API calls.
 */

// ---------- Auth ----------

export const registerSchema = z.object({
  email: z.string().email(),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(128),
});
export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});
export type LoginInput = z.infer<typeof loginSchema>;

// ---------- User ----------

export const userRoleSchema = z.enum(["user", "admin"]);
export type UserRole = z.infer<typeof userRoleSchema>;

export interface PublicUser {
  id: string;
  email: string;
  role: UserRole;
  createdAt: string;
}

// ---------- Calculations ----------

/**
 * Per-calculator inputs/results are stored as flexible JSON so new
 * calculators can be added without database migrations.
 */
export const createCalculationSchema = z.object({
  calculatorSlug: z.string().min(1).max(64),
  title: z.string().min(1).max(120).optional(),
  inputs: z.record(z.unknown()),
  results: z.record(z.unknown()),
});
export type CreateCalculationInput = z.infer<typeof createCalculationSchema>;

export const updateCalculationSchema = createCalculationSchema.partial();
export type UpdateCalculationInput = z.infer<typeof updateCalculationSchema>;

export interface Calculation {
  id: string;
  userId: string;
  calculatorSlug: string;
  title: string | null;
  inputs: Record<string, unknown>;
  results: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}
