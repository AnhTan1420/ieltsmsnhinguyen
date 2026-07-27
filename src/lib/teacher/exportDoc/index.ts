import JSZip from "jszip";
import { parseSubmissionContent } from "@/lib/grading/parse";
import type { GradingFeedback, SubmissionRow } from "@/lib/types";
import { resolveTaskCorrections } from "@/lib/grading/feedback-resolvers";
import { escapeHtml } from "./html-helpers";
import { resolveSectionsImage, type ExportSections } from "./image";
import { buildTaskSectionsHtml } from "./task-sections-html";
import { buildFeedbackHtml } from "./task-feedback-html";

export type { ExportSections };

// Font dùng cho toàn bộ file export — Geist Sans (font của UI web) không có sẵn
// trong Word, nên dùng bộ font sans-serif hiện đại, rõ nét gần nhất mà máy nào
// cũng có sẵn: Calibri (mặc định Office) -> Segoe UI (Windows) -> Arial. Thay
// cho Times New Roman cũ, vốn nhỏ và khó đọc hơn khi xem trên màn hình.
const DOC_FONT = "Calibri, 'Segoe UI', Arial, sans-serif";

// Dựng toàn bộ nội dung HTML (dạng .doc) cho MỘT bài làm — dùng chung cho nút
// "Xuất File DOC" (tải lẻ) VÀ tính năng "Tải tất cả / Tải đã chọn" (zip)
function buildFullDocHtml(studentName: string, sections: ExportSections, feedback?: GradingFeedback | null): string {
  const header =
    `<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'><head><meta charset='utf-8'><title>Export HTML To Doc</title><style>` +
    `body { font-family: ${DOC_FONT}; font-size: 10.5pt; line-height: 1.5; color: #1e293b; } ` +
    `h2, h3, h4 { font-family: ${DOC_FONT}; }` +
    `</style></head><body>`;
  const footer = "</body></html>";

  let sourceHTML = `<h2 style="font-size:16pt;text-align:center;color:#0f172a;border-bottom:2px solid #e2e8f0;padding-bottom:8px;margin:0 0 12px 0;">Bài làm của ${escapeHtml(studentName)}</h2>`;
  const task1Corrections = feedback ? resolveTaskCorrections(feedback, "task1", sections.task1Answer) : [];
  const task2Corrections = feedback ? resolveTaskCorrections(feedback, "task2", sections.task2Answer) : [];
  sourceHTML += buildTaskSectionsHtml(sections, task1Corrections, task2Corrections);

  if (sections.teacherComment && sections.teacherComment.trim()) {
    sourceHTML += `<div style="background:#ecfdf5;border:1px solid #a7f3d0;border-radius:8px;padding:11px;margin-top:16px;">
      <h3 style="font-size:11pt;color:#059669;margin:0 0 6px 0;">Nhận xét bổ sung của giáo viên</h3>
      <p style="white-space:pre-wrap;font-size:10.5pt;line-height:1.6;margin:0;">${escapeHtml(sections.teacherComment)}</p>
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
        teacherComment: submission.teacher_comment ?? undefined,
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
