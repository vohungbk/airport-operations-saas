import { defineConfig } from "vitest/config";

/**
 * Vitest config. No jsdom/DOM environment is configured because none of the current tests render
 * React components in a browser; add it only when a test genuinely needs the DOM.
 *
 * Two projects, run one after the other:
 *   - `unit`: every test that does not need the database, in parallel.
 *   - `database`: the integration suites (`*.integration.test.ts`), one file at a time. They read
 *     and write the same local database, and several of them count rows (the dashboard figures,
 *     the demo data) while the RLS suite is adding rows. Run together they disagree now and then,
 *     so the release gate went red without a real fault. One at a time they do not.
 */
export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    environment: "node",
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          include: ["src/**/*.test.ts"],
          exclude: ["**/node_modules/**", "src/**/*.integration.test.ts"],
          sequence: { groupOrder: 1 },
        },
      },
      {
        extends: true,
        test: {
          name: "database",
          include: ["src/**/*.integration.test.ts"],
          fileParallelism: false,
          sequence: { groupOrder: 2 },
        },
      },
    ],
  },
});
