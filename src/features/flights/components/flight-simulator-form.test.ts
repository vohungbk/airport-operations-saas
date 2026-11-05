import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/features/flights/actions/apply-flight-simulation.action", () => ({
  applyFlightSimulationAction: vi.fn(),
}));

import { FlightSimulatorForm } from "@/features/flights/components/flight-simulator-form";

const render = (enabled: boolean) => renderToStaticMarkup(createElement(FlightSimulatorForm, { enabled }));

describe("FlightSimulatorForm (VI-F02-S12)", () => {
  it("should show the flight number, the estimated arrival and the status", () => {
    const html = render(true);

    expect(html).toContain('id="flight_number"');
    expect(html).toContain('id="estimated_arrival_at"');
    expect(html).toContain('type="datetime-local"');
    expect(html).toContain('id="status"');
    expect(html).toContain("Scheduled");
  });

  it("should offer Apply and a Cancel link to the Flight board", () => {
    const html = render(true);

    expect(html).toContain("Apply");
    expect(html).toMatch(/<a[^>]*href="\/flights"[^>]*>Cancel<\/a>/);
  });

  it("should turn Apply off and say why when the source is not the simulator", () => {
    const html = render(false);

    expect(html).toContain("The simulator is off");
    expect(html).toMatch(/<button[^>]*disabled[^>]*type="submit"|<button[^>]*type="submit"[^>]*disabled/);
  });

  it("should not show the off message when the simulator is the source", () => {
    expect(render(true)).not.toContain("The simulator is off");
  });
});
