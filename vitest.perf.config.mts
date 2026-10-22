import { defineConfig } from "vitest/config";

/**
 * Config of `npm run perf:measure` (VI-F08-S06). The measurement is a run against
 * a running app, so it is not part of `npm test`: it only matches `*.perf.ts`.
 */
export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    environment: "node",
    include: ["src/**/*.perf.ts"],
    testTimeout: 600_000,
    fileParallelism: false,
  },
});
