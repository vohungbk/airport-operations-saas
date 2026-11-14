"use client";

import { useState, type ChangeEvent, type DragEvent } from "react";

import { isCsvFile } from "@/features/bookings/lib/csv-file";

/**
 * CO-F07-S01: the file of the import screen, chosen with the file picker or dropped on the area.
 * Only a CSV is kept; any other file is ignored and the one chosen before stays.
 */
export function useCsvDropzone() {
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const take = (files: FileList | null) => {
    const picked = files?.[0];
    if (picked && isCsvFile(picked)) setFile(picked);
  };

  return {
    file,
    isDragging,
    onChange: (event: ChangeEvent<HTMLInputElement>) => {
      take(event.target.files);
      // The same file can be chosen again after it was replaced.
      event.target.value = "";
    },
    onDragOver: (event: DragEvent<HTMLElement>) => {
      event.preventDefault();
      setIsDragging(true);
    },
    onDragLeave: () => setIsDragging(false),
    onDrop: (event: DragEvent<HTMLElement>) => {
      event.preventDefault();
      setIsDragging(false);
      take(event.dataTransfer.files);
    },
  };
}
