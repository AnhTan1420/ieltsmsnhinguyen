"use client";

import { Clock, ShieldAlert, Timer } from "lucide-react";
import type { SubmissionRow } from "@/lib/types";
import { formatDateTime, formatDuration, statusLabels, statusStyles } from "@/lib/teacher/submission-utils";

type SubmissionHeaderProps = {
  submission: SubmissionRow;
};

// Phần đầu panel chi tiết: tên học sinh, tên đề thi, badge trạng thái, mốc thời
// gian nộp bài/thời lượng làm bài, và banner cảnh báo nếu có vi phạm gian lận.
export default function SubmissionHeader({ submission }: SubmissionHeaderProps) {
  return (
    <div className="p-5 sm:p-6 border-b border-slate-100 bg-white shrink-0">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">{submission.student_name}</h2>
          <p className="text-sm font-medium text-cyan-700 mt-1">{submission.tests?.title}</p>
        </div>
        <span
          className={`text-xs font-bold px-3 py-1.5 rounded-full border ${
            statusStyles[submission.status] || "bg-slate-50 border-slate-200 text-slate-600"
          }`}
        >
          {statusLabels[submission.status] || submission.status}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-4 mb-4 text-xs font-semibold text-slate-500">
        <span className="flex items-center gap-1.5">
          <Clock className="h-3.5 w-3.5 text-slate-400" />
          Nộp bài:{" "}
          <span className="text-slate-700">
            {submission.submitted_at ? formatDateTime(submission.submitted_at) : "Chưa nộp"}
          </span>
        </span>
        <span className="flex items-center gap-1.5">
          <Timer className="h-3.5 w-3.5 text-slate-400" />
          Thời gian làm bài:{" "}
          <span className="text-slate-700">
            {formatDuration(submission.started_at, submission.submitted_at)}
            {submission.status === "in_progress" && " (đang tính...)"}
          </span>
        </span>
      </div>

      {submission.warning_count > 0 && (
        <div className="flex items-center gap-3 rounded-2xl bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200/60 p-4 text-sm font-semibold text-amber-900">
          <div className="bg-amber-100 p-2 rounded-full text-amber-600 shrink-0">
            <ShieldAlert className="h-5 w-5" />
          </div>
          Học sinh đã vi phạm quy chế thoát trang {submission.warning_count}/5 lần!
        </div>
      )}
    </div>
  );
}
