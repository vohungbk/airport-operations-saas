import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // `forbidden()` and `forbidden.tsx`: a signed-in user who may not open a page gets a 403
    // inside the shell of the group (UI-F02-S04). Still an experimental option of Next.js.
    authInterrupts: true,
    // The booking import (CO-F07-S02) sends a CSV file in a Server Action. The default limit is 1 MB;
    // this stays above `BOOKING_IMPORT_MAX_FILE_BYTES` so a file over it is answered by our own check.
    serverActions: { bodySizeLimit: "6mb" },
  },
};

export default nextConfig;
