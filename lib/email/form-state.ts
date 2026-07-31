// Tách khỏi app/admin/inbox/actions.ts vì file đó là "use server": mọi thứ
// export từ đó đều biến thành server reference, nên hằng số initial state sẽ về
// undefined ở client và form luôn hiện ô lỗi rỗng.
export type InboxActionState = { status: "idle" | "success" | "error"; message: string };

export const initialInboxActionState: InboxActionState = { status: "idle", message: "" };
