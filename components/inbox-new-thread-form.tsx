"use client";

import { useActionState, useEffect, useId, useRef, useState } from "react";
import { Check, ChevronDown, Plus, Search, Send } from "lucide-react";
import {
  createSubjectTemplate,
  loadSubjectTemplates,
  searchContacts,
  startThread
} from "@/app/admin/inbox/actions";
import type { ContactHit } from "@/lib/email/inbox-types";
import { initialInboxActionState } from "@/lib/email/form-state";

/** Đóng dropdown khi bấm ra ngoài hoặc nhấn Escape. */
function useDismiss(open: boolean, close: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) close();
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") close();
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, close]);
  return ref;
}

/** Ô "Gửi tới": gõ để tìm contact (email tài khoản khách), chọn thì điền. */
function ContactToField({
  value,
  onChange
}: {
  value: string;
  onChange: (email: string) => void;
}) {
  const [hits, setHits] = useState<ContactHit[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reqId = useRef(0);
  const ref = useDismiss(open, () => setOpen(false));

  function runSearch(query: string) {
    if (timer.current) clearTimeout(timer.current);
    const q = query.trim();
    if (q.length < 2) {
      setHits([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    timer.current = setTimeout(async () => {
      const id = ++reqId.current;
      const result = await searchContacts(q);
      if (id !== reqId.current) return; // bỏ kết quả cũ đến muộn
      setHits(result);
      setLoading(false);
      setOpen(true);
    }, 250);
  }

  return (
    <div className="inbox-combo" ref={ref}>
      <div className="inbox-combo-input">
        <Search size={15} aria-hidden="true" />
        <input
          name="to"
          type="email"
          required
          autoComplete="off"
          placeholder="Tìm theo email hoặc tên khách…"
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            runSearch(e.target.value);
          }}
          onFocus={() => {
            if (hits.length) setOpen(true);
          }}
        />
      </div>
      {open ? (
        <ul className="inbox-combo-menu" role="listbox">
          {loading ? (
            <li className="inbox-combo-empty">Đang tìm…</li>
          ) : hits.length ? (
            hits.map((hit) => (
              <li key={hit.email}>
                <button
                  type="button"
                  onClick={() => {
                    onChange(hit.email);
                    setOpen(false);
                  }}
                >
                  <span className="inbox-combo-primary">{hit.name || hit.email}</span>
                  <span className="inbox-combo-secondary">
                    {hit.name ? hit.email : null}
                    {hit.role && hit.role !== "customer" ? (
                      <em className="inbox-combo-tag">{hit.role}</em>
                    ) : null}
                  </span>
                </button>
              </li>
            ))
          ) : (
            <li className="inbox-combo-empty">Không có tài khoản khớp — gõ email trực tiếp cũng được.</li>
          )}
        </ul>
      ) : null}
    </div>
  );
}

/** Ô "Tiêu đề": dropdown mẫu + tự thêm mẫu mới. */
function SubjectField({
  value,
  onChange,
  templates,
  onTemplatesChange
}: {
  value: string;
  onChange: (subject: string) => void;
  templates: string[];
  onTemplatesChange: (next: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const ref = useDismiss(open, () => setOpen(false));

  const trimmed = value.trim();
  const alreadyTemplate = templates.some((t) => t.toLowerCase() === trimmed.toLowerCase());
  const canSaveAsTemplate = trimmed.length > 0 && !alreadyTemplate;

  async function saveTemplate() {
    if (!canSaveAsTemplate || saving) return;
    setSaving(true);
    const result = await createSubjectTemplate(trimmed);
    if (result.ok) onTemplatesChange(result.templates);
    setSaving(false);
    setOpen(false);
  }

  return (
    <div className="inbox-combo" ref={ref}>
      <div className="inbox-combo-input">
        <input
          name="subject"
          required
          maxLength={200}
          autoComplete="off"
          placeholder="Chọn mẫu hoặc tự nhập…"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
        <button
          type="button"
          className="inbox-combo-toggle"
          aria-label="Chọn tiêu đề mẫu"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          <ChevronDown size={16} aria-hidden="true" />
        </button>
      </div>
      {open ? (
        <ul className="inbox-combo-menu" role="listbox">
          {templates.map((template) => (
            <li key={template}>
              <button
                type="button"
                onClick={() => {
                  onChange(template);
                  setOpen(false);
                }}
              >
                <span className="inbox-combo-primary">{template}</span>
                {template.toLowerCase() === trimmed.toLowerCase() ? (
                  <Check size={15} aria-hidden="true" />
                ) : null}
              </button>
            </li>
          ))}
          {canSaveAsTemplate ? (
            <li>
              <button type="button" className="inbox-combo-add" onClick={saveTemplate} disabled={saving}>
                <Plus size={15} aria-hidden="true" />
                {saving ? "Đang lưu…" : `Lưu “${trimmed}” làm mẫu`}
              </button>
            </li>
          ) : null}
        </ul>
      ) : null}
    </div>
  );
}

/** Soạn thư mới tới một địa chỉ chưa có hội thoại. */
export function NewThreadForm() {
  const [state, action, pending] = useActionState(startThread, initialInboxActionState);

  const [to, setTo] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [templates, setTemplates] = useState<string[]>([]);
  const fieldId = useId();

  // Nạp tiêu đề mẫu một lần khi mở form.
  useEffect(() => {
    let cancelled = false;
    loadSubjectTemplates().then((list) => {
      if (!cancelled) setTemplates(list);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Gửi xong thì xoá trắng form — xử lý ngay trong render (không setState trong
  // effect) bằng cách so state hiện tại với state đã xử lý.
  const [handledState, setHandledState] = useState(state);
  if (state !== handledState) {
    setHandledState(state);
    if (state.status === "success") {
      setTo("");
      setSubject("");
      setBody("");
    }
  }

  return (
    <section className="form-card">
      <div className="form-card-heading">
        <div>
          <h2>Soạn thư mới</h2>
          <p>Gửi từ support@vinamealsupplies.com. Thư được lưu vào hộp thư chung.</p>
        </div>
      </div>

      <form className="inbox-compose" action={action}>
        <label htmlFor={`${fieldId}-to`}>
          Gửi tới
          <ContactToField value={to} onChange={setTo} />
        </label>
        <label>
          Tiêu đề
          <SubjectField
            value={subject}
            onChange={setSubject}
            templates={templates}
            onTemplatesChange={setTemplates}
          />
        </label>
        <label>
          Nội dung
          <textarea
            name="body"
            rows={6}
            required
            maxLength={20000}
            value={body}
            onChange={(e) => setBody(e.target.value)}
          />
        </label>

        {state.status === "error" ? (
          <p className="form-error" role="alert">
            {state.message}
          </p>
        ) : null}
        {state.status === "success" ? (
          <p className="form-success" role="status">
            {state.message}
          </p>
        ) : null}

        <button className="button primary" type="submit" disabled={pending}>
          <Send size={15} aria-hidden="true" /> {pending ? "Đang gửi…" : "Gửi thư"}
        </button>
      </form>
    </section>
  );
}
