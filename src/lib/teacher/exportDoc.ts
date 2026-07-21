import JSZip from "jszip";
import { parseSubmissionContent } from "@/lib/grading/parse";
import type { Correction, GradingFeedback, SubmissionRow } from "@/lib/types";
import { resolveTaskCorrections, resolveTaskSummary, formatBandScore } from "@/components/teacher/GradingResultPanel";
import { parseExaminerSummary } from "@/components/teacher/ExaminerSummaryCard";
import { sanitizeBandMentions } from "@/components/teacher/band-sanitizer";

// Font dùng cho toàn bộ file export — Geist Sans (font của UI web) không có sẵn
// trong Word, nên dùng bộ font sans-serif hiện đại, rõ nét gần nhất mà máy nào
// cũng có sẵn: Calibri (mặc định Office) -> Segoe UI (Windows) -> Arial. Thay
// cho Times New Roman cũ, vốn nhỏ và khó đọc hơn khi xem trên màn hình.
const DOC_FONT = "Calibri, 'Segoe UI', Arial, sans-serif";

// ---- Các hàm hỗ trợ xuất file DOC, đảm bảo nội dung file tải về khớp với UI trên web ----

/**
 * Word chặn tự động tải ảnh từ URL ngoài khi mở file .doc (giống cách Outlook chặn ảnh từ xa
 * trong email HTML) — ảnh Task 1 sẽ hiện icon lỗi thay vì hình thật. Để khắc phục, ta tải ảnh về
 * và nhúng thẳng dạng base64 (data URI) vào file, giúp ảnh luôn hiển thị được mà không cần mạng.
 */
async function imageUrlToBase64(url: string): Promise<string | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const blob = await response.blob();
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

/**
 * Word không tin cậy CSS max-width/max-height khi convert file .doc — nó thường lấy kích thước
 * gốc (pixel thật) của ảnh, khiến ảnh bị phóng to sai tỉ lệ khi bấm "Enable Editing". Để tránh việc
 * này, ta đo trước kích thước gốc, tính lại theo tỉ lệ (giới hạn maxWidth/maxHeight) rồi gán thẳng
 * thuộc tính width/height (px) vào thẻ <img> — Word tôn trọng thuộc tính này hơn CSS.
 */
async function loadImageForDoc(
  url: string,
  maxWidth = 500,
  maxHeight = 350,
): Promise<{ dataUrl: string; width: number; height: number } | null> {
  const dataUrl = await imageUrlToBase64(url);
  if (!dataUrl) return null;

  try {
    const size = await new Promise<{ width: number; height: number }>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
      img.onerror = () => reject(new Error("Không đọc được kích thước ảnh"));
      img.src = dataUrl;
    });

    let { width, height } = size;
    if (width > 0 && height > 0) {
      const ratio = Math.min(maxWidth / width, maxHeight / height, 1);
      width = Math.round(width * ratio);
      height = Math.round(height * ratio);
    } else {
      width = maxWidth;
      height = maxHeight;
    }

    return { dataUrl, width, height };
  } catch {
    // Không đo được kích thước (ảnh lỗi định dạng...) — vẫn giữ ảnh với kích thước mặc định thay vì mất ảnh
    return { dataUrl, width: maxWidth, height: maxHeight };
  }
}

export type ExportSections = {
  task1Prompt?: string;
  task1ImageUrl?: string | null;
  task1ImageWidth?: number;
  task1ImageHeight?: number;
  task1Answer?: string;
  task2Prompt?: string;
  task2Answer?: string;
  teacherComment?: string;
};

/** Trả về bản sao sections với task1ImageUrl đã chuyển sang base64 + kích thước đã tính theo tỉ lệ
 * (nếu tải/đo được), giữ nguyên URL cũ nếu lỗi. cache (tuỳ chọn) giúp tránh tải lại cùng 1 ảnh nhiều
 * lần khi export hàng loạt (nhiều học sinh chung 1 đề thi). */
async function resolveSectionsImage(
  sections: ExportSections,
  cache?: Map<string, { dataUrl: string; width: number; height: number }>,
): Promise<ExportSections> {
  if (!sections.task1ImageUrl) return sections;
  const url = sections.task1ImageUrl;

  const cached = cache?.get(url);
  if (cached) {
    return { ...sections, task1ImageUrl: cached.dataUrl, task1ImageWidth: cached.width, task1ImageHeight: cached.height };
  }

  const result = await loadImageForDoc(url);
  if (!result) return sections;

  cache?.set(url, result);
  return { ...sections, task1ImageUrl: result.dataUrl, task1ImageWidth: result.width, task1ImageHeight: result.height };
}

function escapeHtml(value?: string) {
  return (value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// Dựng phần HTML cho Task 1 & Task 2 (đề bài + ảnh + bài làm) — dùng chung cho mọi kiểu export
function buildTaskSectionsHtml(sections: ExportSections) {
  let html = "";

  html += `<h3 style="font-size:15pt;color:#0f172a;border-left:5px solid #06b6d4;padding-left:12px;margin-top:32px;margin-bottom:14px;">TASK 1</h3>`;
  if (sections.task1Prompt) {
    html += `<div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:16px;margin-bottom:14px;">
      <p style="margin:0 0 6px 0;font-size:10.5pt;font-weight:bold;color:#64748b;letter-spacing:0.03em;text-transform:uppercase;">Đề bài</p>
      <p style="margin:0;white-space:pre-wrap;font-size:12.5pt;line-height:1.9;">${escapeHtml(sections.task1Prompt)}</p>
    </div>`;
  }
  if (sections.task1ImageUrl) {
    const widthAttr = sections.task1ImageWidth ? ` width="${sections.task1ImageWidth}"` : "";
    const heightAttr = sections.task1ImageHeight ? ` height="${sections.task1ImageHeight}"` : "";
    // Nếu đã có width/height cụ thể (đo từ ảnh thật) thì không cần max-width/max-height CSS nữa —
    // Word không tin cậy CSS khi convert .doc nên ưu tiên thuộc tính HTML width/height.
    const sizeStyle = sections.task1ImageWidth ? "" : "max-width:500px;max-height:350px;";
    html += `<div style="text-align:center;margin-bottom:14px;">
      <img src="${sections.task1ImageUrl}"${widthAttr}${heightAttr} style="${sizeStyle}border:1px solid #e2e8f0;border-radius:10px;" />
    </div>`;
  }
  html += `<div style="margin-bottom:14px;">
    <p style="margin:0 0 6px 0;font-size:10.5pt;font-weight:bold;color:#64748b;letter-spacing:0.03em;text-transform:uppercase;">Bài làm học sinh</p>
    <p style="white-space:pre-wrap;font-size:12.5pt;line-height:2;">${sections.task1Answer ? escapeHtml(sections.task1Answer) : "<i>Học sinh chưa làm Task 1</i>"}</p>
  </div>`;

  html += `<h3 style="font-size:15pt;color:#0f172a;border-left:5px solid #06b6d4;padding-left:12px;margin-top:32px;margin-bottom:14px;">TASK 2</h3>`;
  if (sections.task2Prompt) {
    html += `<div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:16px;margin-bottom:14px;">
      <p style="margin:0 0 6px 0;font-size:10.5pt;font-weight:bold;color:#64748b;letter-spacing:0.03em;text-transform:uppercase;">Đề bài</p>
      <p style="margin:0;white-space:pre-wrap;font-size:12.5pt;line-height:1.9;">${escapeHtml(sections.task2Prompt)}</p>
    </div>`;
  }
  html += `<div style="margin-bottom:14px;">
    <p style="margin:0 0 6px 0;font-size:10.5pt;font-weight:bold;color:#64748b;letter-spacing:0.03em;text-transform:uppercase;">Bài làm học sinh</p>
    <p style="white-space:pre-wrap;font-size:12.5pt;line-height:2;">${sections.task2Answer ? escapeHtml(sections.task2Answer) : "<i>Học sinh chưa làm Task 2</i>"}</p>
  </div>`;

  return html;
}

// Icon (emoji) tương ứng với icon lucide-react dùng trên UI (ExaminerSummaryCard) —
// Word không render được SVG lucide nên dùng emoji để giữ cảm giác trực quan.
function criterionEmoji(label: string) {
  if (/Task Achievement|Task Response/i.test(label)) return "🎯";
  if (/Coherence/i.test(label)) return "🔗";
  if (/Lexical/i.test(label)) return "📖";
  return "✍️";
}
function diagnosisStyle(label: string | null): { emoji: string; bg: string; border: string; color: string } {
  if (label && /Lỗi chí mạng/i.test(label)) return { emoji: "⚠️", bg: "#fef2f2", border: "#fecaca", color: "#b91c1c" };
  if (label && /dịch thuật|L1/i.test(label)) return { emoji: "🌐", bg: "#fffbeb", border: "#fde68a", color: "#b45309" };
  if (label && /Điểm sáng/i.test(label)) return { emoji: "⭐", bg: "#ecfdf5", border: "#a7f3d0", color: "#047857" };
  return { emoji: "💡", bg: "#ecfeff", border: "#a5f3fc", color: "#0e7490" };
}

// In đậm các cụm **...** giống UI (renderInline trong ExaminerSummaryCard.tsx) — nhận
// xét từ AI luôn ở dạng markdown thô (### tiêu đề, **in đậm**, - gạch đầu dòng), nếu in
// nguyên văn vào file .doc thì các ký tự ###/** sẽ hiện lù lù thay vì được định dạng.
function renderInlineHtml(text: string): string {
  return escapeHtml(text).replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
}

function buildCorrectionsHtml(corrections: Correction[]): string {
  if (corrections.length === 0) return "";
  let html = `<h4 style="font-size:13pt;color:#0f172a;margin:20px 0 12px 0;">Lỗi sai &amp; Đề xuất sửa</h4>`;
  corrections.forEach((c) => {
    html += `<div style="border:1px solid #e2e8f0;border-radius:10px;padding:14px;margin-bottom:12px;">
      <p style="margin:0 0 8px 0;background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:8px 10px;font-size:12pt;color:#b91c1c;text-decoration:line-through;white-space:pre-wrap;">❌ ${escapeHtml(c.original)}</p>
      <p style="margin:0 0 8px 0;background:#ecfdf5;border:1px solid #a7f3d0;border-radius:8px;padding:8px 10px;font-size:12pt;font-weight:bold;color:#047857;white-space:pre-wrap;">✅ ${escapeHtml(c.corrected)}</p>
      <p style="margin:0;background:#f8fafc;border-radius:8px;padding:8px 10px;font-size:11.5pt;color:#475569;">💡 <i>Lời khuyên:</i> ${escapeHtml(c.explanation)}</p>
    </div>`;
  });
  return html;
}

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

  let html = `<div style="margin-top:26px;">`;
  html += `<div style="margin-bottom:14px;">
    <span style="background:#0f172a;color:#fff;font-size:10.5pt;font-weight:bold;letter-spacing:0.04em;padding:6px 12px;border-radius:8px;">${taskLabel}</span>
    <span style="background:#cffafe;color:#0e7490;font-size:10.5pt;font-weight:bold;padding:6px 12px;border-radius:999px;margin-left:8px;">Band ${formatBandScore(score.band)}</span>
  </div>`;

  html += `<table style="width:100%;border-collapse:collapse;margin-bottom:14px;">`;
  criteriaLabels.forEach((c) => {
    html += `<tr>
      <td style="border:1px solid #e2e8f0;padding:8px 12px;font-size:11.5pt;color:#475569;">${c.label}</td>
      <td style="border:1px solid #e2e8f0;padding:8px 12px;font-size:11.5pt;font-weight:bold;color:#0f172a;text-align:right;width:70px;">${formatBandScore((score as unknown as Record<string, number>)[c.key])}</td>
    </tr>`;
  });
  html += `</table>`;

  // Nhận xét: thử parse theo cấu trúc "### 1. ... / ### 2. ..." giống ExaminerSummaryCard,
  // nếu không khớp format thì hiện nguyên đoạn văn (đã in đậm ** và bỏ Band sai lệch).
  const { criteria, diagnosis } = parseExaminerSummary(summary);
  if (criteria.length === 0 && diagnosis.length === 0) {
    const sanitized = sanitizeBandMentions(summary, validBands);
    if (sanitized.trim()) {
      html += `<div style="border-left:4px solid #22d3ee;background:#fff;border:1px solid #cffafe;border-radius:10px;padding:14px;margin-bottom:14px;">
        <p style="margin:0;font-size:12pt;line-height:1.9;color:#334155;">${renderInlineHtml(sanitized)}</p>
      </div>`;
    }
  } else {
    if (criteria.length > 0) {
      html += `<p style="font-size:10.5pt;font-weight:bold;letter-spacing:0.03em;text-transform:uppercase;color:#94a3b8;margin:16px 0 10px 0;">Phân tích 4 tiêu chí chấm điểm</p>`;
      criteria.forEach((item) => {
        html += `<div style="border:1px solid #e2e8f0;border-radius:10px;padding:12px;margin-bottom:10px;">
          <p style="margin:0 0 4px 0;font-size:12pt;font-weight:bold;color:#1e293b;">${criterionEmoji(item.label)} ${escapeHtml(item.label)}</p>
          <p style="margin:0;font-size:11.5pt;line-height:1.8;color:#475569;">${renderInlineHtml(sanitizeBandMentions(item.content, validBands))}</p>
        </div>`;
      });
    }
    if (diagnosis.length > 0) {
      html += `<p style="font-size:10.5pt;font-weight:bold;letter-spacing:0.03em;text-transform:uppercase;color:#94a3b8;margin:16px 0 10px 0;">Chẩn đoán chuyên sâu</p>`;
      diagnosis.forEach((item) => {
        const style = diagnosisStyle(item.label);
        html += `<div style="background:${style.bg};border:1px solid ${style.border};border-radius:10px;padding:12px;margin-bottom:10px;">
          <p style="margin:0;font-size:11.5pt;line-height:1.8;color:#334155;">${style.emoji} ${
          item.label ? `<strong style="color:${style.color};">${escapeHtml(item.label)}: </strong>` : ""
        }${renderInlineHtml(sanitizeBandMentions(item.content, validBands))}</p>
        </div>`;
      });
    }
  }

  html += buildCorrectionsHtml(corrections);
  html += `</div>`;
  return html;
}

// Dựng toàn bộ khối feedback (Overall band + Task 1 + Task 2), khớp 100% với những gì
// giáo viên thấy trên GradingResultPanel/ExaminerSummaryCard ở UI web.
function buildFeedbackHtml(feedback: GradingFeedback, task1Answer?: string, task2Answer?: string): string {
  let html = `<div style="margin-top:32px;">`;
  // Bảng thay vì flexbox: Word không tin cậy display:flex khi convert HTML -> .doc,
  // dùng table 2 cột đảm bảo 2 phần luôn nằm ngang hàng khi mở bằng Word thật.
  html += `<table style="width:100%;background:#0f172a;border-radius:12px;border-collapse:collapse;margin-bottom:6px;">
    <tr>
      <td style="padding:16px 20px;color:#e2e8f0;font-size:13pt;font-weight:bold;">Đánh giá từ AI Examiner</td>
      <td style="padding:16px 20px;color:#22d3ee;font-size:18pt;font-weight:bold;text-align:right;">Overall ${formatBandScore(feedback.overall_band)}</td>
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
    html += `<div style="border-left:4px solid #22d3ee;background:#fff;border:1px solid #cffafe;border-radius:10px;padding:14px;margin-top:14px;">
      <p style="margin:0 0 8px 0;font-size:13pt;font-weight:bold;color:#0f172a;">Nhận xét tổng quan</p>
      <p style="margin:0;font-size:12pt;line-height:1.9;color:#334155;">${renderInlineHtml(feedback.examiner_summary)}</p>
    </div>`;
    html += buildCorrectionsHtml(feedback.corrections ?? []);
  }

  html += `</div>`;
  return html;
}

// Dựng toàn bộ nội dung HTML (dạng .doc) cho MỘT bài làm — dùng chung cho nút
// "Xuất File DOC" (tải lẻ) VÀ tính năng "Tải tất cả / Tải đã chọn" (zip)
function buildFullDocHtml(studentName: string, sections: ExportSections, feedback?: GradingFeedback | null): string {
  const header =
    `<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'><head><meta charset='utf-8'><title>Export HTML To Doc</title><style>` +
    `body { font-family: ${DOC_FONT}; font-size: 12pt; line-height: 1.7; color: #1e293b; } ` +
    `h2, h3, h4 { font-family: ${DOC_FONT}; }` +
    `</style></head><body>`;
  const footer = "</body></html>";

  let sourceHTML = `<h2 style="font-size:20pt;text-align:center;color:#0f172a;border-bottom:2px solid #e2e8f0;padding-bottom:14px;margin-bottom:20px;">Bài làm của ${escapeHtml(studentName)}</h2>`;
  sourceHTML += buildTaskSectionsHtml(sections);

  if (sections.teacherComment && sections.teacherComment.trim()) {
    sourceHTML += `<div style="background:#ecfdf5;border:1px solid #a7f3d0;border-radius:10px;padding:16px;margin-top:28px;">
      <h3 style="font-size:13pt;color:#059669;margin:0 0 8px 0;">Nhận xét bổ sung của giáo viên</h3>
      <p style="white-space:pre-wrap;font-size:12pt;line-height:1.9;margin:0;">${escapeHtml(sections.teacherComment)}</p>
    </div>`;
  }

  if (feedback) {
    sourceHTML += buildFeedbackHtml(feedback, sections.task1Answer, sections.task2Answer);
  }

  return header + sourceHTML + footer;
}

// Export File DOC đầy đủ — đề bài, ảnh Task 1, bài làm từng Task, nhận xét giáo viên và Feedback AI nếu có.
// Chuyển ảnh Task 1 sang base64 trước khi build HTML để ảnh luôn hiển thị được khi mở bằng Word.
export async function downloadSubmissionDoc(studentName: string, sections: ExportSections, feedback?: GradingFeedback | null) {
  const resolvedSections = await resolveSectionsImage(sections);
  const fullHtml = buildFullDocHtml(studentName, resolvedSections, feedback);
  const source = "data:application/vnd.ms-word;charset=utf-8," + encodeURIComponent(fullHtml);
  const fileDownload = document.createElement("a");
  document.body.appendChild(fileDownload);
  fileDownload.href = source;
  fileDownload.download = `IELTS_Writing_${studentName.replace(/\s+/g, "_")}.doc`;
  fileDownload.click();
  document.body.removeChild(fileDownload);
}

// Export nhanh (icon Download cạnh tiêu đề) — theo cấu trúc Task 1 / Task 2 giống UI, không kèm feedback AI
export async function downloadSubmissionRawText(studentName: string, sections: ExportSections) {
  if (!sections.task1Answer && !sections.task2Answer) return;

  const resolvedSections = await resolveSectionsImage(sections);

  const header = "<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'><head><meta charset='utf-8'><title>Export</title></head><body>";
  const footer = "</body></html>";
  const bodyHtml = buildTaskSectionsHtml(resolvedSections);
  const fullHtml = `${header}<h2 style="text-align:center; color:#0f172a;">Bài làm của ${escapeHtml(studentName)}</h2>${bodyHtml}${footer}`;

  const blob = new Blob([fullHtml], { type: "application/msword" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${studentName.replace(/\s+/g, "_")}.doc`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/** Tránh trùng tên file khi nhiều học sinh trùng tên trong cùng 1 lượt tải zip */
function makeUniqueFileName(base: string, used: Map<string, number>): string {
  const safeBase = base.replace(/\s+/g, "_").replace(/[\\/:*?"<>|]/g, "");
  const count = used.get(safeBase) ?? 0;
  used.set(safeBase, count + 1);
  return count === 0 ? `${safeBase}.doc` : `${safeBase}_${count + 1}.doc`;
}

// Tải nhiều bài làm cùng lúc (zip) — mỗi file .doc bên trong zip có cấu trúc y hệt UI:
// đề bài + ảnh Task 1 + bài làm từng Task + nhận xét giáo viên + kết quả chấm (nếu có).
export async function downloadSubmissionsZip(submissions: SubmissionRow[]) {
  const zip = new JSZip();
  const usedNames = new Map<string, number>();
  const imageCache = new Map<string, { dataUrl: string; width: number; height: number }>(); // Cache ảnh (base64 + kích thước) theo URL — nhiều học sinh chung 1 đề thi sẽ dùng chung cache, tránh tải lại ảnh nhiều lần

  for (const submission of submissions) {
    const parsed = parseSubmissionContent(submission.content);
    const resolvedSections = await resolveSectionsImage(
      {
        task1Prompt: submission.tests?.task1_prompt,
        task1ImageUrl: submission.tests?.image_url,
        task1Answer: parsed.task1Answer,
        task2Prompt: submission.tests?.task2_prompt,
        task2Answer: parsed.task2Answer,
        teacherComment: (submission as any).teacher_comment ?? undefined,
      },
      imageCache,
    );
    const html = buildFullDocHtml(submission.student_name, resolvedSections, submission.feedback);
    const fileName = makeUniqueFileName(submission.student_name, usedNames);
    zip.file(fileName, html);
  }

  const blob = await zip.generateAsync({ type: "blob" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  const stamp = new Date().toISOString().slice(0, 10);
  link.download = `Bai_lam_IELTS_${stamp}.zip`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
