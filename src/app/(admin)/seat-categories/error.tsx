"use client";

import { PageError } from "@/components/shared/page-error";

interface SeatCategoriesErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function SeatCategoriesError({ reset }: SeatCategoriesErrorProps) {
  return <PageError title="Could not load seat categories" reset={reset} />;
}
