"use client";

import { AlertOctagon, Languages, Star, Lightbulb, Target, Link2, SpellCheck2, PenTool } from "lucide-react";
import { sanitizeBandMentions } from "./band-sanitizer";

type CriterionItem = { label: string; content: string };
type DiagnosisItem = { label: string | null; content: string };

function splitBullets(block: string): string[] {
  const bullets: string[] = [];
  for (const rawLine of block.split("\n")) {
    const line = rawLine.trim();
    if (!line) continue;
    if (line.startsWith("- ")) {
      bullets.push(line.slice(2).trim());
    } else if (bullets.length > 0 && !/^###/.test(line)) {
      bullets[bullets.length - 1] += " " + line;
    }
  }
  return bullets;
}

function parseBulletLabel(bullet: string): DiagnosisItem {
  const match = bullet.match(/^\*\*([^*]+?):?\*\*:?\s*(.*)$/);
  if (match) return { label: match[1].trim(), content: match[2].trim() };
  return { label: null, content: bullet };
}

export function parseExaminerSummary(raw: string): { criteria: CriterionItem[]; diagnosis: DiagnosisItem[] } {
  if (!raw) return { criteria: [], diagnosis: [] };

  const sections = raw.split(/\n(?=###\s)/).map((s) => s.trim());
  const section1 = sections.find((s) => /^###\s*1\./.test(s)) ?? "";
  const section2 = sections.find((s) => /^###\s*2\./.test(s)) ?? "";

  const criteria = splitBullets(section1)
    .map(parseBulletLabel)
    .filter((b): b is CriterionItem => Boolean(b.label));

  const diagnosis = splitBullets(section2).map(parseBulletLabel);

  return { criteria, diagnosis };
}

function renderInline(text: string) {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith("**") && part.endsWith("**") ? (
      <strong key={i} className="font-bold text-slate-900">
        {part.slice(2, -2)}
      </strong>
    ) : (
      <span key={i}>{part}</span>
    ),
  );
}

// Mỗi tiêu chí có 1 màu riêng — dùng xuyên suốt (icon, viền trái của thẻ, badge
// điểm ở GradingResultPanel) để mắt quét nhanh mà không cần đọc chữ.
function criterionIcon(label: string) {
  if (/Task Achievement|Task Response/i.test(label))
    return { Icon: Target, color: "text-cyan-600", bg: "bg-cyan-100", accent: "bg-cyan-400" };
  if (/Coherence/i.test(label))
    return { Icon: Link2, color: "text-violet-600", bg: "bg-violet-100", accent: "bg-violet-400" };
  if (/Lexical/i.test(label))
    return { Icon: SpellCheck2, color: "text-amber-600", bg: "bg-amber-100", accent: "bg-amber-400" };
  return { Icon: PenTool, color: "text-emerald-600", bg: "bg-emerald-100", accent: "bg-emerald-400" };
}

function diagnosisStyle(label: string | null) {
  if (!label) return { Icon: Lightbulb, color: "text-cyan-700", bg: "bg-cyan-50", border: "border-cyan-200", iconBg: "bg-cyan-100" };
  if (/Lỗi chí mạng/i.test(label))
    return { Icon: AlertOctagon, color: "text-red-700", bg: "bg-red-50", border: "border-red-200", iconBg: "bg-red-100" };
  if (/dịch thuật|L1/i.test(label))
    return { Icon: Languages, color: "text-amber-700", bg: "bg-amber-50", border: "border-amber-200", iconBg: "bg-amber-100" };
  if (/Điểm sáng/i.test(label))
    return { Icon: Star, color: "text-emerald-700", bg: "bg-emerald-50", border: "border-emerald-200", iconBg: "bg-emerald-100" };
  return { Icon: Lightbulb, color: "text-cyan-700", bg: "bg-cyan-50", border: "border-cyan-200", iconBg: "bg-cyan-100" };
}

type ExaminerSummaryCardProps = {
  summary: string;
  // Danh sách điểm THẬT SỰ đã chấm (TA/TR, CC, LR, GRA của đúng task này) —
  // dùng để lọc bỏ những câu nhắc "Band X.X" không khớp bất kỳ điểm nào,
  // vì đó là dấu hiệu model tự mâu thuẫn giữa văn xuôi và điểm số JSON.
  validBands: number[];
};

export default function ExaminerSummaryCard({ summary, validBands }: ExaminerSummaryCardProps) {
  const { criteria, diagnosis } = parseExaminerSummary(summary);

  if (criteria.length === 0 && diagnosis.length === 0) {
    const sanitized = sanitizeBandMentions(summary, validBands);
    return (
      <div className="rounded-2xl bg-white p-5 sm:p-6 border border-cyan-100/50 shadow-sm relative">
        <div className="absolute top-0 left-0 w-1 h-full bg-cyan-400 rounded-l-2xl" />
        <p className="text-[15px] leading-[1.8] text-slate-700 whitespace-pre-line">{renderInline(sanitized)}</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {criteria.length > 0 && (
        <div>
          <h4 className="text-[13px] font-black uppercase tracking-wider text-slate-500 mb-4 flex items-center gap-2">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-slate-300" />
            Phân tích 4 tiêu chí chấm điểm
          </h4>
          <div className="grid gap-4 sm:grid-cols-2">
            {criteria.map((item, i) => {
              const { Icon, color, bg, accent } = criterionIcon(item.label);
              const sanitizedContent = sanitizeBandMentions(item.content, validBands);
              return (
                <div
                  key={i}
                  className="relative overflow-hidden rounded-2xl bg-white border border-slate-200/60 shadow-sm p-5 transition-shadow hover:shadow-md"
                >
                  <span className={`absolute inset-y-0 left-0 w-1 ${accent}`} />
                  <div className="flex items-center gap-2.5 mb-3">
                    <div className={`${bg} p-2 rounded-xl shrink-0`}>
                      <Icon className={`h-4 w-4 ${color}`} />
                    </div>
                    <span className="text-[14px] font-bold text-slate-800">{item.label}</span>
                  </div>
                  <p className="text-[13.5px] leading-[1.75] text-slate-600">{renderInline(sanitizedContent)}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {diagnosis.length > 0 && (
        <div>
          <h4 className="text-[13px] font-black uppercase tracking-wider text-slate-500 mb-4 flex items-center gap-2">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-slate-300" />
            Chẩn đoán chuyên sâu
          </h4>
          <div className="space-y-3">
            {diagnosis.map((item, i) => {
              const { Icon, color, bg, border, iconBg } = diagnosisStyle(item.label);
              const sanitizedContent = sanitizeBandMentions(item.content, validBands);
              return (
                <div key={i} className={`rounded-2xl ${bg} border ${border} p-4 sm:p-5 flex items-start gap-3`}>                  <div className={`${iconBg} p-1.5 rounded-lg shrink-0 mt-0.5`}>
                    <Icon className={`h-4 w-4 ${color}`} />
                  </div>
                  <p className="text-[13.5px] leading-[1.75] text-slate-700">
                    {item.label && <span className={`font-bold ${color}`}>{item.label}: </span>}
                    {renderInline(sanitizedContent)}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}