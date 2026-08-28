import { defineConfig } from "vitest/config";

/**
 * Minimal Vitest config for F03 QA: unit/integration tests for pure
 * logic and mocked-Supabase-boundary code under src/**. No jsdom/DOM
 * environment is configured because none of the current tests render
 * React components — add it only when a test genuinely needs the DOM.
 */
export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
