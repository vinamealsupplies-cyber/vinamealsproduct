"use client";

import { useEffect } from "react";
import { bindCartAccount } from "@/lib/cart";

/**
 * Gắn userId từ server → store giỏ client.
 * Chỉ tài khoản đã đăng nhập mới có giỏ (DB). Guest = giỏ trống.
 */
export function CartAccountBridge({ userId }: { userId: string | null }) {
  useEffect(() => {
    bindCartAccount(userId);
  }, [userId]);

  return null;
}
