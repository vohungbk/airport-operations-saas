import type { ReactNode } from "react";

import { ThemeControl } from "@/components/theme/theme-control";

interface AuthLayoutProps {
  children: ReactNode;
}

export default function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <div className="relative flex flex-1 flex-col items-center justify-center bg-background px-6 py-12">
      <div className="absolute top-4 right-4 print:hidden">
        <ThemeControl />
      </div>
      <div className="w-full max-w-sm">{children}</div>
    </div>
  );
}
