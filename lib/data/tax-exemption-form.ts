// Type + state khởi tạo cho form miễn thuế.
// Tách khỏi file "use server" vì ở đó chỉ được export async function.

export type TaxExemptionFormState = {
  status: "idle" | "success" | "error";
  message: string;
};

export const initialTaxExemptionState: TaxExemptionFormState = { status: "idle", message: "" };
