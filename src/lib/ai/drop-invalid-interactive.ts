import { interactiveExerciseSchema } from "@/lib/ai/schemas";

// QA fix (2026-10-06): `interactive` is an optional enhancement on a content
// block (the reader falls back to plain items without it), but a single
// malformed one - seen live: `{ "type": "multiple_choice" }` with no
// question/options from the free-tier model - failed schema validation for
// the WHOLE unit side, and after the step's retries the entire run died.
// Used from the generateObject repair hook: any `interactive` value that
// doesn't satisfy its schema is dropped, everything else is kept.
export function dropInvalidInteractive(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(dropInvalidInteractive);
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      if (key === "interactive" && !interactiveExerciseSchema.safeParse(child).success) continue;
      out[key] = dropInvalidInteractive(child);
    }
    return out;
  }
  return value;
}
