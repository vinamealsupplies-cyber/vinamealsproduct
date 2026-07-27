export type AddressFormState = {
  status: "idle" | "success" | "error";
  message: string;
  /** Id của địa chỉ vừa tạo — cart picker dùng để auto-select. */
  addressId?: string;
};

export const initialAddressFormState: AddressFormState = {
  status: "idle",
  message: ""
};
