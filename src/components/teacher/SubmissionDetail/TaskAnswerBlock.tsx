"use client";

import { BookOpen, ChevronDown, ChevronUp, Image as ImageIcon } from "lucide-react";
import {
  renderHighlightedAnswer,
  type HighlightCluster,
  type HighlightItem,
} from "@/lib/teacher/submission-utils";

type TaskAnswerBlockProps = {
  taskNumber: 1 | 2;
  prompt?: string | null;
  imageUrl?: string | null;
  answer: string;
  expanded: boolean;
  onToggleExpanded: () => void;
  highlightItems: HighlightItem[];
  activeClusterStart: number | null;
  onSelectCluster: (cluster: HighlightCluster | null) => void;
};

// Khối "TASK 1" / "TASK 2" thu gọn/mở rộng trong panel chi tiết bài làm — cùng
// một cấu trúc UI, chỉ khác đề bài/ảnh minh họa/nội dung, nên gộp thành 1
// component dùng chung thay vì lặp lại JSX gần như y hệt 2 lần.
export default function TaskAnswerBlock({
  taskNumber,
  prompt,
  imageUrl,
  answer,
  expanded,
  onToggleExpanded,
  highlightItems,
  activeClusterStart,
  onSelectCluster,
}: TaskAnswerBlockProps) {
  const Icon = taskNumber === 1 ? ImageIcon : BookOpen;
  const emptyLabel = `Học sinh chưa làm Task ${taskNumber}...`;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-sm">
      <button
        type="button"
        onClick={onToggleExpanded}
        className="w-full flex items-center justify-between gap-2 bg-slate-900 text-white px-4 sm:px-5 py-3.5 hover:bg-slate-800 transition-colors"
      >
        <span className="flex items-center gap-2 font-black tracking-wide text-sm">
          <Icon className="h-4 w-4 text-cyan-400" /> TASK {taskNumber}
        </span>
        <span className="flex items-center gap-1 text-xs font-bold text-cyan-300">
          {expanded ? (
            <>Thu gọn <ChevronUp className="h-3.5 w-3.5" /></>
          ) : (
            <>Xem đầy đủ <ChevronDown className="h-3.5 w-3.5" /></>
          )}
        </span>
      </button>

      {expanded ? (
        <div className="p-4 sm:p-5 space-y-4">
          {prompt && (
            <div className="rounded-xl bg-slate-50 border border-slate-200 border-l-4 border-l-cyan-400 p-4">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Đề bài</p>
              <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">{prompt}</p>
            </div>
          )}

          {imageUrl && (
            <div className="flex justify-center bg-white border border-slate-200 rounded-xl p-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={imageUrl} alt="Minh họa đề Task 1" className="max-h-[360px] object-contain rounded-lg" />
            </div>
          )}

          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">Bài làm học sinh</p>
            <div className="whitespace-pre-wrap font-serif text-[15px] leading-[2] bg-[#fcfcfc] border border-slate-200 rounded-xl px-4 sm:px-6 py-6 text-slate-800 tracking-wide selection:bg-cyan-200 min-h-[120px]">
              {answer ? (
                renderHighlightedAnswer(answer, highlightItems, activeClusterStart, onSelectCluster)
              ) : (
                <span className="text-slate-400 italic font-sans text-sm">{emptyLabel}</span>
              )}
            </div>
          </div>
        </div>
      ) : (
        <button type="button" onClick={onToggleExpanded} className="w-full text-left p-4 hover:bg-slate-50 transition-colors">
          <p className="text-sm text-slate-500 line-clamp-2 leading-relaxed">
            {answer || <span className="italic text-slate-400">{emptyLabel}</span>}
          </p>
          <p className="mt-2 text-[11px] font-bold text-cyan-600">
            Bấm để xem đề bài{taskNumber === 1 && imageUrl ? ", ảnh minh họa" : ""} và toàn bộ bài làm →
          </p>
        </button>
      )}
    </div>
  );
}
