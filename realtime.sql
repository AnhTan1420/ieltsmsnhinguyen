-- ============================================================================
-- ENABLE REALTIME cho tính năng "Theo dõi & Chấm bài" xem trực tiếp
-- Idempotent — chạy lại nhiều lần trong Supabase SQL Editor không lỗi.
--
-- BỐI CẢNH / TẠI SAO CẦN FILE NÀY:
-- Code (useSubmissions.ts) đã subscribe "postgres_changes" trên bảng
-- submissions từ trước, và StudentTest.tsx đã autosave nội dung bài làm mỗi
-- 3-5 giây. Nhưng Supabase KHÔNG tự phát sự kiện realtime cho một bảng chỉ vì
-- bảng đó tồn tại — bảng phải được thêm thủ công vào publication tên
-- "supabase_realtime" (tương đương bật toggle "Enable Realtime" trong
-- Database > Replication trên dashboard). Nếu chưa từng bật, mọi
-- `.on("postgres_changes", ...)` ở client sẽ subscribe thành công (không báo
-- lỗi) nhưng KHÔNG BAO GIỜ nhận được event nào — đây chính là lý do dashboard
-- giáo viên chỉ cập nhật khi F5 lại trang, chứ không phải do bug ở React.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1) THÊM CỘT updated_at + TRIGGER TỰ ĐỘNG CẬP NHẬT
--
-- submissions hiện chưa có cột nào đánh dấu "lần thay đổi gần nhất" (created_at
-- chỉ ghi lúc tạo bài, không đổi khi autosave/warning update). Có cột này thì:
--   - Payload "new" mà Realtime gửi về client sẽ tự động có updated_at mới nhất
--     -> UI hiện được "cập nhật X giây trước" ngay cạnh nhãn LIVE, giúp giáo
--     viên tin tưởng dữ liệu đang thật sự chảy về theo thời gian thực chứ
--     không phải đứng yên.
--   - Không cần sửa gì ở các API route (PATCH/RPC) vì trigger tự chạy trên
--     mọi UPDATE, không phụ thuộc route nào gọi.
-- ----------------------------------------------------------------------------

alter table public.submissions
  add column if not exists updated_at timestamptz not null default now();

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_submissions_updated_at on public.submissions;
create trigger trg_submissions_updated_at
  before update on public.submissions
  for each row
  execute function public.set_updated_at();


-- ----------------------------------------------------------------------------
-- 2) BẬT REALTIME CHO BẢNG submissions
--
-- Dùng khối DO + kiểm tra pg_publication_tables trước khi ALTER PUBLICATION,
-- vì "alter publication ... add table" sẽ báo lỗi "already member of
-- publication" nếu chạy 2 lần liên tiếp — bọc điều kiện để cả file idempotent.
-- ----------------------------------------------------------------------------

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'submissions'
  ) then
    alter publication supabase_realtime add table public.submissions;
  end if;
end $$;

-- Replica identity mặc định (chỉ PK) là đủ cho nhu cầu hiện tại vì code chỉ
-- đọc "new" record (luôn đầy đủ cột), không cần so sánh với "old". Không cần
-- set REPLICA IDENTITY FULL — set thêm chỉ tốn thêm băng thông WAL vô ích.
-- ============================================================================