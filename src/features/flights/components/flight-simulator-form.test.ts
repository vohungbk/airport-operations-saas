import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/features/flights/actions/apply-flight-simulation.action", () => ({
  applyFlightSimulationAction: vi.fn(),
}));
vi.mock("@/features/flights/actions/lookup-simulator-flight.action", () => ({
  lookupSimulatorFlightAction: vi.fn(),
}));

import { FlightSimulatorForm } from "@/features/flights/components/flight-simulator-form";

const AIRPORT = { code: "DXB", timezone: "Asia/Dubai" };

const render = (enabled: boolean, airport: typeof AIRPORT | null = AIRPORT) =>
  renderToStaticMarkup(createElement(FlightSimulatorForm, { enabled, airport }));

describe("FlightSimulatorForm (VI-F02-T02, Figma D7)", () => {
  it("should show the source banner in the words of the design when the simulator is the source", () => {
    const html = render(true);

    expect(html).toContain("Simulator source is active. This is simulated flight data.");
    expect(html).not.toContain("The simulator is off");
  });

  it("should show the form card with the scheduled arrival as read-only text and a dash before a flight is chosen", () => {
    const html = render(true);

    expect(html).toContain("Flight simulation form");
    expect(html).toContain("Scheduled arrival: - (read-only)");
  });

  it("should show the three fields with their hints, as the design draws them", () => {
    const html = render(true);

    expect(html).toContain("Flight number *");
    expect(html).toContain("Required · DXB airport context");
    expect(html).toContain("Estimated arrival *");
    expect(html).toContain("Required · Airport time, Asia/Dubai");
    expect(html).toContain("Status *");
    expect(html).toContain("Required · Scheduled, Delayed, Landed, Cancelled, or Diverted");
    expect(html).toContain('type="datetime-local"');
  });

  it("should say only Required under the flight number when there is no airport", () => {
    expect(render(true, null)).not.toContain("airport context");
  });

  it("should show the note, a Cancel link to the Flight board and Apply change", () => {
    const html = render(true);

    expect(html).toContain("Apply change is enabled only when the active source is Simulator.");
    expect(html).toMatch(/<a[^>]*href="\/flights"[^>]*>Cancel<\/a>/);
    expect(html).toContain("Apply change");
  });

  it("should show the four impact lines with a dash before a flight is chosen", () => {
    const html = render(true);

    expect(html).toContain("Calculated operational impact");
    for (const label of ["Change", "New priority", "New installation deadline", "Previous installation deadline"]) {
      expect(html).toContain(label);
    }
    expect(html).not.toContain("Affected bookings");
    expect(html).not.toContain("Technician to notify");
    expect(html).not.toContain("Simulation reason");
  });

  it("should turn the fields and Apply change off and say why when the source is not the simulator", () => {
    const html = render(false);

    expect(html).toContain("The simulator is off");
    expect(html).not.toContain("Simulator source is active");
    expect(html).toMatch(/<button[^>]*disabled[^>]*type="submit"|<button[^>]*type="submit"[^>]*disabled/);
    expect(html).toMatch(/<input[^>]*id="flight_number"[^>]*disabled|<input[^>]*disabled[^>]*id="flight_number"/);
  });
});
