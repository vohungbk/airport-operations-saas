/** The child age bands of the booking form (design D2). The value is stored as written. */
export const CHILD_AGE_BANDS = [
  "0-12 months",
  "12-24 months",
  "24-48 months",
  "4-8 years",
] as const;

export const CHILD_AGE_BAND_HINT = "0-12 months · 12-24 months · 24-48 months · 4-8 years";

/** The bands to offer: a saved value that is not one of them stays selectable. */
export function childAgeBandChoices(current?: string | null): string[] {
  const bands: string[] = [...CHILD_AGE_BANDS];

  return current && !bands.includes(current) ? [current, ...bands] : bands;
}
