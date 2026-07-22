import type { GradingFeedback } from "@/lib/types";
import type { TaskType } from "./prompt";

// ─────────────────────────────────────────────────────────────
// Parse phản hồi thô (raw content) của học sinh — tách Task 1 / Task 2
// ─────────────────────────────────────────────────────────────

/**
 * Tách nội dung bài làm thô (chứa === THÔNG TIN HỌC SINH ===, === TASK 1 ===, === TASK 2 ===)
 * thành 2 phần: bài làm Task 1 và bài làm Task 2, bỏ hẳn khối thông tin học sinh khỏi hiển thị.
 */
export function parseSubmissionContent(raw: string | null | undefined) {
  const content = raw ?? "";

  const extract = (marker: string, nextMarkers: string[]) => {
    const startIdx = content.indexOf(marker);
    if (startIdx === -1) return "";
    const afterMarker = startIdx + marker.length;
    let endIdx = content.length;
    for (const next of nextMarkers) {
      const idx = content.indexOf(next, afterMarker);
      if (idx !== -1 && idx < endIdx) endIdx = idx;
    }
    return content.slice(afterMarker, endIdx).trim();
  };

  const task1Answer = extract("=== TASK 1 ===", ["=== TASK 2 ==="]);
  const task2Answer = extract("=== TASK 2 ===", []);

  // Fallback cho bài làm cũ không có marker: coi toàn bộ nội dung là Task 2
  if (!task1Answer && !task2Answer && content.trim() && !content.includes("=== TASK")) {
    return { task1Answer: "", task2Answer: content.trim() };
  }

  return { task1Answer, task2Answer };
}

// ─────────────────────────────────────────────────────────────
// Parse response JSON từ AI (Groq/Gemini) → GradingFeedback đã sanitize
// ─────────────────────────────────────────────────────────────

/** JSON không parse được sau mọi nỗ lực sửa — coi là lỗi "đáng thử model khác", không phải lỗi hệ thống */
export class JsonExtractionError extends Error { }

function toHalfBand(x: number): number {
  return Math.round(Math.min(Math.max(x, 1), 9) * 2) / 2;
}

/**
 * Sanitize AI output: Bọc thép các trường hợp AI nhầm lẫn TA/TR hoặc nhầm Object Task1/Task2
 */
function sanitizeBands(raw: GradingFeedback, taskType: TaskType): GradingFeedback {
  // BỔ SUNG: Bọc thép word_count đảm bảo luôn là SỐ NGUYÊN DƯƠNG
  if (raw.word_count !== undefined) {
    raw.word_count = Math.max(0, Math.round(Number(raw.word_count) || 0));
  }

  // 1. CHỐNG ẢO GIÁC: Đang chấm Task 1 nhưng AI lại nhét kết quả vào object `task2`
  if (taskType === "task1" && !raw.task1 && raw.task2) {
    raw.task1 = raw.task2 as any;
    raw.task2 = null;
  } else if (taskType === "task2" && !raw.task2 && raw.task1) {
    raw.task2 = raw.task1 as any;
    raw.task1 = null;
  }

  // 2. CHUẨN HOÁ TASK 1 (giữ half-band 0.5, không ép về số nguyên)
  if (raw.task1) {
    const taScore = raw.task1.TA ?? (raw.task1 as any).TR ?? 1;
    raw.task1.TA = toHalfBand(taScore);
    raw.task1.CC = toHalfBand(raw.task1.CC ?? 1);
    raw.task1.LR = toHalfBand(raw.task1.LR ?? 1);
    raw.task1.GRA = toHalfBand(raw.task1.GRA ?? 1);

    const mean = (raw.task1.TA + raw.task1.CC + raw.task1.LR + raw.task1.GRA) / 4;
    raw.task1.band = toHalfBand(mean);
  }

  // 3. CHUẨN HOÁ TASK 2
  if (raw.task2) {
    const trScore = raw.task2.TR ?? (raw.task2 as any).TA ?? 1;
    raw.task2.TR = toHalfBand(trScore);
    raw.task2.CC = toHalfBand(raw.task2.CC ?? 1);
    raw.task2.LR = toHalfBand(raw.task2.LR ?? 1);
    raw.task2.GRA = toHalfBand(raw.task2.GRA ?? 1);

    const mean = (raw.task2.TR + raw.task2.CC + raw.task2.LR + raw.task2.GRA) / 4;
    raw.task2.band = toHalfBand(mean);
  }

  // 4. TÍNH TOÁN LẠI OVERALL BAND
  // (nhánh task1 && task2 hiện chưa xảy ra vì bước 1 luôn ép về đúng 1 object theo taskType đang chấm;
  //  giữ lại để tương thích nếu sau này hỗ trợ chấm gộp cả 2 task trong 1 lần gọi)
  if (raw.task1 && raw.task2) {
    raw.overall_band = toHalfBand((raw.task1.band + raw.task2.band * 2) / 3);
  } else if (raw.task1) {
    raw.overall_band = raw.task1.band;
  } else if (raw.task2) {
    raw.overall_band = raw.task2.band;
  }

  return raw;
}

/** Pull the JSON block out of the model response and parse it safely */
export function extractJson(raw: string, taskType: TaskType): GradingFeedback {
  // 1. Dọn dẹp markdown fence nếu model lỡ thêm vào
  let jsonString = raw.replace(/```json/gi, "").replace(/```/g, "").trim();

  // 2. Tìm vị trí bắt đầu và kết thúc của JSON
  const start = jsonString.indexOf("{");
  const end = jsonString.lastIndexOf("}");

  if (start === -1 || end === -1 || end < start) {
    throw new JsonExtractionError("Không tìm thấy cấu trúc JSON hợp lệ trong phản hồi AI.");
  }

  jsonString = jsonString.slice(start, end + 1);

  // 3. Thử parse trực tiếp trước — đây là đường đi bình thường khi model trả JSON hợp lệ
  try {
    return sanitizeBands(JSON.parse(jsonString) as GradingFeedback, taskType);
  } catch {
    // 4. Fallback: chỉ số ít trường hợp model chèn ký tự điều khiển CHƯA escape
    // (newline/tab thật nằm trong string JSON) mới rơi vào đây.
    // Escape đúng các ký tự đó thay vì xoá hoặc double-escape các \n đã hợp lệ.
    const repaired = jsonString.replace(/[\u0000-\u001F]/g, (ch) => {
      switch (ch) {
        case "\n":
          return "\\n";
        case "\r":
          return "\\r";
        case "\t":
          return "\\t";
        default:
          return ""; // ký tự điều khiển lạ khác — loại bỏ an toàn
      }
    });

    try {
      return sanitizeBands(JSON.parse(repaired) as GradingFeedback, taskType);
    } catch (finalErr) {
      throw new JsonExtractionError(
        `AI trả về JSON không hợp lệ và không thể tự sửa: ${(finalErr as Error).message}`,
      );
    }
  }
}

/** Lỗi có nên fallback sang model/provider khác hay không (rate limit/quota/quá tải/JSON hỏng) */
export function isFallbackWorthyError(err: any): boolean {
  if (err instanceof JsonExtractionError) return true;

  const status = err?.status ?? err?.response?.status ?? err?.code;
  if (status === 429 || status === 413 || status === 503) return true;
  if (status === "RESOURCE_EXHAUSTED" || status === "UNAVAILABLE") return true;

  const msg = String(err?.message ?? "").toLowerCase();
  return (
    msg.includes("rate_limit") ||
    msg.includes("quota") ||
    msg.includes("too large") ||
    msg.includes("overloaded") ||
    msg.includes("resource_exhausted") ||
    msg.includes("exceeded your current quota")
  );
}
