"use client";

import { useCallback, useEffect, useState } from "react";

import { createClient } from "@/lib/supabase/client";
import { validatePhotoFile } from "@/features/bookings/lib/booking-photos";
import { chainStepPhotoPath, RETURN_CHAIN_PHOTO_BUCKET } from "@/features/return-queue/lib/chain-step-photos";
import type { RecordedChainStep } from "@/features/return-queue/lib/return-chain";
import type { PhotoUploadStatus } from "@/lib/field/photo-upload";

export interface ChainStepPhoto {
  id: string;
  file_name: string;
  status: PhotoUploadStatus;
  /** Where the photo is stored, set once it is uploaded. */
  path?: string;
}

/**
 * The photos of a chain step: each file is checked first (a rejected file is
 * named in `errors`), then sent straight to the private photo bucket from the
 * browser. Storage policies decide who may add a photo. `onPathsChange` gets
 * the paths of the uploaded photos after every change.
 */
export function useChainStepPhotos(
  bookingId: string,
  step: RecordedChainStep,
  onPathsChange: (paths: string[]) => void,
) {
  const [photos, setPhotos] = useState<ChainStepPhoto[]>([]);
  const [errors, setErrors] = useState<string[]>([]);

  useEffect(() => {
    onPathsChange(photos.flatMap((photo) => (photo.path ? [photo.path] : [])));
  }, [photos, onPathsChange]);

  const addFiles = useCallback(
    (list: FileList | null) => {
      const rejected: string[] = [];

      for (const file of Array.from(list ?? [])) {
        const reason = validatePhotoFile(file);

        if (reason) {
          rejected.push(reason);
          continue;
        }

        const id = crypto.randomUUID();
        const path = chainStepPhotoPath(bookingId, step, id, file.type);

        setPhotos((current) => [...current, { id, file_name: file.name, status: "uploading" }]);

        void createClient()
          .storage.from(RETURN_CHAIN_PHOTO_BUCKET)
          .upload(path, file, { contentType: file.type })
          .then(({ error }) => {
            setPhotos((current) =>
              current.map((photo) =>
                photo.id === id
                  ? error
                    ? { ...photo, status: "failed" }
                    : { ...photo, status: "uploaded", path }
                  : photo,
              ),
            );
          });
      }

      setErrors(rejected);
    },
    [bookingId, step],
  );

  const remove = useCallback(
    (id: string) => setPhotos((current) => current.filter((photo) => photo.id !== id)),
    [],
  );

  return { photos, errors, addFiles, remove };
}
