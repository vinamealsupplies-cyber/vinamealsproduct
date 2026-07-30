"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import {
  Building2,
  ChevronDown,
  LogOut,
  MapPin,
  Package,
  ShieldCheck,
  UserRound
} from "lucide-react";

// Dropdown tài khoản trên header. Dùng button + panel (không dùng <details>
// controlled) — cùng lý do như CategoryMenu: open={state} xung đột toggle native.
export function AccountMenu({
  signedIn,
  fullName,
  email,
  canAccessAdmin = false,
  adminLabel = "Admin"
}: {
  signedIn: boolean;
  fullName?: string;
  email?: string;
  canAccessAdmin?: boolean;
  adminLabel?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const panelId = useId();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  if (!signedIn) {
    return (
      <Link className="header-action" href="/login" aria-label="Sign in">
        <UserRound size={19} aria-hidden="true" />
        <span className="header-account-label">Sign in</span>
      </Link>
    );
  }

  const close = () => setOpen(false);

  return (
    <div className={`account-menu${open ? " is-open" : ""}`} ref={ref}>
      <button
        type="button"
        className="header-action account-menu-trigger"
        aria-expanded={open}
        aria-controls={panelId}
        aria-label="Account menu"
        onClick={() => setOpen((value) => !value)}
      >
        <UserRound size={19} aria-hidden="true" />
        <span className="header-account-label">Account</span>
        <ChevronDown className="account-menu-caret" size={15} aria-hidden="true" />
      </button>

      {open ? (
        <div className="account-dropdown" id={panelId} role="menu">
          <div className="account-dropdown-head">
            <strong>{fullName?.trim() || "My account"}</strong>
            {email ? <span>{email}</span> : null}
          </div>

          <Link href="/account/orders" role="menuitem" onClick={close}>
            <Package size={16} aria-hidden="true" />
            Orders &amp; purchase history
          </Link>
          <Link href="/account/profile" role="menuitem" onClick={close}>
            <UserRound size={16} aria-hidden="true" />
            Profile
          </Link>
          <Link href="/account/addresses" role="menuitem" onClick={close}>
            <MapPin size={16} aria-hidden="true" />
            Shipping addresses
          </Link>
          <Link href="/account/business-application" role="menuitem" onClick={close}>
            <Building2 size={16} aria-hidden="true" />
            Business &amp; tax exemption
          </Link>

          {canAccessAdmin ? (
            <>
              <span className="account-dropdown-divider" aria-hidden="true" />
              <Link href="/admin" role="menuitem" onClick={close}>
                <ShieldCheck size={16} aria-hidden="true" />
                {adminLabel}
              </Link>
            </>
          ) : null}

          <span className="account-dropdown-divider" aria-hidden="true" />
          <form action="/auth/signout" method="post">
            <button type="submit" role="menuitem" onClick={close}>
              <LogOut size={16} aria-hidden="true" />
              Sign out
            </button>
          </form>
        </div>
      ) : null}
    </div>
  );
}
