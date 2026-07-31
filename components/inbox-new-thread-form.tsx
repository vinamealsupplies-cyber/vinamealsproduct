"use client";

import { useActionState } from "react";
import { Send } from "lucide-react";
import { startThread } from "@/app/admin/inbox/actions";
import { initialInboxActionState } from "@/lib/email/form-state";

/** Soạn thư mới tới một địa chỉ chưa có hội thoại. */
export function NewThreadForm() {
  const [state, action, pending] = useActionState(startThread, initialInboxActionState);

  return (
    <section className="form-card">
      <div className="form-card-heading">
        <div>
          <h2>Soạn thư mới</h2>
          <p>Gửi từ support@vinamealsupplies.com. Thư được lưu vào hộp thư chung.</p>
        </div>
      </div>

      <form className="inbox-compose" action={action}>
        <label>
          Gửi tới
          <input name="to" type="email" required placeholder="khach@example.com" />
        </label>
        <label>
          Tiêu đề
          <input name="subject" required maxLength={200} placeholder="Về đơn hàng của bạn" />
        </label>
        <label>
          Nội dung
          <textarea name="body" rows={6} required maxLength={20000} />
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
