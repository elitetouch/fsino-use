/**
 * The vaccines and treatments a farmer can pick by name.
 *
 * ONE LIST, because there were three. The wizard's vaccination step
 * had its own array, its treatment step had another, and quick record
 * parsed against a third — so the same dose reached the medical
 * record as "Multivitamins" from one screen and "vitamin" from the
 * other, and neither matched what the flock's protocol calls it.
 *
 * These labels are what gets WRITTEN into the record (`vaccine_name`,
 * `treatment_type`), so changing one rewrites how new records read.
 * They are the fallback vocabulary: where the flock's own protocol
 * names a row, that name wins over anything here, because it is the
 * one the schedule is counted against.
 */

export const VACCINE_OPTIONS = [
  { value: 'gumboro', label: 'Gumboro' },
  { value: 'newcastle', label: 'Newcastle (Lasota)' },
  { value: 'infectious_bronchitis', label: 'Infectious bronchitis' },
  { value: 'fowl_pox', label: 'Fowl pox' },
  { value: 'marek', label: 'Marek' },
  { value: 'coccidiosis', label: 'Coccidiosis' },
  { value: 'other', label: 'Other (type in)' },
] as const;

export const TREATMENT_OPTIONS = [
  { value: 'anti_biotics', label: 'Anti-biotics' },
  { value: 'anti_fungals', label: 'Anti-fungals' },
  { value: 'anti_virals', label: 'Anti-virals' },
  { value: 'dewormer', label: 'Dewormer' },
  { value: 'multivitamins', label: 'Multivitamins' },
  { value: 'probiotics', label: 'Probiotics' },
  { value: 'other', label: 'Other (type in)' },
] as const;

/**
 * Why a treatment was given. The wizard requires one; quick record
 * fills it from the protocol row's disease target when it can and
 * leaves it empty otherwise.
 */
export const TREATMENT_REASONS = [
  { value: 'prophylactic', label: 'Prophylactic / routine' },
  { value: 'respiratory', label: 'Respiratory illness' },
  { value: 'digestive', label: 'Digestive illness' },
  { value: 'parasites', label: 'Internal / external parasites' },
  { value: 'stress', label: 'Stress (heat, transport, etc.)' },
  { value: 'post_vaccine', label: 'Post-vaccine support' },
  { value: 'other', label: 'Other (type in)' },
] as const;

/** Labels only, for a picker that writes the label straight through. */
export const VACCINE_LABELS: readonly string[] = VACCINE_OPTIONS
  .filter((o) => o.value !== 'other').map((o) => o.label);

export const TREATMENT_LABELS: readonly string[] = TREATMENT_OPTIONS
  .filter((o) => o.value !== 'other').map((o) => o.label);
