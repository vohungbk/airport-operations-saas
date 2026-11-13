import { JobStatusBadge } from "@/features/jobs/components/job-status-badge";
import {
  KeyValue,
  NONE,
  SectionCard,
  terminalLabel,
} from "@/features/jobs/components/today-parts";
import type { TodayJob } from "@/features/jobs/lib/todays-jobs";

interface TodayJobCardProps {
  job: TodayJob;
}

/** `DXB · Terminal 3 · Bay C-14`: the airport, the terminal of the flight and the bay, whichever are known. */
function locationOf(job: TodayJob): string {
  const terminal = job.flight?.terminal;
  const parts = [
    job.airport?.code,
    terminal && terminalLabel(terminal),
    job.vehicle_bay && `Bay ${job.vehicle_bay}`,
  ].filter(Boolean);

  return parts.length > 0 ? parts.join(" · ") : NONE;
}

/**
 * The job to do first, as the design draws it (UI-F07-S01, spec R1). The partner is the name given to the
 * technician (VI-F11-T02). The job number and the deadline have no source yet (no job number column, no
 * deadline formula), so they are a dash.
 */
export function TodayJobCard({ job }: TodayJobCardProps) {
  return (
    <SectionCard title={NONE}>
      <div>
        <JobStatusBadge status={job.status} />
      </div>
      <KeyValue label="Booking" mono>
        {job.booking_number}
      </KeyValue>
      <KeyValue label="Partner">{job.partner_name ?? NONE}</KeyValue>
      <KeyValue label="Location">{locationOf(job)}</KeyValue>
      <KeyValue label="Vehicle">{job.vehicle ?? NONE}</KeyValue>
      <KeyValue label="Required category">
        {job.required_category ?? NONE}
      </KeyValue>
      <KeyValue label="Assigned seat" mono>
        {job.seat ?? NONE}
      </KeyValue>
      <KeyValue label="Technician">{job.technician ?? NONE}</KeyValue>
      <KeyValue
        label={`Deadline${job.airport ? ` · ${job.airport.timezone}` : ""}`}
      >
        {NONE}
      </KeyValue>
    </SectionCard>
  );
}
