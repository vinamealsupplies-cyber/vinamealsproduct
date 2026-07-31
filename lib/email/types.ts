export type EmailDirection = "inbound" | "outbound";
export type EmailThreadStatus = "open" | "closed";

export type InboxThread = {
  id: string;
  subject: string;
  contactAddress: string;
  contactName: string | null;
  customerId: string | null;
  status: EmailThreadStatus;
  messageCount: number;
  hasUnread: boolean;
  lastMessageAt: string;
  createdAt: string;
  /** Chỉ có ở màn danh sách — trích từ thư mới nhất. */
  preview?: string;
};

export type InboxAttachment = {
  id: string;
  filename: string;
  contentType: string;
  bytes: number;
  objectKey: string;
};

export type InboxMessage = {
  id: string;
  threadId: string;
  direction: EmailDirection;
  fromAddress: string;
  fromName: string | null;
  toAddresses: string[];
  ccAddresses: string[];
  subject: string;
  textBody: string | null;
  htmlBody: string | null;
  rfcMessageId: string | null;
  inReplyTo: string | null;
  /** Chỉ thư gửi đi mới có — DB ép buộc bằng CHECK constraint. */
  sentByName: string | null;
  sentBy: string | null;
  providerId: string | null;
  createdAt: string;
  attachments: InboxAttachment[];
};
