import type { FlightBoardAlert } from "@/features/flights/lib/flight-board";

interface FlightBoardBannersProps {
  alerts: readonly FlightBoardAlert[];
}

/**
 * The banners of the Flight board design: the title says how early or late the flight is, the line under
 * it says what is stored (the estimate and the moved deadline). Who was notified is not stored, so it is
 * not written. The text carries the meaning, not the color.
 */
export function FlightBoardBanners({ alerts }: FlightBoardBannersProps) {
  if (alerts.length === 0) return null;

  return (
    <ul aria-label="Flight alerts" className="flex flex-col gap-2.5">
      {alerts.map((alert) => (
        <li
          key={alert.key}
          data-kind={alert.kind}
          className="flex min-w-0 flex-col gap-1.5 rounded-[10px] border border-info-fg bg-info-bg p-3.5 text-xs text-info-fg"
        >
          <p className="font-semibold break-words">{alert.title}</p>
          <p className="break-words">{alert.detail}</p>
        </li>
      ))}
    </ul>
  );
}
