-- Nạp thư ĐẾN vào hộp thư hỗ trợ. Email worker (Cloudflare) parse MIME rồi gọi
-- RPC này bằng service_role. Trigger touch_email_thread lo message_count /
-- has_unread / last_message_at; constraint bắt inbound có sent_by(_name)=NULL.

create or replace function public.ingest_inbound_email(
  p_from_address text,
  p_from_name text,
  p_to_addresses text[],
  p_subject text,
  p_text_body text,
  p_html_body text,
  p_rfc_message_id text,
  p_in_reply_to text,
  p_references text[]
) returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_catalog'
as $$
declare
  v_from      text := lower(btrim(coalesce(p_from_address, '')));
  v_name      text := nullif(btrim(coalesce(p_from_name, '')), '');
  v_subject   text := coalesce(nullif(btrim(p_subject), ''), '(no subject)');
  v_thread_id uuid;
  v_message_id uuid;
  v_ref       text;
begin
  if v_from = '' then
    raise exception 'from address required';
  end if;

  -- Chống trùng theo Message-ID (Email Routing có thể giao 2 lần / worker retry).
  if p_rfc_message_id is not null and btrim(p_rfc_message_id) <> '' then
    select id, thread_id into v_message_id, v_thread_id
    from public.email_messages
    where rfc_message_id = p_rfc_message_id
    limit 1;
    if v_message_id is not null then
      return jsonb_build_object(
        'thread_id', v_thread_id, 'message_id', v_message_id, 'duplicate', true
      );
    end if;
  end if;

  -- 1) Nối theo In-Reply-To rồi References → thread của thư mà khách trả lời.
  --    (Chỉ khớp khi thư outbound có lưu rfc_message_id; hiện chưa lưu nên
  --     thường rơi xuống bước 2 — vẫn đúng.)
  if p_in_reply_to is not null and btrim(p_in_reply_to) <> '' then
    select thread_id into v_thread_id
    from public.email_messages
    where rfc_message_id = btrim(p_in_reply_to)
    order by created_at desc
    limit 1;
  end if;

  if v_thread_id is null and p_references is not null then
    foreach v_ref in array p_references loop
      select thread_id into v_thread_id
      from public.email_messages
      where rfc_message_id = btrim(v_ref)
      order by created_at desc
      limit 1;
      exit when v_thread_id is not null;
    end loop;
  end if;

  -- 2) Chưa nối được → thread đang MỞ theo địa chỉ khách.
  if v_thread_id is null then
    select id into v_thread_id
    from public.email_threads
    where lower(contact_address) = v_from and status = 'open'
    order by last_message_at desc
    limit 1;
  end if;

  -- 3) Vẫn không có → tạo thread mới; nếu nối vào thread đã đóng thì mở lại.
  if v_thread_id is null then
    insert into public.email_threads (contact_address, contact_name, subject)
    values (v_from, v_name, v_subject)
    returning id into v_thread_id;
  else
    update public.email_threads
       set status = 'open'
     where id = v_thread_id and status = 'closed';
  end if;

  insert into public.email_messages (
    thread_id, direction, from_address, from_name, to_addresses,
    subject, text_body, html_body, rfc_message_id, in_reply_to
  ) values (
    v_thread_id, 'inbound', v_from, v_name,
    coalesce(p_to_addresses, '{}'::text[]),
    v_subject, p_text_body, p_html_body,
    nullif(btrim(coalesce(p_rfc_message_id, '')), ''),
    nullif(btrim(coalesce(p_in_reply_to, '')), '')
  )
  returning id into v_message_id;

  return jsonb_build_object(
    'thread_id', v_thread_id, 'message_id', v_message_id, 'duplicate', false
  );
end;
$$;

-- Chỉ service_role (email worker) được gọi.
revoke all on function public.ingest_inbound_email(
  text, text, text[], text, text, text, text, text, text[]
) from public;
revoke all on function public.ingest_inbound_email(
  text, text, text[], text, text, text, text, text, text[]
) from anon, authenticated;
grant execute on function public.ingest_inbound_email(
  text, text, text[], text, text, text, text, text, text[]
) to service_role;
