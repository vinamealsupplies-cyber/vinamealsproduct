import "server-only";

import type { AddressType, CustomerAddress } from "@/lib/data/address-types";
import { createAdminClient } from "@/lib/supabase/admin";

export type { AddressType, CustomerAddress } from "@/lib/data/address-types";
export { formatAddressLine, formatAddressMultiline } from "@/lib/data/address-types";

type DbAddress = {
  id: string;
  customer_id: string;
  address_type: AddressType;
  label: string | null;
  recipient_name: string | null;
  company_name: string | null;
  phone: string | null;
  note: string | null;
  line1: string;
  line2: string | null;
  city: string;
  state_region: string;
  postal_code: string;
  country_code: string;
  is_default: boolean;
  created_at: string;
};

const SELECT =
  "id, customer_id, address_type, label, recipient_name, company_name, phone, note, line1, line2, city, state_region, postal_code, country_code, is_default, created_at";

function mapAddress(row: DbAddress): CustomerAddress {
  return {
    id: row.id,
    customerId: row.customer_id,
    addressType: row.address_type,
    label: row.label,
    recipientName: row.recipient_name,
    companyName: row.company_name,
    phone: row.phone,
    note: row.note,
    line1: row.line1,
    line2: row.line2,
    city: row.city,
    stateRegion: row.state_region,
    postalCode: row.postal_code,
    countryCode: row.country_code,
    isDefault: row.is_default,
    createdAt: row.created_at
  };
}

/** Địa chỉ shipping của khách đang đăng nhập (default trước, rồi mới nhất). */
export async function getOwnShippingAddresses(authUserId: string): Promise<CustomerAddress[]> {
  const supabase = createAdminClient();
  const { data: customer } = await supabase
    .from("customers")
    .select("id")
    .eq("auth_user_id", authUserId)
    .maybeSingle();
  if (!customer) return [];

  const { data, error } = await supabase
    .from("customer_addresses")
    .select(SELECT)
    .eq("customer_id", customer.id)
    .eq("address_type", "shipping")
    .order("is_default", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) return [];
  return ((data ?? []) as DbAddress[]).map(mapAddress);
}

/** Customer id gắn với user — null nếu chưa có hồ sơ khách. */
export async function getOwnCustomerId(authUserId: string): Promise<string | null> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("customers")
    .select("id")
    .eq("auth_user_id", authUserId)
    .maybeSingle();
  return data?.id ?? null;
}
