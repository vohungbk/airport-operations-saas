/**
 * A technician is a `public.users` row with `role = 'technician'` (there
 * is no separate technicians table). Only the columns the list and detail
 * screens render are selected.
 */
export interface Technician {
  id: string;
  full_name: string;
  email: string;
  is_active: boolean;
  created_at: string;
}

/** A technician with the figures the list shows next to the name. */
export interface TechnicianListRow extends Technician {
  /** Airport of the most recently assigned job; null until the first job. */
  airport_name: string | null;
  airport_code: string | null;
  open_jobs: number;
  jobs_done_this_week: number;
}
