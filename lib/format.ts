export const usd = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD"
});

export const integer = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 0
});

export function formatDate(value: string | Date) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric"
  }).format(new Date(value));
}
