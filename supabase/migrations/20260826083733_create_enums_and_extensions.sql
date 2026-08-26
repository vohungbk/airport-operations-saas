-- F02: enums, extensions, and shared trigger helper.
-- RLS is intentionally NOT part of this migration set (deferred to F05 —
-- Multi-tenancy + RLS); see docs/database.md for the scoped exception.

create extension if not exists pgcrypto;

create type user_role as enum (
  'operator_admin',
  'partner_admin',
  'partner_staff',
  'technician'
);

create type partner_status as enum (
  'pending',
  'active',
  'suspended',
  'inactive'
);

create type seat_status as enum (
  'available',
  'reserved',
  'in_use',
  'cleaning',
  'inspection',
  'quarantine',
  'retired'
);

create type booking_status as enum (
  'pending',
  'confirmed',
  'assigned',
  'in_progress',
  'completed',
  'cancelled',
  'no_show'
);

create type technician_job_status as enum (
  'assigned',
  'in_progress',
  'completed',
  'cancelled'
);

create type inspection_result as enum (
  'pass',
  'conditional_pass',
  'fail'
);

create type incident_status as enum (
  'open',
  'investigating',
  'resolved',
  'closed'
);

create type incident_severity as enum (
  'low',
  'medium',
  'high',
  'critical'
);

create type invoice_status as enum (
  'draft',
  'issued',
  'paid',
  'overdue',
  'void'
);

create type settlement_status as enum (
  'draft',
  'pending_approval',
  'approved',
  'paid'
);

create type flight_status as enum (
  'scheduled',
  'delayed',
  'landed',
  'cancelled',
  'diverted'
);

create function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- Rollback (run manually against the target database if needed):
-- drop function if exists set_updated_at();
-- drop type if exists flight_status;
-- drop type if exists settlement_status;
-- drop type if exists invoice_status;
-- drop type if exists incident_severity;
-- drop type if exists incident_status;
-- drop type if exists inspection_result;
-- drop type if exists technician_job_status;
-- drop type if exists booking_status;
-- drop type if exists seat_status;
-- drop type if exists partner_status;
-- drop type if exists user_role;
-- drop extension if exists pgcrypto;
