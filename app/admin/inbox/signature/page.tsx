import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { AdminPageHeader } from "@/components/admin-page-header";
import { EmailSignatureForm } from "@/components/email-signature-form";
import { requireAdminAccessPage } from "@/lib/auth";
import { senderDisplayName } from "@/lib/email/signature";
import { createAdminClient } from "@/lib/supabase/admin";

export const metadata = { title: "Chữ ký email" };

// Trang RIÊNG thay vì nhét vào /admin/settings: trang đó dùng requireStaffPage()
// nên seller không vào được, mà seller cũng cần đặt chữ ký của mình.
export default async function SignaturePage() {
  const viewer = await requireAdminAccessPage();

  const { data } = await createAdminClient()
    .from("profiles")
    .select("email_signature")
    .eq("id", viewer.id)
    .maybeSingle();

  return (
    <>
      <AdminPageHeader
        eyebrow="Hộp thư"
        title="Chữ ký email"
        description="Chữ ký riêng của bạn. Mỗi người một chữ ký, không ảnh hưởng người khác."
        action={
          <Link className="button ghost" href="/admin/inbox">
            <ArrowLeft size={15} aria-hidden="true" /> Về hộp thư
          </Link>
        }
      />

      <EmailSignatureForm
        initial={(data?.email_signature as string | null) ?? ""}
        senderName={senderDisplayName(viewer)}
      />
    </>
  );
}
