import { describe, expect, it } from "vitest";

import { badgeVariants } from "@/components/ui/badge";
import { DOMAIN_STATUS, getStatusLook, type StatusDomain } from "@/lib/status/domain-status";
import { Constants } from "@/types/database.types";

const ENUM_OF: Record<StatusDomain, readonly string[]> = {
  seat: Constants.public.Enums.seat_status,
  workflow: Constants.public.Enums.incident_status,
  booking: Constants.public.Enums.booking_status,
  job: Constants.public.Enums.technician_job_status,
  result: Constants.public.Enums.inspection_result,
  severity: Constants.public.Enums.incident_severity,
  flight: Constants.public.Enums.flight_status,
  invoice: Constants.public.Enums.invoice_status,
  settlement: Constants.public.Enums.settlement_status,
};

const DOMAINS = Object.keys(DOMAIN_STATUS) as StatusDomain[];

describe("DOMAIN_STATUS", () => {
  it("should cover the nine domains of the spec", () => {
    expect(DOMAINS.sort()).toEqual(
      ["booking", "flight", "invoice", "job", "result", "seat", "settlement", "severity", "workflow"].sort(),
    );
  });

  it.each(DOMAINS)("should give %s exactly the values of its database enum", (domain) => {
    expect(Object.keys(DOMAIN_STATUS[domain]).sort()).toEqual([...ENUM_OF[domain]].sort());
  });

  it.each(DOMAINS)("should give every %s status an icon, a text and a variant", (domain) => {
    for (const [value, look] of Object.entries(DOMAIN_STATUS[domain])) {
      expect(look.label, `${domain}.${value}`).not.toBe("");
      expect(look.icon, `${domain}.${value}`).toBeDefined();
      expect(look.variant, `${domain}.${value}`).toBeDefined();
    }
  });

  it("should give every variant a background and text token pair", () => {
    const pair = { success: "success", warning: "warning", info: "info", destructive: "danger" } as const;
    for (const domain of DOMAINS) {
      for (const { variant } of Object.values(DOMAIN_STATUS[domain])) {
        const classes = badgeVariants({ variant });
        if (variant === "muted") {
          expect(classes).toContain("bg-muted");
          expect(classes).toContain("text-muted-foreground");
        } else {
          expect(classes).toContain(`bg-${pair[variant]}-bg`);
          expect(classes).toContain(`text-${pair[variant]}-fg`);
        }
      }
    }
  });
});

describe("getStatusLook", () => {
  it("should return the look of a known status", () => {
    expect(getStatusLook("invoice", "overdue").variant).toBe("destructive");
  });

  it("should fall back to a neutral look with the raw value for an unknown status", () => {
    const look = getStatusLook("flight", "teleported");
    expect(look.label).toBe("teleported");
    expect(look.variant).toBe("muted");
  });

  it("should fall back to Unknown when the value is empty", () => {
    expect(getStatusLook("seat", "").label).toBe("Unknown");
  });
});
