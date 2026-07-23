# Vinameals — Next.js Starter

This starter demonstrates the intended information architecture, bright modern English UI, product hover behavior, search/filter/sort, a 10-image media manager, account/admin routes, Supabase SSR utilities, R2 presigned uploads and Excel import preview parsing.

It is a development starter, not a finished production storefront. Storefront and admin tables currently use sample data until repository queries and mutation routes are connected; the UI labels the admin scaffold accordingly.

## Start locally

```bash
nvm use
cp .env.example .env.local
npm install --no-audit --no-fund
npm run dev
```

For a UI-only preview without Supabase, set `APP_DEMO_MODE=true`. This flag is intentionally ignored when `NODE_ENV=production`.

Dependencies are pinned in `package.json`. Commit the generated `package-lock.json` after the first successful install, then replace the CI install command with `npm ci`.

## Connect Supabase

1. Run the SQL migrations from the parent `database/` directory.
2. Run `database/tests/001_smoke_test.sql` in development/staging.
3. Add project URL and publishable key to `.env.local`.
4. Add the service-role key only for verified server-side jobs; never prefix it with `NEXT_PUBLIC_`.
5. Generate types:

```bash
supabase gen types typescript --linked > types/database.generated.ts
```

The placeholder generated type file is intentionally permissive. Replace it immediately after the schema is deployed so query mistakes become TypeScript errors.

## Connect Cloudflare R2

Create an R2 bucket and scoped token, configure CORS for the exact site origins, then fill the R2 variables. The presign endpoint allows JPEG, PNG, WebP and AVIF images up to 8 MB. The completion route verifies the stored object with a HEAD request, then calls the service-role-only `admin_complete_product_image` RPC so primary-image replacement and metadata insertion are atomic. Database constraints/triggers are the final enforcement for unique media references and the 10-image limit.

Use a separate private bucket or private key namespace for tax certificates, receipts and other sensitive documents; never expose those through `R2_PUBLIC_BASE_URL`.

## Optional Cloudflare Stream

Fill the Stream token and customer code. The starter endpoint creates a one-time direct upload URL and a pending `product_media` record for a product video. Complete webhook/status synchronization before publishing videos.

## Quality commands

```bash
npm run lint
npm run typecheck
npm run build
# or all three
npm run check
```

## Production work still required

- Connect storefront/admin sample data to Supabase queries.
- Persist the product form and implement transactional CRUD routes.
- Implement the import commit transaction, idempotency and media ingestion queue.
- Complete Stream webhook/status synchronization.
- Add cart/checkout/payment and sales-tax calculation.
- Add shipping/fulfillment and transactional email.
- Add rate limiting, origin/CSRF checks, malware/document handling, monitoring and full automated tests.
- Review accounting/tax logic with qualified professionals.
