import type { ReactNode } from "react";

import { MAIN_CONTENT_ID, SkipLink } from "@/components/shared/skip-link";

interface AuthLayoutProps {
  children: ReactNode;
}

export default function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <div className="relative flex flex-1 flex-col items-center justify-center bg-background px-6 py-12">
      <SkipLink />
      <main
        id={MAIN_CONTENT_ID}
        tabIndex={-1}
        className="w-full max-w-105 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        {children}
      </main>
    </div>
  );
}
