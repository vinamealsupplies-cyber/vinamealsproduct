-- Transactional server-only RPC helpers.
-- Apply after 003_rls_and_grants.sql because these functions use private role helpers.

create or replace function public.admin_complete_product_image(
  p_product_id uuid,
  p_object_key text,
  p_public_url text,
  p_content_type text,
  p_bytes bigint,
  p_width integer,
  p_height integer,
  p_alt_text text,
  p_position integer,
  p_is_primary boolean,
  p_created_by uuid
)
returns public.product_media
language plpgsql
security definer
set search_path = pg_catalog, private, pg_temp
as $$
declare
  v_media public.product_media;
  v_image_count integer;
begin
  if not private.is_service_role() then
    raise exception 'This operation requires the service role.';
  end if;

  if p_position < 1 or p_position > 10 then
    raise exception 'Product image position must be between 1 and 10.';
  end if;

  if p_bytes <= 0 or p_bytes > 8 * 1024 * 1024 then
    raise exception 'Product image size must be between 1 byte and 8 MB.';
  end if;

  if p_content_type not in ('image/jpeg', 'image/png', 'image/webp', 'image/avif') then
    raise exception 'Unsupported product image content type.';
  end if;

  if p_object_key is null or p_object_key !~ ('^products/' || p_product_id::text || '/images/[A-Za-z0-9._/-]+$') then
    raise exception 'The R2 object key does not belong to this product.';
  end if;

  if p_public_url is null or p_public_url !~ '^https://' then
    raise exception 'The product image public URL must use HTTPS.';
  end if;

  -- Serialize media completion per product so concurrent uploads cannot bypass the 10-image limit.
  perform 1
  from public.products
  where id = p_product_id
  for update;

  if not found then
    raise exception 'Product not found.';
  end if;

  select count(*)
    into v_image_count
  from public.product_media
  where product_id = p_product_id
    and media_type = 'image';

  if v_image_count >= 10 then
    raise exception 'A product can have at most 10 images.';
  end if;

  if p_is_primary then
    update public.product_media
    set is_primary = false,
        updated_at = now()
    where product_id = p_product_id
      and media_type = 'image'
      and is_primary;
  end if;

  insert into public.product_media (
    product_id,
    media_type,
    provider,
    status,
    object_key,
    public_url,
    alt_text,
    content_type,
    bytes,
    width,
    height,
    position,
    is_primary,
    created_by
  ) values (
    p_product_id,
    'image',
    'r2',
    'ready',
    p_object_key,
    p_public_url,
    nullif(btrim(coalesce(p_alt_text, '')), ''),
    p_content_type,
    p_bytes,
    p_width,
    p_height,
    p_position::smallint,
    p_is_primary,
    p_created_by
  )
  returning * into v_media;

  return v_media;
end;
$$;

revoke all on function public.admin_complete_product_image(
  uuid, text, text, text, bigint, integer, integer, text, integer, boolean, uuid
) from public, anon, authenticated;

grant execute on function public.admin_complete_product_image(
  uuid, text, text, text, bigint, integer, integer, text, integer, boolean, uuid
) to service_role;
