-- Transactional smoke test for migrations 001-005.
-- Run this in the Supabase SQL Editor after applying the migrations.
-- Every test row is rolled back at the end.

begin;

-- Make owner-rights reporting views exercise their service-role gate during this test.
select set_config('request.jwt.claim.role', 'service_role', true);

do $$
declare
  v_suffix text := replace(gen_random_uuid()::text, '-', '');
  v_parent_category_id uuid;
  v_child_category_id uuid;
  v_product_id uuid;
  v_variant_id uuid;
  v_location_id uuid;
  v_opening_movement_id uuid;
  v_customer_id uuid;
  v_other_customer_id uuid;
  v_order_id uuid;
  v_invoice_id uuid;
  v_on_hand numeric(14,3);
  v_reserved numeric(14,3);
  v_available numeric(14,3);
  v_order_total numeric(14,2);
  v_invoice_total numeric(14,2);
  v_amount_paid numeric(14,2);
  v_balance_due numeric(14,2);
  v_invoice_status public.invoice_status;
  v_count integer;
  v_expected_error boolean;
begin
  insert into public.categories (name, slug)
  values ('Smoke Parent', 'smoke-parent-' || v_suffix)
  returning id into v_parent_category_id;

  insert into public.categories (parent_id, name, slug)
  values (v_parent_category_id, 'Smoke Child', 'smoke-child-' || v_suffix)
  returning id into v_child_category_id;

  v_expected_error := false;
  begin
    update public.categories
    set parent_id = v_child_category_id
    where id = v_parent_category_id;
  exception
    when others then
      if position('cycle' in lower(sqlerrm)) = 0 then
        raise;
      end if;
      v_expected_error := true;
  end;

  if not v_expected_error then
    raise exception 'Smoke test failed: category cycle was accepted.';
  end if;

  insert into public.products (
    product_handle, name, slug, short_description, status, published_at
  ) values (
    'SMOKE-' || upper(left(v_suffix, 10)),
    'Smoke Test Product',
    'smoke-product-' || v_suffix,
    'Temporary product created by the database smoke test.',
    'active',
    now()
  ) returning id into v_product_id;

  insert into public.product_categories (product_id, category_id, is_primary)
  values (v_product_id, v_child_category_id, true);

  insert into public.product_variants (
    product_id, variant_name, sku, retail_price, wholesale_price, cost_price,
    taxable, track_inventory, unit, is_default
  ) values (
    v_product_id,
    'Default',
    'SMOKE-SKU-' || upper(left(v_suffix, 12)),
    5.00,
    4.00,
    2.0000,
    true,
    true,
    'each',
    true
  ) returning id into v_variant_id;

  for v_count in 1..10 loop
    insert into public.product_media (
      product_id, media_type, provider, status, public_url,
      alt_text, position, is_primary
    ) values (
      v_product_id,
      'image',
      'external',
      'ready',
      'https://example.com/smoke/' || v_suffix || '/' || v_count || '.jpg',
      'Smoke image ' || v_count,
      v_count,
      v_count = 1
    );
  end loop;

  v_expected_error := false;
  begin
    insert into public.product_media (
      product_id, media_type, provider, status, public_url, alt_text, position
    ) values (
      v_product_id,
      'image',
      'external',
      'ready',
      'https://example.com/smoke/' || v_suffix || '/11.jpg',
      'Smoke image 11',
      10
    );
  exception
    when others then
      if position('at most 10 images' in lower(sqlerrm)) = 0 then
        raise;
      end if;
      v_expected_error := true;
  end;

  if not v_expected_error then
    raise exception 'Smoke test failed: an eleventh product image was accepted.';
  end if;

  insert into public.inventory_locations (code, name)
  values ('SMK-' || upper(left(v_suffix, 8)), 'Smoke Test Warehouse')
  returning id into v_location_id;

  insert into public.inventory_movements (
    variant_id, location_id, movement_type, quantity_change,
    unit_cost, source_type, reference, reason
  ) values (
    v_variant_id, v_location_id, 'opening', 12,
    2.0000, 'smoke_test', 'SMOKE-OPENING', 'Opening balance smoke test'
  ) returning id into v_opening_movement_id;

  insert into public.inventory_movements (
    variant_id, location_id, movement_type, quantity_reserved_change,
    source_type, reference, reason
  ) values (
    v_variant_id, v_location_id, 'reserve', 3,
    'smoke_test', 'SMOKE-RESERVE', 'Reservation smoke test'
  );

  select quantity_on_hand, quantity_reserved, available_quantity
  into v_on_hand, v_reserved, v_available
  from public.inventory_balances
  where variant_id = v_variant_id and location_id = v_location_id;

  if v_on_hand <> 12 or v_reserved <> 3 or v_available <> 9 then
    raise exception 'Smoke test failed: inventory expected 12/3/9 but got %/%/%',
      v_on_hand, v_reserved, v_available;
  end if;

  v_expected_error := false;
  begin
    insert into public.inventory_movements (
      variant_id, location_id, movement_type, quantity_change,
      source_type, reference, reason
    ) values (
      v_variant_id, v_location_id, 'sale', 1,
      'smoke_test', 'SMOKE-BAD-SALE', 'Positive sale quantity must be rejected'
    );
  exception
    when others then
      if position('requires a negative' in lower(sqlerrm)) = 0 then
        raise;
      end if;
      v_expected_error := true;
  end;

  if not v_expected_error then
    raise exception 'Smoke test failed: an inventory sale with a positive quantity was accepted.';
  end if;

  v_expected_error := false;
  begin
    insert into public.inventory_movements (
      variant_id, location_id, movement_type, quantity_change, reversal_of,
      source_type, reference, reason
    ) values (
      v_variant_id, v_location_id, 'reversal', -11, v_opening_movement_id,
      'smoke_test', 'SMOKE-BAD-REVERSAL', 'Inexact reversal must be rejected'
    );
  exception
    when others then
      if position('exact opposite' in lower(sqlerrm)) = 0 then
        raise;
      end if;
      v_expected_error := true;
  end;

  if not v_expected_error then
    raise exception 'Smoke test failed: an inexact inventory reversal was accepted.';
  end if;

  v_expected_error := false;
  begin
    update public.inventory_movements
    set reason = 'This update must be rejected.'
    where id = v_opening_movement_id;
  exception
    when others then
      if position('immutable' in lower(sqlerrm)) = 0 then
        raise;
      end if;
      v_expected_error := true;
  end;

  if not v_expected_error then
    raise exception 'Smoke test failed: posted inventory movement was mutable.';
  end if;

  v_expected_error := false;
  begin
    insert into public.customers (
      customer_number, customer_type, first_name, last_name, email, tax_exempt_status
    ) values (
      'SMOKE-TAX-' || upper(left(v_suffix, 12)),
      'retail', 'Unverified', 'Tax Review', 'unverified-tax-' || v_suffix || '@example.com', 'rejected'
    );
  exception
    when others then
      if position('requires a verifier' in lower(sqlerrm)) = 0 then
        raise;
      end if;
      v_expected_error := true;
  end;

  if not v_expected_error then
    raise exception 'Smoke test failed: a reviewed tax-exempt status without a verifier was accepted.';
  end if;

  insert into public.customers (
    customer_number, customer_type, first_name, last_name, email
  ) values (
    'SMOKE-CUST-' || upper(left(v_suffix, 12)),
    'retail', 'Smoke', 'Customer', 'smoke-' || v_suffix || '@example.com'
  ) returning id into v_customer_id;

  insert into public.customers (
    customer_number, customer_type, first_name, last_name, email
  ) values (
    'SMOKE-OTHER-' || upper(left(v_suffix, 12)),
    'retail', 'Other', 'Customer', 'other-' || v_suffix || '@example.com'
  ) returning id into v_other_customer_id;

  insert into public.sales_orders (
    order_number, customer_id, channel, status, shipping_amount, placed_at
  ) values (
    'SMOKE-SO-' || upper(left(v_suffix, 12)),
    v_customer_id, 'admin', 'confirmed', 2.00, now()
  ) returning id into v_order_id;

  insert into public.sales_order_items (
    order_id, product_id, variant_id, product_name_snapshot,
    variant_name_snapshot, sku_snapshot, quantity, unit_price,
    unit_cost_snapshot, discount_amount, tax_rate_snapshot, tax_amount
  ) values (
    v_order_id, v_product_id, v_variant_id, 'Smoke Test Product',
    'Default', 'SMOKE-SNAPSHOT', 2, 5.00,
    2.0000, 1.00, 0.050000, 0.50
  );

  select total_amount into v_order_total
  from public.sales_orders where id = v_order_id;

  if v_order_total <> 11.50 then
    raise exception 'Smoke test failed: order total expected 11.50 but got %', v_order_total;
  end if;

  v_expected_error := false;
  begin
    insert into public.invoices (
      invoice_number, order_id, customer_id, status, shipping_amount, issued_at
    ) values (
      'SMOKE-BAD-INV-' || upper(left(v_suffix, 10)),
      v_order_id, v_other_customer_id, 'issued', 2.00, now()
    );
  exception
    when others then
      if position('customer must match' in lower(sqlerrm)) = 0 then
        raise;
      end if;
      v_expected_error := true;
  end;

  if not v_expected_error then
    raise exception 'Smoke test failed: an invoice with a mismatched order customer was accepted.';
  end if;

  insert into public.invoices (
    invoice_number, order_id, customer_id, status, shipping_amount, issued_at
  ) values (
    'SMOKE-INV-' || upper(left(v_suffix, 12)),
    v_order_id, v_customer_id, 'issued', 2.00, now()
  ) returning id into v_invoice_id;

  insert into public.invoice_items (
    invoice_id, product_id, variant_id, product_name_snapshot,
    variant_name_snapshot, sku_snapshot, quantity, unit_price,
    unit_cost_snapshot, discount_amount, tax_rate_snapshot, tax_amount
  ) values (
    v_invoice_id, v_product_id, v_variant_id, 'Smoke Test Product',
    'Default', 'SMOKE-SNAPSHOT', 2, 5.00,
    2.0000, 1.00, 0.050000, 0.50
  );

  select total_amount into v_invoice_total
  from public.invoices where id = v_invoice_id;

  if v_invoice_total <> 11.50 then
    raise exception 'Smoke test failed: invoice total expected 11.50 but got %', v_invoice_total;
  end if;

  v_expected_error := false;
  begin
    insert into public.payments (
      invoice_id, payment_kind, status, amount, currency, payment_method, received_at
    ) values (
      v_invoice_id, 'payment', 'succeeded', 1.00, 'EUR', 'cash', now()
    );
  exception
    when others then
      if position('currency must match' in lower(sqlerrm)) = 0 then
        raise;
      end if;
      v_expected_error := true;
  end;

  if not v_expected_error then
    raise exception 'Smoke test failed: a payment in a different invoice currency was accepted.';
  end if;

  insert into public.payments (
    invoice_id, payment_kind, status, amount, payment_method, received_at
  ) values (
    v_invoice_id, 'payment', 'succeeded', 11.50, 'cash', now()
  );

  select status, amount_paid, balance_due
  into v_invoice_status, v_amount_paid, v_balance_due
  from public.invoices
  where id = v_invoice_id;

  if v_invoice_status <> 'paid' or v_amount_paid <> 11.50 or v_balance_due <> 0 then
    raise exception 'Smoke test failed: paid invoice expected paid/11.50/0 but got %/%/%',
      v_invoice_status, v_amount_paid, v_balance_due;
  end if;

  select count(*) into v_count
  from public.v_product_listing
  where product_id = v_product_id;

  if v_count <> 1 then
    raise exception 'Smoke test failed: active product missing from storefront projection.';
  end if;

  select count(*) into v_count
  from public.v_monthly_business_performance
  where month_start = date_trunc('month', current_date::timestamp)::date;

  if v_count < 1 then
    raise exception 'Smoke test failed: manager reporting projection returned no current-month row.';
  end if;

  if not exists (
    select 1
    from public.v_monthly_business_performance
    where month_start = date_trunc('month', current_date::timestamp)::date
      and net_sales >= 9.00
      and shipping_revenue >= 2.00
      and tax_collected >= 0.50
      and amount_received >= 11.50
  ) then
    raise exception 'Smoke test failed: net sales, shipping, tax, and cash received were not separated correctly.';
  end if;

  raise notice 'All food-store database smoke tests passed.';
end;
$$;

rollback;
