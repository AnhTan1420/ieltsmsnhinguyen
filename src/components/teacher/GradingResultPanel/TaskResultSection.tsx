"use client";

import { AlertTriangle, BookOpen, Image as ImageIcon, Type } from "lucide-react";
import type { AdvancedStructure, BandProgression, Correction, EssayUpgrade, VocabularySuggestion } from "@/lib/types";
import { formatBandScore } from "@/lib/grading/feedback-resolvers";
import { countWords } from "@/lib/teacher/submission-utils";
import ExaminerSummaryCard from "../ExaminerSummaryCard";
import CorrectionsSection from "./CorrectionsSection";
import TaskExtras from "./TaskExtras";

type CriterionScore = { label: string; short: string; score?: number };

type TaskResultSectionProps = {
  taskNumber: 1 | 2;
  band: number;
  criteria: CriterionScore[];
  answer?: string;
  corrections: Correction[];
  summary: string | null;
  goldenRule?: string;
  bandProgression?: BandProgression;
  vocabulary: VocabularySuggestion[];
  advancedStructures: AdvancedStructure[];
  essayUpgrades: EssayUpgrade[];
  legacyEditedEssay?: string;
};

// Toàn bộ khối kết quả của MỘT task: badge Task N + Band, thống kê số từ/số
// lỗi, bảng 4 tiêu chí, nhận xét giám khảo (ExaminerSummaryCard), danh sách
// lỗi sai (CorrectionsSection), và các phần mở rộng (TaskExtras). Task 1 và
// Task 2 dùng chung component này — trước đây 2 khối gần như giống hệt nhau
// bị lặp lại nguyên văn trong GradingResultPanel.tsx.
export default function TaskResultSection({
  taskNumber,
  band,
  criteria,
  answer,
  corrections,
  summary,
  goldenRule,
  bandProgression,
  vocabulary,
  advancedStructures,
  essayUpgrades,
  legacyEditedEssay,
}: TaskResultSectionProps) {
  const Icon = taskNumber === 1 ? ImageIcon : BookOpen;
  const validBands = criteria.map((c) => c.score).filter((n): n is number => typeof n === "number");

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <span className="rounded-lg bg-slate-900 text-white text-xs font-black px-3 py-1.5 uppercase tracking-wider flex items-center gap-1.5">
          <Icon className="h-3.5 w-3.5" /> Task {taskNumber}
        </span>
        <span className="rounded-full bg-cyan-100 text-cyan-800 text-xs font-bold px-3 py-1">Band {band}</span>
        <div className="h-px flex-1 bg-slate-200" />
      </div>

      <div className="rounded-2xl bg-white border border-slate-200/60 shadow-sm p-4 flex items-center gap-4">
        <div className="flex items-center gap-2">
          <div className="bg-slate-100 p-1.5 rounded-lg shrink-0"><Type className="h-3.5 w-3.5 text-slate-500" /></div>
          <div>
            <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Số từ</p>
            <p className="text-base font-black text-slate-900">
              {countWords(answer)} <span className="text-[10px] font-medium text-slate-400">từ</span>
            </p>
          </div>
        </div>
        {corrections.length > 0 && (
          <div className="flex items-center gap-2">
            <div className="bg-amber-100 p-1.5 rounded-lg shrink-0"><AlertTriangle className="h-3.5 w-3.5 text-amber-600" /></div>
            <div>
              <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Số lỗi</p>
              <p className="text-base font-black text-slate-900">
                {corrections.length} <span className="text-[10px] font-medium text-slate-400">lỗi</span>
              </p>
            </div>
          </div>
        )}
      </div>

      <div className="rounded-2xl bg-white border border-slate-200/60 shadow-sm overflow-hidden">
        <div className="bg-slate-50 px-5 py-3 border-b border-slate-100">
          <span className="font-bold text-slate-800">Điểm chi tiết</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-y sm:divide-y-0 divide-slate-100">
          {criteria.map((item, i) => (
            <div key={i} className="p-4 text-center">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400" title={item.label}>
                {item.short}
              </p>
              <p className="mt-1 text-2xl font-black text-slate-900">{formatBandScore(item.score)}</p>
            </div>
          ))}
        </div>
      </div>

      {summary && <ExaminerSummaryCard summary={summary} validBands={validBands} />}

      <CorrectionsSection corrections={corrections} />

      <TaskExtras
        goldenRule={goldenRule}
        bandProgression={bandProgression}
        vocabulary={vocabulary}
        advancedStructures={advancedStructures}
        essayUpgrades={essayUpgrades}
        legacyEditedEssay={legacyEditedEssay}
      />
    </div>
  );
}
