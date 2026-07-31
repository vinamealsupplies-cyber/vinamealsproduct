-- Bỏ hộp thư hỗ trợ trong app — support email chuyển sang Gmail. Gửi invoice
-- (Resend) vẫn giữ và KHÔNG dùng các bảng này. Giữ cột profiles.email_signature
-- vì email invoice vẫn ký tên bằng chữ ký nhân viên.

drop table if exists public.email_attachments cascade;
drop table if exists public.email_messages cascade;
drop table if exists public.email_threads cascade;

drop function if exists public.ingest_inbound_email(
  text, text, text[], text, text, text, text, text, text[]
);
drop function if exists public.touch_email_thread() cascade;

drop type if exists public.email_direction;
drop type if exists public.email_thread_status;
