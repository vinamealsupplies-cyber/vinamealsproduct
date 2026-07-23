-- DEMO/LOCAL ONLY. Do not run against production without reviewing every row.

insert into public.app_settings (key, value, is_public, description)
values
  ('business.name', '"Vinameals"'::jsonb, true, 'Store display name'),
  ('business.currency', '"USD"'::jsonb, true, 'Default currency'),
  ('business.timezone', '"America/Los_Angeles"'::jsonb, false, 'Reporting timezone'),
  ('media.max_product_images', '10'::jsonb, false, 'Maximum images per product'),
  ('payments.enabled', 'false'::jsonb, true, 'Payment gateway feature flag')
on conflict (key) do update set value = excluded.value, is_public = excluded.is_public;

insert into public.inventory_locations (id, code, name)
values ('10000000-0000-0000-0000-000000000001', 'MAIN', 'Main Warehouse')
on conflict (id) do nothing;

insert into public.categories (id, parent_id, name, slug, description, sort_order)
values
  ('20000000-0000-0000-0000-000000000001', null, 'Pantry', 'pantry', 'Everyday pantry favorites.', 10),
  ('20000000-0000-0000-0000-000000000002', null, 'Frozen', 'frozen', 'Frozen foods ready for your freezer.', 20),
  ('20000000-0000-0000-0000-000000000003', null, 'Beverages', 'beverages', 'Refreshing drinks.', 30),
  ('20000000-0000-0000-0000-000000000004', null, 'Snacks', 'snacks', 'Crunchy and shareable snacks.', 40),
  ('20000000-0000-0000-0000-000000000005', null, 'Sauces', 'sauces', 'Flavor-packed sauces and condiments.', 50),
  ('20000000-0000-0000-0000-000000000006', '20000000-0000-0000-0000-000000000002', 'Dumplings', 'dumplings', 'Frozen dumplings and buns.', 10)
on conflict (id) do nothing;

insert into public.products (
  id, product_handle, name, slug, short_description, description, status, featured, published_at
)
values
  ('30000000-0000-0000-0000-000000000001', 'tropical-mango', 'Tropical Mango Slices', 'tropical-mango-slices', 'Sweet, sunny mango slices ready to enjoy.', 'Bright tropical mango slices with a soft bite and naturally sweet flavor.', 'active', true, now()),
  ('30000000-0000-0000-0000-000000000002', 'veggie-dumplings', 'Garden Veggie Dumplings', 'garden-veggie-dumplings', 'Tender dumplings filled with colorful vegetables.', 'Freezer-friendly vegetable dumplings for quick lunches, appetizers, and family meals.', 'active', true, now()),
  ('30000000-0000-0000-0000-000000000003', 'chili-crisp', 'Golden Chili Crisp', 'golden-chili-crisp', 'Crunchy, savory and gently spicy.', 'A spoonable chili crisp for noodles, rice, eggs, vegetables, and more.', 'active', true, now()),
  ('30000000-0000-0000-0000-000000000004', 'rice-crackers', 'Sesame Rice Crackers', 'sesame-rice-crackers', 'Light, crisp crackers with toasted sesame.', 'A bright pantry snack with a satisfying crunch.', 'active', false, now()),
  ('30000000-0000-0000-0000-000000000005', 'coconut-water', 'Pure Coconut Water', 'pure-coconut-water', 'Clean, refreshing coconut water.', 'Serve chilled for a crisp, refreshing drink.', 'active', false, now()),
  ('30000000-0000-0000-0000-000000000006', 'ramen-kit', 'Weeknight Ramen Kit', 'weeknight-ramen-kit', 'A quick ramen kit for cozy weeknight meals.', 'Noodles and a savory soup base packed for an easy meal.', 'active', false, now())
on conflict (id) do nothing;

insert into public.product_categories (product_id, category_id, is_primary)
values
  ('30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000004', true),
  ('30000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000006', true),
  ('30000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000005', true),
  ('30000000-0000-0000-0000-000000000004', '20000000-0000-0000-0000-000000000004', true),
  ('30000000-0000-0000-0000-000000000005', '20000000-0000-0000-0000-000000000003', true),
  ('30000000-0000-0000-0000-000000000006', '20000000-0000-0000-0000-000000000001', true)
on conflict do nothing;

insert into public.product_variants (
  id, product_id, variant_name, sku, retail_price, wholesale_price, cost_price, unit, is_default
)
values
  ('40000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', '8 oz bag', 'MANGO-8OZ', 8.99, 6.25, 3.40, 'bag', true),
  ('40000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000002', '20 count', 'DUMP-VEG-20', 12.99, 9.40, 5.20, 'bag', true),
  ('40000000-0000-0000-0000-000000000003', '30000000-0000-0000-0000-000000000003', '6 oz jar', 'CHILI-6OZ', 10.50, 7.60, 3.85, 'jar', true),
  ('40000000-0000-0000-0000-000000000004', '30000000-0000-0000-0000-000000000004', '5 oz bag', 'RICE-SES-5', 5.99, 4.20, 2.10, 'bag', true),
  ('40000000-0000-0000-0000-000000000005', '30000000-0000-0000-0000-000000000005', '16.9 fl oz', 'COCO-169', 3.99, 2.65, 1.35, 'bottle', true),
  ('40000000-0000-0000-0000-000000000006', '30000000-0000-0000-0000-000000000006', '2 serving kit', 'RAMEN-KIT-2', 11.99, 8.50, 4.60, 'kit', true)
on conflict (id) do nothing;

insert into public.product_media (
  id, product_id, media_type, provider, status, public_url, alt_text, position, is_primary
)
values
  ('50000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 'image', 'external', 'ready', '/products/tropical-mango.svg', 'Bright tropical mango slices', 1, true),
  ('50000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000002', 'image', 'external', 'ready', '/products/veggie-dumplings.svg', 'Garden vegetable dumplings', 1, true),
  ('50000000-0000-0000-0000-000000000003', '30000000-0000-0000-0000-000000000003', 'image', 'external', 'ready', '/products/chili-crisp.svg', 'Jar of golden chili crisp', 1, true),
  ('50000000-0000-0000-0000-000000000004', '30000000-0000-0000-0000-000000000004', 'image', 'external', 'ready', '/products/rice-crackers.svg', 'Sesame rice crackers', 1, true),
  ('50000000-0000-0000-0000-000000000005', '30000000-0000-0000-0000-000000000005', 'image', 'external', 'ready', '/products/coconut-water.svg', 'Bottle of pure coconut water', 1, true),
  ('50000000-0000-0000-0000-000000000006', '30000000-0000-0000-0000-000000000006', 'image', 'external', 'ready', '/products/ramen-kit.svg', 'Weeknight ramen kit', 1, true)
on conflict (id) do nothing;

insert into public.inventory_movements (
  variant_id, location_id, movement_type, quantity_change, unit_cost, reference, reason
)
select v.variant_id, '10000000-0000-0000-0000-000000000001', 'opening', v.qty, v.cost, 'DEMO-OPENING', 'Demo opening balance'
from (values
  ('40000000-0000-0000-0000-000000000001'::uuid, 42::numeric, 3.40::numeric),
  ('40000000-0000-0000-0000-000000000002'::uuid, 18::numeric, 5.20::numeric),
  ('40000000-0000-0000-0000-000000000003'::uuid, 27::numeric, 3.85::numeric),
  ('40000000-0000-0000-0000-000000000004'::uuid, 9::numeric, 2.10::numeric),
  ('40000000-0000-0000-0000-000000000005'::uuid, 64::numeric, 1.35::numeric),
  ('40000000-0000-0000-0000-000000000006'::uuid, 14::numeric, 4.60::numeric)
) as v(variant_id, qty, cost)
where not exists (
  select 1 from public.inventory_movements im
  where im.variant_id = v.variant_id and im.reference = 'DEMO-OPENING'
);

update public.inventory_balances ib
set reorder_point = values_table.reorder_point
from (values
  ('40000000-0000-0000-0000-000000000001'::uuid, 10::numeric),
  ('40000000-0000-0000-0000-000000000002'::uuid, 8::numeric),
  ('40000000-0000-0000-0000-000000000003'::uuid, 8::numeric),
  ('40000000-0000-0000-0000-000000000004'::uuid, 10::numeric),
  ('40000000-0000-0000-0000-000000000005'::uuid, 15::numeric),
  ('40000000-0000-0000-0000-000000000006'::uuid, 6::numeric)
) as values_table(variant_id, reorder_point)
where ib.variant_id = values_table.variant_id
  and ib.location_id = '10000000-0000-0000-0000-000000000001';

insert into public.expense_categories (name, description)
values
  ('Inventory supplies', 'Packaging and inventory handling supplies'),
  ('Marketing', 'Advertising and promotion'),
  ('Delivery and shipping', 'Freight and local delivery costs'),
  ('Software', 'Software and online services'),
  ('Other', 'Other operating expenses')
on conflict (name) do nothing;
