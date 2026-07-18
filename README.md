## Project Structure
src/
├── components/teacher/         # Giao diện quản lý của giáo viên
│   ├── TeacherDashboard.tsx    # Layout chính & quản lý Tab state
│   ├── ExamCreateForm.tsx      # Chức năng tạo đề thi (upload, config)
│   ├── SubmissionList.tsx      # Sidebar danh sách bài làm & tác vụ bulk
│   ├── SubmissionDetail.tsx    # Xem chi tiết & so sánh Task 1/2
│   ├── GradingResultPanel.tsx  # Hiển thị AI Feedback, Band score, Diff
│   └── GradingProgressModal.tsx # Modal hiển thị tiến trình chấm điểm
│
├── hooks/teacher/              # Các Custom Hooks xử lý business logic
│   ├── useTeacherAuth.ts       # Xác thực quyền truy cập
│   ├── useTests.ts             # Quản lý vòng đời đề thi
│   ├── useSubmissions.ts       # Quản lý logic bài nộp & chấm điểm
│   └── useBulkActions.ts       # Xử lý các hành động hàng loạt (xóa, tải)
│
└── lib/grading/                # Core logic chấm điểm AI
    ├── prompt.ts               # Định nghĩa Task Config & System Prompts
    ├── provider.ts             # Kết nối & gọi API (Groq/Gemini)
    └── parse.ts                # Xử lý nội dung input & parse JSON output


This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
