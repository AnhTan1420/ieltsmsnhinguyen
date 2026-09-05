# IELTS Writing Platform

Nền tảng luyện thi & chấm bài **IELTS Writing** (Task 1 + Task 2) — học sinh làm bài trực tuyến có giám sát chống gian lận, giáo viên tạo đề và chấm bài bằng AI (Gemini / Groq) kèm nhận xét chi tiết bằng tiếng Việt.

**Stack:** Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS 4 · Supabase (Postgres + Auth + Storage bucket `test-images` cho ảnh biểu đồ Task 1 + Realtime) · Groq / Google Gemini (chấm bài AI) · Vercel (deploy)

---

## Mục lục

- [Tính năng chính](#tính-năng-chính)
- [Cấu trúc thư mục](#cấu-trúc-thư-mục)
- [Kiến trúc & luồng dữ liệu](#kiến-trúc--luồng-dữ-liệu)
- [Bắt đầu nhanh](#bắt-đầu-nhanh)
- [Biến môi trường](#biến-môi-trường)
- [Schema cơ sở dữ liệu](#schema-cơ-sở-dữ-liệu)

---

## Tính năng chính

- **Học sinh:** vào link đề thi → nhập tên → làm bài toàn màn hình (fullscreen) có đồng hồ đếm ngược, tự động lưu bài mỗi 5 giây, tự nộp khi hết giờ. Sau khi nộp, nếu bài đã được chấm thì xem ngay kết quả (band từng Task + 4 tiêu chí, nhận xét giám khảo) và tải file `.doc` kết quả của chính mình. Trạng thái "đã nộp" được ghi tạm vào `localStorage` (5 phút) để lỡ F5 vẫn ở lại màn hình kết quả thay vì quay về màn nhập tên.
- **Chống gian lận:** phát hiện thoát fullscreen / chuyển tab / mất focus cửa sổ, cảnh báo tối đa 5 lần trước khi tự động hủy bài. Giáo viên có thể bật thêm tùy chọn **chặn copy/paste** riêng cho từng đề thi.
- **Giáo viên:** tạo/sửa đề thi (kèm ảnh biểu đồ cho Task 1), theo dõi bài làm **trực tiếp (realtime)** — nội dung, số cảnh báo gian lận và bài mới nộp cập nhật tức thời qua Supabase Realtime (không cần F5), chấm bằng AI (Gemini → fallback Groq) theo band descriptor IELTS chính thức, tự tính lại band tổng từ 4 tiêu chí (TA/TR, CC, LR, GRA) thay vì tin số model tự viết, thêm nhận xét thủ công, chọn nhiều để xóa/tải hàng loạt, xuất từng bài hoặc cả loạt ra file `.doc`/`.zip`.
- **Quản lý lớp học:** tạo/đổi tên/xóa lớp, gắn mỗi đề thi vào một lớp, sau đó lọc danh sách bài nộp theo lớp bằng thanh tab ở màn "Theo dõi & Chấm bài".
- Giao diện giáo viên có layout **master-detail thích ứng mobile** (danh sách và chi tiết bài làm chuyển màn hình riêng trên điện thoại, hiện song song trên desktop).

## Cấu trúc thư mục

```
src/
├── app/                              # Next.js App Router — routing & API
│   ├── page.tsx                      # Trang chủ (landing) — nút vào /teacher
│   ├── login/page.tsx                # Đăng nhập giáo viên
│   ├── teacher/page.tsx              # Trang giáo viên (chỉ render <TeacherDashboard/>)
│   ├── test/[id]/page.tsx            # Trang học sinh làm bài (chỉ render <StudentTest/>)
│   └── api/
│       ├── grade/route.ts                        # POST — chấm bài AI + tự tính lại band (yêu cầu đăng nhập)
│       └── submissions/
│           ├── route.ts                          # POST — học sinh bắt đầu bài thi (public)
│           ├── bulk-delete/route.ts              # POST — xóa hàng loạt bài nộp (yêu cầu đăng nhập)
│           └── [id]/
│               ├── route.ts                      # PATCH — autosave nội dung / lưu nhận xét (public + protected tùy field)
│               ├── submit/route.ts               # POST — nộp bài chính thức (public)
│               └── warning/route.ts              # POST — ghi nhận vi phạm chống gian lận (public)
│
├── components/
│   ├── auth/
│   │   ├── LoginForm.tsx
│   │   └── AuthStatus.tsx
│   │
│   ├── teacher/                      # Toàn bộ UI trang giáo viên
│   │   ├── TeacherDashboard/              # Orchestrator: layout, tab, ghép các hook + component con
│   │   │   ├── index.tsx                      # State cấp trang (tab, bộ lọc lớp, master-detail mobile) + compose
│   │   │   ├── DashboardHeader.tsx            # Header dính đầu trang: logo, trạng thái Realtime, đăng xuất, tab strip
│   │   │   ├── ClassFilterTabs.tsx            # Thanh tab lọc bài nộp theo lớp
│   │   │   ├── ScrollbarStyles.tsx            # CSS .custom-scrollbar/.no-scrollbar dùng toàn dashboard
│   │   │   └── TeacherAuthScreens.tsx         # Màn "đang kiểm tra đăng nhập" / "chưa đăng nhập"
│   │   ├── SubmissionList.tsx             # Danh sách bài nộp + chọn nhiều/xóa hàng loạt/tải tất cả
│   │   ├── SubmissionDetail/              # Chi tiết 1 bài làm
│   │   │   ├── index.tsx                      # State (task đang mở, cụm highlight chọn, nháp nhận xét) + compose
│   │   │   ├── SubmissionHeader.tsx           # Tên học sinh/đề thi, badge trạng thái, banner cảnh báo
│   │   │   ├── TaskAnswerBlock.tsx            # Khối Task 1/Task 2 thu gọn-mở rộng (dùng chung cho cả 2 task)
│   │   │   ├── HighlightDetailPanel.tsx       # Panel/bottom-sheet chi tiết lỗi-sai/nâng-cấp/cấu-trúc khi bấm vào highlight
│   │   │   ├── SubmissionActions.tsx          # Cụm nút chấm/xuất file/xóa
│   │   │   └── TeacherCommentBox.tsx          # Ô nhận xét thủ công của giáo viên
│   │   ├── GradingResultPanel/            # Khối hiển thị kết quả chấm AI (band, tiêu chí, lỗi sửa)
│   │   │   ├── index.tsx                      # Header Overall band + ghép TaskResultSection cho task1/task2
│   │   │   ├── TaskResultSection.tsx          # Toàn bộ kết quả 1 task — dùng chung cho Task 1 & 2
│   │   │   ├── CorrectionsSection.tsx         # Danh sách lỗi sai & đề xuất sửa (thu gọn/mở rộng)
│   │   │   └── TaskExtras.tsx                 # Nguyên tắc vàng, lộ trình band, từ vựng, cấu trúc nâng cao, câu nâng cấp
│   │   ├── ExaminerSummaryCard.tsx        # Thẻ nhận xét giám khảo, tách theo từng phần bài viết
│   │   ├── ExamCreateForm/                # Tab "Quản lý đề thi"
│   │   │   ├── index.tsx                      # State (đề đang sửa, cờ lưu/upload) + handler + compose
│   │   │   ├── TestBankList.tsx               # Cột trái: danh sách đề đã tạo
│   │   │   └── TestEditorForm.tsx             # Cột phải: form soạn/sửa đề (kể cả chọn lớp, bật chặn copy/paste)
│   │   ├── ClassManagement.tsx            # Tab "Quản lý lớp học" — CRUD lớp (dùng hook useClasses)
│   │   ├── GradingProgressModal.tsx       # Modal "đang chấm điểm"
│   │   └── FeedbackExport.tsx
│   │
│   └── test/                         # Toàn bộ UI trang học sinh làm bài
│       ├── StudentTest.tsx               # Orchestrator: gọi useStudentTestState() + ghép các màn hình/component
│       ├── ExamHeader.tsx                # Header dính đầu trang lúc làm bài: tên đề, tên học sinh, đồng hồ, nav pill
│       ├── AntiCheatWarningBanner.tsx    # Banner cảnh báo vi phạm + thông báo trình duyệt không hỗ trợ fullscreen
│       ├── SetupScreen.tsx               # Màn hình nhập tên trước khi thi
│       ├── TaskCard.tsx                  # Thẻ đề bài + khung viết (dùng chung Task 1 & 2)
│       ├── NavPill.tsx                   # Nút điều hướng nhanh trong sub-nav
│       ├── ImageZoomOverlay.tsx          # Modal phóng to ảnh biểu đồ Task 1
│       ├── DisqualifiedScreen.tsx        # Màn hình bị hủy bài thi
│       ├── SubmittedScreen.tsx           # Màn hình nộp bài thành công — hiện <StudentResultPanel/> nếu đã có điểm
│       └── StudentResultPanel.tsx        # Bản rút gọn kết quả chấm cho học sinh + nút tải file .doc của riêng mình
│
├── hooks/
│   ├── teacher/                      # Logic nghiệp vụ của dashboard giáo viên, tách khỏi UI
│   │   ├── useTeacherAuth.ts             # Check đăng nhập (client) + tự động đăng xuất sau 30 phút rảnh
│   │   ├── useSubmissions.ts             # Load bài nộp + subscribe Supabase Realtime (INSERT/UPDATE/DELETE), chấm điểm (AI), xóa, lưu nhận xét
│   │   ├── useBulkActions.ts             # Chọn nhiều, xóa hàng loạt, tải tất cả (.zip)
│   │   ├── useTests.ts                   # CRUD đề thi + upload ảnh Task 1
│   │   └── useClasses.ts                 # CRUD lớp học (dùng chung bởi tab "Quản lý lớp học" và ExamCreateForm)
│   ├── useStudentTestState.ts         # Toàn bộ state/effect/handler trang làm bài (resume F5, chặn copy/paste, autosave, nối useAntiCheat/useExamTimer)
│   ├── useAntiCheat.ts                # Phát hiện & báo cáo hành vi gian lận (học sinh); fullscreen qua lib/device-utils
│   ├── useExamTimer.ts                # Đếm ngược dựa trên mốc thời gian từ server (học sinh)
│   └── useNow.ts                      # Tick Date.now() mỗi giây — dùng cho nhãn "cập nhật x giây trước"
│
└── lib/
    ├── types.ts                       # Kiểu dữ liệu dùng chung (SubmissionRow, TestRow, ClassRow, Correction, GradingFeedback...)
    ├── supabase.ts                     # Supabase client phía browser (anon key) + getAuthHeader() cho fetch
    ├── supabase-admin.ts               # Supabase client phía server (service role, bypass RLS)
    ├── auth-server.ts                  # requireAuth()/getAuthenticatedUser() — xác thực Bearer token ở API route
    ├── student-test-utils.ts           # Hằng số & hàm thuần dùng riêng cho trang làm bài
    ├── device-utils.ts                 # Helper Fullscreen API an toàn qua các trình duyệt (kể cả không hỗ trợ)
    ├── grading/                        # Pipeline chấm điểm AI
    │   ├── index.ts                       # Điểm vào công khai (giữ nguyên đường dẫn import @/lib/grading)
    │   ├── prompt.ts                      # TASK_CONFIG + system prompt giám khảo IELTS
    │   ├── provider.ts                    # Gọi Gemini (chính) → fallback Groq khi lỗi/quá tải
    │   ├── parse.ts                       # Parse & làm sạch JSON model trả về + parseSubmissionContent
    │   ├── schema.ts                      # Schema/kiểu dữ liệu response kỳ vọng từ model
    │   └── feedback-resolvers.ts          # Logic thuần lấy đúng dữ liệu 1 task từ GradingFeedback (band/summary/corrections/...), có fallback cho bản ghi cũ
    └── teacher/
        ├── band-sanitizer.ts           # Lọc câu văn xuôi nhắc sai số band không khớp điểm đã chấm
        ├── submission-utils.tsx        # Style/label trạng thái + renderHighlightedAnswer dùng chung SubmissionDetail/GradingResultPanel
        └── exportDoc/                  # Build & tải file .doc / .zip cho 1 hoặc nhiều bài làm
            ├── index.ts                    # API công khai (giữ nguyên đường dẫn import @/lib/teacher/exportDoc)
            ├── html-helpers.ts             # escape/in-đậm markdown/tô highlight/emoji tiêu chí — helper HTML cấp thấp
            ├── image.ts                    # Tải ảnh Task 1 về base64 + tính lại kích thước để Word hiển thị đúng
            ├── task-sections-html.ts       # Dựng HTML đề bài + ảnh + bài làm (Task 1 & 2)
            ├── feedback-sections-html.ts   # Dựng HTML từng mục nhỏ (nguyên tắc vàng, lộ trình band, từ vựng, cấu trúc, câu nâng cấp, lỗi sửa)
            └── task-feedback-html.ts       # Ghép thành feedback đầy đủ 1 task / cả bài (band + 4 tiêu chí + nhận xét)
```

**Nguyên tắc tổ chức:** mỗi trang/khối UI đủ lớn (`TeacherDashboard`, `SubmissionDetail`, `GradingResultPanel`, `ExamCreateForm`, `StudentTest`...) là một thư mục con với `index.tsx` làm **orchestrator mỏng** — chỉ giữ state/hook cấp cao, còn UI chia theo màn hình/khu vực chức năng thành các component con nằm cùng thư mục. Component nào bị lặp lại gần như y hệt cho 2 trường hợp (khối Task 1 vs Task 2, ví dụ `TaskAnswerBlock`/`TaskResultSection`) được gộp thành 1 component dùng chung thay vì copy-paste. Logic nghiệp vụ nhiều state/effect (fetch, autosave, chống gian lận) tách riêng vào `hooks/` — ví dụ `useStudentTestState.ts` giữ toàn bộ state của trang làm bài để `StudentTest.tsx` chỉ còn lo render. Logic không phụ thuộc React (build prompt, parse JSON, build file export, tính band) nằm trong `lib/`, có thể unit-test độc lập — kể cả những hàm từng nằm "tạm" trong file component (`feedback-resolvers.ts` tách ra từ `GradingResultPanel.tsx` cũ) nay cũng đã chuyển đúng chỗ.

## Kiến trúc & luồng dữ liệu

```mermaid
flowchart LR
  subgraph Học sinh
    A[StudentTest] -- POST /api/submissions --> B[(Supabase)]
    A -- PATCH autosave mỗi 5s --> B
    A -- POST submit --> B
    A -- POST warning --> B
  end

  subgraph Giáo viên
    C[TeacherDashboard] -- Bearer token --> B
    C -- POST /api/grade --> D[lib/grading]
    D -- chính --> E[Google Gemini]
    D -- fallback khi lỗi/quá tải --> F[Groq]
    D -- update feedback + band_score --> B
    B -- Realtime: postgres_changes (INSERT/UPDATE/DELETE trên submissions) --> C
  end
```

- **Theo dõi trực tiếp:** `useSubmissions` mở một kênh Supabase Realtime (`.channel("teacher-submissions")`, subscribe `postgres_changes` trên bảng `submissions`) — mọi lần học sinh autosave, bị cảnh báo gian lận, hoặc nộp bài mới đều đẩy về dashboard giáo viên ngay lập tức, không cần tải lại trang. Sự kiện `UPDATE` được ghép thẳng vào state cục bộ (không gọi lại API); `INSERT`/`DELETE` load lại danh sách vì cần dữ liệu join `tests` đầy đủ. Trạng thái kênh (đang kết nối / đã kết nối / lỗi) và mốc "cập nhật lần cuối" hiện ở header dashboard.
- **Bắt buộc chạy `realtime.sql`** sau `schema.sql`: Supabase không tự phát sự kiện realtime chỉ vì bảng tồn tại — bảng `submissions` phải được thêm thủ công vào publication `supabase_realtime`, và cần cột `updated_at` (tự set bằng trigger) để dashboard hiện đúng "cập nhật X giây trước".

- **Ghi dữ liệu học sinh** (`/api/submissions`, `/submit`, `/warning`, autosave nội dung qua PATCH) dùng **service-role key** (bypass RLS) và **cố ý public** — học sinh làm bài không cần tài khoản.
- **Đọc dữ liệu giáo viên** qua Supabase client (anon key) được bảo vệ bằng **Row Level Security**: chỉ user đã đăng nhập mới đọc được `submissions`/`tests`/`classes`.
- **Các thao tác chỉ-giáo-viên** (`/api/grade`, `/api/submissions/bulk-delete`) dùng service-role key nhưng bắt buộc có JWT hợp lệ: client gắn `Authorization: Bearer <access_token>` (qua `getAuthHeader()`), server xác minh bằng `requireAuth()` (gọi `auth.getUser(token)` để Supabase Auth server tự xác thực chữ ký/hạn dùng, không tự giải mã token rồi tin payload).
- **`useTeacherAuth`** chỉ là gác ở client (ẩn/hiện UI + tự đăng xuất sau 30 phút rảnh) — lớp bảo vệ thật sự nằm ở RLS (đọc) và `requireAuth()` (ghi/thao tác tốn phí), không phải ở route `/teacher` tự nó.

## Bắt đầu nhanh

```bash
npm install
# Tạo file .env.local thủ công với các biến ở mục bên dưới
# (repo hiện chưa có sẵn .env.local.example để copy)
npm run dev
```

Chạy trên Supabase SQL Editor theo đúng thứ tự: [`schema.sql`](./schema.sql) trước, rồi [`realtime.sql`](./realtime.sql) — thiếu bước sau thì dashboard giáo viên vẫn chạy được nhưng phải F5 mới thấy bài mới/cập nhật thay vì hiện tức thời.

Mở [http://localhost:3000](http://localhost:3000). Deploy production dùng Vercel (`vercel.json`).

## Biến môi trường

| Biến | Bắt buộc | Mô tả |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | URL project Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ | Anon key (client, bị giới hạn bởi RLS) |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | Service role key (chỉ dùng ở server, bypass RLS) |
| `GOOGLE_GEMINI_API_KEY` | ✅ | Provider chấm bài chính |
| `GEMINI_MODEL` | ⛔ (mặc định `gemini-3.6-flash`) | Override model Gemini |
| `GROQ_API_KEY` | ✅ | Provider chấm bài dự phòng khi Gemini lỗi/quá tải |
| `GROQ_MODEL` | ⛔ (mặc định `openai/gpt-oss-120b`) | Override model Groq |

## Schema cơ sở dữ liệu

Xem chi tiết đầy đủ (cột, ràng buộc, RLS policy) trong [`schema.sql`](./schema.sql). Tóm tắt các bảng chính:

| Bảng | Vai trò |
|---|---|
| `profiles` | Tài khoản giáo viên (mọi user đăng ký = giáo viên, không phân quyền thêm) |
| `classes` | Lớp học do giáo viên tạo — dùng để gắn đề thi và lọc bài nộp theo lớp |
| `tests` | Đề thi: tiêu đề, đề Task 1/2, ảnh biểu đồ, thời lượng, lớp gắn (`class_id`), cờ `block_copy_paste` |
| `submissions` | Bài làm học sinh: nội dung, trạng thái, điểm & nhận xét AI (`feedback`, `band_score`), nhận xét giáo viên |
| `warnings` | Lịch sử các lần vi phạm chống gian lận theo từng `submission` |

`submissions` **không** lưu `class_id` riêng — lớp của một bài nộp được suy ra qua `submissions.test_id → tests.class_id`, tránh lệch dữ liệu khi một đề thi đổi lớp sau khi đã có học sinh nộp bài.