import type { GradingFeedback } from "@/lib/types";
import type { TaskType } from "./prompt";

// ─────────────────────────────────────────────────────────────
// Parse phản hồi thô (raw content) của học sinh — tách Task 1 / Task 2
// ─────────────────────────────────────────────────────────────

/**
 * Chuẩn hoá xuống dòng trong bài làm học sinh trước khi hiển thị/export.
 *
 * Vấn đề: UI (và file .doc export) dùng `white-space: pre-wrap`, nên MỌI ký tự
 * \n trong content thô đều lộ ra thành 1 dòng mới — kể cả những chỗ học sinh
 * chỉ lỡ tay Enter giữa câu (rất hay gặp khi gõ trong textarea, đặc biệt trên
 * điện thoại), khiến câu văn bị cắt ngang giữa chừng dù không hề có ý tách
 * đoạn ở đó (ví dụ ảnh chụp màn hình học sinh gửi: "...in cities. While" xuống
 * dòng rồi mới tới "rural areas provide...").
 *
 * Một đoạn văn MỚI chỉ được coi là bắt đầu khi:
 *  (1) có dòng trống ở giữa (2+ dấu \n liền nhau), hoặc
 *  (2) dòng tiếp theo có thụt đầu dòng (tab/nhiều khoảng trắng) — quy ước
 *      nhiều học sinh vẫn dùng để đánh dấu đoạn mới, giống bài trong ảnh có
 *      dòng "    In the countryside,...".
 * Mọi dấu \n đơn còn lại (không khớp 2 điều kiện trên) được coi là ngắt dòng
 * "mềm" không chủ ý, gộp lại thành khoảng trắng để câu liền mạch trở lại.
 */
function normalizeParagraphBreaks(text: string): string {
  if (!text) return text;

  const PARA_MARKER = "\u0000PARA\u0000";
  const withMarkers = text.replace(/\n{2,}/g, PARA_MARKER).replace(/\n(?=[ \t]+\S)/g, PARA_MARKER);

  return withMarkers
    .split(PARA_MARKER)
    .map((paragraph) =>
      paragraph
        .replace(/[ \t]*\n[ \t]*/g, " ") // gộp \n đơn còn lại + khoảng trắng quanh nó thành 1 dấu cách
        .replace(/^[ \t]+/, "") // bỏ thụt đầu dòng gốc — để CSS/định dạng lo phần hiển thị, không lưu bằng khoảng trắng thô
        .trim(),
    )
    .filter(Boolean)
    .join("\n\n");
}

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

  const task1Answer = normalizeParagraphBreaks(extract("=== TASK 1 ===", ["=== TASK 2 ==="]));
  const task2Answer = normalizeParagraphBreaks(extract("=== TASK 2 ===", []));

  // Fallback cho bài làm cũ không có marker: coi toàn bộ nội dung là Task 2
  if (!task1Answer && !task2Answer && content.trim() && !content.includes("=== TASK")) {
    return { task1Answer: "", task2Answer: normalizeParagraphBreaks(content.trim()) };
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

function parseCriterionBand(x: any): number {
  const num = parseFloat(String(x));
  const validNum = isNaN(num) ? 1 : num;
  // Đúng chuẩn IELTS thật: giám khảo CHỈ cho band SỐ NGUYÊN (1-9) cho từng
  // tiêu chí riêng lẻ (TA/TR, CC, LR, GRA) — không có band lẻ .5 ở cấp độ
  // này. Band .5 chỉ xuất hiện ở band tổng của 1 task / overall band, vốn là
  // kết quả của việc lấy TRUNG BÌNH 4 số nguyên đó (xem toHalfBand ở dưới).
  // (Trước đây có 1 bản sửa nhầm dùng toHalfBand ở đây — đã revert.)
  return Math.round(Math.min(Math.max(validNum, 1), 9));
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

  /// 2. CHUẨN HOÁ TASK 1 (ép mỗi tiêu chí về số nguyên hợp lệ 1-9, đúng chuẩn IELTS)
  if (raw.task1) {
    const taScore = raw.task1.TA ?? (raw.task1 as any).TR ?? 1;
    raw.task1.TA = parseCriterionBand(taScore);
    raw.task1.CC = parseCriterionBand(raw.task1.CC ?? 1);
    raw.task1.LR = parseCriterionBand(raw.task1.LR ?? 1);
    raw.task1.GRA = parseCriterionBand(raw.task1.GRA ?? 1);

    const mean = (raw.task1.TA + raw.task1.CC + raw.task1.LR + raw.task1.GRA) / 4;
    raw.task1.band = toHalfBand(mean);
  }

  // 3. CHUẨN HOÁ TASK 2 (ép mỗi tiêu chí về số nguyên hợp lệ 1-9, đúng chuẩn IELTS)
  if (raw.task2) {
    const trScore = raw.task2.TR ?? (raw.task2 as any).TA ?? 1;
    raw.task2.TR = parseCriterionBand(trScore);
    raw.task2.CC = parseCriterionBand(raw.task2.CC ?? 1);
    raw.task2.LR = parseCriterionBand(raw.task2.LR ?? 1);
    raw.task2.GRA = parseCriterionBand(raw.task2.GRA ?? 1);

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

/**
 * Lỗi có nên fallback sang model/provider khác hay không
 * (rate limit / quota / quá tải / timeout / mất kết nối / JSON hỏng).
 *
 * QUAN TRỌNG — bug đã sửa: trước đây timeout/abort KHÔNG khớp bất kỳ điều
 * kiện nào bên dưới, nên khi 1 model bị CHẬM (chứ không phải lỗi hẳn), lỗi bị
 * throw thẳng ra ngoài thay vì thử model/provider kế tiếp trong chain — tức
 * là hỏng đúng cái tình huống mà toàn bộ model-chain (70b→8b, Flash→Flash-
 * Lite, Gemini→Groq) được dựng ra để chịu đựng. Đã verify trực tiếp trong
 * source của 2 SDK đang dùng:
 *  - groq-sdk: timeout (qua request option `{ timeout }`) ném
 *    APIConnectionTimeoutError với message CHÍNH XÁC "Request timed out."
 *  - @google/genai: timeout/abort (qua `httpOptions.timeout` hoặc
 *    abortSignal) khiến fetch nội bộ ném DOMException tên "AbortError".
 *
 * Cũng bổ sung 500/502/504/408 — đây chính là các mã mà bản thân
 * @google/genai coi là "retryable" ở tầng nội bộ (DEFAULT_RETRY_HTTP_STATUS_CODES
 * trong SDK). LƯU Ý: gradeWithGemini() giờ đã set `retryOptions: { attempts: 1 }`
 * trong httpOptions để TẮT hẳn retry nội bộ đó (xem comment ở provider.ts) —
 * nên các mã này giờ lọt ra ngay từ lần gọi ĐẦU TIÊN, không phải sau khi SDK
 * đã tự thử lại nhiều lần. Model-chain (Flash → Flash-Lite → Groq) đóng vai
 * trò "thử lại" thay, bằng cách nhảy sang model/provider khác — nhanh hơn và
 * hợp lý hơn retry mù quáng vào đúng chỗ vừa quá tải.
 */
export function isFallbackWorthyError(err: any): boolean {
  if (err instanceof JsonExtractionError) return true;

  const status = err?.status ?? err?.response?.status ?? err?.code;
  if ([429, 413, 503, 500, 502, 504, 408].includes(status)) return true;
  if (status === "RESOURCE_EXHAUSTED" || status === "UNAVAILABLE") return true;

  // Timeout/abort — xem giải thích đầy đủ ở JSDoc phía trên.
  if (err?.name === "AbortError") return true;

  const msg = String(err?.message ?? "").toLowerCase();
  return (
    msg.includes("rate_limit") ||
    msg.includes("quota") ||
    msg.includes("too large") ||
    msg.includes("overloaded") ||
    msg.includes("resource_exhausted") ||
    msg.includes("exceeded your current quota") ||
    msg.includes("timed out") ||
    msg.includes("timeout") ||
    msg.includes("aborted") ||
    msg.includes("econnreset") ||
    msg.includes("econnrefused") ||
    msg.includes("fetch failed")
  );
}