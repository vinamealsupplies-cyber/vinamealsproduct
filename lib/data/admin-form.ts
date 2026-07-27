// Type + state khởi tạo dùng chung cho các form quản trị.
// Tách khỏi file "use server" vì ở đó chỉ được export async function.

export type AdminFormState = {
  status: "idle" | "success" | "error";
  message: string;
};

export const initialAdminFormState: AdminFormState = { status: "idle", message: "" };
