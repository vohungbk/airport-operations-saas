import { flightSnapshotSchema, type FlightSnapshot, type FlightSourceAdapter } from "./flight-source";
import { ProviderError, toProviderErrorKind } from "./provider-error";

/** A provider that does not answer in this time fails the call instead of hanging it (spec R12). */
const PROVIDER_TIMEOUT_MS = 10_000;

const UNEXPECTED_ANSWER = "Flight provider answered with an unexpected flight";

interface ProviderAdapterOptions {
  base_url: string;
  provider_key: string;
  fetchImpl?: typeof fetch;
}

/**
 * The live provider. The provider is not chosen yet (spec Q1), so this speaks a plain HTTP
 * contract: `GET {base_url}/flights/{flight_number}` with a bearer key, answering a flight in the
 * shape of `flightSnapshotSchema`. Mapping a real provider's answer belongs to the story that
 * picks one. The key is sent to the provider only; it is never returned or logged.
 */
export function createProviderAdapter({
  base_url,
  provider_key,
  fetchImpl = fetch,
}: ProviderAdapterOptions): FlightSourceAdapter {
  return {
    source: "provider",
    async fetchFlight(flight_number: string): Promise<FlightSnapshot | null> {
      const url = `${base_url.replace(/\/+$/, "")}/flights/${encodeURIComponent(flight_number)}`;
      let response: Response;
      try {
        response = await fetchImpl(url, {
          headers: { Authorization: `Bearer ${provider_key}`, Accept: "application/json" },
          cache: "no-store",
          signal: AbortSignal.timeout(PROVIDER_TIMEOUT_MS),
        });
      } catch (error) {
        // No cause is kept: it could carry the address or the key.
        throw new ProviderError(toProviderErrorKind(error), "Flight provider request failed");
      }

      if (response.status === 404) {
        return null;
      }

      if (response.status === 429) {
        throw new ProviderError("rate_limited", "Flight provider rate limit reached");
      }

      if (!response.ok) {
        throw new ProviderError("unavailable", `Flight provider answered with status ${response.status}`);
      }

      let body: unknown;
      try {
        body = await response.json();
      } catch (error) {
        // The timeout also covers reading the body; anything else that is not JSON is an unexpected answer.
        throw new ProviderError(
          toProviderErrorKind(error) === "timeout" ? "timeout" : "invalid_response",
          UNEXPECTED_ANSWER,
        );
      }

      const parsed = flightSnapshotSchema.safeParse(body);
      if (!parsed.success) {
        throw new ProviderError("invalid_response", UNEXPECTED_ANSWER);
      }

      return parsed.data;
    },
  };
}
