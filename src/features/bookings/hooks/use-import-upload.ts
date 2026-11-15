"use client";

import { useState, useTransition } from "react";

import { checkBookingImportFileAction } from "@/features/bookings/actions/check-booking-import-file.action";
import {
  confirmBookingImportAction,
  type ConfirmedImport,
} from "@/features/bookings/actions/confirm-booking-import.action";
import { useCsvDropzone } from "@/features/bookings/hooks/use-csv-dropzone";
import type { ImportFileErrorCode } from "@/features/bookings/lib/booking-import-file";
import type { ImportReport } from "@/features/bookings/lib/validate-import-rows";
import { bookingImportInputSchema } from "@/features/bookings/schemas/booking-import.schema";

/**
 * CO-F07-S02, S03, S05: the upload card of the import screen. It holds the partner and the file, checks them
 * in the browser (V1, V2, E1), and on "Validate file" asks the server to check them again, to read the
 * encoding and the header (E2, E3) and to check every row (R7, R8). The answer is the report of the file
 * or a refusal. A refusal belongs to the file it was given for, so choosing another file clears it.
 */
export function useImportUpload() {
  const { file, fileError, isDragging, bindArea, onChange } = useCsvDropzone();
  const [partnerId, setPartnerId] = useState("");
  const [partnerMissing, setPartnerMissing] = useState(false);
  const [serverRefusal, setServerRefusal] = useState<{ file: File; code: ImportFileErrorCode } | null>(null);
  const [checked, setChecked] = useState<{ file: File; report: ImportReport } | null>(null);
  const [isPending, startTransition] = useTransition();
  const [confirmed, setConfirmed] = useState<ConfirmedImport | null>(null);
  const [importFailure, setImportFailure] = useState<ImportFileErrorCode | null>(null);
  const [isImporting, startImport] = useTransition();

  const serverCode = serverRefusal && serverRefusal.file === file ? serverRefusal.code : null;
  const errorCode = fileError ?? serverCode;

  const submit = () => {
    if (!file || errorCode) return;

    if (!bookingImportInputSchema.safeParse({ partner_id: partnerId }).success) {
      setPartnerMissing(true);
      return;
    }

    const data = new FormData();
    data.set("partner_id", partnerId);
    data.set("file", file);

    startTransition(async () => {
      const result = await checkBookingImportFileAction(data);
      if (result.success) {
        setChecked({ file, report: result.report });
        return;
      }
      if (result.code === "PARTNER_REQUIRED") setPartnerMissing(true);
      else setServerRefusal({ file, code: result.code });
    });
  };

  /** CO-F07-S05: creates the valid rows. The server reads the file again, so the browser sends the file, not the report. */
  const confirm = () => {
    const reportedFile = checked?.file;
    if (!reportedFile || isImporting) return;

    const data = new FormData();
    data.set("partner_id", partnerId);
    data.set("file", reportedFile);

    setImportFailure(null);
    startImport(async () => {
      const result = await confirmBookingImportAction(data);
      if (result.success) setConfirmed(result.result);
      else setImportFailure(result.code);
    });
  };

  return {
    file,
    errorCode,
    partnerId,
    partnerMissing,
    isDragging,
    isPending,
    isImporting,
    importFailure,
    confirmed,
    confirm,
    report: checked?.report ?? null,
    reportFile: checked?.file ?? null,
    canValidate: file !== null && errorCode === null && !isPending,
    bindArea,
    onFileChange: onChange,
    onPartnerChange: (value: string | null) => {
      setPartnerId(value ?? "");
      setPartnerMissing(false);
    },
    submit,
    /** Back from the report to the upload card, to choose another file. */
    clearReport: () => {
      setChecked(null);
      setImportFailure(null);
    },
  };
}
