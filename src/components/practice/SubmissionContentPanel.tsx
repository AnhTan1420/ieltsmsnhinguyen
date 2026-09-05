"use client";

import { useState } from "react";
import { BookOpen, Lightbulb, Sparkles, Wand2 } from "lucide-react";
import {
  renderHighlightedAnswer,
  type HighlightCluster,
  type HighlightItem,
} from "@/lib/teacher/submission-utils";

type SubmissionContentPanelProps = {
  taskLabel: string;
  prompt: string;
  imageUrl?: string | null;
  essay: string;
  highlightItems: HighlightItem[];
};

// Chi tiết của 1 item khi bấm vào đoạn tô sáng — bản rút gọn, tự thân (không
// phụ thuộc HighlightDetailPanel bên /teacher, vốn được thiết kế cho layout 3
// cột sticky của SubmissionDetail). Hiện trong 1 div riêng phía trên khối
// "Writing Task N", vì trang luyện tập chỉ cần 2 khối: bài làm + đánh giá AI.
function ClusterDetailItem({ item }: { item: HighlightItem }) {
  if (item.kind === "correction") {
    const c = item.data;
    return (
      <div className="space-y-2.5">
        <p className="flex items-center gap-1.5 text-xs font-bold text-amber-700">
          <Lightbulb className="h-3.5 w-3.5" /> Lỗi sai
        </p>
        <p className="text-sm leading-relaxed text-slate-600">{c.explanation}</p>
        <div className="border-l-[3px] border-red-300 pl-3 py-0.5 text-sm leading-relaxed text-slate-500 line-through">
          {c.original}
        </div>
        <div className="border-l-[3px] border-emerald-300 pl-3 py-0.5 text-sm font-medium leading-relaxed text-slate-700">
          {c.corrected}
        </div>
      </div>
    );
  }

  if (item.kind === "upgrade") {
    const u = item.data;
    return (
      <div className="space-y-2.5">
        <p className="flex items-center gap-1.5 text-xs font-bold text-sky-700">
          <Sparkles className="h-3.5 w-3.5" /> Câu nên viết hay hơn
        </p>
        <p className="text-sm leading-relaxed text-slate-600">{u.note}</p>
        <div className="border-l-[3px] border-slate-300 pl-3 py-0.5 text-sm leading-relaxed text-slate-500">
          {u.original}
        </div>
        <div className="border-l-[3px] border-sky-300 pl-3 py-0.5 text-sm font-medium leading-relaxed text-slate-700">
          {u.upgraded}
        </div>
      </div>
    );
  }

  const s = item.data;
  return (
    <div className="space-y-2.5">
      <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-emerald-700">
        <Wand2 className="h-3.5 w-3.5" /> {s.structure_name}
      </p>
      <p className="text-sm leading-relaxed text-slate-600">{s.explanation_vi}</p>
      <div className="border-l-[3px] border-emerald-300 pl-3 py-0.5 text-sm font-medium italic leading-relaxed text-slate-700">
        {s.example_sentence_en}
      </div>
    </div>
  );
}

// Khối "Nội dung bài làm" ở trang /practice — đề bài + ảnh biểu đồ (nếu Task
// 1) + bài làm của người luyện tập, đặt CẠNH panel "Đánh giá từ AI Examiner"
// (GradingResultPanel) thay vì tách rời như trước, để xem lại bài viết và kết
// quả chấm cùng lúc mà không phải cuộn lên xuống. Tái dùng renderHighlightedAnswer
// dùng chung với /teacher nên lỗi sai/câu nâng cấp/cấu trúc nâng cao cũng được
// tô sáng trực tiếp trong bài làm, bấm vào để xem chi tiết ngay bên dưới.
export default function SubmissionContentPanel({
  taskLabel,
  prompt,
  imageUrl,
  essay,
  highlightItems,
}: SubmissionContentPanelProps) {
  const [activeCluster, setActiveCluster] = useState<HighlightCluster | null>(null);
  const hasHighlights = highlightItems.length > 0;

  return (
    <div className="flex flex-col gap-4 xl:flex-row xl:items-start">
      <div className="min-w-0 flex-1 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center gap-2 bg-slate-900 px-5 py-3.5 text-white sm:px-6">
          <BookOpen className="h-4 w-4 text-cyan-400" />
          <span className="text-sm font-black uppercase tracking-wide">{taskLabel}</span>
        </div>

        <div className="space-y-4 p-5 sm:p-6">
          {prompt && (
            <div className="rounded-xl border border-l-4 border-slate-200 border-l-cyan-400 bg-slate-50 p-4">
              <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">Đề bài</p>
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700">{prompt}</p>
            </div>
          )}

          {imageUrl && (
            <div className="flex justify-center rounded-xl border border-slate-200 bg-white p-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={imageUrl} alt="Biểu đồ đề bài" className="max-h-[320px] rounded-lg object-contain" />
            </div>
          )}

          <div>
            <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">Bài làm của bạn</p>

            {hasHighlights && (
              <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-[11px] font-semibold">
                <span className="flex items-center gap-1.5 text-amber-700">
                  <span className="inline-block h-3 w-3 shrink-0 rounded-sm border border-amber-400 bg-amber-200/70" />
                  Lỗi sai
                </span>
                <span className="flex items-center gap-1.5 text-sky-700">
                  <span className="inline-block h-3 w-3 shrink-0 rounded-sm border border-sky-400 bg-sky-200/70" />
                  Câu nên viết hay hơn
                </span>
                <span className="flex items-center gap-1.5 text-emerald-700">
                  <span className="inline-block h-3 w-3 shrink-0 rounded-sm border border-emerald-400 bg-emerald-200/70" />
                  Gợi ý cấu trúc nâng cao
                </span>
              </div>
            )}

            <div className="min-h-[120px] whitespace-pre-wrap rounded-xl border border-slate-200 bg-[#fcfcfc] px-4 py-6 font-serif text-[15px] leading-[2] tracking-wide text-slate-800 selection:bg-cyan-200 sm:px-6">
              {essay ? (
                renderHighlightedAnswer(essay, highlightItems, activeCluster?.start ?? null, setActiveCluster)
              ) : (
                <span className="font-sans text-sm italic text-slate-400">Chưa có nội dung bài làm.</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Chi tiết phản hồi — đặt CẠNH khối "Writing Task N", căn về bên phải
          (thay vì nằm phía trên như trước) — cùng hàng trên màn hình rộng
          (xl+), xuống dưới thành 1 khối riêng trên màn hình hẹp hơn. */}
      {hasHighlights && (
        <div className="w-full shrink-0 rounded-2xl border border-slate-100 bg-slate-50 p-4 xl:w-72">
          <p className="mb-2 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
            <Lightbulb className="h-3.5 w-3.5 text-amber-500" /> Chi tiết phản hồi
          </p>
          {activeCluster ? (
            <div className="space-y-4">
              {activeCluster.items.map((item, i) => (
                <div key={i}>
                  {i > 0 && <div className="mb-4 border-t border-slate-200" />}
                  <ClusterDetailItem item={item} />
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs italic leading-relaxed text-slate-400">
              Bấm vào đoạn được tô sáng bên cạnh để xem chi tiết nhận xét.
            </p>
          )}
        </div>
      )}
    </div>
  );
}