import type { ReactNode } from "react";

interface AuthLayoutProps {
  children: ReactNode;
}

export default function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center bg-background px-6 py-12">
      <div className="w-full max-w-sm">{children}</div>
    </div>
  );
}
