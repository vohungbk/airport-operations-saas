import type { ReactNode } from "react";
import Link from "next/link";

import { Skeleton } from "@/components/ui/skeleton";

interface JobFormCrumb {
  label: string;
  href?: string;
}

interface JobFormPageProps {
  crumbs: JobFormCrumb[];
  title: string;
  description: string;
  children: ReactNode;
}

/** The heading block shared by Create job and Edit job, in the page and while it loads. */
export function JobFormPage({
  crumbs,
  title,
  description,
  children,
}: JobFormPageProps) {
  return (
    <div className="flex flex-1 flex-col gap-6 p-8">
      <div className="flex flex-col gap-2">
        <nav aria-label="Breadcrumb">
          <ol className="flex flex-wrap items-center gap-1 text-xs text-text-muted">
            {crumbs.map((crumb, index) => (
              <li key={crumb.label} className="flex items-center gap-1">
                {index > 0 && <span aria-hidden="true">/</span>}
                {crumb.href ? (
                  <Link href={crumb.href} className="hover:underline">
                    {crumb.label}
                  </Link>
                ) : (
                  <span aria-current="page">{crumb.label}</span>
                )}
              </li>
            ))}
          </ol>
        </nav>
        <h1 className="text-2xl leading-8 font-semibold text-primary-subtle-foreground">
          {title}
        </h1>
        <p className="text-sm text-text-muted">{description}</p>
      </div>
      {children}
    </div>
  );
}

interface JobFormSkeletonProps {
  cardDescription: string;
  /** Edit job shows the Job ID, status and last updated strip above the card. */
  withMeta?: boolean;
}

/** The Job assignment card with its fields as placeholders, for the loading state. */
export function JobFormSkeleton({
  cardDescription,
  withMeta = false,
}: JobFormSkeletonProps) {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label="Loading"
      className="mx-auto flex w-full max-w-xl flex-col gap-4"
    >
      {withMeta && (
        <div className="grid grid-cols-3 gap-4 rounded-xl border bg-surface p-4">
          <Skeleton className="h-9" />
          <Skeleton className="h-9" />
          <Skeleton className="h-9" />
        </div>
      )}
      <div className="overflow-hidden rounded-xl border bg-surface">
        <div className="flex flex-col gap-5 p-6">
          <div className="flex flex-col gap-1">
            <h2 className="text-base font-semibold text-foreground">
              Job assignment
            </h2>
            <p className="text-sm text-text-muted">{cardDescription}</p>
          </div>
          {[0, 1, 2].map((field) => (
            <div key={field} className="flex flex-col gap-2">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-11 w-full" />
              <Skeleton className="h-3 w-3/4" />
            </div>
          ))}
        </div>
        <div className="flex items-center justify-end gap-3 border-t px-6 py-4">
          <Skeleton className="h-11 w-20" />
          <Skeleton className="h-11 w-20" />
        </div>
      </div>
    </div>
  );
}
