"use client";

import { useState } from "react";
import { AlertTriangle, BookOpen, Bot, ChevronDown, Compass, Image as ImageIcon, Languages, Lightbulb, Sparkles, Type, Wand2 } from "lucide-react";
import type { AdvancedStructure, BandProgression, Correction, EssayUpgrade, GradingFeedback, VocabularySuggestion } from "@/lib/types";
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
export function resolveTaskSummary(feedback: GradingFeedback, task: "task1" | "task2"): string {
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
export function resolveTaskCorrections(feedback: GradingFeedback, task: "task1" | "task2", answerText?: string): Correction[] {
  const all = feedback.corrections ?? [];
  const hasTags = all.some((c) => c.task);
  if (hasTags) return all.filter((c) => c.task === task);
  if (!answerText) return [];
  return all.filter((c) => answerText.includes(c.original));
}

// Task nào đang là "task đơn lẻ" của feedback này — dùng để fallback các field
// cũ (chưa tách theo task, lưu trước khi route.ts được vá) về đúng task đang
// hiển thị. Khi feedback có CẢ task1 lẫn task2 (chấm "both"), field cũ không
// đáng tin (chỉ còn của lần gọi cuối), nên KHÔNG fallback trong trường hợp đó.
function soloTaskOf(feedback: GradingFeedback): "task1" | "task2" | null {
  if (feedback.task1 && !feedback.task2) return "task1";
  if (feedback.task2 && !feedback.task1) return "task2";
  return null;
}

export function resolveTaskGoldenRule(feedback: GradingFeedback, task: "task1" | "task2"): string | undefined {
  const direct = task === "task1" ? feedback.task1_golden_rule : feedback.task2_golden_rule;
  if (direct) return direct;
  return feedback.golden_rule && soloTaskOf(feedback) === task ? feedback.golden_rule : undefined;
}

export function resolveTaskBandProgression(feedback: GradingFeedback, task: "task1" | "task2"): BandProgression | undefined {
  const direct = task === "task1" ? feedback.task1_band_progression : feedback.task2_band_progression;
  if (direct) return direct;
  return feedback.band_progression && soloTaskOf(feedback) === task ? feedback.band_progression : undefined;
}

export function resolveTaskEditedEssay(feedback: GradingFeedback, task: "task1" | "task2"): string | undefined {
  const direct = task === "task1" ? feedback.task1_edited_essay_markdown : feedback.task2_edited_essay_markdown;
  if (direct) return direct;
  return feedback.edited_essay_markdown && soloTaskOf(feedback) === task ? feedback.edited_essay_markdown : undefined;
}

export function resolveTaskEssayUpgrades(feedback: GradingFeedback, task: "task1" | "task2"): EssayUpgrade[] {
  const all = feedback.essay_upgrades ?? [];
  const hasTags = all.some((u) => u.task);
  if (hasTags) return all.filter((u) => u.task === task);
  return soloTaskOf(feedback) === task ? all : [];
}

export function resolveTaskVocabulary(feedback: GradingFeedback, task: "task1" | "task2"): VocabularySuggestion[] {
  const all = feedback.vocabulary_suggestions ?? [];
  const hasTags = all.some((v) => v.task);
  if (hasTags) return all.filter((v) => v.task === task);
  return soloTaskOf(feedback) === task ? all : [];
}

export function resolveTaskAdvancedStructures(feedback: GradingFeedback, task: "task1" | "task2"): AdvancedStructure[] {
  const all = feedback.advanced_structures ?? [];
  const hasTags = all.some((s) => s.task);
  if (hasTags) return all.filter((s) => s.task === task);
  return soloTaskOf(feedback) === task ? all : [];
}

// Hiển thị ĐÚNG giá trị band (band IELTS luôn là bội số 0.5, VD 7, 7.5, 8) —
// KHÔNG làm tròn về số nguyên, vì Math.round(7.5) = 8 sẽ khiến điểm hiển thị
// trông cao hơn thực tế, tạo cảm giác mâu thuẫn với overall band ở badge.
export function formatBandScore(score: unknown): string {
  const n = Number(score);
  if (score === undefined || score === null || Number.isNaN(n)) return String(score ?? "");
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

type TaskExtrasProps = {
  goldenRule?: string;
  bandProgression?: BandProgression;
  vocabulary: VocabularySuggestion[];
  advancedStructures: AdvancedStructure[];
  essayUpgrades: EssayUpgrade[];
  // Dữ liệu cũ (đoạn văn tự do, không định vị/highlight được trong bài gốc) —
  // chỉ dùng làm fallback hiển thị cho submission chấm TRƯỚC khi có "essayUpgrades".
  legacyEditedEssay?: string;
};

// Gom 5 mảnh phản hồi vốn đang bị AI sinh ra rồi bỏ xó (golden rule, lộ trình
// lên band, bảng nâng cấp từ vựng, cấu trúc nâng cao, câu được viết lại hay
// hơn) — hiển thị riêng cho 1 task. Không render section nào nếu dữ liệu
// rỗng, để không vỡ layout với các submission cũ chưa có mấy field này.
function TaskExtras({ goldenRule, bandProgression, vocabulary, advancedStructures, essayUpgrades, legacyEditedEssay }: TaskExtrasProps) {
  const [showLegacyEssay, setShowLegacyEssay] = useState(false);

  const hasAnything =
    goldenRule || bandProgression || vocabulary.length > 0 || advancedStructures.length > 0 || essayUpgrades.length > 0 || legacyEditedEssay;
  if (!hasAnything) return null;

  return (
    <div className="space-y-5">
      {goldenRule && (
        <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50/60 p-4">
          <div className="shrink-0 bg-amber-100 p-1.5 rounded-lg"><Lightbulb className="h-4 w-4 text-amber-600" /></div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-amber-600 mb-0.5">Nguyên tắc vàng</p>
            <p className="text-sm text-slate-700 font-medium leading-relaxed">{goldenRule}</p>
          </div>
        </div>
      )}

      {bandProgression && (
        <div className="rounded-2xl bg-white border border-slate-200/60 shadow-sm overflow-hidden">
          <div className="bg-slate-50 px-5 py-3 border-b border-slate-100 flex items-center gap-2">
            <Compass className="h-4 w-4 text-cyan-600" />
            <span className="font-bold text-slate-800">Lộ trình lên band</span>
          </div>
          <div className="p-5 space-y-3 text-sm">
            <p><span className="font-bold text-slate-700">Vì sao đang ở band này: </span><span className="text-slate-600">{bandProgression.why_current}</span></p>
            <p><span className="font-bold text-slate-700">Vì sao chưa thấp hơn: </span><span className="text-slate-600">{bandProgression.why_not_lower}</span></p>
            <p><span className="font-bold text-slate-700">Vì sao chưa cao hơn: </span><span className="text-slate-600">{bandProgression.why_not_higher}</span></p>
            {bandProgression.roadmap_steps?.length > 0 && (
              <div className="pt-2">
                <p className="font-bold text-slate-700 mb-1.5">Việc cần làm tiếp theo:</p>
                <ul className="space-y-1.5">
                  {bandProgression.roadmap_steps.map((step, i) => (
                    <li key={i} className="flex gap-2 text-slate-600">
                      <span className="text-cyan-500 font-bold">{i + 1}.</span> {step}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}

      {vocabulary.length > 0 && (
        <div className="rounded-2xl bg-white border border-slate-200/60 shadow-sm overflow-hidden">
          <div className="bg-slate-50 px-5 py-3 border-b border-slate-100 flex items-center gap-2">
            <Languages className="h-4 w-4 text-cyan-600" />
            <span className="font-bold text-slate-800">Nâng cấp từ vựng</span>
          </div>
          <div className="divide-y divide-slate-100">
            {vocabulary.map((v, i) => (
              <div key={i} className="p-4 grid grid-cols-1 sm:grid-cols-[1fr_1fr_1.4fr] gap-2 sm:gap-4 items-start">
                <span className="text-sm text-red-600 line-through decoration-red-300/60">{v.original_word}</span>
                <span className="text-sm font-bold text-emerald-700">{v.better_alternative}</span>
                <span className="text-sm text-slate-500">{v.reason}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {advancedStructures.length > 0 && (
        <div className="rounded-2xl bg-white border border-slate-200/60 shadow-sm overflow-hidden">
          <div className="bg-slate-50 px-5 py-3 border-b border-slate-100 flex items-center gap-2">
            <Wand2 className="h-4 w-4 text-cyan-600" />
            <span className="font-bold text-slate-800">Cấu trúc nâng cao gợi ý</span>
          </div>
          <div className="divide-y divide-slate-100">
            {advancedStructures.map((s, i) => (
              <div key={i} className="p-4 space-y-1">
                <p className="text-xs font-bold uppercase tracking-wide text-cyan-700">{s.structure_name}</p>
                {s.original_sentence && (
                  <p className="text-sm text-slate-400 line-through decoration-slate-300">{s.original_sentence}</p>
                )}
                <p className="text-sm text-slate-800 italic">
                  <mark className="bg-emerald-200/70 text-slate-900 rounded-sm px-0.5">{s.example_sentence_en}</mark>
                </p>
                <p className="text-sm text-slate-500">{s.explanation_vi}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {essayUpgrades.length > 0 && (
        <div className="rounded-2xl bg-white border border-slate-200/60 shadow-sm overflow-hidden">
          <div className="bg-slate-50 px-5 py-3 border-b border-slate-100 flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-cyan-600" />
            <span className="font-bold text-slate-800">Câu được viết lại hay hơn</span>
          </div>
          <div className="divide-y divide-slate-100">
            {essayUpgrades.map((u, i) => (
              <div key={i} className="p-4 space-y-1.5">
                <p className="text-sm text-slate-500 line-through decoration-slate-300">{u.original}</p>
                <p className="text-sm text-slate-800">
                  <mark className="bg-sky-200/70 text-slate-900 rounded-sm px-0.5">{u.upgraded}</mark>
                </p>
                <p className="text-sm text-slate-500">{u.note}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {essayUpgrades.length === 0 && legacyEditedEssay && (
        <div className="rounded-2xl bg-white border border-slate-200/60 shadow-sm overflow-hidden">
          <button
            onClick={() => setShowLegacyEssay((v) => !v)}
            className="w-full bg-slate-50 px-5 py-3 border-b border-slate-100 flex items-center justify-between gap-2 text-left"
          >
            <span className="font-bold text-slate-800">Bài viết mẫu đã chỉnh sửa</span>
            <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform ${showLegacyEssay ? "rotate-180" : ""}`} />
          </button>
          {showLegacyEssay && (
            <div className="p-5">
              <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap bg-sky-100/70 rounded-lg px-3 py-2.5 box-decoration-clone">
                {legacyEditedEssay}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
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
              <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-y sm:divide-y-0 divide-slate-100">
                {[
                  { label: "Task Achievement", short: "TA", score: feedback.task1.TA },
                  { label: "Coherence & Cohesion", short: "CC", score: feedback.task1.CC },
                  { label: "Lexical Resource", short: "LR", score: feedback.task1.LR },
                  { label: "Grammar", short: "GRA", score: feedback.task1.GRA },
                ].map((item, i) => (
                  <div key={i} className="p-4 text-center">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400" title={item.label}>
                      {item.short}
                    </p>
                    <p className="mt-1 text-2xl font-black text-slate-900">{formatBandScore(item.score)}</p>
                  </div>
                ))}
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

            <TaskExtras
              goldenRule={resolveTaskGoldenRule(feedback, "task1")}
              bandProgression={resolveTaskBandProgression(feedback, "task1")}
              vocabulary={resolveTaskVocabulary(feedback, "task1")}
              advancedStructures={resolveTaskAdvancedStructures(feedback, "task1")}
              essayUpgrades={resolveTaskEssayUpgrades(feedback, "task1")}
              legacyEditedEssay={resolveTaskEditedEssay(feedback, "task1")}
            />
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
              <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-y sm:divide-y-0 divide-slate-100">
                {[
                  { label: "Task Response", short: "TR", score: feedback.task2.TR },
                  { label: "Coherence & Cohesion", short: "CC", score: feedback.task2.CC },
                  { label: "Lexical Resource", short: "LR", score: feedback.task2.LR },
                  { label: "Grammar", short: "GRA", score: feedback.task2.GRA },
                ].map((item, i) => (
                  <div key={i} className="p-4 text-center">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400" title={item.label}>
                      {item.short}
                    </p>
                    <p className="mt-1 text-2xl font-black text-slate-900">{formatBandScore(item.score)}</p>
                  </div>
                ))}
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

            <TaskExtras
              goldenRule={resolveTaskGoldenRule(feedback, "task2")}
              bandProgression={resolveTaskBandProgression(feedback, "task2")}
              vocabulary={resolveTaskVocabulary(feedback, "task2")}
              advancedStructures={resolveTaskAdvancedStructures(feedback, "task2")}
              essayUpgrades={resolveTaskEssayUpgrades(feedback, "task2")}
              legacyEditedEssay={resolveTaskEditedEssay(feedback, "task2")}
            />
          </div>
        )}
      </div>
    </div>
  );
}
