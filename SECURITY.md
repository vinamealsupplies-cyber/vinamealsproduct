# Security policy

Do not open a public issue containing credentials, personal customer data, private object URLs or exploitable security details. Report suspected vulnerabilities privately to the repository owner/security contact configured by the business.

## Never commit

- Supabase service-role keys
- Cloudflare API tokens or R2 secret keys
- Production `.env` files
- Tax-exemption certificates, receipts or customer exports
- Payment credentials or webhook secrets

## Required controls before production

- Verified server-side role checks for every admin mutation
- Row Level Security tests by role and customer ownership
- Rate limiting for authentication, upload, search and mutation routes
- Origin/CSRF controls for cookie-authenticated mutations
- Signed and verified webhooks
- Dependency/secret scanning
- Logging, alerting, backups and restore testing
- No card number or CVV storage
