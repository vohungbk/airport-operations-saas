import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { PARTNER_HOME_ROUTE } from "@/lib/constants/routes";

/** The way back from a partner's view to the partner home (spec NAV-3, NAV-4). */
export function BackToPartnerHome() {
  return (
    <Link
      href={PARTNER_HOME_ROUTE}
      className={buttonVariants({ variant: "outline", size: "sm" })}
    >
      Back to Partner home
    </Link>
  );
}
