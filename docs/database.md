# Database

No schema or migrations exist yet. This document records the planned
domains only, as a reference for `F02 — Database Foundation`.

## Planned Domains

- **Identity & Access** — users, tenants, memberships, roles/permissions
- **Partners** — rental-car partner accounts and their staff
- **Airports** — airport locations and partner operating locations
- **Inventory** — seat categories and individually tracked seat units
  (permanent QR passport)
- **Bookings** — rental bookings and their state machine
- **Technician Operations** — assignment of bookings to technicians,
  mobile workflow state
- **Cleaning & Inspection** — turnaround, inspection results, quarantine
- **Finance** — settlement runs, invoices, revenue calculation, launch
  credit
- **Flights** — flight schedule data used to time bookings
- **AI** — partner intelligence derived from the above domains

Every domain above is tenant-scoped (partner or operator) except Airports
and Flights, which are shared reference data.

Schema design, migrations, and RLS policies are out of scope for this task
— see `security.md` for the security principles that will govern them.
