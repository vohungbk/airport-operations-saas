"use server";

import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { LOGIN_ROUTE } from "@/lib/constants/routes";

export async function logoutAction(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect(LOGIN_ROUTE);
}
