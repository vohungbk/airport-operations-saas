"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";

import { toast } from "@/components/ui/toast";
import { runClientAction } from "@/lib/actions/run-client-action";
import { zodResolver } from "@/lib/validation/zod-resolver";
import { applyFlightSimulationAction } from "@/features/flights/actions/apply-flight-simulation.action";
import { lookupSimulatorFlightAction } from "@/features/flights/actions/lookup-simulator-flight.action";
import {
  NETWORK_ERROR,
  type FlightSimulatorResult,
} from "@/features/flights/lib/flight-simulator-errors";
import { buildSimulatorImpact, type SimulatorFlightPreview } from "@/features/flights/lib/simulator-impact";
import {
  FLIGHT_SIMULATOR_DEFAULTS,
  flightSimulatorSchema,
  type FlightSimulatorInput,
} from "@/features/flights/schemas/flight-simulator.schema";

/** How long the flight number rests before the flight is looked up, so a typed number asks once. */
const LOOKUP_DELAY_MS = 400;

const flightNumberSchema = flightSimulatorSchema.shape.flight_number;

/**
 * VI-F02-S12 and VI-F02-T02: the state of the Flight simulator screen. A call that does not get through becomes a
 * network error and the form keeps what was typed; a field the server refused shows the server's message under it.
 * A saved change shows a success message and opens the Flight status panel of the booking. A valid flight number is
 * looked up (after a short rest) and the operational impact is worked out from the flight and the values typed,
 * before Apply.
 */
export function useFlightSimulatorForm() {
  const router = useRouter();
  const form = useForm<FlightSimulatorInput>({
    resolver: zodResolver(flightSimulatorSchema),
    defaultValues: FLIGHT_SIMULATOR_DEFAULTS,
  });
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<FlightSimulatorResult | null>(null);
  // The answer of the last lookup and the number it was for: an answer for another number is not shown.
  const [lookup, setLookup] = useState<{ number: string; flight: SimulatorFlightPreview | null } | null>(null);

  const [flightNumber, estimated, status] = useWatch({
    control: form.control,
    name: ["flight_number", "estimated_arrival_at", "status"],
  });
  const number = useMemo(() => {
    const parsed = flightNumberSchema.safeParse(flightNumber);
    return parsed.success ? parsed.data : null;
  }, [flightNumber]);

  useEffect(() => {
    if (!number) return;

    let cancelled = false;
    const timer = setTimeout(async () => {
      const next = await runClientAction(() => lookupSimulatorFlightAction({ flight_number: number }), NETWORK_ERROR);

      if (!cancelled) setLookup({ number, flight: next.success ? (next.flight ?? null) : null });
    }, LOOKUP_DELAY_MS);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [number]);

  const preview = number !== null && lookup?.number === number ? lookup.flight : null;
  const impact = useMemo(
    () => buildSimulatorImpact({ preview, estimated_arrival_at: estimated, status }),
    [preview, estimated, status],
  );

  const onSubmit = form.handleSubmit((values) => {
    setResult(null);
    startTransition(async () => {
      const next = await runClientAction(() => applyFlightSimulationAction(values), NETWORK_ERROR);

      for (const detail of next.error?.details ?? []) {
        form.setError(detail.field as keyof FlightSimulatorInput, { type: "server", message: detail.issue });
      }

      setResult(next);

      if (next.success && next.href) {
        toast("Simulated flight change applied", "success");
        router.push(next.href);
      }
    });
  });

  return { form, onSubmit, isPending, result, preview, impact };
}
