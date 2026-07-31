"use client";

import { useActionState } from "react";
import { Send, ShieldCheck } from "lucide-react";
import { sendThreadReply } from "@/app/admin/inbox/actions";
import { initialInboxActionState } from "@/lib/email/form-state";

/**
 * Ô trả lời trong hội thoại.
 *
 * Cố ý KHÔNG có ô nhập tên người gửi. Tên được server lấy từ phiên đăng nhập và
 * chèn vào cuối thư; DB còn có CHECK constraint bắt buộc mọi thư gửi đi phải có
 * tên. Dòng chú thích bên dưới cho nhân viên thấy trước điều đó.
 */
export function InboxReplyForm({
  threadId,
  senderName,
  hasSignature
}: {
  threadId: string;
  senderName: string;
  hasSignature: boolean;
}) {
  const [state, action, pending] = useActionState(sendThreadReply, initialInboxActionState);

  return (
    <form className="inbox-reply" action={action}>
      <input type="hidden" name="threadId" value={threadId} />
      <label>
        Trả lời
        <textarea
          name="body"
          rows={6}
          required
          maxLength={20000}
          placeholder="Nhập nội dung trả lời…"
        />
      </label>

      <p className="field-hint">
        <ShieldCheck size={14} aria-hidden="true" /> Thư sẽ tự động ký{" "}
        <strong>Sent by {senderName}</strong> — không sửa được.{" "}
        {hasSignature ? (
          <>Chữ ký cá nhân của bạn được chèn phía trên dòng này.</>
        ) : (
          <>
            Bạn chưa đặt chữ ký cá nhân — thêm ở <a href="/admin/settings">Settings</a>.
          </>
        )}
      </p>

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
        <Send size={15} aria-hidden="true" /> {pending ? "Đang gửi…" : "Gửi"}
      </button>
    </form>
  );
}
