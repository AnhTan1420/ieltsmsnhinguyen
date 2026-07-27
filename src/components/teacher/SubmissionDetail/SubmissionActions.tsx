"use client";

import { Bot, Clock, FileDown, Loader2, Trash2 } from "lucide-react";
import type { SubmissionRow } from "@/lib/types";

type SubmissionActionsProps = {
  submission: SubmissionRow;
  isGrading: boolean;
  isDeleting: boolean;
  onGrade: (submission: SubmissionRow, forceTaskType?: "task1" | "task2" | "both") => void;
  onDownloadDoc: () => void;
  onDeleteSubmission: (submission: SubmissionRow) => void;
};

// Cụm nút hành động: chấm cả 2 Task (chính), chấm riêng Task 1/2, xuất file
// .doc, xóa bài — cộng thông báo "đang chờ nộp bài" khi status = in_progress.
export default function SubmissionActions({
  submission,
  isGrading,
  isDeleting,
  onGrade,
  onDownloadDoc,
  onDeleteSubmission,
}: SubmissionActionsProps) {
  const gradingDisabled = isGrading || submission.status === "in_progress" || !submission.content;

  return (
    <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-3 pt-6 border-t border-slate-200">
      {/* Nút chính: Chấm cả 2 Task - Ưu tiên hiển thị nổi bật nhất */}
      <button
        onClick={() => onGrade(submission, "both")}
        disabled={gradingDisabled}
        className="flex w-full sm:w-auto items-center justify-center gap-2 bg-slate-900 hover:bg-black text-white px-5 py-2.5 rounded-lg text-sm font-semibold shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        title="Chấm cả hai bài cùng lúc và tính trung bình cộng điểm Overall"
      >
        {isGrading ? (
          <Loader2 className="h-4 w-4 animate-spin shrink-0" />
        ) : (
          <Bot className="h-4 w-4 text-cyan-400 animate-pulse shrink-0" />
        )}
        <span>{submission.feedback ? "AI Chấm lại cả 2 Task" : "AI Chấm cả 2 Task"}</span>
      </button>

      {/* Cụm nút phụ: Chấm riêng lẻ - Giao diện sáng (Outline) để phân biệt hoàn toàn với nút chính */}
      <div className="flex w-full sm:w-auto items-center gap-3">
        <button
          onClick={() => onGrade(submission, "task1")}
          disabled={gradingDisabled}
          className="flex-1 sm:flex-none flex justify-center bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 px-4 py-2.5 rounded-lg text-sm font-medium shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
          title="Chấm đơn lẻ chỉ đề bài Task 1"
        >
          Chấm riêng Task 1
        </button>

        <button
          onClick={() => onGrade(submission, "task2")}
          disabled={gradingDisabled}
          className="flex-1 sm:flex-none flex justify-center bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 px-4 py-2.5 rounded-lg text-sm font-medium shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
          title="Chấm đơn lẻ chỉ đề bài Task 2"
        >
          Chấm riêng Task 2
        </button>
      </div>

      <button
        onClick={onDownloadDoc}
        disabled={!submission.content}
        className="flex items-center justify-center gap-2 rounded-xl bg-white border border-slate-200 px-5 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-50 hover:text-cyan-700 hover:border-cyan-200 disabled:opacity-50 w-full sm:w-auto"
      >
        <FileDown className="h-4 w-4" /> Xuất File DOC
      </button>

      <button
        onClick={() => onDeleteSubmission(submission)}
        disabled={isDeleting}
        className="flex items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700 transition hover:bg-red-100 disabled:opacity-50 w-full sm:w-auto sm:ml-auto"
      >
        <Trash2 className="h-4 w-4" /> Xóa bài
      </button>

      {submission.status === "in_progress" && (
        <div className="w-full mt-2 flex items-center gap-2 text-xs font-medium text-slate-500 bg-slate-100/50 p-3 rounded-xl border border-slate-200 border-dashed">
          <Clock className="h-4 w-4 shrink-0" /> Hệ thống đang chờ học sinh ấn nút nộp bài để có thể chấm điểm.
        </div>
      )}
    </div>
  );
}
