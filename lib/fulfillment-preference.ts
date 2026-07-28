"use client";

// Ghi nhớ lựa chọn pickup / ship từ cart → checkout (localStorage).

export type FulfillmentMethod = "pickup" | "ship";

const STORAGE_KEY = "vinameals-fulfillment-method";
const DEFAULT_METHOD: FulfillmentMethod = "ship";

export function isFulfillmentMethod(value: unknown): value is FulfillmentMethod {
  return value === "pickup" || value === "ship";
}

/** Đọc preference; SSR / chưa hydrate → default ship. */
export function getFulfillmentMethod(): FulfillmentMethod {
  if (typeof window === "undefined") return DEFAULT_METHOD;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (isFulfillmentMethod(raw)) return raw;
  } catch {
    // private mode / blocked
  }
  return DEFAULT_METHOD;
}

export function setFulfillmentMethod(method: FulfillmentMethod): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, method);
  } catch {
    // ignore
  }
}
