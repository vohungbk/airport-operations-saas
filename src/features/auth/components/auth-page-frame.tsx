import type { ReactNode } from "react";
import { PlaneIcon } from "lucide-react";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface AuthPageFrameProps {
  /** The page heading, and the title of the card (the design uses the same words for both). */
  title: string;
  children: ReactNode;
}

/**
 * The frame the sign in and sign up designs share: the page heading, the product name with the plane,
 * the card that holds the form, and the protected workspace line under it.
 */
export function AuthPageFrame({ title, children }: AuthPageFrameProps) {
  return (
    <>
      <header className="mb-8 flex flex-col gap-2 lg:absolute lg:top-8 lg:left-8 lg:mb-0">
        <h1 className="text-display font-semibold text-text">{title}</h1>
        <p className="text-body text-text-muted">
          Secure access to Airport Operations SaaS
        </p>
      </header>

      <div className="flex flex-col gap-6">
        <div className="flex items-center gap-3">
          <PlaneIcon
            aria-hidden="true"
            strokeWidth={1.75}
            className="size-6 shrink-0 text-primary"
          />
          <p className="text-h2 font-semibold text-text">Airport Operations</p>
        </div>

        <Card className="gap-4 rounded-xl border border-border bg-surface py-5 ring-0">
          <CardHeader className="px-5">
            <CardTitle className="text-h3 font-semibold text-text">
              {title}
            </CardTitle>
          </CardHeader>
          <CardContent className="px-5">{children}</CardContent>
        </Card>

        <p className="text-body text-text-muted">
          Protected workspace · Tenant-scoped access · © 2026 Airport Operations
        </p>
      </div>
    </>
  );
}
