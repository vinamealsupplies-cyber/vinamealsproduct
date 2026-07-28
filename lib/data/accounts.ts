import "server-only";

import type { AccountStatus, AdminAccount, AppRole } from "@/lib/roles";
import { createAdminClient } from "@/lib/supabase/admin";

export type { AccountStatus, AdminAccount };

type DbProfile = {
  id: string;
  email: string | null;
  full_name: string | null;
  phone: string | null;
  role: AppRole;
  status: AccountStatus;
  created_at: string;
  updated_at: string;
};

function mapProfile(row: DbProfile): AdminAccount {
  return {
    id: row.id,
    email: row.email,
    fullName: row.full_name,
    phone: row.phone,
    role: row.role,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

/** Toàn bộ tài khoản đăng nhập (profiles). Service role — đã gate admin ở page/action. */
export async function getAccountsForAdmin(): Promise<AdminAccount[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, email, full_name, phone, role, status, created_at, updated_at")
    .order("created_at", { ascending: false });

  if (error) throw new Error(`Failed to load accounts: ${error.message}`);
  return ((data ?? []) as DbProfile[]).map(mapProfile);
}

export async function countAdmins(): Promise<number> {
  const supabase = createAdminClient();
  const { count, error } = await supabase
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .eq("role", "admin")
    .eq("status", "active");

  if (error) throw new Error(`Failed to count admins: ${error.message}`);
  return count ?? 0;
}
