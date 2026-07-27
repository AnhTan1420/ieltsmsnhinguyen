// ─────────────────────────────────────────────────────────────
// Lọc các câu nhắc đến "Band X.X" mà con số KHÔNG khớp với bất kỳ tiêu chí
// nào đã thực sự được chấm (TA/TR, CC, LR, GRA) — vì model đôi khi tự mâu
// thuẫn, viết trong văn xuôi 1 con số band không khớp với điểm số nó vừa
// chấm ở field JSON (VD: chấm TA/CC/LR/GRA = 8,8,8,8 nhưng lại viết "đạt
// band 7.5" trong examiner_summary). Không thể sửa văn xuôi cho đúng số,
// nên an toàn nhất là loại bỏ hẳn câu chứa con số sai lệch.
// ─────────────────────────────────────────────────────────────

// Bắt các dạng: "band 7.5", "Band: 8.0+", "7.5 band", "band 8"
const BAND_MENTION_REGEXES = [
  /\bband\s*[:\-]?\s*(\d+(?:\.\d+)?)\s*\+?/gi,
  /\b(\d+(?:\.\d+)?)\s*\+?\s*band\b/gi,
];

function extractBandNumbers(text: string): number[] {
  const numbers: number[] = [];
  for (const regex of BAND_MENTION_REGEXES) {
    for (const match of text.matchAll(regex)) {
      const n = Number(match[1]);
      if (!Number.isNaN(n)) numbers.push(n);
    }
  }
  return numbers;
}

// Tách thành câu, giữ lại dấu câu kết thúc — an toàn với số thập phân
// (VD "7.5") vì dấu chấm trong số không theo sau bởi khoảng trắng.
function splitSentences(text: string): string[] {
  return text.split(/(?<=[.!?])\s+/g).filter((s) => s.trim().length > 0);
}

function bandMatchesAnyCriterion(band: number, validBands: number[]): boolean {
  return validBands.some((v) => Math.abs(v - band) < 0.01);
}

/**
 * Lọc bỏ những câu nhắc đến "Band X.X" với X không khớp bất kỳ tiêu chí nào
 * đã chấm (TA/TR, CC, LR, GRA). Câu không nhắc band nào thì luôn được giữ.
 * Nếu lọc xong mà rỗng hoàn toàn (hiếm), fallback: chỉ xoá riêng cụm "Band
 * X.X" sai thay vì xoá cả câu, để tránh mất trắng nội dung.
 */
export function sanitizeBandMentions(text: string, validBands: number[]): string {
  if (!text || validBands.length === 0) return text;

  const sentences = splitSentences(text);
  const kept = sentences.filter((sentence) => {
    const bands = extractBandNumbers(sentence);
    if (bands.length === 0) return true;
    return bands.every((b) => bandMatchesAnyCriterion(b, validBands));
  });

  const result = kept.join(" ").trim();
  if (result) return result;

  // Fallback: mọi câu đều bị loại (hiếm) — chỉ xoá cụm "Band X.X" sai, giữ phần còn lại
  let fallback = text;
  for (const regex of BAND_MENTION_REGEXES) {
    fallback = fallback.replace(regex, (match, num) => {
      const n = Number(num);
      return bandMatchesAnyCriterion(n, validBands) ? match : "";
    });
  }
  return fallback.replace(/\s{2,}/g, " ").trim();
}