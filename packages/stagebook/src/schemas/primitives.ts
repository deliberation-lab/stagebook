/**
 * Tiny schema primitives shared between `reference.ts` and `treatment.ts`.
 * Lives in its own file so `reference.ts` (imported by the cross-stage
 * walker) can pull `nameSchema` without dragging in `treatment.ts`'s
 * import-cycle with the walker.
 */

import { z } from "zod";

// Names should have properties:
// max length: 64 characters
// min length: 1 character
// allowed characters: a-z, A-Z, 0-9, -, _, and space
// Plus optional `${field}` template placeholders.
export const nameSchema = z
  .string()
  .min(1, "Name is required")
  .max(64)
  .regex(/^(?:[a-zA-Z0-9 _-]|\$\{[a-zA-Z0-9_]+\})+$/, {
    message:
      "Name must be alphanumeric, cannot have special characters, with optional template fields in the format ${fieldname}",
  });
export type NameType = z.infer<typeof nameSchema>;
