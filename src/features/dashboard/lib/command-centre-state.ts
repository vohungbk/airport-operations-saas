interface CommandCentreFigures {
  arrivalsToday: number | null;
  installationsDue: number | null;
  overdueTasks: number | null;
  flightAlertCount: number;
}

/**
 * Pure. Nothing needs attention only when every figure was read and is zero and no flight alert is shown.
 * A figure that could not be read (`null`) is never counted as zero (spec VI-F11, Empty state).
 */
export function isNothingToAttend({
  arrivalsToday,
  installationsDue,
  overdueTasks,
  flightAlertCount,
}: CommandCentreFigures): boolean {
  return (
    arrivalsToday === 0 &&
    installationsDue === 0 &&
    overdueTasks === 0 &&
    flightAlertCount === 0
  );
}
