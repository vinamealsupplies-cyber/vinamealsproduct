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
