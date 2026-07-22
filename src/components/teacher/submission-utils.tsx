// Các hằng số + hàm hỗ trợ hiển thị dùng chung giữa SubmissionList,
// SubmissionDetail và GradingResultPanel.

export const statusStyles: Record<string, string> = {
  in_progress: "bg-blue-50 text-blue-700 border-blue-200",
  completed: "bg-emerald-50 text-emerald-700 border-emerald-200",
  disqualified: "bg-red-50 text-red-700 border-red-200",
};

export const statusLabels: Record<string, string> = {
  in_progress: "Đang làm bài",
  completed: "Đã nộp",
  disqualified: "Hủy bài làm",
};

export type Correction = { original: string; corrected: string; explanation: string };

/** Định dạng thời điểm nộp bài kiểu "HH:mm dd/MM/yyyy" (giờ địa phương trình duyệt) */
export function formatDateTime(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${pad(d.getHours())}:${pad(d.getMinutes())} ${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
}

/** Tính + định dạng thời gian học sinh đã làm bài = submitted_at (hoặc mốc hiện tại nếu đang làm) - started_at */
export function formatDuration(startedAt?: string | null, endedAt?: string | null): string {
  if (!startedAt) return "—";
  const start = new Date(startedAt).getTime();
  const end = endedAt ? new Date(endedAt).getTime() : Date.now();
  if (Number.isNaN(start) || Number.isNaN(end) || end < start) return "—";

  const totalSeconds = Math.floor((end - start) / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) return `${hours}h ${minutes}p ${seconds}s`;
  if (minutes > 0) return `${minutes} phút ${seconds}s`;
  return `${seconds} giây`;
}

/** Đếm số từ đơn giản (tách theo khoảng trắng), dùng cho khối "Thống kê từ" */
export function countWords(text?: string | null): number {
  if (!text) return 0;
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).filter(Boolean).length;
}

/** Đếm số correction có "original" xuất hiện trong đoạn text cho trước — dùng để tách thống kê lỗi theo từng Task */
function escapeRegExp(string: string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildFlexWhitespaceRegex(original: string) {
  const escaped = escapeRegExp(original.trim());
  // Bất kỳ chuỗi khoảng trắng nào trong original đều có thể khớp với chuỗi khoảng trắng trong text
  const pattern = escaped.replace(/\\s+/g, "\\s+").replace(/\s+/g, "\\s+");
  return new RegExp(pattern, "i");
}

export function countMatchedCorrections(text: string | undefined | null, corrections: { original: string }[]): number {
  if (!text || !corrections || corrections.length === 0) return 0;
  let count = 0;
  for (const c of corrections) {
    if (!c?.original) continue;
    
    // Check exact first
    let idx = text.indexOf(c.original);
    if (idx === -1) idx = text.toLowerCase().indexOf(c.original.toLowerCase());
    
    if (idx !== -1) {
      count++;
    } else {
      // Fallback: regex search
      const regex = buildFlexWhitespaceRegex(c.original);
      if (regex.test(text)) {
        count++;
      }
    }
  }
  return count;
}

/**
 * Tô sáng các đoạn bị AI sửa ngay trong bài làm gốc. Với mỗi correction, tìm vị trí
 * "original" xuất hiện trong text (khớp chính xác, fallback không phân biệt hoa/thường),
 * bỏ qua các correction không tìm thấy hoặc bị chồng lấn vị trí với correction trước đó.
 * Bấm vào đoạn tô vàng sẽ gọi onSelect để hiện chi tiết ở panel "Chi tiết phản hồi" bên cạnh.
 * Đoạn đang được chọn (activeCorrection) sẽ đổi sang màu xanh cyan để phân biệt.
 */
export function renderHighlightedAnswer(
  text: string,
  corrections: Correction[],
  activeCorrection: Correction | null,
  onSelect: (correction: Correction) => void,
) {
  if (!text) return text;
  if (!corrections || corrections.length === 0) return text;

  type Match = { start: number; end: number; correction: Correction };
  const matches: Match[] = [];

  for (const correction of corrections) {
    if (!correction?.original) continue;
    
    // Tìm chính xác trước
    let idx = text.indexOf(correction.original);
    if (idx === -1) {
      idx = text.toLowerCase().indexOf(correction.original.toLowerCase());
    }
    
    if (idx !== -1) {
      matches.push({ start: idx, end: idx + correction.original.length, correction });
    } else {
      // Nếu không tìm thấy, dùng regex linh hoạt 
      const regex = buildFlexWhitespaceRegex(correction.original);
      const match = text.match(regex);
      if (match && match.index !== undefined) {
        matches.push({
          start: match.index,
          end: match.index + match[0].length,
          correction
        });
      }
    }
  }

  if (matches.length === 0) return text;

  // Sắp xếp theo vị trí xuất hiện, loại bỏ các match bị chồng lấn
  matches.sort((a, b) => a.start - b.start);
  const filtered: Match[] = [];
  let lastEnd = -1;
  for (const m of matches) {
    if (m.start >= lastEnd) {
      filtered.push(m);
      lastEnd = m.end;
    }
  }

  const nodes: any[] = [];
  let cursor = 0;
  filtered.forEach((m, i) => {
    if (m.start > cursor) nodes.push(text.slice(cursor, m.start));
    const isActive = activeCorrection === m.correction;
    nodes.push(
      <button
        key={i}
        type="button"
        onClick={() => onSelect(m.correction)}
        title="Bấm để xem chi tiết đề xuất sửa"
        className={`inline whitespace-normal text-left border-0 appearance-none p-0 m-0 [font:inherit] text-inherit align-baseline rounded-sm px-0.5 cursor-pointer underline decoration-2 underline-offset-2 transition-colors ${
          isActive
            ? "bg-cyan-300/80 decoration-cyan-600 ring-2 ring-cyan-500"
            : "bg-amber-200/70 decoration-amber-500 hover:bg-amber-300/80"
        }`}
      >
        {text.slice(m.start, m.end)}
      </button>,
    );
    cursor = m.end;
  });
  if (cursor < text.length) nodes.push(text.slice(cursor));

  return nodes;
}