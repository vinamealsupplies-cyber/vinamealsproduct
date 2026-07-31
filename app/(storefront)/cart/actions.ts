"use server";

import { getViewer } from "@/lib/auth";
import type { CartItem } from "@/lib/cart-types";
import {
  clearOwnCartItems,
  getOwnCartItems,
  replaceOwnCartItems
} from "@/lib/data/cart";
import { isLocalDemoMode, isSupabaseAdminConfigured } from "@/lib/env";

export type CartActionResult =
  | { ok: true; items: CartItem[] }
  | { ok: false; error: string; items?: CartItem[] };

export async function loadAccountCart(): Promise<CartActionResult> {
  if (isLocalDemoMode()) {
    return { ok: true, items: [] };
  }
  if (!isSupabaseAdminConfigured()) {
    return { ok: false, error: "Cart sync is not configured.", items: [] };
  }
  const viewer = await getViewer();
  if (!viewer || viewer.demo) {
    return { ok: false, error: "Sign in to use an account cart.", items: [] };
  }
  const items = await getOwnCartItems(viewer.id);
  return { ok: true, items };
}

export async function saveAccountCart(items: CartItem[]): Promise<CartActionResult> {
  if (isLocalDemoMode()) {
    return { ok: true, items: Array.isArray(items) ? items : [] };
  }
  if (!isSupabaseAdminConfigured()) {
    return { ok: false, error: "Cart sync is not configured." };
  }
  const viewer = await getViewer();
  if (!viewer || viewer.demo) {
    return { ok: false, error: "Sign in to save cart to your account." };
  }
  if (!Array.isArray(items)) {
    return { ok: false, error: "Invalid cart payload." };
  }
  // Giới hạn số dòng để tránh abuse.
  if (items.length > 200) {
    return { ok: false, error: "Cart is too large." };
  }
  const result = await replaceOwnCartItems(viewer.id, items);
  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true, items };
}

export async function clearAccountCart(): Promise<CartActionResult> {
  if (isLocalDemoMode()) {
    return { ok: true, items: [] };
  }
  if (!isSupabaseAdminConfigured()) {
    return { ok: false, error: "Cart sync is not configured." };
  }
  const viewer = await getViewer();
  if (!viewer || viewer.demo) {
    return { ok: false, error: "Sign in required." };
  }
  const result = await clearOwnCartItems(viewer.id);
  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true, items: [] };
}
