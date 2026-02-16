export function formatPrice(cents: number | null | undefined): string {
  if (cents === null || cents === undefined) return "N/A";
  return `$${(cents / 100).toFixed(2)}`;
}

export function formatNumber(n: number): string {
  return new Intl.NumberFormat().format(n);
}
