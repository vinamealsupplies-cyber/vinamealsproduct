# Supabase Database Setup

Run the SQL files in this order, preferably through Supabase CLI migrations:

1. `001_types_and_schema.sql`
2. `002_functions_and_triggers.sql`
3. `003_rls_and_grants.sql`
4. `004_reporting_views.sql`
5. `006_transactional_admin_rpcs.sql`
6. `005_seed_demo.sql` — local/demo only; skip in production

Then run the transactional verification script:

7. `tests/001_smoke_test.sql` — development/staging verification; ends with `ROLLBACK`

Recommended workflow:

```bash
supabase init
supabase link --project-ref YOUR_PROJECT_REF
supabase migration new food_commerce_schema
# Copy SQL into timestamped migration files, preserving order.
supabase db push
supabase gen types typescript --linked > starter/types/database.generated.ts
```

For the smoke test, open the Supabase SQL Editor after migrations and run `tests/001_smoke_test.sql`. It verifies category/media constraints, inventory sign/reversal/immutability rules, tax-review audit fields, order/customer/currency consistency, invoice/payment totals and reporting projections without retaining test rows or consuming numbering sequences.

Important:

- Do not run demo seed on production.
- Test RLS using anon, authenticated customer, staff, manager, admin and service-role server requests.
- Public/authenticated catalog grants are column-scoped; internal cost, media object keys and creator IDs are not exposed to customer clients.
- `admin_complete_product_image` is service-role only and atomically changes the primary image plus inserts the new media row.
- Reporting views are management-reporting starting points, not a substitute for accounting/tax review.
- `service_role` must remain server-side.
- Copy these files into timestamped migrations before production; do not edit a migration after it has been applied.
