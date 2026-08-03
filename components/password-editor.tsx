"use client";

import { useActionState, useState } from "react";
import { KeyRound, Save } from "lucide-react";
import { changePasswordAction } from "@/app/(storefront)/account/profile/actions";
import { initialAdminFormState, type AdminFormState } from "@/lib/data/admin-form";

export function PasswordEditor() {
  const [state, setState] = useState<AdminFormState>(initialAdminFormState);
  const [formKey, setFormKey] = useState(0);

  const [, action, pending] = useActionState(
    async (prev: AdminFormState, formData: FormData) => {
      const result = await changePasswordAction(prev, formData);
      setState(result);
      if (result.status === "success") setFormKey((k) => k + 1); // reset các ô
      return result;
    },
    initialAdminFormState
  );

  return (
    <div className="profile-editor form-card" style={{ marginTop: 18 }}>
      <div className="form-card-heading">
        <div>
          <h2>
            <KeyRound size={18} aria-hidden="true" /> Đổi mật khẩu
          </h2>
          <p className="field-hint">Nhập mật khẩu hiện tại để xác nhận, rồi đặt mật khẩu mới.</p>
        </div>
      </div>

      {state.status !== "idle" ? (
        <div
          className={state.status === "success" ? "form-success" : "form-error"}
          role="status"
        >
          {state.message}
        </div>
      ) : null}

      <form action={action} className="form-grid" key={formKey}>
        <label className="full-width">
          Mật khẩu hiện tại
          <input type="password" name="currentPassword" required autoComplete="current-password" />
        </label>
        <label className="full-width">
          Mật khẩu mới (ít nhất 8 ký tự)
          <input
            type="password"
            name="newPassword"
            required
            minLength={8}
            autoComplete="new-password"
          />
        </label>
        <label className="full-width">
          Nhập lại mật khẩu mới
          <input
            type="password"
            name="confirmPassword"
            required
            minLength={8}
            autoComplete="new-password"
          />
        </label>
        <div className="button-row">
          <button className="button primary" type="submit" disabled={pending}>
            <Save size={16} aria-hidden="true" /> {pending ? "Đang đổi…" : "Đổi mật khẩu"}
          </button>
        </div>
      </form>
    </div>
  );
}
