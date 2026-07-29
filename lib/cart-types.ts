// Shared cart types + pure helpers (client + server).

export type CartItem = {
  productId: string;
  quantity: number;
  /** Yêu cầu đặc biệt cho món này (tùy chọn). */
  note?: string;
};

export const CART_NOTE_MAX = 300;

export function normalizeCartQuantity(quantity: number, maxStock?: number) {
  const q = Math.max(1, Math.floor(Number.isFinite(quantity) ? quantity : 1));
  if (typeof maxStock === "number" && maxStock > 0) return Math.min(q, Math.floor(maxStock));
  return q;
}

export function normalizeCartNote(note: string | null | undefined): string | undefined {
  if (typeof note !== "string") return undefined;
  const trimmed = note.trim().slice(0, CART_NOTE_MAX);
  return trimmed || undefined;
}
