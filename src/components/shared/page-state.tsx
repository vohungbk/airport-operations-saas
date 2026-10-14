import type { ReactNode } from "react";
import Link from "next/link";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Shared page-state pattern (loading, empty, success, forbidden, not
 * found). The error state lives in `page-error.tsx` because it needs a
 * client boundary. Feature pages must use these instead of hand-rolling
 * markup, so every state looks the same across features.
 */

export const DEFAULT_EMPTY_MESSAGE = "No records found.";
export const DEFAULT_FORBIDDEN_TITLE = "Access denied";
export const DEFAULT_FORBIDDEN_DESCRIPTION =
  "You don't have permission to view this page. If you think this is a mistake, contact your administrator.";
export const DEFAULT_NOT_FOUND_TITLE = "Page not found";
export const DEFAULT_NOT_FOUND_DESCRIPTION =
  "The page you are looking for does not exist or was moved.";

export function PageLoading() {
  return (
    <div
      className="flex flex-1 flex-col gap-6 p-8"
      role="status"
      aria-busy="true"
      aria-label="Loading"
    >
      <div className="h-8 w-48 animate-pulse rounded-md bg-muted" />
      <div className="h-9 w-full max-w-md animate-pulse rounded-md bg-muted" />
      <div className="h-64 w-full animate-pulse rounded-md bg-muted" />
    </div>
  );
}

interface PageEmptyProps {
  message?: string;
  className?: string;
}

export function PageEmpty({
  message = DEFAULT_EMPTY_MESSAGE,
  className,
}: PageEmptyProps) {
  return (
    <p className={cn("text-sm text-muted-foreground", className)}>{message}</p>
  );
}

interface PageSuccessProps {
  title: string;
  description?: string;
}

export function PageSuccess({ title, description }: PageSuccessProps) {
  return (
    <Alert variant="success">
      <AlertTitle>{title}</AlertTitle>
      {description ? <AlertDescription>{description}</AlertDescription> : null}
    </Alert>
  );
}

interface PageMessageProps {
  title: string;
  description: string;
  children?: ReactNode;
}

function PageMessage({ title, description, children }: PageMessageProps) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 bg-background px-6 text-center">
      <h1 className="text-2xl font-semibold tracking-tight text-foreground">
        {title}
      </h1>
      <p className="max-w-sm text-sm text-muted-foreground">{description}</p>
      {children}
    </div>
  );
}

interface PageForbiddenProps {
  title?: string;
  description?: string;
  children?: ReactNode;
}

export function PageForbidden({
  title = DEFAULT_FORBIDDEN_TITLE,
  description = DEFAULT_FORBIDDEN_DESCRIPTION,
  children,
}: PageForbiddenProps) {
  return (
    <PageMessage title={title} description={description}>
      {children}
    </PageMessage>
  );
}

interface PageNotFoundProps {
  title?: string;
  description?: string;
  backHref?: string;
  backLabel?: string;
}

export function PageNotFound({
  title = DEFAULT_NOT_FOUND_TITLE,
  description = DEFAULT_NOT_FOUND_DESCRIPTION,
  backHref = "/",
  backLabel = "Go back",
}: PageNotFoundProps) {
  return (
    <PageMessage title={title} description={description}>
      <Link href={backHref} className={buttonVariants({ variant: "outline" })}>
        {backLabel}
      </Link>
    </PageMessage>
  );
}
