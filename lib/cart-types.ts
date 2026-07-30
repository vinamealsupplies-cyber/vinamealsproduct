// Shared cart types + pure helpers (client + server).

export type CartItem = {
  productId: string;
  quantity: number;
  /** Yêu cầu đặc biệt cho món này (tùy chọn). */
  note?: string;
};

export const CART_NOTE_MAX = 300;
/** Join multiple special-request tags on one cart line (also readable in admin). */
export const CART_NOTE_SEP = " · ";
const CART_NOTE_TAG_MAX = 20;

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

/** Split stored line note into individual tags. */
export function parseCartNoteTags(note: string | null | undefined): string[] {
  if (typeof note !== "string" || !note.trim()) return [];
  const parts = note
    .split(/\s*[·|]\s*|\n+/)
    .map((part) => part.trim())
    .filter(Boolean);
  const seen = new Set<string>();
  const tags: string[] = [];
  for (const part of parts) {
    const key = part.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    tags.push(part.slice(0, 120));
    if (tags.length >= CART_NOTE_TAG_MAX) break;
  }
  return tags;
}

/** Join tags back into one cart note string (capped length). */
export function joinCartNoteTags(tags: string[]): string | undefined {
  const seen = new Set<string>();
  const clean: string[] = [];
  for (const raw of tags) {
    const part = raw.trim().slice(0, 120);
    if (!part) continue;
    const key = part.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    const candidate = clean.length ? `${clean.join(CART_NOTE_SEP)}${CART_NOTE_SEP}${part}` : part;
    if (candidate.length > CART_NOTE_MAX) break;
    clean.push(part);
    if (clean.length >= CART_NOTE_TAG_MAX) break;
  }
  return clean.length ? clean.join(CART_NOTE_SEP) : undefined;
}
