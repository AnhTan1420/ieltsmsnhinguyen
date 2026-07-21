import JSZip from "jszip";
import { parseSubmissionContent } from "@/lib/grading/parse";
import type { SubmissionRow } from "@/lib/types";

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

  html += `<h3 style="color:#0f172a;border-left:4px solid #06b6d4;padding-left:10px;margin-top:24px;">TASK 1</h3>`;
  if (sections.task1Prompt) {
    html += `<div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:12px;margin-bottom:10px;">
      <p style="margin:0 0 4px 0;font-size:10pt;font-weight:bold;color:#64748b;text-transform:uppercase;">Đề bài</p>
      <p style="margin:0;white-space:pre-wrap;font-size:11pt;">${escapeHtml(sections.task1Prompt)}</p>
    </div>`;
  }
  if (sections.task1ImageUrl) {
    const widthAttr = sections.task1ImageWidth ? ` width="${sections.task1ImageWidth}"` : "";
    const heightAttr = sections.task1ImageHeight ? ` height="${sections.task1ImageHeight}"` : "";
    // Nếu đã có width/height cụ thể (đo từ ảnh thật) thì không cần max-width/max-height CSS nữa —
    // Word không tin cậy CSS khi convert .doc nên ưu tiên thuộc tính HTML width/height.
    const sizeStyle = sections.task1ImageWidth ? "" : "max-width:500px;max-height:350px;";
    html += `<div style="text-align:center;margin-bottom:10px;">
      <img src="${sections.task1ImageUrl}"${widthAttr}${heightAttr} style="${sizeStyle}border:1px solid #e2e8f0;border-radius:8px;" />
    </div>`;
  }
  html += `<div style="margin-bottom:10px;">
    <p style="margin:0 0 4px 0;font-size:10pt;font-weight:bold;color:#64748b;text-transform:uppercase;">Bài làm học sinh</p>
    <p style="white-space:pre-wrap;font-size:11pt;line-height:1.8;">${sections.task1Answer ? escapeHtml(sections.task1Answer) : "<i>Học sinh chưa làm Task 1</i>"}</p>
  </div>`;

  html += `<h3 style="color:#0f172a;border-left:4px solid #06b6d4;padding-left:10px;margin-top:24px;">TASK 2</h3>`;
  if (sections.task2Prompt) {
    html += `<div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:12px;margin-bottom:10px;">
      <p style="margin:0 0 4px 0;font-size:10pt;font-weight:bold;color:#64748b;text-transform:uppercase;">Đề bài</p>
      <p style="margin:0;white-space:pre-wrap;font-size:11pt;">${escapeHtml(sections.task2Prompt)}</p>
    </div>`;
  }
  html += `<div style="margin-bottom:10px;">
    <p style="margin:0 0 4px 0;font-size:10pt;font-weight:bold;color:#64748b;text-transform:uppercase;">Bài làm học sinh</p>
    <p style="white-space:pre-wrap;font-size:11pt;line-height:1.8;">${sections.task2Answer ? escapeHtml(sections.task2Answer) : "<i>Học sinh chưa làm Task 2</i>"}</p>
  </div>`;

  return html;
}

// Dựng toàn bộ nội dung HTML (dạng .doc) cho MỘT bài làm — dùng chung cho nút
// "Xuất File DOC" (tải lẻ) VÀ tính năng "Tải tất cả / Tải đã chọn" (zip)
function buildFullDocHtml(studentName: string, sections: ExportSections, feedback?: any): string {
  const header =
    "<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'><head><meta charset='utf-8'><title>Export HTML To Doc</title><style>body { font-family: 'Times New Roman', serif; line-height: 1.6; color: #1e293b; } .feedback-box { background: #f0fdfa; border: 1px solid #ccfbf1; padding: 15px; border-radius: 8px; margin-top: 20px; } .correction { background: #fff; border: 1px solid #e2e8f0; padding: 10px; margin-bottom: 10px; border-radius: 4px; } .wrong { color: #ef4444; text-decoration: line-through; white-space: pre-wrap; } .right { color: #10b981; font-weight: bold; white-space: pre-wrap; } .reason { color: #64748b; font-size: 0.9em; }</style></head><body>";
  const footer = "</body></html>";

  let sourceHTML = `<h2 style="text-align:center; color: #0f172a; border-bottom: 2px solid #e2e8f0; padding-bottom: 10px;">Bài làm của ${escapeHtml(studentName)}</h2>`;
  sourceHTML += buildTaskSectionsHtml(sections);

  if (sections.teacherComment && sections.teacherComment.trim()) {
    sourceHTML += `<div style="background:#ecfdf5;border:1px solid #a7f3d0;border-radius:8px;padding:15px;margin-top:24px;">
      <h3 style="color:#059669;margin-top:0;">Nhận xét bổ sung của giáo viên</h3>
      <p style="white-space:pre-wrap;font-size:11pt;">${escapeHtml(sections.teacherComment)}</p>
    </div>`;
  }

  if (feedback) {
    sourceHTML += `<div class="feedback-box">`;
    sourceHTML += `<h3 style="color: #0d9488; margin-top: 0;">Kết quả chấm - Overall Band: ${feedback.overall_band}</h3>`;
    sourceHTML += `<p><strong>Nhận xét tổng quan:</strong> ${feedback.examiner_summary}</p>`;

    if (feedback.corrections && feedback.corrections.length > 0) {
      sourceHTML += `<h4 style="color: #0f172a;">Chi tiết sửa lỗi:</h4>`;
      feedback.corrections.forEach((c: any) => {
        sourceHTML += `<div class="correction">`;
        sourceHTML += `<div class="wrong">❌ ${c.original}</div>`;
        sourceHTML += `<div class="right">✅ ${c.corrected}</div>`;
        sourceHTML += `<div class="reason">💡 Lời khuyên: ${c.explanation}</div>`;
        sourceHTML += `</div>`;
      });
    }
    sourceHTML += `</div>`;
  }

  return header + sourceHTML + footer;
}

// Export File DOC đầy đủ — đề bài, ảnh Task 1, bài làm từng Task, nhận xét giáo viên và Feedback AI nếu có.
// Chuyển ảnh Task 1 sang base64 trước khi build HTML để ảnh luôn hiển thị được khi mở bằng Word.
export async function downloadSubmissionDoc(studentName: string, sections: ExportSections, feedback?: any) {
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
