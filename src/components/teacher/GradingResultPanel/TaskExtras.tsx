"use client";

import { useState } from "react";
import { ChevronDown, Compass, Languages, Lightbulb, Sparkles, Wand2 } from "lucide-react";
import type { AdvancedStructure, BandProgression, EssayUpgrade, VocabularySuggestion } from "@/lib/types";

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
export default function TaskExtras({ goldenRule, bandProgression, vocabulary, advancedStructures, essayUpgrades, legacyEditedEssay }: TaskExtrasProps) {
  const [showLegacyEssay, setShowLegacyEssay] = useState(false);

  const hasAnything =
    goldenRule || bandProgression || vocabulary.length > 0 || advancedStructures.length > 0 || essayUpgrades.length > 0 || legacyEditedEssay;
  if (!hasAnything) return null;

  return (
    <div className="space-y-5">
      {goldenRule && (
        <div className="flex items-start gap-3 rounded-xl border-l-[3px] border-amber-300 bg-white p-4">
          <div className="shrink-0 bg-amber-50 p-1.5 rounded-lg"><Lightbulb className="h-4 w-4 text-amber-500" /></div>
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
                {s.original_sentence ? (
                  <p className="text-sm text-slate-400 line-through decoration-slate-300">{s.original_sentence}</p>
                ) : (
                  <p className="text-[11px] font-semibold text-slate-400 italic">Gợi ý tổng hợp — không nâng cấp từ 1 câu cụ thể nào</p>
                )}
                <p className="text-sm text-slate-800 italic">
                  <mark className="bg-emerald-100/70 text-slate-900 rounded-sm px-0.5">{s.example_sentence_en}</mark>
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
                  <mark className="bg-sky-100/70 text-slate-900 rounded-sm px-0.5">{u.upgraded}</mark>
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
              <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap bg-sky-50 rounded-lg px-3 py-2.5 box-decoration-clone">
                {legacyEditedEssay}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
