// Type + state khởi tạo cho form category.
// Tách khỏi actions.ts vì file "use server" chỉ được export async function —
// export một object hằng ở đó sẽ bị biến thành server reference, khiến client
// nhận `undefined` thay vì { status: "idle" }.

export type CategoryFormState = {
  status: "idle" | "success" | "error";
  message: string;
};

export const initialCategoryState: CategoryFormState = { status: "idle", message: "" };
