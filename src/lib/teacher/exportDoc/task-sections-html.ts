import type { Correction } from "@/lib/types";
import { escapeHtml, highlightAnswerHtml } from "./html-helpers";
import type { ExportSections } from "./image";

// Dựng phần HTML cho Task 1 & Task 2 (đề bài + ảnh + bài làm) — dùng chung cho mọi kiểu export.
// task1Corrections/task2Corrections (mặc định []) dùng để tô vàng đúng đoạn bị AI sửa, y hệt cách
// SubmissionDetail hiển thị trên UI (renderHighlightedAnswer).
export function buildTaskSectionsHtml(
  sections: ExportSections,
  task1Corrections: Correction[] = [],
  task2Corrections: Correction[] = [],
) {
  let html = "";

  html += `<h3 style="font-size:12.5pt;color:#0f172a;border-left:4px solid #06b6d4;padding-left:9px;margin:0 0 8px 0;">TASK 1</h3>`;
  if (sections.task1Prompt) {
    html += `<table style="width:100%;border-collapse:collapse;margin-bottom:8px;"><tr><td style="background:#f8fafc;border:1px solid #e2e8f0;padding:9px 11px;">
      <p style="margin:0 0 3px 0;font-size:8.5pt;font-weight:bold;color:#64748b;letter-spacing:0.03em;text-transform:uppercase;">Đề bài</p>
      <p style="margin:0;white-space:pre-wrap;font-size:10.5pt;line-height:1.45;">${escapeHtml(sections.task1Prompt)}</p>
    </td></tr></table>`;
  }
  if (sections.task1ImageUrl) {
    const widthAttr = sections.task1ImageWidth ? ` width="${sections.task1ImageWidth}"` : "";
    const heightAttr = sections.task1ImageHeight ? ` height="${sections.task1ImageHeight}"` : "";
    // Nếu đã có width/height cụ thể (đo từ ảnh thật) thì không cần max-width/max-height CSS nữa —
    // Word không tin cậy CSS khi convert .doc nên ưu tiên thuộc tính HTML width/height.
    const sizeStyle = sections.task1ImageWidth ? "" : "max-width:440px;max-height:300px;";
    html += `<div style="text-align:center;margin-bottom:8px;">
      <img src="${sections.task1ImageUrl}"${widthAttr}${heightAttr} style="${sizeStyle}border:1px solid #e2e8f0;border-radius:8px;" />
    </div>`;
  }
  html += `<div style="margin-bottom:14px;">
    <p style="margin:0 0 4px 0;font-size:8.5pt;font-weight:bold;color:#94a3b8;letter-spacing:0.05em;text-transform:uppercase;">Bài làm học sinh</p>
    <table style="width:100%;border-collapse:collapse;"><tr><td style="background:#fcfcfc;border:1px solid #e2e8f0;padding:12px;">
    <p style="white-space:pre-wrap;font-family:Georgia,'Times New Roman',serif;font-size:10.5pt;line-height:1.6;color:#1e293b;margin:0;">${
      sections.task1Answer ? highlightAnswerHtml(sections.task1Answer, task1Corrections) : "<i>Học sinh chưa làm Task 1</i>"
    }</p>
    </td></tr></table>
  </div>`;

  html += `<h3 style="font-size:12.5pt;color:#0f172a;border-left:4px solid #06b6d4;padding-left:9px;margin:0 0 8px 0;">TASK 2</h3>`;
  if (sections.task2Prompt) {
    html += `<table style="width:100%;border-collapse:collapse;margin-bottom:8px;"><tr><td style="background:#f8fafc;border:1px solid #e2e8f0;padding:9px 11px;">
      <p style="margin:0 0 3px 0;font-size:8.5pt;font-weight:bold;color:#64748b;letter-spacing:0.03em;text-transform:uppercase;">Đề bài</p>
      <p style="margin:0;white-space:pre-wrap;font-size:10.5pt;line-height:1.45;">${escapeHtml(sections.task2Prompt)}</p>
    </td></tr></table>`;
  }
  html += `<div style="margin-bottom:14px;">
    <p style="margin:0 0 4px 0;font-size:8.5pt;font-weight:bold;color:#94a3b8;letter-spacing:0.05em;text-transform:uppercase;">Bài làm học sinh</p>
    <table style="width:100%;border-collapse:collapse;"><tr><td style="background:#fcfcfc;border:1px solid #e2e8f0;padding:12px;">
    <p style="white-space:pre-wrap;font-family:Georgia,'Times New Roman',serif;font-size:10.5pt;line-height:1.6;color:#1e293b;margin:0;">${
      sections.task2Answer ? highlightAnswerHtml(sections.task2Answer, task2Corrections) : "<i>Học sinh chưa làm Task 2</i>"
    }</p>
    </td></tr></table>
  </div>`;

  return html;
}
