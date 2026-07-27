import type { GradingFeedback } from "@/lib/types";
import { resolveTaskCorrections, resolveTaskSummary, resolveTaskGoldenRule, resolveTaskBandProgression, resolveTaskVocabulary, resolveTaskAdvancedStructures, resolveTaskEssayUpgrades, resolveTaskEditedEssay } from "@/lib/grading/feedback-resolvers";
import { parseExaminerSummary } from "@/components/teacher/ExaminerSummaryCard";
import { sanitizeBandMentions } from "@/lib/teacher/band-sanitizer";
import { criterionEmoji, diagnosisStyle, escapeHtml, renderInlineHtml, showBand } from "./html-helpers";
import {
  buildAdvancedStructuresHtml,
  buildBandProgressionHtml,
  buildCorrectionsHtml,
  buildEssayUpgradesHtml,
  buildGoldenRuleHtml,
  buildVocabularyHtml,
} from "./feedback-sections-html";

// Dựng phần feedback của MỘT task (band, 4 tiêu chí, nhận xét, chẩn đoán, lỗi sửa) —
// dùng đúng logic tách task/nhận xét/lỗi với GradingResultPanel.tsx và đúng cách parse
// markdown (### / **) với ExaminerSummaryCard.tsx để file tải về khớp 100% với UI.
function buildTaskFeedbackHtml(
  feedback: GradingFeedback,
  task: "task1" | "task2",
  answerText: string | undefined,
  taskLabel: string,
  criteriaLabels: { key: "TA" | "TR" | "CC" | "LR" | "GRA"; label: string }[],
): string {
  const score = task === "task1" ? feedback.task1 : feedback.task2;
  if (!score) return "";

  const summary = resolveTaskSummary(feedback, task);
  const corrections = resolveTaskCorrections(feedback, task, answerText);
  const validBands = criteriaLabels
    .map((c) => (score as unknown as Record<string, number>)[c.key])
    .filter((n): n is number => typeof n === "number");

  let html = `<div style="margin-bottom:16px;">`;
  html += `<div style="margin-bottom:8px;">
    <span style="background:#0f172a;color:#fff;font-size:9.5pt;font-weight:bold;letter-spacing:0.04em;padding:4px 10px;border-radius:6px;">${taskLabel}</span>
    <span style="background:#0e7490;color:#fff;font-size:11pt;font-weight:bold;padding:4px 12px;border-radius:999px;margin-left:6px;">Band ${showBand(score.band)}</span>
  </div>`;

  // Bảng điểm 4 tiêu chí — cố tình làm nổi bật (nền đậm, số to) để không bị lẫn
  // vào phần nhận xét dài phía dưới, tránh cảm giác "không thấy điểm đâu".
  html += `<table style="width:100%;border-collapse:collapse;margin-bottom:8px;table-layout:fixed;">
    <tr>${criteriaLabels.map((c) => `<td style="border:1px solid #e2e8f0;background:#f1f5f9;padding:4px 6px;font-size:8pt;font-weight:bold;color:#64748b;text-align:center;">${escapeHtml(c.label)}</td>`).join("")}</tr>
    <tr>${criteriaLabels
      .map(
        (c) =>
          `<td style="border:1px solid #e2e8f0;padding:5px 6px;font-size:13pt;font-weight:bold;color:#0e7490;text-align:center;">${showBand((score as unknown as Record<string, number>)[c.key])}</td>`,
      )
      .join("")}</tr>
  </table>`;

  // Nhận xét: thử parse theo cấu trúc "### 1. ... / ### 2. ..." giống ExaminerSummaryCard,
  // nếu không khớp format thì hiện nguyên đoạn văn (đã in đậm ** và bỏ Band sai lệch).
  const { criteria, diagnosis } = parseExaminerSummary(summary);
  if (criteria.length === 0 && diagnosis.length === 0) {
    const sanitized = sanitizeBandMentions(summary, validBands);
    if (sanitized.trim()) {
      html += `<div style="border-left:3px solid #22d3ee;background:#fff;border:1px solid #cffafe;border-radius:8px;padding:9px 11px;margin-bottom:8px;">
        <p style="margin:0;font-size:10.5pt;line-height:1.5;color:#334155;">${renderInlineHtml(sanitized)}</p>
      </div>`;
    }
  } else {
    if (criteria.length > 0) {
      html += `<p style="font-size:8.5pt;font-weight:bold;letter-spacing:0.03em;text-transform:uppercase;color:#94a3b8;margin:0 0 6px 0;">Phân tích 4 tiêu chí chấm điểm</p>`;
      criteria.forEach((item) => {
        html += `<div style="border:1px solid #e2e8f0;border-radius:8px;padding:7px 9px;margin-bottom:6px;">
          <p style="margin:0 0 2px 0;font-size:10.5pt;font-weight:bold;color:#1e293b;">${criterionEmoji(item.label)} ${escapeHtml(item.label)}</p>
          <p style="margin:0;font-size:10pt;line-height:1.5;color:#475569;">${renderInlineHtml(sanitizeBandMentions(item.content, validBands))}</p>
        </div>`;
      });
    }
    if (diagnosis.length > 0) {
      html += `<p style="font-size:8.5pt;font-weight:bold;letter-spacing:0.03em;text-transform:uppercase;color:#94a3b8;margin:8px 0 6px 0;">Chẩn đoán chuyên sâu</p>`;
      diagnosis.forEach((item) => {
        const style = diagnosisStyle(item.label);
        html += `<div style="background:${style.bg};border:1px solid ${style.border};border-radius:8px;padding:7px 9px;margin-bottom:6px;">
          <p style="margin:0;font-size:10pt;line-height:1.5;color:#334155;">${style.emoji} ${
          item.label ? `<strong style="color:${style.color};">${escapeHtml(item.label)}: </strong>` : ""
        }${renderInlineHtml(sanitizeBandMentions(item.content, validBands))}</p>
        </div>`;
      });
    }
  }

  html += buildCorrectionsHtml(corrections);
  html += buildGoldenRuleHtml(resolveTaskGoldenRule(feedback, task));
  html += buildBandProgressionHtml(resolveTaskBandProgression(feedback, task));
  html += buildVocabularyHtml(resolveTaskVocabulary(feedback, task));
  html += buildAdvancedStructuresHtml(resolveTaskAdvancedStructures(feedback, task));
  html += buildEssayUpgradesHtml(resolveTaskEssayUpgrades(feedback, task), resolveTaskEditedEssay(feedback, task));
  html += `</div>`;
  return html;
}

// Dựng toàn bộ khối feedback (Overall band + Task 1 + Task 2), khớp 100% với những gì
// giáo viên thấy trên GradingResultPanel/ExaminerSummaryCard ở UI web.
export function buildFeedbackHtml(feedback: GradingFeedback, task1Answer?: string, task2Answer?: string): string {
  let html = `<div>`;
  // Bảng thay vì flexbox: Word không tin cậy display:flex khi convert HTML -> .doc,
  // dùng table 2 cột đảm bảo 2 phần luôn nằm ngang hàng khi mở bằng Word thật.
  html += `<table style="width:100%;background:#0f172a;border-radius:10px;border-collapse:collapse;margin-bottom:12px;">
    <tr>
      <td style="padding:10px 14px;color:#e2e8f0;font-size:11pt;font-weight:bold;">Đánh giá từ AI Examiner</td>
      <td style="padding:10px 14px;color:#22d3ee;font-size:16pt;font-weight:bold;text-align:right;">Overall ${showBand(feedback.overall_band)}</td>
    </tr>
  </table>`;

  html += buildTaskFeedbackHtml(feedback, "task1", task1Answer, "TASK 1", [
    { key: "TA", label: "Task Achievement" },
    { key: "CC", label: "Coherence & Cohesion" },
    { key: "LR", label: "Lexical Resource" },
    { key: "GRA", label: "Grammar" },
  ]);
  html += buildTaskFeedbackHtml(feedback, "task2", task2Answer, "TASK 2", [
    { key: "TR", label: "Task Response" },
    { key: "CC", label: "Coherence & Cohesion" },
    { key: "LR", label: "Lexical Resource" },
    { key: "GRA", label: "Grammar" },
  ]);

  // Dữ liệu cũ chấm trước khi có task1/task2 tách riêng — không có feedback.task1/task2
  // nên 2 khối trên không render gì, fallback về examiner_summary thô (vẫn in đậm ** cho dễ đọc).
  if (!feedback.task1 && !feedback.task2 && feedback.examiner_summary) {
    html += `<div style="border-left:3px solid #22d3ee;background:#fff;border:1px solid #cffafe;border-radius:8px;padding:9px 11px;margin-bottom:8px;">
      <p style="margin:0 0 4px 0;font-size:11pt;font-weight:bold;color:#0f172a;">Nhận xét tổng quan</p>
      <p style="margin:0;font-size:10.5pt;line-height:1.5;color:#334155;">${renderInlineHtml(feedback.examiner_summary)}</p>
    </div>`;
    html += buildCorrectionsHtml(feedback.corrections ?? []);
  }

  html += `</div>`;
  return html;
}
