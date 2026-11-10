"use client";

import { useCallback, useRef, useState } from "react";

import { validatePhotoFile } from "@/features/bookings/lib/booking-photos";
import type { PhotoUploadItem } from "@/lib/field/photo-upload";

/** Sends one photo to the server; resolves with its address. Given by the feature that stores the photos. */
export type SendBookingPhoto = (file: File, onProgress: (percent: number) => void) => Promise<string>;

/**
 * The photos being added on the Photos tab: each file is checked first (a rejected file is named in `errors`
 * and nothing is kept), then sent. With no `send`, an accepted file is shown as failed so it can be retried
 * or removed, because the storage of photos is not built yet.
 */
export function useBookingPhotoUpload(send?: SendBookingPhoto) {
  const [items, setItems] = useState<PhotoUploadItem[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const files = useRef(new Map<string, File>());

  const patch = useCallback((id: string, change: Partial<PhotoUploadItem>) => {
    setItems((current) => current.map((item) => (item.id === id ? { ...item, ...change } : item)));
  }, []);

  const run = useCallback(
    async (id: string, file: File) => {
      patch(id, { status: "uploading", progress: 0 });
      try {
        if (!send) throw new Error("not available");
        const url = await send(file, (progress) => patch(id, { progress }));
        patch(id, { status: "uploaded", thumbnail_url: url });
      } catch {
        patch(id, { status: "failed" });
      }
    },
    [patch, send],
  );

  const addFiles = useCallback(
    (list: FileList | File[]) => {
      const rejected: string[] = [];
      for (const file of Array.from(list)) {
        const reason = validatePhotoFile(file);
        if (reason) {
          rejected.push(reason);
          continue;
        }
        const id = crypto.randomUUID();
        files.current.set(id, file);
        setItems((current) => [...current, { id, file_name: file.name, status: "uploading", progress: 0 }]);
        void run(id, file);
      }
      setErrors(rejected);
    },
    [run],
  );

  const retry = useCallback(
    (id: string) => {
      const file = files.current.get(id);
      if (file) void run(id, file);
    },
    [run],
  );

  const remove = useCallback((id: string) => {
    files.current.delete(id);
    setItems((current) => current.filter((item) => item.id !== id));
  }, []);

  return { items, errors, addFiles, retry, remove };
}
