-- ----------------------------------------------------------------------------
-- 1) TÍNH NĂNG "QUẢN LÝ LỚP HỌC" — chạy TRƯỚC vì mục (2) bên dưới cần cột
-- tests.class_id đã tồn tại để tạo index trên nó.
--
-- Tạo bảng classes + cột tests.class_id để giáo viên gắn 1 đề thi vào 1 lớp
-- học, sau đó tab "Theo dõi & Chấm bài" lọc bài nộp theo lớp (qua đề thi mà
-- học sinh đã làm). KHÔNG thêm class_id vào bảng submissions — việc phân loại
-- bài nộp theo lớp lấy trực tiếp từ submissions.tests.class_id (join sẵn có),
-- không cần cột riêng, tránh out-of-sync khi 1 đề đổi lớp sau khi đã có người nộp.
-- ----------------------------------------------------------------------------

create table if not exists public.classes (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.tests
  add column if not exists class_id uuid references public.classes (id) on delete set null;

-- RLS: cùng mô hình mở hiện tại của bảng tests/submissions — mọi giáo viên đã
-- đăng nhập (authenticated) đều thấy và quản lý được toàn bộ lớp học (chưa
-- scope theo giáo viên tạo ra lớp đó). Học sinh (anon, không đăng nhập) không
-- cần và không được đụng tới bảng classes.
alter table public.classes enable row level security;

drop policy if exists "Authenticated can read classes" on public.classes;
create policy "Authenticated can read classes"
  on public.classes for select
  to authenticated
  using (true);

drop policy if exists "Authenticated can insert classes" on public.classes;
create policy "Authenticated can insert classes"
  on public.classes for insert
  to authenticated
  with check (true);

drop policy if exists "Authenticated can update classes" on public.classes;
create policy "Authenticated can update classes"
  on public.classes for update
  to authenticated
  using (true)
  with check (true);

drop policy if exists "Authenticated can delete classes" on public.classes;
create policy "Authenticated can delete classes"
  on public.classes for delete
  to authenticated
  using (true);


-- ----------------------------------------------------------------------------
-- 2) INDEX CHO CÁC CỘT FOREIGN KEY / FILTER / ORDER BY
--
-- Postgres CHỈ tự tạo index cho PRIMARY KEY, không tự tạo cho cột FK.
-- Nhìn vào code:
--   - useSubmissions.ts  : .select("*, tests(...)").order("created_at", desc)
--       -> chạy trên TOÀN BỘ bảng submissions, mỗi lần có realtime event
--          (INSERT/UPDATE/DELETE bất kỳ) là load lại full bảng.
--   - useTests.ts        : .order("created_at", desc) trên bảng tests
--   - mọi route submissions/[id]/*  : .eq("id", id) — đã có PK index sẵn, ok.
--   - submissions_test_id_fkey, submissions_user_id_fkey, student_id_fkey,
--     tests_class_id_fkey, tests_created_by_fkey, warnings_*
--     -> chưa có cột nào trong số này được index.
--
-- Khi bảng submissions lớn dần (vài nghìn bài trở lên), thiếu index này sẽ
-- khiến mọi lần load dashboard giáo viên chậm dần + JOIN với tests chậm.
-- ----------------------------------------------------------------------------

create index if not exists idx_tests_created_by     on public.tests (created_by);
create index if not exists idx_tests_class_id       on public.tests (class_id);
create index if not exists idx_tests_created_at     on public.tests (created_at desc);

create index if not exists idx_submissions_test_id    on public.submissions (test_id);
create index if not exists idx_submissions_user_id    on public.submissions (user_id);
create index if not exists idx_submissions_student_id on public.submissions (student_id);
create index if not exists idx_submissions_status     on public.submissions (status);
create index if not exists idx_submissions_created_at on public.submissions (created_at desc);
-- (KHÔNG tạo index trên submissions.class_id: cột này không tồn tại trên
--  bảng submissions. Muốn lọc "theo lớp, mới nhất trước" thì join qua
--  tests.class_id, ví dụ:
--    select s.* from submissions s join tests t on t.id = s.test_id
--    where t.class_id = :class_id order by s.created_at desc;
--  Index idx_tests_class_id ở trên đã đủ hỗ trợ join này.)

create index if not exists idx_warnings_submission_id on public.warnings (submission_id);
create index if not exists idx_warnings_user_id       on public.warnings (user_id);

create index if not exists idx_classes_created_by on public.classes (created_by);
create index if not exists idx_classes_created_at on public.classes (created_at desc);


-- ----------------------------------------------------------------------------
-- 3) RPC: TĂNG warning_count MỘT CÁCH ATOMIC
--
-- File src/app/api/submissions/[id]/warning/route.ts hiện làm 2 bước tách
-- rời: SELECT warning_count -> tính nextCount ở Node -> UPDATE. Nếu anti-cheat
-- bắn 2 warning gần như cùng lúc (rất dễ xảy ra), cả 2 request đọc cùng
-- warning_count cũ -> một lần tăng bị "mất" (lost update), học sinh có thể
-- vượt quá MAX_WARNINGS mà không bị disqualify đúng lúc. Comment trong code
-- cũng đã tự nhận ra rủi ro này ("nếu warnings tới rất nhanh, ta trust local
-- count").
--
-- Gộp toàn bộ SELECT -> tính -> UPDATE -> INSERT warnings vào 1 hàm SQL chạy
-- trong 1 transaction, dùng "for update" để khoá row -> loại bỏ race
-- condition hoàn toàn, đồng thời giảm từ 2-3 round-trip xuống còn 1 lần gọi
-- duy nhất từ code (supabase.rpc(...)).
-- ----------------------------------------------------------------------------

create or replace function public.increment_submission_warning(
  p_submission_id uuid,
  p_reason text,
  p_max_warnings integer default 5
)
returns table (
  warning_count integer,
  status text,
  disqualified boolean,
  already_finished boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status text;
  v_count  integer;
begin
  select s.status, s.warning_count into v_status, v_count
  from submissions s
  where s.id = p_submission_id
  for update; -- khoá row này cho tới hết transaction, request thứ 2 phải đợi

  if not found then
    raise exception 'Submission % not found', p_submission_id;
  end if;

  -- Bài đã completed/disqualified rồi thì không tăng nữa, trả trạng thái hiện tại
  if v_status <> 'in_progress' then
    return query select v_count, v_status, (v_status = 'disqualified'), true;
    return;
  end if;

  v_count := v_count + 1;
  v_status := case when v_count >= p_max_warnings then 'disqualified' else 'in_progress' end;

  update submissions set
    warning_count = v_count,
    status        = v_status,
    end_reason    = case when v_status = 'disqualified' then 'disqualified' else end_reason end,
    submitted_at  = case when v_status = 'disqualified' then now() else submitted_at end
  where id = p_submission_id;

  insert into warnings (submission_id, reason, warning_number)
  values (p_submission_id, p_reason, v_count);

  return query select v_count, v_status, (v_status = 'disqualified'), false;
end;
$$;

-- Cho phép gọi hàm này qua service-role key (route đang dùng supabaseAdmin) và
-- qua anon/authenticated nếu sau này bạn muốn gọi thẳng từ client:
grant execute on function public.increment_submission_warning(uuid, text, integer) to anon, authenticated, service_role;


-- ----------------------------------------------------------------------------
-- 4) SỬA LẠI CHECK CONSTRAINT warning_count CHO KHỚP THỰC TẾ
--
-- schema.sql trong repo đang ghi "check (warning_count between 0 and 3)",
-- nhưng DB thật của bạn (bản user gửi) là "between 0 and 5", và code
-- (MAX_WARNINGS = 5 trong warning/route.ts) cũng đang dùng 5. Đây là ví dụ
-- điển hình của việc file schema.sql bị lệch khỏi DB thật — nên đồng bộ lại
-- để không ai đọc nhầm schema.sql rồi sửa code theo số sai.
-- ----------------------------------------------------------------------------

alter table public.submissions drop constraint if exists submissions_warning_count_check;
alter table public.submissions
  add constraint submissions_warning_count_check check (warning_count >= 0 and warning_count <= 5);


-- ----------------------------------------------------------------------------
-- 5) GHI CHÚ — KHÔNG PHẢI SQL CẦN CHẠY, CHỈ ĐỂ BẠN ĐỐI CHIẾU
--
-- Các cột sau tồn tại trong DB thật nhưng KHÔNG được dùng ở đâu trong
-- src/ hiện tại (grep không ra kết quả): classes (cả bảng, tới khi mục (1)
-- ở trên chạy), tests.class_id, tests.content, submissions.teacher_notes,
-- submissions.teacher_band_score, submissions.is_reviewed.
-- (submissions.class_id KHÔNG tồn tại và KHÔNG nên thêm — xem mục 1.)
-- Đây là "control debt": DB có sẵn hạ tầng cho tính năng theo lớp + review
-- 2 lượt (band AI vs band giáo viên chỉnh) nhưng frontend/API chưa hề đọc/ghi
-- các cột này, và RLS cũng chưa scope theo class_id (mọi giáo viên đã đăng
-- nhập đang thấy TẤT CẢ submissions/tests, không lọc theo lớp mình dạy).
-- Nếu tính năng lớp học sắp được dùng thật, nói mình biết để viết luôn phần
-- RLS lọc theo class_id + cập nhật TestRow/SubmissionRow trong types.ts.
-- ============================================================================
-- ----------------------------------------------------------------------------
-- 6) TÍNH NĂNG "CHẶN COPY/PASTE" — checkbox trong panel "Chỉnh sửa Đề thi"
--
-- Thêm cột boolean trên bảng tests để giáo viên bật/tắt việc chặn copy/paste
-- ở trang làm bài của học sinh (StudentTest.tsx), theo từng đề thi riêng.
-- Mặc định false (không chặn) để không ảnh hưởng các đề thi đã tạo trước đó.
-- ----------------------------------------------------------------------------

alter table public.tests
  add column if not exists block_copy_paste boolean not null default false;