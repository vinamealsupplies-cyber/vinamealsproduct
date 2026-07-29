"use client";

// Ghi nhớ lựa chọn pickup / ship từ cart → checkout (localStorage).

import { useSyncExternalStore } from "react";

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

const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

export function setFulfillmentMethod(method: FulfillmentMethod): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, method);
  } catch {
    // ignore
  }
  emit();
}

function subscribe(callback: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  listeners.add(callback);
  // Đồng bộ khi tab khác đổi preference.
  window.addEventListener("storage", callback);
  return () => {
    listeners.delete(callback);
    window.removeEventListener("storage", callback);
  };
}

/**
 * Preference dạng reactive. Render đầu (SSR + hydrate) trả `ship` rồi tự cập
 * nhật theo localStorage — thay cho việc setState trong useEffect (rule
 * react-hooks/set-state-in-effect: cascading render).
 */
export function useFulfillmentMethod(): FulfillmentMethod {
  return useSyncExternalStore(subscribe, getFulfillmentMethod, () => DEFAULT_METHOD);
}

/** `false` khi SSR / render đầu, `true` sau khi client hydrate — không dùng effect. */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );
}
