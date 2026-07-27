"use client";

import { ChevronRight, Loader2, Users } from "lucide-react";

// Hiện trong lúc useTeacherAuth() còn đang kiểm tra session (chớp nhoáng lúc vừa load trang).
export function AuthCheckingScreen() {
  return (
    <main className="min-h-screen bg-slate-50 flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-cyan-600" />
        <p className="text-sm font-medium text-slate-500">Đang tải dữ liệu...</p>
      </div>
    </main>
  );
}

// Hiện khi đã xác định chắc chắn KHÔNG có giáo viên nào đăng nhập — học sinh
// không cần tài khoản nên không bị chặn bởi màn này (trang /test/[id] riêng).
export function SignInPromptScreen() {
  return (
    <main className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-white text-center">
      <div className="bg-slate-900/50 p-10 rounded-3xl border border-slate-800 max-w-lg w-full backdrop-blur-xl">
        <div className="mx-auto bg-cyan-950/50 w-20 h-20 rounded-full flex items-center justify-center mb-6 border border-cyan-900">
          <Users className="w-10 h-10 text-cyan-400" />
        </div>
        <h1 className="text-2xl font-bold mb-3 tracking-tight">Khu vực dành cho Giáo viên</h1>
        <p className="text-slate-400 mb-8 leading-relaxed text-sm">
          Học sinh không cần tài khoản để thi. Trang này chỉ dành cho giáo viên — vui lòng đăng nhập để tạo đề và theo dõi bài làm.
        </p>
        <a
          href="/login?next=/teacher"
          className="inline-flex items-center justify-center w-full gap-2 rounded-xl bg-cyan-500 px-6 py-3.5 font-bold text-slate-950 hover:bg-cyan-400 transition-all shadow-[0_0_20px_rgba(6,182,212,0.3)] hover:shadow-[0_0_30px_rgba(6,182,212,0.5)]"
        >
          Đăng nhập ngay <ChevronRight className="h-5 w-5" />
        </a>
      </div>
    </main>
  );
}
