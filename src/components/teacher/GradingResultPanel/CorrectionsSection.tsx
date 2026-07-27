"use client";

import { useState } from "react";
import { Bot, ChevronDown } from "lucide-react";
import type { Correction } from "@/lib/types";

// Danh sách "Lỗi sai & Đề xuất sửa" — mặc định THU GỌN, chỉ hiện số lượng lỗi
// theo từng tiêu chí (TA/CC/LR/GRA) để quét nhanh bằng mắt; bấm vào mới xổ ra
// từng lỗi chi tiết. Tránh việc phải cuộn qua 8-15 card ngay khi vừa mở bài.
export default function CorrectionsSection({ corrections }: { corrections: Correction[] }) {
  const [expanded, setExpanded] = useState(false);
  if (corrections.length === 0) return null;

  const counts: Record<string, number> = {};
  for (const c of corrections) {
    const key = (c as any).criterion || "Khác";
    counts[key] = (counts[key] ?? 0) + 1;
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-white border border-slate-200/80 px-5 py-4 text-left hover:border-slate-300 transition-colors"
      >
        <div className="flex items-center gap-2.5">
          <h4 className="font-black text-slate-900 text-base">Lỗi sai & Đề xuất sửa</h4>
          <span className="text-xs font-bold text-slate-400">{corrections.length} lỗi</span>
        </div>
        <div className="flex items-center gap-2 ml-auto">
          <div className="hidden sm:flex items-center gap-1.5">
            {Object.entries(counts).map(([key, n]) => (
              <span key={key} className="text-[11px] font-bold text-slate-500 bg-slate-100 rounded-full px-2 py-0.5">
                {key} · {n}
              </span>
            ))}
          </div>
          <span className="text-xs font-bold text-cyan-700">{expanded ? "Thu gọn" : "Xem chi tiết"}</span>
          <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform ${expanded ? "rotate-180" : ""}`} />
        </div>
      </button>

      {expanded && (
        <div className="space-y-4 mt-4">
          {corrections.map((correction, index) => (
            <div key={index} className="rounded-2xl bg-white border border-slate-200/80 p-5 shadow-sm space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="border-l-[3px] border-red-300 pl-3 py-0.5">
                  <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Bản gốc</span>
                  <p className="text-[14px] text-slate-500 line-through decoration-slate-300 whitespace-pre-wrap">{correction.original}</p>
                </div>
                <div className="border-l-[3px] border-emerald-300 pl-3 py-0.5">
                  <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Đề xuất sửa</span>
                  <p className="text-[14px] text-slate-700 font-medium whitespace-pre-wrap">{correction.corrected}</p>
                </div>
              </div>
              <div className="flex items-start gap-2.5 rounded-xl bg-slate-50 p-3">
                <Bot className="h-5 w-5 shrink-0 text-cyan-600 mt-0.5" />
                <p className="text-sm text-slate-600 leading-relaxed font-medium">{correction.explanation}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
