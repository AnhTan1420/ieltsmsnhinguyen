"use client";

import Link from "next/link";
// Nếu bạn dùng Supabase, hãy import thư viện ở đây
// import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
// import { useRouter } from "next/navigation";

export default function Home() {
  // const supabase = createClientComponentClient();
  // const router = useRouter();

  const handleSignOut = async () => {
    try {
      // Gọi logic đăng xuất của bạn tại đây
      // await supabase.auth.signOut();
      // router.push("/login");
      console.log("Đã click đăng xuất!");
    } catch (error) {
      console.error("Lỗi khi đăng xuất:", error);
    }
  };

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
          Mở Dashboard Quản Trị 🚀
        </Link>
      </div>

      {/* NÚT SIGN OUT FIXED Ở GÓC DƯỚI BÊN PHẢI */}
      <button 
        onClick={handleSignOut}
        className="fixed bottom-8 right-8 z-50 flex items-center gap-2 rounded-full border border-red-500/30 bg-slate-900 px-6 py-3 font-semibold text-red-400 shadow-xl transition-all hover:bg-red-600 hover:text-white"
        aria-label="Sign out"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
          <polyline points="16 17 21 12 16 7"></polyline>
          <line x1="21" y1="12" x2="9" y2="12"></line>
        </svg>
        Sign Out
      </button>

    </main>
  );
}