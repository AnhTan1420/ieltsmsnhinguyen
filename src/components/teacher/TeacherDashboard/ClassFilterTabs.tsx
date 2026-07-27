"use client";

import { GraduationCap } from "lucide-react";
import type { ClassRow } from "@/lib/types";

type ClassFilterTabsProps = {
  classes: ClassRow[];
  selectedClassId: string;
  onSelect: (classId: string) => void;
};

// Thanh tab lọc bài nộp theo lớp học ở tab "Theo dõi & Chấm bài" — chỉ đổi
// danh sách bài làm hiển thị, không ảnh hưởng gì tới SubmissionList/Detail bên
// dưới. Không render gì nếu giáo viên chưa tạo lớp nào.
export default function ClassFilterTabs({ classes, selectedClassId, onSelect }: ClassFilterTabsProps) {
  if (classes.length === 0) return null;

  return (
    <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
      <button
        onClick={() => onSelect("all")}
        className={`shrink-0 flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-bold border transition-colors ${
          selectedClassId === "all"
            ? "bg-slate-900 text-white border-slate-900"
            : "bg-white text-slate-500 border-slate-200 hover:border-slate-300 hover:text-slate-700"
        }`}
      >
        Tất cả
      </button>
      {classes.map((cls) => (
        <button
          key={cls.id}
          onClick={() => onSelect(cls.id)}
          className={`shrink-0 flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-bold border transition-colors ${
            selectedClassId === cls.id
              ? "bg-cyan-500 text-slate-900 border-cyan-500"
              : "bg-white text-slate-500 border-slate-200 hover:border-slate-300 hover:text-slate-700"
          }`}
        >
          <GraduationCap className="h-3.5 w-3.5" /> {cls.name}
        </button>
      ))}
      <button
        onClick={() => onSelect("none")}
        className={`shrink-0 flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-bold border transition-colors ${
          selectedClassId === "none"
            ? "bg-slate-900 text-white border-slate-900"
            : "bg-white text-slate-500 border-slate-200 hover:border-slate-300 hover:text-slate-700"
        }`}
      >
        Chưa phân lớp
      </button>
    </div>
  );
}
