import type { Correction } from "@/lib/types";
import { formatBandScore } from "@/lib/grading/feedback-resolvers";

// formatBandScore() trả về "" khi điểm bị thiếu (undefined/null/NaN) — trong file .doc,
// 1 ô trống trắng xóa trông giống lỗi "mất điểm" hơn là "chưa có dữ liệu". Bọc thêm dấu
// gạch ngang để giáo viên luôn thấy RÕ RÀNG có ô điểm ở đó, chỉ là chưa có giá trị.
export function showBand(score: unknown): string {
  const formatted = formatBandScore(score);
  return formatted.trim() ? formatted : "—";
}

export function escapeHtml(value?: string) {
  return (value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// In đậm các cụm **...** giống UI (renderInline trong ExaminerSummaryCard.tsx) — nhận
// xét từ AI luôn ở dạng markdown thô (### tiêu đề, **in đậm**, - gạch đầu dòng), nếu in
// nguyên văn vào file .doc thì các ký tự ###/** sẽ hiện lù lù thay vì được định dạng.
export function renderInlineHtml(text: string): string {
  return escapeHtml(text).replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
}

// Bản HTML tĩnh của renderHighlightedAnswer (lib/teacher/submission-utils.tsx) — cùng thuật
// toán tìm vị trí "original" trong text (khớp chính xác, fallback không phân biệt hoa/thường,
// bỏ overlap), nhưng xuất ra <span> tô vàng có gạch chân thay vì <button> bấm được (Word
// không cần tương tác).
export function highlightAnswerHtml(text: string, corrections: Correction[]): string {
  if (!text) return "";
  if (!corrections || corrections.length === 0) return escapeHtml(text);

  type Match = { start: number; end: number };
  const matches: Match[] = [];
  for (const c of corrections) {
    if (!c?.original) continue;
    let idx = text.indexOf(c.original);
    if (idx === -1) idx = text.toLowerCase().indexOf(c.original.toLowerCase());
    if (idx === -1) continue;
    matches.push({ start: idx, end: idx + c.original.length });
  }
  if (matches.length === 0) return escapeHtml(text);

  matches.sort((a, b) => a.start - b.start);
  const filtered: Match[] = [];
  let lastEnd = -1;
  for (const m of matches) {
    if (m.start >= lastEnd) {
      filtered.push(m);
      lastEnd = m.end;
    }
  }

  let html = "";
  let cursor = 0;
  filtered.forEach((m) => {
    if (m.start > cursor) html += escapeHtml(text.slice(cursor, m.start));
    html += `<span style="background:#fde68a;text-decoration:underline;text-decoration-color:#f59e0b;text-underline-offset:2px;border-radius:2px;padding:0 1px;">${escapeHtml(
      text.slice(m.start, m.end),
    )}</span>`;
    cursor = m.end;
  });
  if (cursor < text.length) html += escapeHtml(text.slice(cursor));
  return html;
}

// Icon (emoji) tương ứng với icon lucide-react dùng trên UI (ExaminerSummaryCard) —
// Word không render được SVG lucide nên dùng emoji để giữ cảm giác trực quan.
export function criterionEmoji(label: string) {
  if (/Task Achievement|Task Response/i.test(label)) return "🎯";
  if (/Coherence/i.test(label)) return "🔗";
  if (/Lexical/i.test(label)) return "📖";
  return "✍️";
}

export function diagnosisStyle(label: string | null): { emoji: string; bg: string; border: string; color: string } {
  if (label && /Lỗi chí mạng/i.test(label)) return { emoji: "⚠️", bg: "#fef2f2", border: "#fecaca", color: "#b91c1c" };
  if (label && /dịch thuật|L1/i.test(label)) return { emoji: "🌐", bg: "#fffbeb", border: "#fde68a", color: "#b45309" };
  if (label && /Điểm sáng/i.test(label)) return { emoji: "⭐", bg: "#ecfdf5", border: "#a7f3d0", color: "#047857" };
  return { emoji: "💡", bg: "#ecfeff", border: "#a5f3fc", color: "#0e7490" };
}
