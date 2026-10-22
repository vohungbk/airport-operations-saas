import { defineConfig } from "vitest/config";

/**
 * Config of the tools that run on request and are not part of `npm test`:
 * `npm run perf:measure` (VI-F08-S06, a run against a running app, `*.perf.ts`) and
 * `npm run release:report` (VI-F08-S08, `*.report.ts`).
 */
export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    environment: "node",
    include: ["src/**/*.perf.ts", "src/**/*.report.ts"],
    testTimeout: 600_000,
    fileParallelism: false,
  },
});
