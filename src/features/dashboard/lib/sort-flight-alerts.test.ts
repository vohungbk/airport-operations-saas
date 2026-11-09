import { describe, expect, it } from "vitest";

import type { FlightAlertItem } from "@/features/dashboard/lib/get-flight-alerts";
import { sortFlightAlerts } from "@/features/dashboard/lib/sort-flight-alerts";

const alert = (id: string, kind: FlightAlertItem["kind"]): FlightAlertItem => ({
  id,
  flight_number: id,
  kind,
  minutes: 0,
  arrival_label: "15:45",
  booking_number: null,
  deadline_label: null,
});

const ids = (alerts: readonly FlightAlertItem[]) => alerts.map((item) => item.id);

describe("sortFlightAlerts", () => {
  it("should put the early flight first, then the flags, then the delay", () => {
    const sorted = sortFlightAlerts([
      alert("late", "delayed"),
      alert("flag", "cancelled"),
      alert("soon", "early"),
    ]);

    expect(ids(sorted)).toEqual(["soon", "flag", "late"]);
  });

  it("should keep the incoming order for alerts of the same rank", () => {
    const sorted = sortFlightAlerts([alert("a", "cancelled"), alert("b", "diverted")]);

    expect(ids(sorted)).toEqual(["a", "b"]);
  });

  it("should return an empty list and leave the input untouched", () => {
    const input = [alert("late", "delayed"), alert("soon", "early")];

    expect(sortFlightAlerts([])).toEqual([]);
    sortFlightAlerts(input);
    expect(ids(input)).toEqual(["late", "soon"]);
  });
});
