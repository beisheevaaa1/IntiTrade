export function formatPrice(value: unknown, options: { freeLabel?: string; fallback?: string } = {}) {
  const amount = Number(value);
  const freeLabel = options.freeLabel ?? "Free";
  const fallback = options.fallback ?? "—";

  if (!Number.isFinite(amount)) return fallback;
  return amount <= 0 ? freeLabel : `RM ${amount.toFixed(2)}`;
}
