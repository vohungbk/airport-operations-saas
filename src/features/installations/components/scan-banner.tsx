import { CircleAlert, CircleCheck } from "lucide-react";

import { cn } from "@/lib/utils";

interface ScanBannerProps {
  tone: "success" | "danger" | "info";
  title: string;
  children: string;
}

const TONE_CLASS = {
  success: "bg-success-bg text-success-fg",
  danger: "bg-danger-bg text-danger-fg",
  info: "bg-info-bg text-info-fg",
} as const;

/**
 * The banner of the design: an icon, a title of 14 px semibold and one line. The scan result screens use
 * success and danger; the partner finance screen uses info (VI-F04-S14).
 */
export function ScanBanner({ tone, title, children }: ScanBannerProps) {
  const Icon = tone === "success" ? CircleCheck : CircleAlert;

  return (
    <div
      role={tone === "danger" ? "alert" : "status"}
      data-tone={tone}
      className={cn(
        "flex min-w-0 items-start gap-3 rounded-lg p-4 text-sm",
        TONE_CLASS[tone],
      )}
    >
      <Icon aria-hidden="true" className="size-5 shrink-0" />
      <div className="flex min-w-0 flex-col gap-1">
        <p className="font-semibold break-words">{title}</p>
        <p className="break-words">{children}</p>
      </div>
    </div>
  );
}
