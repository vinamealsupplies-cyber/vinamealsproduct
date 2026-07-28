"use client";

import { useSyncExternalStore } from "react";

// Giỏ hàng client-side, lưu localStorage. productId + quantity + note (ghi chú
// từng món). Giá/tên/tồn luôn lấy từ catalog DB.

export type CartItem = {
  productId: string;
  quantity: number;
  /** Yêu cầu đặc biệt cho món này (tùy chọn). */
  note?: string;
};

const STORAGE_KEY = "vinameals-cart-v1";
const NOTE_MAX = 300;

type CartSnapshot = {
  items: CartItem[];
  /** false cho tới khi đọc xong localStorage — tránh flash "giỏ trống". */
  ready: boolean;
};

const SERVER_SNAPSHOT: CartSnapshot = { items: [], ready: false };

let snapshot: CartSnapshot = SERVER_SNAPSHOT;
let hydrated = false;
const listeners = new Set<() => void>();

function normalizeQuantity(quantity: number, maxStock?: number) {
  const q = Math.max(1, Math.floor(Number.isFinite(quantity) ? quantity : 1));
  if (typeof maxStock === "number" && maxStock > 0) return Math.min(q, Math.floor(maxStock));
  return q;
}

export function normalizeCartNote(note: string | null | undefined): string | undefined {
  if (typeof note !== "string") return undefined;
  const trimmed = note.trim().slice(0, NOTE_MAX);
  return trimmed || undefined;
}

function restore(raw: string | null): CartItem[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const restored: CartItem[] = [];
    for (const entry of parsed) {
      if (!entry || typeof entry !== "object") continue;
      const { productId, quantity, note } = entry as Partial<CartItem>;
      if (typeof productId !== "string" || typeof quantity !== "number") continue;
      if (restored.some((item) => item.productId === productId)) continue;
      const cleanNote = normalizeCartNote(note);
      restored.push({
        productId,
        quantity: normalizeQuantity(quantity),
        ...(cleanNote ? { note: cleanNote } : {})
      });
    }
    return restored;
  } catch {
    return [];
  }
}

function emit() {
  for (const listener of listeners) listener();
}

function setItems(items: CartItem[]) {
  snapshot = { items, ready: true };
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {
    // Hết quota / private mode → giỏ chỉ sống trong phiên.
  }
  emit();
}

function hydrate() {
  if (hydrated) return;
  hydrated = true;
  let items: CartItem[] = [];
  try {
    items = restore(window.localStorage.getItem(STORAGE_KEY));
  } catch {
    // localStorage bị chặn.
  }
  snapshot = { items, ready: true };
}

function getSnapshot() {
  hydrate();
  return snapshot;
}

function getServerSnapshot() {
  return SERVER_SNAPSHOT;
}

let storageListenerAttached = false;

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (!storageListenerAttached) {
    storageListenerAttached = true;
    window.addEventListener("storage", (event) => {
      if (event.key !== STORAGE_KEY) return;
      snapshot = { items: restore(event.newValue), ready: true };
      emit();
    });
  }
  return () => {
    listeners.delete(listener);
  };
}

export function addToCart(productId: string, quantity = 1, maxStock?: number) {
  const current = getSnapshot().items;
  const existing = current.find((item) => item.productId === productId);
  const normalized = normalizeQuantity((existing?.quantity ?? 0) + quantity, maxStock);
  setItems(
    existing
      ? current.map((item) =>
          item.productId === productId ? { ...item, quantity: normalized } : item
        )
      : [...current, { productId, quantity: normalized }]
  );
}

export function setCartQuantity(productId: string, quantity: number, maxStock?: number) {
  const current = getSnapshot().items;
  if (quantity <= 0) {
    setItems(current.filter((item) => item.productId !== productId));
    return;
  }
  const normalized = normalizeQuantity(quantity, maxStock);
  setItems(
    current.map((item) => (item.productId === productId ? { ...item, quantity: normalized } : item))
  );
}

export function setCartNote(productId: string, note: string) {
  const current = getSnapshot().items;
  const cleanNote = normalizeCartNote(note);
  setItems(
    current.map((item) => {
      if (item.productId !== productId) return item;
      if (!cleanNote) {
        const { note: _drop, ...rest } = item;
        return rest;
      }
      return { ...item, note: cleanNote };
    })
  );
}

export function removeFromCart(productId: string) {
  setItems(getSnapshot().items.filter((item) => item.productId !== productId));
}

export function clearCart() {
  setItems([]);
}

export function useCart() {
  const { items, ready } = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const count = items.reduce((sum, item) => sum + item.quantity, 0);
  return {
    items,
    count,
    ready,
    add: addToCart,
    setQuantity: setCartQuantity,
    setNote: setCartNote,
    remove: removeFromCart,
    clear: clearCart
  };
}
