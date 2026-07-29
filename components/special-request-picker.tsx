"use client";

import { useId, useState } from "react";
import { MessageSquareText, Plus, X } from "lucide-react";
import {
  rememberSpecialRequest,
  removeSpecialRequest
} from "@/app/cart/special-request-actions";
import { CART_NOTE_MAX } from "@/lib/cart-types";
import type { SpecialRequest } from "@/lib/special-request-types";

/**
 * Special request: chọn từ list phrase hay dùng của account, hoặc gõ mới.
 * Khi chọn / blur text mới → ghi vào cart line + remember vào list tài khoản.
 */
export function SpecialRequestPicker({
  productId,
  value,
  suggestions,
  onChange,
  onSuggestionsChange,
  label = "Special request for this item"
}: {
  productId: string;
  value?: string;
  suggestions: SpecialRequest[];
  /** Áp dụng note vào cart line. */
  onChange: (productId: string, note: string) => void;
  onSuggestionsChange: (items: SpecialRequest[]) => void;
  label?: string;
}) {
  const fieldId = useId();
  const [text, setText] = useState(value ?? "");
  const [customOpen, setCustomOpen] = useState(Boolean(value?.trim()) && !suggestions.some((s) => s.body === value));
  const [busyId, setBusyId] = useState<string | null>(null);
  const [synced, setSynced] = useState({ value, productId });

  // Cart line (value / product) đổi → reset ô nhập ngay trong render, thay cho
  // setState trong effect (rule react-hooks/set-state-in-effect).
  if (synced.value !== value || synced.productId !== productId) {
    setSynced({ value, productId });
    setText(value ?? "");
    if (value?.trim() && !suggestions.some((s) => s.body === value)) {
      setCustomOpen(true);
    }
  }

  const selectedBody = text.trim();

  async function applyBody(body: string, remember: boolean) {
    const next = body.slice(0, CART_NOTE_MAX);
    setText(next);
    onChange(productId, next);
    if (remember && next.trim()) {
      const result = await rememberSpecialRequest(next);
      if (result.ok) onSuggestionsChange(result.items);
    }
  }

  function handleSelect(item: SpecialRequest) {
    setCustomOpen(false);
    void applyBody(item.body, true);
  }

  function handleClear() {
    setText("");
    setCustomOpen(false);
    onChange(productId, "");
  }

  async function handleRemoveSuggestion(event: React.MouseEvent, id: string) {
    event.preventDefault();
    event.stopPropagation();
    setBusyId(id);
    try {
      const result = await removeSpecialRequest(id);
      if (result.ok) onSuggestionsChange(result.items);
    } finally {
      setBusyId(null);
    }
  }

  function handleBlur() {
    void applyBody(text, true);
  }

  return (
    <div className="cart-line-note special-request-picker">
      <div className="special-request-label">
        <span>
          <MessageSquareText size={13} aria-hidden="true" /> {label}
        </span>
        {selectedBody ? (
          <button type="button" className="special-request-clear" onClick={handleClear}>
            Clear
          </button>
        ) : null}
      </div>

      {suggestions.length > 0 ? (
        <ul className="special-request-list" aria-label="Saved special requests">
          {suggestions.map((item) => {
            const active = selectedBody === item.body;
            return (
              <li key={item.id}>
                <button
                  type="button"
                  className={`special-request-chip${active ? " is-active" : ""}`}
                  onClick={() => handleSelect(item)}
                  title={item.body}
                  disabled={busyId === item.id}
                >
                  <span className="special-request-chip-text">{item.body}</span>
                </button>
                <button
                  type="button"
                  className="special-request-chip-remove"
                  aria-label={`Remove saved request: ${item.body}`}
                  disabled={busyId === item.id}
                  onClick={(e) => void handleRemoveSuggestion(e, item.id)}
                >
                  <X size={12} aria-hidden="true" />
                </button>
              </li>
            );
          })}
          <li>
            <button
              type="button"
              className={`special-request-chip special-request-chip-new${customOpen ? " is-active" : ""}`}
              onClick={() => setCustomOpen(true)}
            >
              <Plus size={13} aria-hidden="true" /> New
            </button>
          </li>
        </ul>
      ) : null}

      {customOpen || suggestions.length === 0 ? (
        <label className="special-request-custom" htmlFor={fieldId}>
          {suggestions.length === 0 ? (
            <span className="special-request-hint">Add a request — it will be saved for next time</span>
          ) : (
            <span className="special-request-hint">Custom request</span>
          )}
          <textarea
            id={fieldId}
            rows={2}
            maxLength={CART_NOTE_MAX}
            placeholder="e.g. ripe fruit, no ice, call on arrival…"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onBlur={handleBlur}
          />
        </label>
      ) : selectedBody && !suggestions.some((s) => s.body === selectedBody) ? (
        <p className="special-request-selected-preview">{selectedBody}</p>
      ) : null}
    </div>
  );
}
