import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // `forbidden()` and `forbidden.tsx`: a signed-in user who may not open a page gets a 403
    // inside the shell of the group (UI-F02-S04). Still an experimental option of Next.js.
    authInterrupts: true,
  },
};

export default nextConfig;
