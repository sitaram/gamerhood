/**
 * One canonical USD formatter for cent amounts. UI code should never reach
 * for `toFixed(2)` directly — go through here so future changes (locale,
 * currency switch) ripple out from one spot.
 */
export function formatUsd(
  cents: number,
  opts: { showCents?: boolean } = {},
): string {
  if (!Number.isFinite(cents)) return "—";
  const showCents = opts.showCents ?? true;
  const dollars = cents / 100;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: showCents ? 2 : 0,
    maximumFractionDigits: showCents ? 2 : 0,
  }).format(dollars);
}
