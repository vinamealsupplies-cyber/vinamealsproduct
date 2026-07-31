"use client";

import { useId, useRef, useState } from "react";
import { ChevronDown, MessageSquareText, Plus, Trash2, X } from "lucide-react";
import {
  rememberSpecialRequest,
  removeSpecialRequest
} from "@/app/(storefront)/cart/special-request-actions";
import {
  joinCartNoteTags,
  parseCartNoteTags
} from "@/lib/cart-types";
import type { SpecialRequest } from "@/lib/special-request-types";

/**
 * Multi-tag special requests on one cart line:
 * - Tags show as small lines above the input.
 * - Click a saved phrase → ADD a tag (does not replace others).
 * - Type new text + press Add → ADD a tag (no auto-add on blur).
 * - New phrases are also saved to the account Saved dropdown.
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
  onChange: (productId: string, note: string) => void;
  onSuggestionsChange: (items: SpecialRequest[]) => void;
  label?: string;
}) {
  const fieldId = useId();
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [draft, setDraft] = useState("");
  const [open, setOpen] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [synced, setSynced] = useState({ value, productId });
  const [tags, setTags] = useState<string[]>(() => parseCartNoteTags(value));

  if (synced.value !== value || synced.productId !== productId) {
    setSynced({ value, productId });
    setTags(parseCartNoteTags(value));
    setDraft("");
  }

  const savedCount = suggestions.length;

  function commitTags(nextTags: string[]) {
    setTags(nextTags);
    const joined = joinCartNoteTags(nextTags);
    onChange(productId, joined ?? "");
  }

  async function rememberPhrase(phrase: string) {
    setSaving(true);
    try {
      const result = await rememberSpecialRequest(phrase);
      if (result.ok && result.items) onSuggestionsChange(result.items);
    } finally {
      setSaving(false);
    }
  }

  function addTag(raw: string, alsoRemember: boolean) {
    const phrase = raw.trim();
    if (!phrase) return;
    const exists = tags.some((t) => t.toLowerCase() === phrase.toLowerCase());
    if (!exists) {
      commitTags([...tags, phrase]);
    }
    setDraft("");
    setOpen(false);
    if (alsoRemember) void rememberPhrase(phrase);
  }

  function removeTag(tag: string) {
    commitTags(tags.filter((t) => t !== tag));
  }

  function handleAddClick() {
    addTag(draft, true);
  }

  function handleSelectSaved(item: SpecialRequest) {
    addTag(item.body, true);
  }

  async function handleRemoveSaved(event: React.MouseEvent, id: string) {
    event.preventDefault();
    event.stopPropagation();
    if (id.startsWith("local-")) {
      onSuggestionsChange(suggestions.filter((s) => s.id !== id));
      return;
    }
    setBusyId(id);
    try {
      const result = await removeSpecialRequest(id);
      if (result.ok) onSuggestionsChange(result.items);
    } finally {
      setBusyId(null);
    }
  }

  function handleMenuBlur(event: React.FocusEvent<HTMLDivElement>) {
    const next = event.relatedTarget as Node | null;
    if (next && rootRef.current?.contains(next)) return;
    setOpen(false);
  }

  return (
    <div className="cart-line-note special-request-picker" ref={rootRef} onBlur={handleMenuBlur}>
      <div className="special-request-label">
        <span>
          <MessageSquareText size={13} aria-hidden="true" /> {label}
        </span>
        {tags.length > 0 ? (
          <button
            type="button"
            className="special-request-clear"
            onClick={() => commitTags([])}
          >
            Clear all
          </button>
        ) : null}
      </div>

      {/* Selected tags for THIS line — small rows above the input */}
      {tags.length > 0 ? (
        <ul className="special-request-tags" aria-label="Selected special requests">
          {tags.map((tag) => (
            <li key={tag}>
              <span className="special-request-tag-text">{tag}</span>
              <button
                type="button"
                className="special-request-tag-remove"
                aria-label={`Remove ${tag}`}
                onClick={() => removeTag(tag)}
              >
                <X size={12} aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="special-request-row">
        <div className="special-request-input-wrap">
          <input
            id={fieldId}
            className="special-request-input"
            type="text"
            maxLength={120}
            placeholder="Type a special request…"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleAddClick();
              }
            }}
          />
        </div>

        <button
          type="button"
          className="button primary compact special-request-add-btn"
          disabled={!draft.trim()}
          onClick={handleAddClick}
        >
          <Plus size={14} aria-hidden="true" /> Add
        </button>

        <button
          type="button"
          className={`special-request-dropdown-btn${open ? " is-open" : ""}`}
          aria-expanded={open}
          aria-controls={listId}
          aria-label={
            savedCount > 0 ? `Saved phrases, ${savedCount} saved` : "Saved phrases (none yet)"
          }
          onClick={() => setOpen((v) => !v)}
        >
          {savedCount > 0 ? (
            <span className="special-request-dropdown-count">{savedCount}</span>
          ) : null}
          <span className="special-request-dropdown-label">Saved</span>
          <ChevronDown size={14} aria-hidden="true" />
        </button>
      </div>

      {open ? (
        <div className="special-request-menu" id={listId} role="listbox">
          {suggestions.length === 0 ? (
            <p className="special-request-menu-empty">
              No saved phrases yet. Type a request and press <strong>Add</strong> — it will appear
              here next time.
            </p>
          ) : (
            <ul className="special-request-menu-list">
              {suggestions.map((item) => {
                const already = tags.some((t) => t.toLowerCase() === item.body.toLowerCase());
                return (
                  <li key={item.id} role="option" aria-selected={already}>
                    <button
                      type="button"
                      className={`special-request-menu-item${already ? " is-active" : ""}`}
                      onClick={() => handleSelectSaved(item)}
                      disabled={busyId === item.id || already}
                      title={already ? "Already added" : item.body}
                    >
                      <span>{item.body}</span>
                      {already ? <em>added</em> : null}
                    </button>
                    <button
                      type="button"
                      className="special-request-menu-remove"
                      aria-label={`Remove saved phrase ${item.body}`}
                      disabled={busyId === item.id}
                      onClick={(e) => void handleRemoveSaved(e, item.id)}
                    >
                      <Trash2 size={13} aria-hidden="true" />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      ) : null}

      <p className="special-request-hint">
        Press <strong>Add</strong> to attach a note to this item. Open <strong>Saved</strong> to reuse
        past phrases.
        {saving ? " Saving…" : null}
      </p>
    </div>
  );
}
