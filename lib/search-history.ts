/** Lịch sử tìm kiếm sản phẩm — lưu localStorage, tối đa MAX mục (mới nhất trước). */

export const SEARCH_HISTORY_KEY = "vinameals:product-search-history";
export const SEARCH_HISTORY_MAX = 20;

export function readSearchHistory(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(SEARCH_HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item): item is string => typeof item === "string")
      .map((item) => item.trim())
      .filter(Boolean)
      .slice(0, SEARCH_HISTORY_MAX);
  } catch {
    return [];
  }
}

export function writeSearchHistory(items: string[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      SEARCH_HISTORY_KEY,
      JSON.stringify(items.slice(0, SEARCH_HISTORY_MAX))
    );
  } catch {
    // private mode / quota — bỏ qua
  }
}

/** Thêm query lên đầu; bỏ trùng (không phân biệt hoa thường); cắt còn MAX. */
export function pushSearchHistory(query: string): string[] {
  const q = query.trim();
  if (!q) return readSearchHistory();
  const prev = readSearchHistory().filter((item) => item.toLowerCase() !== q.toLowerCase());
  const next = [q, ...prev].slice(0, SEARCH_HISTORY_MAX);
  writeSearchHistory(next);
  return next;
}

export function removeSearchHistoryItem(query: string): string[] {
  const next = readSearchHistory().filter((item) => item.toLowerCase() !== query.trim().toLowerCase());
  writeSearchHistory(next);
  return next;
}

export function clearSearchHistory() {
  writeSearchHistory([]);
  return [] as string[];
}
