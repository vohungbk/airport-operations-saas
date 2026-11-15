"use client";

import { useEffect, useState, type ChangeEvent } from "react";

import { checkImportFileMeta } from "@/features/bookings/lib/booking-import-file";

/**
 * CO-F07-S01, S02: the file of the import screen, chosen with the file picker or dropped on the area.
 * The last file chosen is kept even when it is refused (not a CSV, too large), so the screen can say
 * why; `fileError` is that refusal, decided before a byte of the file is read (E1). The drop area is
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
      if (dropped) setFile(dropped);
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
    fileError: file ? checkImportFileMeta(file) : null,
    isDragging,
    bindArea: setArea,
    onChange: (event: ChangeEvent<HTMLInputElement>) => {
      const picked = event.target.files?.[0];
      if (picked) setFile(picked);
      // The same file can be chosen again after it was replaced.
      event.target.value = "";
    },
  };
}
