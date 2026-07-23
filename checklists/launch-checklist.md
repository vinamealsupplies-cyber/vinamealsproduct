# Production Launch Checklist

## Business and content

- [ ] Business name, support email, phone and address are final.
- [ ] Shipping/return/privacy/terms policies are reviewed.
- [ ] Product names, prices, units, allergens and descriptions are verified.
- [ ] Wholesale and tax-exempt process is reviewed by a qualified professional.

## Infrastructure

- [ ] Production Supabase project and migrations are applied.
- [ ] RLS tests pass in production-like environment.
- [ ] Cloudflare R2 CORS/custom domain are configured.
- [ ] Stream/webhooks configured if used.
- [ ] Secrets are in hosting environment, not repository.
- [ ] Backups and restore procedure are tested.

## Application

- [ ] Admin routes require verified role.
- [ ] Service key is absent from browser bundle.
- [ ] Error monitoring and logs are enabled.
- [ ] Rate limits and security headers are enabled.
- [ ] Accessibility and responsive QA pass.
- [ ] Search/filter/sort and product gallery pass.
- [ ] Inventory/invoice/payment/report reconciliation pass.
- [ ] Import rollback/idempotency tests pass.

## Operations

- [ ] At least two admin accounts have MFA where supported.
- [ ] Staff permissions are least privilege.
- [ ] Low-stock and customer support workflows are documented.
- [ ] Incident contacts and rollback plan are documented.
