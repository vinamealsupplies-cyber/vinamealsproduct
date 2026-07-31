"use client";

import { useSyncExternalStore } from "react";
import {
  clearAccountCart,
  loadAccountCart,
  saveAccountCart
} from "@/app/(storefront)/cart/actions";
import {
  normalizeCartNote,
  normalizeCartQuantity,
  type CartItem
} from "@/lib/cart-types";

export type { CartItem } from "@/lib/cart-types";
export { normalizeCartNote } from "@/lib/cart-types";

// Giỏ hàng CHỈ theo tài khoản (Supabase cart_items).
// Không localStorage / cookie / session máy. Guest = giỏ trống, phải đăng nhập.

const PERSIST_DEBOUNCE_MS = 300;
/** Key cũ (guest/browser) — dọn khi hydrate để không còn dữ liệu rác. */
const LEGACY_STORAGE_PREFIXES = ["vinameals-cart-v1"];

export type CartMutationResult =
  | { ok: true }
  | { ok: false; reason: "auth" | "not_ready" };

type CartSnapshot = {
  items: CartItem[];
  /** false đến khi bind xong (load server hoặc xác nhận guest). */
  ready: boolean;
  /** null = chưa đăng nhập → không có giỏ. */
  userId: string | null;
};

const SERVER_SNAPSHOT: CartSnapshot = { items: [], ready: false, userId: null };

let snapshot: CartSnapshot = SERVER_SNAPSHOT;
let bound = false;
let activeUserId: string | null = null;
let hydrateGeneration = 0;
let persistTimer: ReturnType<typeof setTimeout> | null = null;
let persistInFlight = false;
let persistQueued: CartItem[] | null = null;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

/** Xóa mọi key cart cũ trên trình duyệt (chỉ dọn rác, không đọc lại). */
function purgeLegacyBrowserCart() {
  if (typeof window === "undefined") return;
  try {
    const toRemove: string[] = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (!key) continue;
      if (LEGACY_STORAGE_PREFIXES.some((p) => key === p || key.startsWith(`${p}:`))) {
        toRemove.push(key);
      }
    }
    for (const key of toRemove) window.localStorage.removeItem(key);
  } catch {
    // private mode / blocked
  }
}

function schedulePersist(items: CartItem[]) {
  if (!activeUserId) return;
  persistQueued = items;
  if (persistTimer) clearTimeout(persistTimer);
  persistTimer = setTimeout(() => {
    persistTimer = null;
    void flushPersist();
  }, PERSIST_DEBOUNCE_MS);
}

async function flushPersist() {
  if (!activeUserId || persistInFlight) return;
  const items = persistQueued;
  if (items == null) return;
  persistQueued = null;
  persistInFlight = true;
  try {
    await saveAccountCart(items);
  } catch {
    // Giữ state memory; lần sửa sau thử lại.
  } finally {
    persistInFlight = false;
    if (persistQueued != null && activeUserId) {
      void flushPersist();
    }
  }
}

function setItems(items: CartItem[], options?: { persist?: boolean }) {
  if (!activeUserId) {
    // Guest không được giữ giỏ trong memory lâu dài — luôn rỗng.
    snapshot = { items: [], ready: true, userId: null };
    emit();
    return;
  }
  const persist = options?.persist !== false;
  snapshot = { items, ready: true, userId: activeUserId };
  if (persist) schedulePersist(items);
  emit();
}

function setGuestEmpty() {
  activeUserId = null;
  snapshot = { items: [], ready: true, userId: null };
  bound = true;
  emit();
}

async function hydrateAccount(userId: string) {
  const generation = ++hydrateGeneration;
  activeUserId = userId;
  // Chờ server — không paint từ browser cache.
  snapshot = { items: [], ready: false, userId };
  bound = true;
  emit();

  let remote: CartItem[] = [];
  try {
    const result = await loadAccountCart();
    if (result.ok) remote = result.items;
  } catch {
    remote = [];
  }

  if (generation !== hydrateGeneration || activeUserId !== userId) return;

  snapshot = { items: remote, ready: true, userId };
  emit();
}

/**
 * Gắn tài khoản từ server layout. userId null = guest (giỏ trống).
 */
export function bindCartAccount(userId: string | null) {
  if (typeof window === "undefined") return;
  purgeLegacyBrowserCart();

  const next = userId?.trim() || null;
  if (bound && activeUserId === next && snapshot.ready) return;

  if (persistTimer) {
    clearTimeout(persistTimer);
    persistTimer = null;
  }
  if (activeUserId && persistQueued) {
    void saveAccountCart(persistQueued).catch(() => {});
    persistQueued = null;
  }

  if (next) {
    void hydrateAccount(next);
  } else {
    hydrateGeneration += 1;
    setGuestEmpty();
  }
}

function getSnapshot() {
  return snapshot;
}

function getServerSnapshot() {
  return SERVER_SNAPSHOT;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function requireAccount(): CartMutationResult {
  if (!snapshot.ready && !bound) return { ok: false, reason: "not_ready" };
  if (!activeUserId) return { ok: false, reason: "auth" };
  return { ok: true };
}

export function addToCart(
  productId: string,
  quantity = 1,
  maxStock?: number
): CartMutationResult {
  const gate = requireAccount();
  if (!gate.ok) return gate;

  const current = snapshot.items;
  const existing = current.find((item) => item.productId === productId);
  const normalized = normalizeCartQuantity((existing?.quantity ?? 0) + quantity, maxStock);
  setItems(
    existing
      ? current.map((item) =>
          item.productId === productId ? { ...item, quantity: normalized } : item
        )
      : [...current, { productId, quantity: normalized }]
  );
  return { ok: true };
}

export function setCartQuantity(
  productId: string,
  quantity: number,
  maxStock?: number
): CartMutationResult {
  const gate = requireAccount();
  if (!gate.ok) return gate;

  const current = snapshot.items;
  if (quantity <= 0) {
    setItems(current.filter((item) => item.productId !== productId));
    return { ok: true };
  }
  const normalized = normalizeCartQuantity(quantity, maxStock);
  setItems(
    current.map((item) => (item.productId === productId ? { ...item, quantity: normalized } : item))
  );
  return { ok: true };
}

export function setCartNote(productId: string, note: string): CartMutationResult {
  const gate = requireAccount();
  if (!gate.ok) return gate;

  const cleanNote = normalizeCartNote(note);
  setItems(
    snapshot.items.map((item) => {
      if (item.productId !== productId) return item;
      if (!cleanNote) {
        const next = { ...item };
        delete next.note;
        return next;
      }
      return { ...item, note: cleanNote };
    })
  );
  return { ok: true };
}

export function removeFromCart(productId: string): CartMutationResult {
  const gate = requireAccount();
  if (!gate.ok) return gate;
  setItems(snapshot.items.filter((item) => item.productId !== productId));
  return { ok: true };
}

export function clearCart(): CartMutationResult {
  const gate = requireAccount();
  if (!gate.ok) return gate;

  if (persistTimer) {
    clearTimeout(persistTimer);
    persistTimer = null;
  }
  persistQueued = null;
  snapshot = { items: [], ready: true, userId: activeUserId };
  emit();
  void clearAccountCart().catch(() => {});
  return { ok: true };
}

export function useCart() {
  const { items, ready, userId } = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const count = items.reduce((sum, item) => sum + item.quantity, 0);
  const signedIn = Boolean(userId);
  return {
    items,
    count,
    ready,
    userId,
    signedIn,
    add: addToCart,
    setQuantity: setCartQuantity,
    setNote: setCartNote,
    remove: removeFromCart,
    clear: clearCart
  };
}
