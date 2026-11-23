import type { z } from "zod";

/** Uniform result for server actions consumed by <ActionForm>. */
export type ActionState = {
  ok?: boolean;
  error?: string;
  message?: string;
  fieldErrors?: Record<string, string>;
  /** Monotonic marker so the client can react to repeated successes. */
  at?: number;
} | null;

export function ok(message?: string): ActionState {
  return { ok: true, message, at: Date.now() };
}

export function fail(error: string, fieldErrors?: Record<string, string>): ActionState {
  return { ok: false, error, fieldErrors, at: Date.now() };
}

/** Validate FormData against a zod schema; on failure returns field errors keyed by path. */
export function parseForm<T extends z.ZodTypeAny>(
  schema: T,
  input: Record<string, unknown>,
): { data: z.infer<T>; fieldErrors?: undefined } | { data?: undefined; fieldErrors: Record<string, string> } {
  const result = schema.safeParse(input);
  if (result.success) return { data: result.data };
  const fieldErrors: Record<string, string> = {};
  for (const issue of result.error.issues) {
    const key = issue.path.join(".");
    if (!fieldErrors[key]) fieldErrors[key] = issue.message;
  }
  return { fieldErrors };
}

export function formObject(fd: FormData): Record<string, string> {
  const obj: Record<string, string> = {};
  for (const [k, v] of fd.entries()) if (typeof v === "string") obj[k] = v;
  return obj;
}
