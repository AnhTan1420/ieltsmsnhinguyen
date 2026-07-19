"use client";

import { AlertTriangle, BookOpen, Bot, Image as ImageIcon, Sparkles, Type } from "lucide-react";
import type { Correction, GradingFeedback } from "@/lib/types";
import { countWords } from "./submission-utils";
import ExaminerSummaryCard from "./ExaminerSummaryCard";

type GradingResultPanelProps = {
  feedback: GradingFeedback;
  task1Answer?: string;
  task2Answer?: string;
};

// Lấy đúng đoạn nhận xét của 1 task. Ưu tiên task1_summary/task2_summary (dữ
// liệu mới, route.ts đã điền sẵn không kèm header). Với submission cũ lưu
// trước khi có 2 field này, fallback: nếu examiner_summary có header
// "### Task N Evaluation:" thì tách theo header; nếu không có header (record
// cũ chỉ từng chấm 1 task) thì coi cả examiner_summary là của task đang hỏi.
function resolveTaskSummary(feedback: GradingFeedback, task: "task1" | "task2"): string {
  const direct = task === "task1" ? feedback.task1_summary : feedback.task2_summary;
  if (direct) return direct;

  const raw = feedback.examiner_summary || "";
  const headerRegex = /^###\s*Task\s*\d[^\n]*$/gim;
  const matches = [...raw.matchAll(headerRegex)];

  if (matches.length === 0) return raw;

  const match = matches.find((m) => (task === "task1" ? /1/.test(m[0]) : /2/.test(m[0])));
  if (!match) return "";

  const matchIdx = matches.indexOf(match);
  const start = match.index ?? 0;
  const end = matchIdx + 1 < matches.length ? matches[matchIdx + 1].index! : raw.length;
  return raw.slice(start, end).replace(headerRegex, "").trim();
}

// Lọc corrections theo task. Ưu tiên field "task" đã gắn sẵn (dữ liệu mới).
// Fallback cho record cũ chưa có field này: đoán bằng cách so khớp text gốc
// của lỗi vào đúng bài làm của task đó.
function resolveTaskCorrections(feedback: GradingFeedback, task: "task1" | "task2", answerText?: string): Correction[] {
  const all = feedback.corrections ?? [];
  const hasTags = all.some((c) => c.task);
  if (hasTags) return all.filter((c) => c.task === task);
  if (!answerText) return [];
  return all.filter((c) => answerText.includes(c.original));
}

// Hiển thị ĐÚNG giá trị band (band IELTS luôn là bội số 0.5, VD 7, 7.5, 8) —
// KHÔNG làm tròn về số nguyên, vì Math.round(7.5) = 8 sẽ khiến điểm hiển thị
// trông cao hơn thực tế, tạo cảm giác mâu thuẫn với overall band ở badge.
function formatBandScore(score: unknown): string {
  const n = Number(score);
  if (score === undefined || score === null || Number.isNaN(n)) return String(score ?? "");
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

export default function GradingResultPanel({ feedback, task1Answer, task2Answer }: GradingResultPanelProps) {
  const task1Summary = feedback.task1 ? resolveTaskSummary(feedback, "task1") : null;
  const task2Summary = feedback.task2 ? resolveTaskSummary(feedback, "task2") : null;
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
        {/* Task 1 */}
        {feedback.task1 && (
          <div className="space-y-6">
            <div className="flex items-center gap-2">
              <span className="rounded-lg bg-slate-900 text-white text-xs font-black px-3 py-1.5 uppercase tracking-wider flex items-center gap-1.5">
                <ImageIcon className="h-3.5 w-3.5" /> Task 1
              </span>
              <span className="rounded-full bg-cyan-100 text-cyan-800 text-xs font-bold px-3 py-1">
                Band {feedback.task1.band}
              </span>
              <div className="h-px flex-1 bg-slate-200" />
            </div>

            <div className="rounded-2xl bg-white border border-slate-200/60 shadow-sm p-4 flex items-center gap-4">
              <div className="flex items-center gap-2">
                <div className="bg-slate-100 p-1.5 rounded-lg shrink-0"><Type className="h-3.5 w-3.5 text-slate-500" /></div>
                <div>
                  <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Số từ</p>
                  <p className="text-base font-black text-slate-900">
                    {countWords(task1Answer)} <span className="text-[10px] font-medium text-slate-400">từ</span>
                  </p>
                </div>
              </div>
              {task1Corrections.length > 0 && (
                <div className="flex items-center gap-2">
                  <div className="bg-amber-100 p-1.5 rounded-lg shrink-0"><AlertTriangle className="h-3.5 w-3.5 text-amber-600" /></div>
                  <div>
                    <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Số lỗi</p>
                    <p className="text-base font-black text-slate-900">
                      {task1Corrections.length} <span className="text-[10px] font-medium text-slate-400">lỗi</span>
                    </p>
                  </div>
                </div>
              )}
            </div>

            {task1Summary && (
              <ExaminerSummaryCard
                summary={task1Summary}
                validBands={[feedback.task1.TA, feedback.task1.CC, feedback.task1.LR, feedback.task1.GRA].filter(
                  (n): n is number => typeof n === "number",
                )}
              />
            )}

            <div className="rounded-2xl bg-white border border-slate-200/60 shadow-sm overflow-hidden">
              <div className="bg-slate-50 px-5 py-3 border-b border-slate-100">
                <span className="font-bold text-slate-800">Điểm chi tiết</span>
              </div>
              <div className="p-5">
                <dl className="space-y-3 text-sm">
                  {[
                    { label: "Task Achievement", score: feedback.task1.TA },
                    { label: "Coherence & Cohesion", score: feedback.task1.CC },
                    { label: "Lexical Resource", score: feedback.task1.LR },
                    { label: "Grammar", score: feedback.task1.GRA },
                  ].map((item, i) => (
                    <div key={i} className="flex justify-between items-center pb-2 border-b border-slate-50 last:border-0 last:pb-0">
                      <dt className="text-slate-500 font-medium">{item.label}</dt>
                      <dd className="font-bold text-slate-900 bg-slate-50 px-2 py-0.5 rounded text-xs">
                        {formatBandScore(item.score)}
                      </dd>
                    </div>
                  ))}
                </dl>
              </div>
            </div>

            {task1Corrections.length > 0 && (
              <div>
                <h4 className="font-black text-slate-900 mb-4 text-lg">Lỗi sai & Đề xuất sửa</h4>
                <div className="space-y-4">
                  {task1Corrections.map((correction, index) => (
                    <div key={index} className="rounded-2xl bg-white border border-slate-200/80 p-5 shadow-sm space-y-3">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div className="rounded-xl bg-red-50/50 border border-red-100 p-3">
                          <span className="block text-[10px] font-bold text-red-400 uppercase tracking-wider mb-1">Bản gốc</span>
                          <p className="text-[14px] text-red-700 line-through decoration-red-300/50 whitespace-pre-wrap">{correction.original}</p>
                        </div>
                        <div className="rounded-xl bg-emerald-50/50 border border-emerald-100 p-3">
                          <span className="block text-[10px] font-bold text-emerald-500 uppercase tracking-wider mb-1">Đề xuất sửa</span>
                          <p className="text-[14px] text-emerald-800 font-medium whitespace-pre-wrap">{correction.corrected}</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-2.5 rounded-xl bg-slate-50 p-3">
                        <Bot className="h-5 w-5 shrink-0 text-cyan-600 mt-0.5" />
                        <p className="text-sm text-slate-600 leading-relaxed font-medium">{correction.explanation}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {feedback.task1 && feedback.task2 && <div className="border-t border-slate-100" />}

        {/* Task 2 */}
        {feedback.task2 && (
          <div className="space-y-6">
            <div className="flex items-center gap-2">
              <span className="rounded-lg bg-slate-900 text-white text-xs font-black px-3 py-1.5 uppercase tracking-wider flex items-center gap-1.5">
                <BookOpen className="h-3.5 w-3.5" /> Task 2
              </span>
              <span className="rounded-full bg-cyan-100 text-cyan-800 text-xs font-bold px-3 py-1">
                Band {feedback.task2.band}
              </span>
              <div className="h-px flex-1 bg-slate-200" />
            </div>

            <div className="rounded-2xl bg-white border border-slate-200/60 shadow-sm p-4 flex items-center gap-4">
              <div className="flex items-center gap-2">
                <div className="bg-slate-100 p-1.5 rounded-lg shrink-0"><Type className="h-3.5 w-3.5 text-slate-500" /></div>
                <div>
                  <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Số từ</p>
                  <p className="text-base font-black text-slate-900">
                    {countWords(task2Answer)} <span className="text-[10px] font-medium text-slate-400">từ</span>
                  </p>
                </div>
              </div>
              {task2Corrections.length > 0 && (
                <div className="flex items-center gap-2">
                  <div className="bg-amber-100 p-1.5 rounded-lg shrink-0"><AlertTriangle className="h-3.5 w-3.5 text-amber-600" /></div>
                  <div>
                    <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Số lỗi</p>
                    <p className="text-base font-black text-slate-900">
                      {task2Corrections.length} <span className="text-[10px] font-medium text-slate-400">lỗi</span>
                    </p>
                  </div>
                </div>
              )}
            </div>

            {task2Summary && (
              <ExaminerSummaryCard
                summary={task2Summary}
                validBands={[feedback.task2.TR, feedback.task2.CC, feedback.task2.LR, feedback.task2.GRA].filter(
                  (n): n is number => typeof n === "number",
                )}
              />
            )}

            <div className="rounded-2xl bg-white border border-slate-200/60 shadow-sm overflow-hidden">
              <div className="bg-slate-50 px-5 py-3 border-b border-slate-100">
                <span className="font-bold text-slate-800">Điểm chi tiết</span>
              </div>
              <div className="p-5">
                <dl className="space-y-3 text-sm">
                  {[
                    { label: "Task Response", score: feedback.task2.TR },
                    { label: "Coherence & Cohesion", score: feedback.task2.CC },
                    { label: "Lexical Resource", score: feedback.task2.LR },
                    { label: "Grammar", score: feedback.task2.GRA },
                  ].map((item, i) => (
                    <div key={i} className="flex justify-between items-center pb-2 border-b border-slate-50 last:border-0 last:pb-0">
                      <dt className="text-slate-500 font-medium">{item.label}</dt>
                      <dd className="font-bold text-slate-900 bg-slate-50 px-2 py-0.5 rounded text-xs">
                        {formatBandScore(item.score)}
                      </dd>
                    </div>
                  ))}
                </dl>
              </div>
            </div>

            {task2Corrections.length > 0 && (
              <div>
                <h4 className="font-black text-slate-900 mb-4 text-lg">Lỗi sai & Đề xuất sửa</h4>
                <div className="space-y-4">
                  {task2Corrections.map((correction, index) => (
                    <div key={index} className="rounded-2xl bg-white border border-slate-200/80 p-5 shadow-sm space-y-3">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div className="rounded-xl bg-red-50/50 border border-red-100 p-3">
                          <span className="block text-[10px] font-bold text-red-400 uppercase tracking-wider mb-1">Bản gốc</span>
                          <p className="text-[14px] text-red-700 line-through decoration-red-300/50 whitespace-pre-wrap">{correction.original}</p>
                        </div>
                        <div className="rounded-xl bg-emerald-50/50 border border-emerald-100 p-3">
                          <span className="block text-[10px] font-bold text-emerald-500 uppercase tracking-wider mb-1">Đề xuất sửa</span>
                          <p className="text-[14px] text-emerald-800 font-medium whitespace-pre-wrap">{correction.corrected}</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-2.5 rounded-xl bg-slate-50 p-3">
                        <Bot className="h-5 w-5 shrink-0 text-cyan-600 mt-0.5" />
                        <p className="text-sm text-slate-600 leading-relaxed font-medium">{correction.explanation}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}