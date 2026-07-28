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

/** Viewer tối thiểu để đóng dấu tên nhân viên vào audit log. */
export type AuditActor = {
  id: string;
  email?: string | null;
  fullName?: string | null;
  role?: string | null;
};

type WriteAuditInput = {
  actorUserId: string | null | undefined;
  action: string;
  entityType: string;
  entityId?: string | null;
  before?: unknown;
  after?: unknown;
  metadata?: Record<string, unknown>;
  /**
   * Tên hiển thị đóng dấu vào metadata (denormalized) — không phụ thuộc join
   * profiles lúc đọc (full_name có thể trống).
   */
  actorName?: string | null;
  actorEmail?: string | null;
  actorRole?: string | null;
};

/** Tên nhân viên dùng trong log: full name → email → id ngắn. */
export function actorDisplayName(actor: AuditActor): string {
  const name = actor.fullName?.trim();
  if (name) return name;
  const email = actor.email?.trim();
  if (email) return email;
  return actor.id.slice(0, 8);
}

/**
 * Metadata chuẩn gắn mọi thao tác staff/seller: tên + email + role.
 * Gọi: metadata: { ...actorAuditMeta(viewer), orderNumber: "..." }
 */
export function actorAuditMeta(actor: AuditActor): Record<string, string> {
  return {
    actorName: actorDisplayName(actor),
    actorEmail: actor.email?.trim() || "",
    actorRole: actor.role?.trim() || ""
  };
}

/**
 * Ghi nhật ký thao tác (seller/staff/admin). Service role — bypass RLS.
 * Luôn denormalize actorName vào metadata để Activity log hiện tên ngay cả khi
 * profiles.full_name trống.
 */
export async function writeAuditLog(input: WriteAuditInput): Promise<void> {
  const supabase = createAdminClient();

  const metaFromTop: Record<string, unknown> = {};
  if (input.actorName) metaFromTop.actorName = input.actorName;
  if (input.actorEmail) metaFromTop.actorEmail = input.actorEmail;
  if (input.actorRole) metaFromTop.actorRole = input.actorRole;

  const { error } = await supabase.from("audit_log").insert({
    actor_user_id: input.actorUserId ?? null,
    action: input.action,
    entity_type: input.entityType,
    entity_id: input.entityId ?? null,
    before_data: input.before ?? null,
    after_data: input.after ?? null,
    metadata: {
      source: "app",
      ...metaFromTop,
      ...(input.metadata ?? {})
    }
  });

  if (error) {
    // Không chặn nghiệp vụ chính nếu audit fail — vẫn báo rõ để theo dõi.
    console.error("[audit_log]", error.message, input.action, input.entityType, input.entityId);
  }
}

function metaString(meta: Record<string, unknown>, key: string): string | null {
  const value = meta[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
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
    const metadata = row.metadata ?? {};
    // Ưu tiên tên profile; fallback metadata denormalized lúc ghi.
    const actorName =
      profile?.full_name?.trim() ||
      metaString(metadata, "actorName") ||
      metaString(metadata, "confirmedByName") ||
      metaString(metadata, "cancelledByName") ||
      null;
    const actorEmail =
      profile?.email?.trim() || metaString(metadata, "actorEmail") || null;

    return {
      id: row.id,
      actorUserId: row.actor_user_id,
      actorEmail,
      actorName,
      action: row.action,
      entityType: row.entity_type,
      entityId: row.entity_id,
      beforeData: row.before_data,
      afterData: row.after_data,
      metadata,
      createdAt: row.created_at
    };
  });
}
