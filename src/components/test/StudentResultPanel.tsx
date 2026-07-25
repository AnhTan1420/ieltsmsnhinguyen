"use client";

import { Sparkles, MessageCircle } from "lucide-react";
import type { GradingFeedback } from "@/lib/types";
import {
  resolveTaskSummary,
  formatBandScore,
} from "@/components/teacher/GradingResultPanel";
import ExaminerSummaryCard from "@/components/teacher/ExaminerSummaryCard";

type StudentResultPanelProps = {
  feedback: GradingFeedback;
  teacherComment?: string | null;
};

// Khối điểm 1 Task (band + 4 tiêu chí) — bản rút gọn cho học sinh, không có số
// lỗi/nút bấm mở rộng như bên panel giáo viên (GradingResultPanel), vì học
// sinh chỉ cần xem kết quả, không cần thao tác.
function TaskScoreBlock({
  taskLabel,
  band,
  criteria,
  summary,
}: {
  taskLabel: string;
  band: number;
  criteria: { short: string; label: string; score: number }[];
  summary: string | null;
}) {
  const validBands = criteria.map((c) => c.score).filter((n): n is number => typeof n === "number");

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <span className="rounded-lg bg-slate-900 text-white text-xs font-black px-3 py-1.5 uppercase tracking-wider">
          {taskLabel}
        </span>
        <span className="rounded-full bg-cyan-100 text-cyan-800 text-xs font-bold px-3 py-1">Band {formatBandScore(band)}</span>
        <div className="h-px flex-1 bg-slate-200" />
      </div>

      <div className="rounded-2xl bg-white border border-slate-200/60 shadow-sm overflow-hidden">
        <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-y sm:divide-y-0 divide-slate-100">
          {criteria.map((c, i) => (
            <div key={i} className="p-4 text-center">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400" title={c.label}>
                {c.short}
              </p>
              <p className="mt-1 text-2xl font-black text-slate-900">{formatBandScore(c.score)}</p>
            </div>
          ))}
        </div>
      </div>

      {summary && <ExaminerSummaryCard summary={summary} validBands={validBands} />}
    </div>
  );
}

// Kết quả chấm bài hiển thị cho HỌC SINH sau khi cả AI lẫn giáo viên đã hoàn
// tất (xem điều kiện "ready" ở SubmittedScreen.tsx). Cố tình gọn hơn
// GradingResultPanel (bản dành cho giáo viên): không có phần "Lỗi sai & Đề
// xuất sửa" chi tiết theo từng câu, cấu trúc nâng cao, nâng cấp từ vựng...
// — những phần đó thiên về công cụ soạn giáo án hơn, học sinh chỉ cần thấy rõ
// điểm số + nhận xét theo từng tiêu chí.
export default function StudentResultPanel({ feedback, teacherComment }: StudentResultPanelProps) {
  const task1Summary = feedback.task1 ? resolveTaskSummary(feedback, "task1") : null;
  const task2Summary = feedback.task2 ? resolveTaskSummary(feedback, "task2") : null;

  return (
    <div className="w-full max-w-3xl rounded-3xl border border-cyan-200/60 bg-gradient-to-br from-cyan-50/80 to-white overflow-hidden shadow-sm text-left">
      <div className="p-6 border-b border-cyan-100 bg-white/50 backdrop-blur-sm flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="bg-cyan-100 p-2.5 rounded-2xl">
            <Sparkles className="h-6 w-6 text-cyan-600" />
          </div>
          <div>
            <h3 className="text-lg font-black text-slate-900 tracking-tight">Kết quả bài thi của bạn</h3>
            <p className="text-xs font-medium text-cyan-700">Chấm tự động theo tiêu chuẩn IELTS</p>
          </div>
        </div>
        <div className="bg-slate-900 text-white px-5 py-2 rounded-2xl flex items-center gap-2 shadow-md shrink-0">
          <span className="text-sm font-medium text-slate-300">Overall</span>
          <span className="text-2xl font-black text-cyan-400">{formatBandScore(feedback.overall_band)}</span>
        </div>
      </div>

      <div className="p-6 space-y-10">
        {feedback.task1 && (
          <TaskScoreBlock
            taskLabel="Task 1"
            band={feedback.task1.band}
            summary={task1Summary}
            criteria={[
              { short: "TA", label: "Task Achievement", score: feedback.task1.TA },
              { short: "CC", label: "Coherence & Cohesion", score: feedback.task1.CC },
              { short: "LR", label: "Lexical Resource", score: feedback.task1.LR },
              { short: "GRA", label: "Grammar", score: feedback.task1.GRA },
            ]}
          />
        )}

        {feedback.task1 && feedback.task2 && <div className="border-t border-slate-100" />}

        {feedback.task2 && (
          <TaskScoreBlock
            taskLabel="Task 2"
            band={feedback.task2.band}
            summary={task2Summary}
            criteria={[
              { short: "TR", label: "Task Response", score: feedback.task2.TR },
              { short: "CC", label: "Coherence & Cohesion", score: feedback.task2.CC },
              { short: "LR", label: "Lexical Resource", score: feedback.task2.LR },
              { short: "GRA", label: "Grammar", score: feedback.task2.GRA },
            ]}
          />
        )}

        {teacherComment && teacherComment.trim() && (
          <div className="rounded-2xl bg-emerald-50 border border-emerald-200 p-5">
            <div className="flex items-center gap-2 mb-2">
              <MessageCircle className="h-4 w-4 text-emerald-600" />
              <h4 className="font-black text-emerald-800 text-sm">Nhận xét từ giáo viên</h4>
            </div>
            <p className="text-sm text-emerald-900 leading-relaxed whitespace-pre-wrap">{teacherComment}</p>
          </div>
        )}
      </div>
    </div>
  );
}