"use client";

import { BookOpen, Check, Clock, Copy, Edit3, GraduationCap, Trash2 } from "lucide-react";
import type { TestRow } from "@/lib/types";

type TestBankListProps = {
  tests: TestRow[];
  copiedId: string | null;
  showOnMobile: boolean;
  onEdit: (test: TestRow) => void;
  onDelete: (testId: string) => void;
  onCopyLink: (testId: string) => void;
  onCreateNew: () => void;
};

// Cột trái "Ngân hàng Đề thi" — danh sách đề đã tạo + nút soạn đề mới. Trên
// mobile ẩn đi khi đang mở form soạn/sửa (điều hướng master-detail).
export default function TestBankList({ tests, copiedId, showOnMobile, onEdit, onDelete, onCopyLink, onCreateNew }: TestBankListProps) {
  return (
    <div className={`${showOnMobile ? "block" : "hidden lg:block"} rounded-3xl bg-white p-4 sm:p-6 shadow-sm border border-slate-200/60 lg:sticky lg:top-24`}>
      <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-5 mb-5">
        <div className="min-w-0">
          <h2 className="text-xl font-bold text-slate-900">Ngân hàng Đề thi</h2>
          <p className="text-sm text-slate-500 font-medium mt-1">Danh sách các đề IELTS Writing bạn đã tạo</p>
        </div>
        <button
          onClick={onCreateNew}
          className="flex shrink-0 items-center gap-2 rounded-xl bg-slate-900 px-4 sm:px-5 py-2.5 text-sm font-bold text-white hover:bg-slate-800 shadow-sm transition-all hover:shadow-md"
        >
          <span className="text-base leading-none">+</span> <span className="hidden sm:inline">Soạn đề mới</span>
        </button>
      </div>

      {tests.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center text-slate-400">
          <BookOpen className="h-8 w-8 mb-2 text-slate-300" />
          <p className="text-sm font-medium">Chưa có đề thi nào. Bấm &quot;Soạn đề mới&quot; để bắt đầu.</p>
        </div>
      ) : (
        <div className="grid gap-4 lg:max-h-[calc(100vh-16rem)] lg:overflow-y-auto pr-0 lg:pr-2 custom-scrollbar">
          {tests.map((test) => (
            <div key={test.id} className="p-4 sm:p-5 border border-slate-200 rounded-2xl bg-white hover:border-cyan-300 hover:shadow-md transition-all group relative overflow-hidden">
              <div className="absolute top-0 left-0 w-1 h-full bg-slate-200 group-hover:bg-cyan-400 transition-colors"></div>
              <div className="flex justify-between items-start gap-2 mb-3">
                <h3 className="font-bold text-lg text-slate-800 group-hover:text-cyan-800 pl-2 pr-1 min-w-0 break-words">{test.title}</h3>
                {/* Luôn hiện sẵn (không chỉ khi hover) — trên cảm ứng không có hover ổn định */}
                <div className="flex shrink-0 gap-0.5 sm:gap-1 bg-slate-50 rounded-lg p-1 border border-slate-100">
                  <button onClick={() => onEdit(test)} className="p-2 text-slate-400 hover:text-cyan-600 hover:bg-white rounded-md transition" title="Sửa đề">
                    <Edit3 className="h-4 w-4" />
                  </button>
                  <button onClick={() => onDelete(test.id)} className="p-2 text-slate-400 hover:text-red-600 hover:bg-white rounded-md transition" title="Xóa đề">
                    <Trash2 className="h-4 w-4" />
                  </button>
                  <button onClick={() => onCopyLink(test.id)} className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-white rounded-md transition" title="Copy Link">
                    {copiedId === test.id ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <div className="pl-2 flex items-center gap-4 text-xs font-medium text-slate-500">
                <span className="flex items-center gap-1.5"><Clock className="h-3.5 w-3.5" /> {test.duration_minutes} phút</span>
                <span className="hidden sm:flex items-center gap-1.5"><BookOpen className="h-3.5 w-3.5" /> Full Test (Task 1 & 2)</span>
                <span className={`flex items-center gap-1.5 ${test.classes?.name ? "text-cyan-700" : "text-slate-400"}`}>
                  <GraduationCap className="h-3.5 w-3.5" /> {test.classes?.name || "Chưa phân lớp"}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
