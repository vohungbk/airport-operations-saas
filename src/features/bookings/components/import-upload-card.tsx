"use client";

import Link from "next/link";
import { Download, Upload } from "lucide-react";

import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCsvDropzone } from "@/features/bookings/hooks/use-csv-dropzone";
import { BOOKING_IMPORT_TEMPLATE_HREF } from "@/features/bookings/lib/booking-import-template";
import { CSV_FILE_ACCEPT, formatFileSize } from "@/features/bookings/lib/csv-file";
import { cn } from "@/lib/utils";

interface ImportUploadCardProps {
  partners: Array<{ value: string; label: string }>;
}

/**
 * CO-F07-S01 (design "Import bookings, Empty"): the card where a partner is chosen and a CSV is
 * dropped on the area or picked with a click. Validating the file belongs to the next story, so
 * "Validate file" stays off. "Download template" (R3) is live.
 */
export function ImportUploadCard({ partners }: ImportUploadCardProps) {
  const dropzone = useCsvDropzone();

  return (
    <section
      aria-labelledby="import-upload-title"
      className="flex flex-col gap-4 rounded-xl border border-border bg-card p-4 text-card-foreground md:p-6"
    >
      <div className="flex flex-col gap-1">
        <h2 id="import-upload-title" className="text-base font-medium text-foreground">
          Upload a booking file
        </h2>
        <p className="text-sm text-muted-foreground">
          Choose a partner and upload their bookings using the CSV template.
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="import-partner">Partner *</Label>
        <Select items={partners}>
          <SelectTrigger
            id="import-partner"
            className="h-11 w-full bg-card px-3 data-[size=default]:h-11 sm:w-80"
          >
            <SelectValue placeholder="Select a partner" />
          </SelectTrigger>
          <SelectContent>
            {partners.map((partner) => (
              <SelectItem key={partner.value} value={partner.value}>
                {partner.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">Rows will be created for this partner only</p>
      </div>

      <label
        data-slot="csv-dropzone"
        data-dragging={dropzone.isDragging || undefined}
        onDragOver={dropzone.onDragOver}
        onDragLeave={dropzone.onDragLeave}
        onDrop={dropzone.onDrop}
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border px-4 py-10 text-center transition-colors focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50",
          "data-dragging:border-primary data-dragging:bg-accent",
        )}
      >
        <Input
          type="file"
          accept={CSV_FILE_ACCEPT}
          aria-label="Choose a CSV file"
          className="sr-only"
          onChange={dropzone.onChange}
        />
        <span className="flex size-11 items-center justify-center rounded-lg bg-muted text-muted-foreground">
          <Upload className="size-5" aria-hidden="true" />
        </span>
        <p className="text-sm font-medium text-foreground">Drop a CSV file here or browse</p>
        <p className="text-xs text-muted-foreground">
          {dropzone.file
            ? `${dropzone.file.name} · ${formatFileSize(dropzone.file.size)}`
            : "CSV only, max size to be confirmed"}
        </p>
        <a
          href={BOOKING_IMPORT_TEMPLATE_HREF}
          download
          className={buttonVariants({ variant: "link", className: "min-h-11 gap-1.5 px-2" })}
        >
          <Download aria-hidden="true" />
          Download template
        </a>
      </label>

      <div className="flex items-center justify-end gap-2">
        <Link
          href="/bookings"
          className={buttonVariants({ variant: "outline", className: "min-h-11 min-w-[94px] bg-surface dark:bg-surface" })}
        >
          Cancel
        </Link>
        <Button type="button" className="min-h-11 min-w-[130px]" disabled>
          Validate file
        </Button>
      </div>
    </section>
  );
}
