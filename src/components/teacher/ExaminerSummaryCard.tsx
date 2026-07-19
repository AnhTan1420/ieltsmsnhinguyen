"use client";

import { AlertOctagon, Languages, Star, Lightbulb, Target, Link2, SpellCheck2, PenTool } from "lucide-react";

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

// Parse ĐÚNG 1 khối nhận xét của 1 task (đã được tách sẵn ở nơi gọi) thành
// "1. Criteria" và "2. Diagnosis" theo template cố định trong prompt.
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

function criterionIcon(label: string) {
  if (/Task Achievement|Task Response/i.test(label)) return { Icon: Target, color: "text-cyan-600", bg: "bg-cyan-100" };
  if (/Coherence/i.test(label)) return { Icon: Link2, color: "text-violet-600", bg: "bg-violet-100" };
  if (/Lexical/i.test(label)) return { Icon: SpellCheck2, color: "text-amber-600", bg: "bg-amber-100" };
  return { Icon: PenTool, color: "text-emerald-600", bg: "bg-emerald-100" };
}

function diagnosisStyle(label: string | null) {
  if (!label) return { Icon: Lightbulb, color: "text-cyan-700", bg: "bg-cyan-50", border: "border-cyan-200" };
  if (/Lỗi chí mạng/i.test(label)) return { Icon: AlertOctagon, color: "text-red-700", bg: "bg-red-50", border: "border-red-200" };
  if (/dịch thuật|L1/i.test(label)) return { Icon: Languages, color: "text-amber-700", bg: "bg-amber-50", border: "border-amber-200" };
  if (/Điểm sáng/i.test(label)) return { Icon: Star, color: "text-emerald-700", bg: "bg-emerald-50", border: "border-emerald-200" };
  return { Icon: Lightbulb, color: "text-cyan-700", bg: "bg-cyan-50", border: "border-cyan-200" };
}

export default function ExaminerSummaryCard({ summary }: { summary: string }) {
  const { criteria, diagnosis } = parseExaminerSummary(summary);

  // Fallback: nếu model không theo đúng template (parse ra rỗng), vẫn hiển thị
  // nguyên văn thay vì mất trắng nội dung — chỉ xử lý bold inline + line-break.
  if (criteria.length === 0 && diagnosis.length === 0) {
    return (
      <div className="rounded-2xl bg-white p-5 border border-cyan-100/50 shadow-sm relative">
        <div className="absolute top-0 left-0 w-1 h-full bg-cyan-400 rounded-l-2xl" />
        <p className="text-[15px] leading-relaxed text-slate-700 whitespace-pre-line">{renderInline(summary)}</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {criteria.length > 0 && (
        <div>
          <h4 className="text-xs font-black uppercase tracking-wider text-slate-400 mb-3">
            Phân tích 4 tiêu chí chấm điểm
          </h4>
          <div className="grid gap-3 sm:grid-cols-2">
            {criteria.map((item, i) => {
              const { Icon, color, bg } = criterionIcon(item.label);
              return (
                <div key={i} className="rounded-2xl bg-white border border-slate-200/60 shadow-sm p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <div className={`${bg} p-1.5 rounded-lg shrink-0`}>
                      <Icon className={`h-3.5 w-3.5 ${color}`} />
                    </div>
                    <span className="text-sm font-bold text-slate-800">{item.label}</span>
                  </div>
                  <p className="text-[13px] leading-relaxed text-slate-600">{renderInline(item.content)}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {diagnosis.length > 0 && (
        <div>
          <h4 className="text-xs font-black uppercase tracking-wider text-slate-400 mb-3">
            Chẩn đoán chuyên sâu
          </h4>
          <div className="space-y-2.5">
            {diagnosis.map((item, i) => {
              const { Icon, color, bg, border } = diagnosisStyle(item.label);
              return (
                <div key={i} className={`rounded-xl ${bg} border ${border} p-3.5 flex items-start gap-2.5`}>
                  <Icon className={`h-4 w-4 shrink-0 mt-0.5 ${color}`} />
                  <p className="text-[13px] leading-relaxed text-slate-700">
                    {item.label && <span className={`font-bold ${color}`}>{item.label}: </span>}
                    {renderInline(item.content)}
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