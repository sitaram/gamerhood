import type { User } from "@supabase/supabase-js";
import { isAdminEmail } from "@/lib/auth/admin";

export function isPlatformAdminUser(user: User | null | undefined): boolean {
  return isAdminEmail(user?.email);
}

export function canManageBrowseCategory(
  user: User,
  row: { created_by: string; is_platform?: boolean },
  asAdmin: boolean,
): boolean {
  if (asAdmin) return true;
  return row.created_by === user.id;
}
