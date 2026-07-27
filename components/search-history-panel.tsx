"use client";

import { Clock3, X } from "lucide-react";

/** Danh sách search gần đây — mỗi dòng có nút X xoá. */
export function SearchHistoryPanel({
  items,
  onPick,
  onRemove,
  onClearAll
}: {
  items: string[];
  onPick: (query: string) => void;
  onRemove: (query: string) => void;
  onClearAll?: () => void;
}) {
  if (!items.length) return null;

  return (
    <div className="search-history-panel" role="listbox" aria-label="Recent searches">
      <div className="search-history-head">
        <span>
          <Clock3 size={14} aria-hidden="true" /> Recent searches
        </span>
        {onClearAll ? (
          <button type="button" className="search-history-clear" onClick={onClearAll}>
            Clear all
          </button>
        ) : null}
      </div>
      <ul className="search-history-list">
        {items.map((item) => (
          <li key={item}>
            <button
              type="button"
              className="search-history-item"
              role="option"
              // role="option" bắt buộc phải khai báo aria-selected. Danh sách
              // lịch sử không có mục nào "đang chọn" nên luôn là false.
              aria-selected={false}
              onMouseDown={(event) => {
                // mousedown trước blur input → vẫn kịp pick
                event.preventDefault();
                onPick(item);
              }}
            >
              {item}
            </button>
            <button
              type="button"
              className="search-history-remove"
              aria-label={`Remove “${item}” from history`}
              onMouseDown={(event) => {
                event.preventDefault();
                event.stopPropagation();
                onRemove(item);
              }}
            >
              <X size={14} aria-hidden="true" />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
