"use client";

import { Sparkles } from "lucide-react";
import type { GradingFeedback } from "@/lib/types";
import {
  resolveTaskAdvancedStructures,
  resolveTaskBandProgression,
  resolveTaskCorrections,
  resolveTaskEditedEssay,
  resolveTaskEssayUpgrades,
  resolveTaskGoldenRule,
  resolveTaskSummary,
  resolveTaskVocabulary,
} from "@/lib/grading/feedback-resolvers";
import TaskResultSection from "./TaskResultSection";

// Re-export để những chỗ import cũ (nếu còn) và mã ngoài components/ tiếp tục
// hoạt động không cần sửa — nguồn thật của các resolver nay là
// lib/grading/feedback-resolvers.ts (logic thuần, không JSX).
export {
  resolveTaskSummary,
  resolveTaskCorrections,
  resolveTaskGoldenRule,
  resolveTaskBandProgression,
  resolveTaskEditedEssay,
  resolveTaskEssayUpgrades,
  resolveTaskVocabulary,
  resolveTaskAdvancedStructures,
  formatBandScore,
} from "@/lib/grading/feedback-resolvers";

type GradingResultPanelProps = {
  feedback: GradingFeedback;
  task1Answer?: string;
  task2Answer?: string;
};

// Panel "Đánh giá từ AI Examiner" — header Overall band + kết quả Task 1 và
// Task 2 (TaskResultSection, dùng chung cho cả 2 task). File này chỉ lo lấy
// dữ liệu đúng task qua các resolver rồi truyền xuống, không còn tự vẽ JSX
// lặp lại cho từng task nữa.
export default function GradingResultPanel({ feedback, task1Answer, task2Answer }: GradingResultPanelProps) {
  const task1Corrections = feedback.task1 ? resolveTaskCorrections(feedback, "task1", task1Answer) : [];
  const task2Corrections = feedback.task2 ? resolveTaskCorrections(feedback, "task2", task2Answer) : [];

  return (
    <div className="mt-8 rounded-3xl border border-cyan-200/60 bg-gradient-to-br from-cyan-50/80 to-white overflow-hidden shadow-sm">
      <div className="p-6 border-b border-cyan-100 bg-white/50 backdrop-blur-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="bg-cyan-100 p-2.5 rounded-2xl">
            <Sparkles className="h-6 w-6 text-cyan-600" />
          </div>
          <div>
            <h3 className="text-lg font-black text-slate-900 tracking-tight">Đánh giá từ AI Examiner</h3>
            <p className="text-xs font-medium text-cyan-700">Tự động phân tích theo tiêu chuẩn IELTS</p>
          </div>
        </div>
        <div className="bg-slate-900 text-white px-5 py-2 rounded-2xl flex items-center gap-2 shadow-md">
          <span className="text-sm font-medium text-slate-300">Overall</span>
          <span className="text-2xl font-black text-cyan-400">{feedback.overall_band}</span>
        </div>
      </div>

      <div className="p-6 space-y-10">
        {feedback.task1 && (
          <TaskResultSection
            taskNumber={1}
            band={feedback.task1.band}
            criteria={[
              { label: "Task Achievement", short: "TA", score: feedback.task1.TA },
              { label: "Coherence & Cohesion", short: "CC", score: feedback.task1.CC },
              { label: "Lexical Resource", short: "LR", score: feedback.task1.LR },
              { label: "Grammar", short: "GRA", score: feedback.task1.GRA },
            ]}
            answer={task1Answer}
            corrections={task1Corrections}
            summary={resolveTaskSummary(feedback, "task1")}
            goldenRule={resolveTaskGoldenRule(feedback, "task1")}
            bandProgression={resolveTaskBandProgression(feedback, "task1")}
            vocabulary={resolveTaskVocabulary(feedback, "task1")}
            advancedStructures={resolveTaskAdvancedStructures(feedback, "task1")}
            essayUpgrades={resolveTaskEssayUpgrades(feedback, "task1")}
            legacyEditedEssay={resolveTaskEditedEssay(feedback, "task1")}
          />
        )}

        {feedback.task1 && feedback.task2 && <div className="border-t border-slate-100" />}

        {feedback.task2 && (
          <TaskResultSection
            taskNumber={2}
            band={feedback.task2.band}
            criteria={[
              { label: "Task Response", short: "TR", score: feedback.task2.TR },
              { label: "Coherence & Cohesion", short: "CC", score: feedback.task2.CC },
              { label: "Lexical Resource", short: "LR", score: feedback.task2.LR },
              { label: "Grammar", short: "GRA", score: feedback.task2.GRA },
            ]}
            answer={task2Answer}
            corrections={task2Corrections}
            summary={resolveTaskSummary(feedback, "task2")}
            goldenRule={resolveTaskGoldenRule(feedback, "task2")}
            bandProgression={resolveTaskBandProgression(feedback, "task2")}
            vocabulary={resolveTaskVocabulary(feedback, "task2")}
            advancedStructures={resolveTaskAdvancedStructures(feedback, "task2")}
            essayUpgrades={resolveTaskEssayUpgrades(feedback, "task2")}
            legacyEditedEssay={resolveTaskEditedEssay(feedback, "task2")}
          />
        )}
      </div>
    </div>
  );
}
