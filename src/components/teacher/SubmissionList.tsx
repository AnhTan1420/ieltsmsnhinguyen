"use client";

import { Archive, CheckSquare, Clock, Loader2, ShieldAlert, Sparkles, Square, Trash2 } from "lucide-react";
import type { SubmissionRow } from "@/lib/types";
import { statusLabels, statusStyles } from "./submission-utils";

type SubmissionListProps = {
  submissions: SubmissionRow[];
  selectedId: string | null;
  onSelect: (id: string) => void;

  selectionMode: boolean;
  selectedIds: Set<string>;
  toggleSelectionMode: () => void;
  toggleSelectId: (id: string) => void;
  toggleSelectAll: () => void;

  isBulkDeleting: boolean;
  onBulkDelete: () => void;
  isDownloadingAll: boolean;
  onDownloadAll: () => void;
};

// Sidebar danh sách bài nộp — hỗ trợ chọn nhiều / xóa hàng loạt / tải tất cả (zip).
export default function SubmissionList({
  submissions,
  selectedId,
  onSelect,
  selectionMode,
  selectedIds,
  toggleSelectionMode,
  toggleSelectId,
  toggleSelectAll,
  isBulkDeleting,
  onBulkDelete,
  isDownloadingAll,
  onDownloadAll,
}: SubmissionListProps) {
  return (
    <div className="rounded-3xl bg-white p-5 shadow-sm border border-slate-200/60 lg:sticky lg:top-24 lg:max-h-[calc(100vh-7rem)] flex flex-col">
      <div className="flex items-center justify-between pb-3 border-b border-slate-100">
        <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
          Bài làm <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full text-xs">{submissions.length}</span>
        </h2>
        <button
          onClick={toggleSelectionMode}
          className={`flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg border transition-colors ${selectionMode
            ? "bg-slate-900 text-white border-slate-900"
            : "bg-white text-slate-500 border-slate-200 hover:border-slate-300 hover:text-slate-700"
            }`}
          title="Bật/tắt chế độ chọn nhiều bài"
        >
          {selectionMode ? <CheckSquare className="h-3.5 w-3.5" /> : <Square className="h-3.5 w-3.5" />}
          Chọn nhiều
        </button>
      </div>

      {/* Thanh công cụ: chọn tất cả + xóa hàng loạt + tải tất cả */}
      <div className="flex items-center gap-2 py-3 border-b border-slate-100 mb-1">
        {selectionMode && (
          <button onClick={toggleSelectAll} className="text-xs font-semibold text-cyan-700 hover:text-cyan-800 px-2 py-1">
            {selectedIds.size === submissions.length && submissions.length > 0 ? "Bỏ chọn tất cả" : "Chọn tất cả"}
          </button>
        )}

        <div className="ml-auto flex items-center gap-2">
          {selectionMode && selectedIds.size > 0 && (
            <button
              onClick={onBulkDelete}
              disabled={isBulkDeleting}
              className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg border border-red-200 bg-red-50 text-red-700 hover:bg-red-100 transition-colors disabled:opacity-50"
            >
              {isBulkDeleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
              Xóa đã chọn ({selectedIds.size})
            </button>
          )}

          <button
            onClick={onDownloadAll}
            disabled={isDownloadingAll || submissions.length === 0}
            className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg border border-cyan-200 bg-cyan-50 text-cyan-700 hover:bg-cyan-100 transition-colors disabled:opacity-50"
            title={
              selectionMode && selectedIds.size > 0
                ? `Tải ${selectedIds.size} bài đã chọn dưới dạng .zip`
                : "Tải toàn bộ bài làm dưới dạng .zip"
            }
          >
            {isDownloadingAll ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Archive className="h-3.5 w-3.5" />}
            Tải {selectionMode && selectedIds.size > 0 ? `(${selectedIds.size})` : "tất cả"}
          </button>
        </div>
      </div>

      <div className="space-y-3 lg:overflow-y-auto pr-1 lg:pr-2 pb-2 lg:custom-scrollbar mt-3">
        {submissions.length === 0 && (
          <div className="text-center py-12 px-4 border-2 border-dashed border-slate-100 rounded-2xl">
            <Clock className="mx-auto h-8 w-8 text-slate-300 mb-2" />
            <p className="text-sm text-slate-500 font-medium">Chưa có học sinh nào nộp bài</p>
          </div>
        )}

        {submissions.map((submission) => (
          <div key={submission.id} className="relative">
            {selectionMode && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  toggleSelectId(submission.id);
                }}
                className="absolute top-3.5 right-3.5 z-10 p-2 rounded-lg bg-white shadow-sm border border-slate-200 active:scale-95 transition-transform"
                title="Chọn bài này"
              >
                {selectedIds.has(submission.id) ? (
                  <CheckSquare className="h-4 w-4 text-cyan-600" />
                ) : (
                  <Square className="h-4 w-4 text-slate-400" />
                )}
              </button>
            )}

            <button
              onClick={() => (selectionMode ? toggleSelectId(submission.id) : onSelect(submission.id))}
              className={`w-full text-left p-4 rounded-2xl border transition-all duration-200 group ${selectedId === submission.id && !selectionMode
                ? "border-cyan-400 bg-cyan-50/50 ring-4 ring-cyan-50"
                : selectionMode && selectedIds.has(submission.id)
                  ? "border-cyan-300 bg-cyan-50/30"
                  : "border-slate-100 bg-white hover:border-slate-300 hover:bg-slate-50 hover:-translate-y-0.5 hover:shadow-sm"
                }`}
            >
              <div className="flex justify-between items-start gap-2 mb-1.5 pr-6">
                <span className="font-bold text-slate-900 group-hover:text-cyan-700 transition-colors">{submission.student_name}</span>
                {submission.status === "in_progress" && (
                  <span className="flex items-center gap-1.5 text-[10px] font-bold text-blue-600 bg-blue-100 px-2 py-0.5 rounded-full">
                    <span className="h-1.5 w-1.5 rounded-full bg-blue-500 animate-pulse" /> LIVE
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 line-clamp-1 font-medium mb-3">{submission.tests?.title ?? "Đề đã bị xóa"}</p>
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full border ${statusStyles[submission.status] || "bg-slate-50 text-slate-600 border-slate-200"}`}>
                  {statusLabels[submission.status] || submission.status}
                </span>
                {submission.warning_count > 0 && (
                  <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200 flex items-center gap-1">
                    <ShieldAlert className="h-3 w-3" /> {submission.warning_count}/5
                  </span>
                )}
                {submission.band_score != null && (
                  <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-slate-900 text-white border border-slate-900 shadow-sm flex items-center gap-1">
                    <Sparkles className="h-3 w-3 text-cyan-400" /> Band {submission.band_score}
                  </span>
                )}
              </div>
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
