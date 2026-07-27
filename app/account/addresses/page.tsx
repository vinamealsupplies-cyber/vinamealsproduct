import Link from "next/link";
import { ArrowLeft, MapPin, UserRound } from "lucide-react";
import { AddressManager } from "@/components/address-manager";
import { SetupNotice } from "@/components/setup-notice";
import { getViewer } from "@/lib/auth";
import { getOwnShippingAddresses } from "@/lib/data/addresses";
import { isSupabaseAdminConfigured } from "@/lib/env";

export const metadata = { title: "Shipping addresses" };

export default async function AccountAddressesPage({
  searchParams
}: {
  searchParams: Promise<{ new?: string }>;
}) {
  const viewer = await getViewer();
  if (!viewer) {
    return (
      <div className="page-shell shell narrow-page">
        <div className="empty-state large">
          <UserRound size={36} />
          <h1>Sign in to manage addresses</h1>
          <p>Save U.S. shipping addresses and pick one when you place an order.</p>
          <Link className="button primary" href="/login?next=/account/addresses">
            Sign in
          </Link>
        </div>
      </div>
    );
  }

  const params = await searchParams;
  const addresses =
    viewer.demo || !isSupabaseAdminConfigured()
      ? []
      : await getOwnShippingAddresses(viewer.id);

  return (
    <div className="page-shell shell narrow-page">
      <header className="page-heading">
        <Link className="text-link" href="/account">
          <ArrowLeft size={15} aria-hidden="true" /> Back to account
        </Link>
        <span className="kicker">My account</span>
        <h1>
          <MapPin size={28} aria-hidden="true" /> Shipping addresses
        </h1>
        <p>Add delivery details so checkout can ship to the right place.</p>
      </header>

      {viewer.demo ? (
        <SetupNotice>
          Demo mode is active. Connect Supabase to save real shipping addresses.
        </SetupNotice>
      ) : null}

      <AddressManager addresses={addresses} openNew={params.new === "1"} />
    </div>
  );
}
