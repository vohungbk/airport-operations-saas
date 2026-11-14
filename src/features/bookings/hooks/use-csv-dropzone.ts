"use client";

import { useEffect, useState, type ChangeEvent } from "react";

import { isCsvFile } from "@/features/bookings/lib/csv-file";

/**
 * CO-F07-S01: the file of the import screen, chosen with the file picker or dropped on the area.
 * Only a CSV is kept; any other file is ignored and the one chosen before stays. The drop area is
 * a label that opens the picker on a click, so the drag events are bound to it here: pass `bindArea` as its `ref`.
 */
export function useCsvDropzone() {
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [area, setArea] = useState<HTMLElement | null>(null);

  useEffect(() => {
    if (!area) return;

    const onDragOver = (event: DragEvent) => {
      event.preventDefault();
      setIsDragging(true);
    };
    const onDragLeave = () => setIsDragging(false);
    const onDrop = (event: DragEvent) => {
      event.preventDefault();
      setIsDragging(false);
      const dropped = event.dataTransfer?.files?.[0];
      if (dropped && isCsvFile(dropped)) setFile(dropped);
    };

    area.addEventListener("dragover", onDragOver);
    area.addEventListener("dragleave", onDragLeave);
    area.addEventListener("drop", onDrop);
    return () => {
      area.removeEventListener("dragover", onDragOver);
      area.removeEventListener("dragleave", onDragLeave);
      area.removeEventListener("drop", onDrop);
    };
  }, [area]);

  return {
    file,
    isDragging,
    bindArea: setArea,
    onChange: (event: ChangeEvent<HTMLInputElement>) => {
      const picked = event.target.files?.[0];
      if (picked && isCsvFile(picked)) setFile(picked);
      // The same file can be chosen again after it was replaced.
      event.target.value = "";
    },
  };
}
