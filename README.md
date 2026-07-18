## Project Structure
```text
src/
├── components/teacher/         # Giao diện quản lý của giáo viên
│   ├── TeacherDashboard.tsx    # Layout chính & quản lý Tab state
│   ├── ExamCreateForm.tsx      # Chức năng tạo đề thi (upload, config)
│   ├── SubmissionList.tsx      # Sidebar danh sách bài nộp & tác vụ bulk
│   ├── SubmissionDetail.tsx    # Panel chi tiết bài làm & so sánh Task 1/2
│   ├── GradingResultPanel.tsx  # Hiển thị AI Feedback, Band score, Diff
│   └── GradingProgressModal.tsx # Modal hiển thị tiến trình chấm điểm
│
├── hooks/teacher/              # Custom Hooks xử lý business logic
│   ├── useTeacherAuth.ts       # Xác thực quyền truy cập
│   ├── useTests.ts             # Quản lý vòng đời đề thi
│   ├── useSubmissions.ts       # Quản lý logic bài nộp & chấm điểm
│   └── useBulkActions.ts       # Xử lý hành động hàng loạt (xóa, tải)
│
└── lib/grading/                # Core logic chấm điểm AI
    ├── prompt.ts               # Định nghĩa Task Config & System Prompts
    ├── provider.ts             # Kết nối & gọi API (Groq/Gemini)
    └── parse.ts                # Xử lý nội dung input & parse JSON output
