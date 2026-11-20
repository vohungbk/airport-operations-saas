import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = { title: "Invoices" };

interface InvoicesLayoutProps {
  children: ReactNode;
}

/**
 * Title only: the `(dashboard)` layout already provides `AppShell`, and each invoice page checks
 * access itself.
 */
export default function InvoicesLayout({ children }: InvoicesLayoutProps) {
  return <>{children}</>;
}
