import Link from "next/link";
import { Mail, MailOpen } from "lucide-react";
import { AdminPageHeader } from "@/components/admin-page-header";
import { NewThreadForm } from "@/components/inbox-new-thread-form";
import { requireAdminAccessPage } from "@/lib/auth";
import { getInboxThreads } from "@/lib/data/inbox";
import { formatDate } from "@/lib/format";

export const metadata = { title: "Inbox" };

export default async function InboxPage({
  searchParams
}: {
  searchParams: Promise<{ status?: string; compose?: string }>;
}) {
  // staff HOẶC seller — hộp thư dùng chung cho cả ba vai trò.
  await requireAdminAccessPage();

  const params = await searchParams;
  const status = params.status === "closed" || params.status === "all" ? params.status : "open";
  const threads = await getInboxThreads({ status });
  const unread = threads.filter((thread) => thread.hasUnread).length;

  return (
    <>
      <AdminPageHeader
        eyebrow="Support"
        title="Inbox"
        description="Thư gửi tới support@vinamealsupplies.com. Seller, manager và admin cùng xem một hộp thư."
        action={
          <Link className="button primary" href="/admin/inbox?compose=1">
            Soạn thư mới
          </Link>
        }
      />

      {params.compose ? <NewThreadForm /> : null}

      <div className="status-filter-tabs" role="tablist" aria-label="Lọc hội thoại">
        {(
          [
            ["open", "Đang mở"],
            ["closed", "Đã đóng"],
            ["all", "Tất cả"]
          ] as const
        ).map(([value, label]) => (
          <Link
            key={value}
            role="tab"
            aria-selected={status === value}
            className={status === value ? "chip-button active" : "chip-button"}
            href={`/admin/inbox?status=${value}`}
          >
            {label}
          </Link>
        ))}
        <span className="field-hint">
          {unread} chưa đọc · {threads.length} hội thoại
        </span>
      </div>

      <div className="data-table-card">
        {threads.length === 0 ? (
          <div className="empty-state">
            <MailOpen size={28} aria-hidden="true" />
            <p>Chưa có thư nào ở mục này.</p>
          </div>
        ) : (
          <ul className="inbox-list">
            {threads.map((thread) => (
              <li key={thread.id} className={thread.hasUnread ? "inbox-row unread" : "inbox-row"}>
                <Link href={`/admin/inbox/${thread.id}`}>
                  <span className="inbox-row-icon" aria-hidden="true">
                    {thread.hasUnread ? <Mail size={16} /> : <MailOpen size={16} />}
                  </span>
                  <span className="inbox-row-main">
                    <span className="inbox-row-top">
                      <strong>{thread.contactName || thread.contactAddress}</strong>
                      <small>{formatDate(thread.lastMessageAt)}</small>
                    </span>
                    <span className="inbox-row-subject">
                      {thread.subject}
                      {thread.messageCount > 1 ? (
                        <em className="inbox-count">{thread.messageCount}</em>
                      ) : null}
                    </span>
                    {thread.preview ? (
                      <small className="inbox-row-preview">{thread.preview}</small>
                    ) : null}
                  </span>
                  {thread.hasUnread ? (
                    <span className="status-pill warn">Chưa đọc</span>
                  ) : thread.status === "closed" ? (
                    <span className="status-pill">Đã đóng</span>
                  ) : null}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
