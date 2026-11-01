import { redirect } from "next/navigation";

import { requireAuth } from "@/lib/auth/current-user";
import { getHomeRouteForRole } from "@/lib/auth/role-home";

/**
 * The address of the site has no content of its own: it opens the home of the
 * signed-in user's role. `requireAuth` sends a signed-out visitor to `/login` and
 * a user without a valid profile or partner to `/forbidden`.
 */
export default async function Home() {
  const user = await requireAuth();

  redirect(getHomeRouteForRole(user.role));
}
