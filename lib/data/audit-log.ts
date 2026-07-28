import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

export type AuditLogEntry = {
  id: number;
  actorUserId: string | null;
  actorEmail: string | null;
  actorName: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  beforeData: unknown;
  afterData: unknown;
  metadata: Record<string, unknown>;
  createdAt: string;
};

type WriteAuditInput = {
  actorUserId: string | null | undefined;
  action: string;
  entityType: string;
  entityId?: string | null;
  before?: unknown;
  after?: unknown;
  metadata?: Record<string, unknown>;
};

/**
 * Ghi nhật ký thao tác (seller/staff/admin). Service role — bypass RLS.
 * Lỗi audit KHÔNG nuốt im: caller nên catch hoặc để bubble khi cần chặn thao tác.
 */
export async function writeAuditLog(input: WriteAuditInput): Promise<void> {
  const supabase = createAdminClient();
  const { error } = await supabase.from("audit_log").insert({
    actor_user_id: input.actorUserId ?? null,
    action: input.action,
    entity_type: input.entityType,
    entity_id: input.entityId ?? null,
    before_data: input.before ?? null,
    after_data: input.after ?? null,
    metadata: {
      ...(input.metadata ?? {}),
      source: "app"
    }
  });

  if (error) {
    // Không chặn nghiệp vụ chính nếu audit fail — vẫn báo rõ để theo dõi.
    console.error("[audit_log]", error.message, input.action, input.entityType, input.entityId);
  }
}

/** Đọc log cho staff/admin (service role). */
export async function getAuditLogsForStaff(limit = 200): Promise<AuditLogEntry[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("audit_log")
    .select(
      "id, actor_user_id, action, entity_type, entity_id, before_data, after_data, metadata, created_at, profiles!audit_log_actor_user_id_fkey ( email, full_name )"
    )
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(`Failed to load audit log: ${error.message}`);

  type Row = {
    id: number;
    actor_user_id: string | null;
    action: string;
    entity_type: string;
    entity_id: string | null;
    before_data: unknown;
    after_data: unknown;
    metadata: Record<string, unknown> | null;
    created_at: string;
    profiles:
      | { email: string | null; full_name: string | null }
      | { email: string | null; full_name: string | null }[]
      | null;
  };

  return ((data ?? []) as unknown as Row[]).map((row) => {
    const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
    return {
      id: row.id,
      actorUserId: row.actor_user_id,
      actorEmail: profile?.email ?? null,
      actorName: profile?.full_name ?? null,
      action: row.action,
      entityType: row.entity_type,
      entityId: row.entity_id,
      beforeData: row.before_data,
      afterData: row.after_data,
      metadata: row.metadata ?? {},
      createdAt: row.created_at
    };
  });
}
