import { requireAnyPermission } from "@/lib/auth/current-user";
import { JOBS_ACCESS_PERMISSIONS, hasPermission } from "@/lib/auth/permissions";
import { PhotoViewerDenied } from "@/features/bookings/components/photo-viewer-denied";
import { PhotoViewerScreen } from "@/features/bookings/components/photo-viewer-screen";
import { getBookingPhotos } from "@/features/bookings/lib/get-booking-photos";
import { getJobById } from "@/features/jobs/lib/get-job-by-id";
import { JOB_TYPE_LABEL } from "@/features/jobs/lib/job-type";

interface JobPhotosPageProps {
  params: Promise<{ id: string }>;
}

/**
 * The photos of one job's record (FO-F06-S05). RLS hides a job that is not the user's the same way as a
 * missing one, and the photos follow the booking's scope, so the denied state does not say which of the
 * two it is.
 */
export default async function JobPhotosPage({ params }: JobPhotosPageProps) {
  const user = await requireAnyPermission(JOBS_ACCESS_PERMISSIONS);
  const { id } = await params;
  const job = await getJobById(id);

  if (!job?.booking) {
    return <PhotoViewerDenied links={[]} backHref="/jobs" />;
  }

  const { booking } = job;
  const { photos, failed } = await getBookingPhotos(booking.id);
  const recordLabel = `${JOB_TYPE_LABEL[job.job_type]} record`;
  const seat = booking.seat;
  const airport = booking.airport;

  return (
    <PhotoViewerScreen
      photos={photos}
      failed={failed}
      timeZone={airport?.timezone ?? "UTC"}
      links={[
        { label: "← Back to record", href: `/jobs/${job.id}/${job.job_type}` },
        ...(seat && hasPermission(user.role, "seats:manage") ? [{ label: "Back to seat history", href: `/seats/${seat.id}` }] : []),
      ]}
      subtitle={[recordLabel, seat?.serial_number, airport && `${airport.name} (${airport.code})`].filter(Boolean).join(" · ")}
      scope="record"
      contextLabel={[seat?.serial_number, recordLabel].filter(Boolean).join(" · ")}
    />
  );
}
