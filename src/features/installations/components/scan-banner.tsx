import { CircleAlert, CircleCheck } from "lucide-react";

import { cn } from "@/lib/utils";

interface ScanBannerProps {
  tone: "success" | "danger";
  title: string;
  children: string;
}

/** The banner of the scan result screens of the design: an icon, a title of 14 px semibold and one line. */
export function ScanBanner({ tone, title, children }: ScanBannerProps) {
  const Icon = tone === "success" ? CircleCheck : CircleAlert;

  return (
    <div
      role={tone === "danger" ? "alert" : "status"}
      data-tone={tone}
      className={cn(
        "flex min-w-0 items-start gap-3 rounded-lg p-4 text-sm",
        tone === "success"
          ? "bg-success-bg text-success-fg"
          : "bg-danger-bg text-danger-fg",
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
