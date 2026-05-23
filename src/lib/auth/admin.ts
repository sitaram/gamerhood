/**
 * Platform-admin gate.
 *
 * The list of admin emails comes from the `ADMIN_EMAILS` env var
 * (comma-separated, case-insensitive). Admins see infrastructure-level
 * errors (e.g. "Stripe Connect isn't enabled") and the CTAs that resolve
 * them (links into the platform's own Stripe / Supabase / etc. dashboards).
 * Non-admins should never see those — they can't act on them, and exposing
 * platform internals to creators is both confusing and a small leak.
 *
 * This is intentionally just an env-var allow-list for now. When we grow
 * beyond one or two admins, swap this for a `parents.role` column (or a
 * dedicated `platform_admins` table) and keep the function signature the
 * same so callers don't have to change.
 */
const ADMIN_EMAILS: string[] = (process.env.ADMIN_EMAILS ?? "")
  .split(",")
  .map((entry) => entry.trim().toLowerCase())
  .filter((entry) => entry.length > 0);

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return ADMIN_EMAILS.includes(email.trim().toLowerCase());
}
