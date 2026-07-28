import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { redirect } from "next/navigation";
import { ProfileEditor } from "@/components/profile-editor";
import { getViewer } from "@/lib/auth";
import { getOwnCustomer } from "@/lib/data/tax-exemption";
import { formatUsPhoneDisplay } from "@/lib/data/us-states";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSupabaseAdminConfigured } from "@/lib/env";

export const metadata = { title: "Edit profile" };

export default async function ProfilePage() {
  const viewer = await getViewer();
  if (!viewer) {
    redirect("/login?next=/account/profile&message=Sign%20in%20to%20edit%20your%20profile.");
  }

  let phone = "";
  let companyName = "";
  let fullName = viewer.fullName || "";

  if (!viewer.demo && isSupabaseAdminConfigured()) {
    const supabase = createAdminClient();
    const [{ data: profile }, customer] = await Promise.all([
      supabase.from("profiles").select("full_name, phone").eq("id", viewer.id).maybeSingle(),
      getOwnCustomer(viewer.id)
    ]);
    fullName = profile?.full_name?.trim() || fullName;
    phone = profile?.phone?.trim() || customer?.phone?.trim() || "";
    companyName = customer?.company_name?.trim() || "";
    // Ưu tiên tên từ customers nếu profile trống.
    if (!fullName) {
      fullName = [customer?.first_name, customer?.last_name].filter(Boolean).join(" ");
    }
  }

  return (
    <div className="page-shell shell narrow-page account-page">
      <header className="page-heading">
        <Link className="text-link" href="/account">
          <ArrowLeft size={15} aria-hidden="true" /> Back to account
        </Link>
        <span className="kicker">My account</span>
        <h1>Edit profile</h1>
        <p>
          Keep your name and phone up to date so staff can contact you about orders
          {phone ? ` (${formatUsPhoneDisplay(phone) || phone})` : ""}.
        </p>
      </header>

      <ProfileEditor
        initial={{
          fullName,
          email: viewer.email,
          phone: phone ? formatUsPhoneDisplay(phone) || phone : "",
          companyName,
          role: viewer.role
        }}
      />
    </div>
  );
}
