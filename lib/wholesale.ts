/** Wholesale eligibility — safe for client + server. */

export type WholesaleMinKind = "quantity" | "amount";

export type WholesaleAccount = {
  customerId: string;
  companyName: string | null;
  /** true = gán mác wholesale (admin). */
  isWholesale: boolean;
  minKind: WholesaleMinKind | null;
  minValue: number | null;
};

export type WholesaleEligibility = {
  isWholesale: boolean;
  qualifies: boolean;
  minKind: WholesaleMinKind | null;
  minValue: number | null;
  cartQuantity: number;
  cartAmount: number;
  /** Thông báo khi là wholesale nhưng chưa đủ ngưỡng. */
  message: string | null;
};

export function evaluateWholesaleEligibility(
  account: WholesaleAccount | null | undefined,
  cartQuantity: number,
  /** Subtotal dùng để so threshold amount (thường = tổng giá sỉ dự kiến). */
  cartAmount: number
): WholesaleEligibility {
  if (!account?.isWholesale) {
    return {
      isWholesale: false,
      qualifies: false,
      minKind: null,
      minValue: null,
      cartQuantity,
      cartAmount,
      message: null
    };
  }

  const kind = account.minKind;
  const min = account.minValue;

  // Wholesale nhưng admin chưa set ngưỡng → vẫn cho giá sỉ (chỉ cần mác wholesale).
  if (!kind || min == null || min <= 0) {
    return {
      isWholesale: true,
      qualifies: true,
      minKind: kind,
      minValue: min,
      cartQuantity,
      cartAmount,
      message: null
    };
  }

  if (kind === "quantity") {
    const ok = cartQuantity >= min;
    return {
      isWholesale: true,
      qualifies: ok,
      minKind: kind,
      minValue: min,
      cartQuantity,
      cartAmount,
      message: ok
        ? null
        : `Wholesale pricing unlocks at ${min} items (you have ${cartQuantity}).`
    };
  }

  // amount
  const ok = cartAmount + 1e-9 >= min;
  return {
    isWholesale: true,
    qualifies: ok,
    minKind: kind,
    minValue: min,
    cartQuantity,
    cartAmount,
    message: ok
      ? null
      : `Wholesale pricing unlocks at $${min.toFixed(2)} subtotal (current $${cartAmount.toFixed(2)}).`
  };
}
