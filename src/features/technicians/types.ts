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
