"use client";

import Link from "next/link";
// Nếu bạn dùng Supabase, hãy import thư viện ở đây
// import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
// import { useRouter } from "next/navigation";

export default function Home() {
  // const supabase = createClientComponentClient();
  // const router = useRouter();


  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center bg-slate-950 px-6 text-white text-center">
      
      {/* KHỐI NỘI DUNG CHÍNH - VÀO THẲNG VẤN ĐỀ */}
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.35em] text-cyan-300">
          IELTS Writing
        </p>
        <h1 className="mt-4 text-4xl font-bold md:text-5xl">Teacher Portal</h1>
        <p className="mt-4 text-slate-400 max-w-md mx-auto">
          Hệ thống quản lý bài thi, theo dõi trực tiếp và chấm điểm tự động.
        </p>
        
        <Link 
          href="/teacher" 
          className="mt-10 inline-block rounded-2xl bg-cyan-400 px-10 py-4 text-lg font-bold text-slate-950 shadow-[0_0_30px_rgba(34,211,238,0.2)] transition-all hover:bg-cyan-300 hover:scale-105"
        >
          Mở Dashboard
        </Link>
      </div>

      
    </main>
  );
}