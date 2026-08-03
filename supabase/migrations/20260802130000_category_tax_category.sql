-- Sales-tax class per category. Products inherit their tax class from their
-- primary category (Costco-style: packaged food / drinks are tax-free grocery,
-- household goods are taxable general). Default 'grocery' = tax-free in CA.
alter table public.categories
  add column if not exists tax_category tax_category not null default 'grocery';

comment on column public.categories.tax_category is
  'Sales-tax class applied to products in this category (grocery=exempt, general=taxable, prepared_food).';

-- categories uses column-level grants: the new column needs an explicit SELECT
-- grant so the storefront (anon) and admin (authenticated) clients can read it.
grant select (tax_category) on public.categories to anon, authenticated;

notify pgrst, 'reload schema';
