"use client";

import { BookOpen, Bot, GraduationCap, LogOut, Radio } from "lucide-react";
import { formatRelativeTime } from "@/lib/teacher/submission-utils";
import type { RealtimeStatus } from "@/hooks/teacher/useSubmissions";

export type DashboardTab = "submissions" | "tests" | "classes";

type DashboardHeaderProps = {
  realtimeStatus: RealtimeStatus;
  justUpdated: boolean;
  lastRealtimeEventAt: number | null;
  now: number;
  activeTab: DashboardTab;
  onTabChange: (tab: DashboardTab) => void;
  onSignOut: () => void;
};

// Thanh điều hướng trên cùng — dính đầu trang: logo + chấm trạng thái kết nối
// Realtime (xanh/đỏ/xám tùy trạng thái) + nút đăng xuất, cộng hàng 3 tab bên
// dưới. Toàn bộ props ở đây đến từ useSubmissions()/useNow() ở component cha.
export default function DashboardHeader({
  realtimeStatus,
  justUpdated,
  lastRealtimeEventAt,
  now,
  activeTab,
  onTabChange,
  onSignOut,
}: DashboardHeaderProps) {
  return (
    <header className="sticky top-0 z-50 border-b border-slate-800 bg-slate-950">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="shrink-0 rounded-lg border border-cyan-500/30 bg-cyan-500/20 p-1.5">
            <Bot className="h-5 w-5 text-cyan-400" />
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-base font-bold leading-tight text-white sm:text-lg">Teacher Workspace</h1>
            <p className="hidden items-center gap-1.5 truncate text-xs text-slate-400 sm:flex">
              <span
                className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                  realtimeStatus === "connected"
                    ? justUpdated
                      ? "animate-pulse bg-emerald-400"
                      : "bg-emerald-400"
                    : realtimeStatus === "error"
                      ? "bg-red-400"
                      : "animate-pulse bg-slate-500"
                }`}
              />
              {realtimeStatus === "connected"
                ? "Đã kết nối realtime — bài làm & cảnh báo cập nhật tức thời"
                : realtimeStatus === "error"
                  ? "Mất kết nối realtime — đang thử lại..."
                  : "Đang kết nối realtime..."}
              {realtimeStatus === "connected" && lastRealtimeEventAt && (
                <span className="text-slate-500"> · cập nhật lần cuối {formatRelativeTime(lastRealtimeEventAt, now)}</span>
              )}
            </p>
          </div>
        </div>

        <button
          onClick={onSignOut}
          className="flex shrink-0 items-center gap-1.5 rounded-xl border border-red-900/50 bg-red-950/30 px-3 py-2 text-xs font-bold text-red-400 transition-colors hover:text-red-300 sm:px-4 sm:text-sm"
        >
          <LogOut className="h-4 w-4" /> <span className="hidden sm:inline">Đăng xuất</span>
        </button>
      </div>

      {/* Tab strip — full-bleed, chia đều 2 nút trên mobile để dễ bấm bằng ngón cái */}
      <div className="mx-auto flex max-w-7xl gap-1 px-4 pb-0 sm:px-6">
        <button
          onClick={() => onTabChange("submissions")}
          className={`flex flex-1 items-center justify-center gap-2 border-b-2 px-4 py-3 text-sm font-semibold transition-colors sm:flex-none ${
            activeTab === "submissions" ? "border-cyan-400 text-white" : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          <Radio className={`h-4 w-4 ${activeTab === "submissions" ? "text-cyan-400" : ""}`} />
          Theo dõi &amp; Chấm bài
        </button>
        <button
          onClick={() => onTabChange("tests")}
          className={`flex flex-1 items-center justify-center gap-2 border-b-2 px-4 py-3 text-sm font-semibold transition-colors sm:flex-none ${
            activeTab === "tests" ? "border-cyan-400 text-white" : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          <BookOpen className="h-4 w-4" />
          Quản lý đề thi
        </button>
        <button
          onClick={() => onTabChange("classes")}
          className={`flex flex-1 items-center justify-center gap-2 border-b-2 px-4 py-3 text-sm font-semibold transition-colors sm:flex-none ${
            activeTab === "classes" ? "border-cyan-400 text-white" : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          <GraduationCap className="h-4 w-4" />
          Quản lý lớp học
        </button>
      </div>
    </header>
  );
}
