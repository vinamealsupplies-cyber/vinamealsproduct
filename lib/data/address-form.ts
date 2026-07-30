import type { CustomerAddress } from "@/lib/data/address-types";

export type AddressFormState = {
  status: "idle" | "success" | "error";
  message: string;
  /** Id của địa chỉ vừa tạo — cart picker dùng để auto-select. */
  addressId?: string;
  /**
   * Địa chỉ vừa lưu (create/update). Cart/checkout giữ list trong client
   * state nên cần payload này để hiện ngay — router.refresh() không cập nhật.
   */
  address?: CustomerAddress;
};

export const initialAddressFormState: AddressFormState = {
  status: "idle",
  message: ""
};
