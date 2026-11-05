"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";

import { runClientAction } from "@/lib/actions/run-client-action";
import { zodResolver } from "@/lib/validation/zod-resolver";
import { applyFlightSimulationAction } from "@/features/flights/actions/apply-flight-simulation.action";
import {
  NETWORK_ERROR,
  type FlightSimulatorResult,
} from "@/features/flights/lib/flight-simulator-errors";
import {
  FLIGHT_SIMULATOR_DEFAULTS,
  flightSimulatorSchema,
  type FlightSimulatorInput,
} from "@/features/flights/schemas/flight-simulator.schema";

/**
 * VI-F02-S12: the state of the Flight simulator form. A call that does not get through becomes a network
 * error and the form keeps what was typed; a field the server refused shows the server's message under it.
 * A successful apply redirects, so there is no success state to hold here.
 */
export function useFlightSimulatorForm() {
  const form = useForm<FlightSimulatorInput>({
    resolver: zodResolver(flightSimulatorSchema),
    defaultValues: FLIGHT_SIMULATOR_DEFAULTS,
  });
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<FlightSimulatorResult | null>(null);

  const onSubmit = form.handleSubmit((values) => {
    setResult(null);
    startTransition(async () => {
      const next = await runClientAction(() => applyFlightSimulationAction(values), NETWORK_ERROR);

      for (const detail of next.error?.details ?? []) {
        form.setError(detail.field as keyof FlightSimulatorInput, { type: "server", message: detail.issue });
      }

      setResult(next);
    });
  });

  return { form, onSubmit, isPending, result };
}
