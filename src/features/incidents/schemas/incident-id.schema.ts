import { z } from "zod";

/**
 * `z.guid()` rather than `z.uuid()`: seeded ids are not RFC-variant UUIDs
 * (same choice as the other features' id schemas).
 */
export const incidentIdSchema = z.guid();
