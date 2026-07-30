-- Store / seller business profile for invoices & offline payment instructions.
-- Stored in app_settings (service role writes from admin).

insert into public.app_settings (key, value, is_public, description)
values (
  'business.invoice_profile',
  '{
    "legalName": "Vinameals",
    "displayName": "Vinameals",
    "addressLine1": "Garden Grove, CA",
    "addressLine2": "",
    "city": "Garden Grove",
    "state": "CA",
    "postalCode": "",
    "country": "US",
    "phone": "",
    "email": "support@vinamealsupplies.com",
    "website": "https://vinamealsupplies.com",
    "logoPath": "/logo-vinameals.png",
    "payableTo": "Vinameals",
    "paymentTermsNote": "Total payment due as arranged. Include your order or invoice number on every payment.",
    "checkPayableTo": "Vinameals",
    "checkMailingNote": "Mail or drop off checks with the order number on the memo line.",
    "zelleName": "",
    "zelleEmailOrPhone": "",
    "zelleInstructions": "Send via Zelle. Put your order number in the memo.",
    "bankName": "",
    "bankAccountName": "",
    "bankRoutingNumber": "",
    "bankAccountNumber": "",
    "bankAccountType": "checking",
    "bankInstructions": "Use ACH / bank transfer. Use your order number as the payment reference."
  }'::jsonb,
  false,
  'Seller business identity + Zelle/check/bank details shown on customer invoices'
)
on conflict (key) do nothing;

-- Managers can update settings (app uses service role; policy is defense in depth).
drop policy if exists app_settings_manager_write on public.app_settings;
create policy app_settings_manager_write
  on public.app_settings for all to authenticated
  using ((select private.is_manager()))
  with check ((select private.is_manager()));

grant insert, update on public.app_settings to authenticated;
