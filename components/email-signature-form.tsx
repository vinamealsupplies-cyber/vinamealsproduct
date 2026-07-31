"use client";

import { useActionState } from "react";
import { PenLine, ShieldCheck } from "lucide-react";
import { saveMySignature } from "@/app/admin/inbox/actions";
import { initialInboxActionState } from "@/lib/email/form-state";

/**
 * Chữ ký cá nhân — phần nhân viên TỰ soạn.
 *
 * Không có ô nào cho tên người gửi: dòng "Sent by <họ tên>" do server chèn từ
 * phiên đăng nhập và luôn nằm dưới chữ ký này. Bản xem trước bên dưới cho thấy
 * đúng thứ tự đó.
 */
export function EmailSignatureForm({
  initial,
  senderName
}: {
  initial: string;
  senderName: string;
}) {
  const [state, action, pending] = useActionState(saveMySignature, initialInboxActionState);

  return (
    <section className="form-card">
      <div className="form-card-heading">
        <div>
          <h2>Chữ ký của tôi</h2>
          <p>Được chèn vào cuối mọi thư bạn gửi từ hộp thư hỗ trợ.</p>
        </div>
      </div>

      <form className="signature-form" action={action}>
        <label>
          Chữ ký
          <textarea
            name="signature"
            rows={4}
            maxLength={600}
            defaultValue={initial}
            placeholder={"Vy Nguyen\nCustomer Care\n(714) 555-0134"}
          />
        </label>

        <div className="signature-preview">
          <small>Xem trước cuối thư</small>
          {initial ? <p className="signature-preview-body">{initial}</p> : null}
          <p className="signature-preview-locked">
            <ShieldCheck size={13} aria-hidden="true" /> Sent by {senderName} — Vinameals
          </p>
          <small className="field-hint">
            Dòng cuối do hệ thống chèn để xác nhận thư do ai gửi — bạn và người khác đều không sửa
            được.
          </small>
        </div>

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
          <PenLine size={15} aria-hidden="true" /> {pending ? "Đang lưu…" : "Lưu chữ ký"}
        </button>
      </form>
    </section>
  );
}
