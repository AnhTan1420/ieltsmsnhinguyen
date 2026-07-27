"use client";

import { useEffect } from "react";
import { Lightbulb, Sparkles, Wand2, X } from "lucide-react";
import type { HighlightCluster, HighlightItem } from "@/lib/teacher/submission-utils";

// Render chi tiết của ĐÚNG 1 item (lỗi sai / câu nâng cấp / gợi ý cấu trúc).
function HighlightItemDetail({ item }: { item: HighlightItem }) {
  if (item.kind === "correction") {
    const c = item.data;
    return (
      <div className="space-y-4">
        <div className="flex items-start gap-2.5">
          <div className="bg-amber-50 text-amber-600 rounded-full p-1.5 shrink-0">
            <Lightbulb className="h-3.5 w-3.5" />
          </div>
          <p className="text-sm font-semibold text-slate-800 leading-relaxed whitespace-pre-wrap">&quot;{c.original}&quot;</p>
        </div>
        <div>
          <p className="text-xs font-bold text-slate-500 mb-1">Giải thích:</p>
          <p className="text-sm text-slate-600 leading-relaxed">{c.explanation}</p>
        </div>
        <div>
          <p className="text-xs font-bold text-slate-500 mb-2">Gợi ý:</p>
          <div className="border-l-[3px] border-red-300 pl-3 py-1 text-sm text-slate-500 leading-relaxed line-through decoration-slate-300 whitespace-pre-wrap">
            {c.original}
          </div>
          <div className="flex justify-center py-1 text-slate-300">↓</div>
          <div className="border-l-[3px] border-emerald-300 pl-3 py-1 text-sm text-slate-700 font-medium leading-relaxed whitespace-pre-wrap">
            {c.corrected}
          </div>
        </div>
      </div>
    );
  }

  if (item.kind === "upgrade") {
    const u = item.data;
    return (
      <div className="space-y-4">
        <div className="flex items-start gap-2.5">
          <div className="bg-sky-50 text-sky-600 rounded-full p-1.5 shrink-0">
            <Sparkles className="h-3.5 w-3.5" />
          </div>
          <p className="text-sm font-semibold text-slate-800 leading-relaxed">Câu này đã đúng — có thể viết hay hơn</p>
        </div>
        <div>
          <p className="text-xs font-bold text-slate-500 mb-1">Ghi chú:</p>
          <p className="text-sm text-slate-600 leading-relaxed">{u.note}</p>
        </div>
        <div>
          <p className="text-xs font-bold text-slate-500 mb-2">Nâng cấp:</p>
          <div className="border-l-[3px] border-slate-300 pl-3 py-1 text-sm text-slate-500 leading-relaxed whitespace-pre-wrap">
            {u.original}
          </div>
          <div className="flex justify-center py-1 text-slate-300">↓</div>
          <div className="border-l-[3px] border-sky-300 pl-3 py-1 text-sm text-slate-700 font-medium leading-relaxed whitespace-pre-wrap">
            {u.upgraded}
          </div>
        </div>
      </div>
    );
  }

  const s = item.data;
  return (
    <div className="space-y-4">
      <div className="flex items-start gap-2.5">
        <div className="bg-emerald-50 text-emerald-600 rounded-full p-1.5 shrink-0">
          <Wand2 className="h-3.5 w-3.5" />
        </div>
        <p className="text-xs font-bold uppercase tracking-wide text-emerald-700 leading-relaxed">{s.structure_name}</p>
      </div>
      {s.original_sentence && (
        <div>
          <p className="text-xs font-bold text-slate-500 mb-2">Câu gốc → Áp dụng cấu trúc:</p>
          <div className="border-l-[3px] border-slate-300 pl-3 py-1 text-sm text-slate-500 leading-relaxed whitespace-pre-wrap">
            {s.original_sentence}
          </div>
          <div className="flex justify-center py-1 text-slate-300">↓</div>
        </div>
      )}
      <div className="border-l-[3px] border-emerald-300 pl-3 py-1 text-sm text-slate-700 font-medium leading-relaxed italic whitespace-pre-wrap">
        {s.example_sentence_en}
      </div>
      <div>
        <p className="text-xs font-bold text-slate-500 mb-1">Giải thích:</p>
        <p className="text-sm text-slate-600 leading-relaxed">{s.explanation_vi}</p>
      </div>
    </div>
  );
}

// Nội dung dùng chung cho cả cột desktop lẫn bottom-sheet mobile. Khi 1 cụm có
// nhiều item chồng lấn (vd cùng 1 câu vừa là gợi ý cấu trúc vừa là câu nâng cấp),
// hiện lần lượt TỪNG item thay vì chỉ item đầu tiên "che mất" các item còn lại.
function HighlightDetailContent({ activeCluster }: { activeCluster: HighlightCluster | null }) {
  if (!activeCluster) {
    return (
      <p className="text-sm text-slate-400 italic leading-relaxed">
        Bấm vào đoạn được tô sáng trong bài làm để xem chi tiết — vàng là lỗi sai, xanh dương là câu được viết lại hay hơn, xanh lá là gợi ý cấu trúc nâng cao, tím là nơi có nhiều hơn 1 phản hồi.
      </p>
    );
  }

  if (activeCluster.items.length === 1) {
    return <HighlightItemDetail item={activeCluster.items[0]} />;
  }

  return (
    <div className="space-y-5">
      <p className="text-xs font-bold text-violet-600 bg-violet-50 border border-violet-100 rounded-lg px-3 py-2">
        Đoạn này có {activeCluster.items.length} phản hồi khác nhau:
      </p>
      {activeCluster.items.map((item, i) => (
        <div key={i}>
          {i > 0 && <div className="border-t border-slate-100 -mx-1 mb-5" />}
          <HighlightItemDetail item={item} />
        </div>
      ))}
    </div>
  );
}

type HighlightDetailPanelProps = {
  activeCluster: HighlightCluster | null;
  onClose: () => void;
};

// Panel "Chi tiết phản hồi" — cột cố định bên phải trên desktop, bottom-sheet
// trượt lên trên mobile (không đủ chỗ cho 1 cột riêng ở màn hình nhỏ).
export default function HighlightDetailPanel({ activeCluster, onClose }: HighlightDetailPanelProps) {
  // Đóng bottom-sheet trên mobile bằng phím Esc.
  useEffect(() => {
    if (!activeCluster) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [activeCluster, onClose]);

  return (
    <>
      {/* Desktop — cột thứ 3 cố định, cuộn riêng */}
      <div className="hidden lg:flex lg:flex-col rounded-3xl bg-white p-5 shadow-sm border border-slate-200/60 lg:sticky lg:top-24 lg:max-h-[calc(100vh-7rem)] overflow-y-auto custom-scrollbar">
        <h3 className="text-sm font-black text-slate-900 flex items-center gap-2 pb-3 border-b border-slate-100 shrink-0">
          <Lightbulb className="h-4 w-4 text-amber-500" /> Chi tiết phản hồi
        </h3>
        <div className="mt-4">
          <HighlightDetailContent activeCluster={activeCluster} />
        </div>
      </div>

      {/* Mobile — cửa sổ trượt lên từ dưới khi bấm vào đoạn tô sáng */}
      <div
        className={`lg:hidden fixed inset-0 z-[90] ${activeCluster ? "pointer-events-auto" : "pointer-events-none"}`}
        aria-hidden={!activeCluster}
      >
        <div
          className={`absolute inset-0 bg-slate-950/50 transition-opacity duration-300 ${
            activeCluster ? "opacity-100" : "opacity-0"
          }`}
          onClick={onClose}
        />
        <div
          className={`absolute inset-x-0 bottom-0 max-h-[75vh] overflow-y-auto custom-scrollbar rounded-t-3xl bg-white p-5 pb-8 shadow-2xl transition-transform duration-300 ${
            activeCluster ? "translate-y-0" : "translate-y-full"
          }`}
        >
          <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-slate-200" />
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
              <Lightbulb className="h-4 w-4 text-amber-500" /> Chi tiết phản hồi
            </h3>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              aria-label="Đóng"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="mt-4">
            <HighlightDetailContent activeCluster={activeCluster} />
          </div>
        </div>
      </div>
    </>
  );
}
