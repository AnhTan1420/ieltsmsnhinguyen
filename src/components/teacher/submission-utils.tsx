// Các hằng số + hàm hỗ trợ hiển thị dùng chung giữa SubmissionList,
// SubmissionDetail và GradingResultPanel.

import type { Correction, AdvancedStructure, EssayUpgrade } from "@/lib/types";

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

export type { Correction, AdvancedStructure, EssayUpgrade };

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

/**
 * Hiện "vừa xong" / "X giây trước" / "X phút trước" so với mốc `now` truyền vào
 * (thường lấy từ hook useNow() để tự nhảy số mỗi giây). Dùng cho nhãn cạnh
 * badge LIVE để giáo viên thấy dữ liệu đang thật sự chảy về theo thời gian thực.
 */
export function formatRelativeTime(iso: string | number | null | undefined, now: number): string {
  if (!iso) return "";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const diffSeconds = Math.max(0, Math.floor((now - then) / 1000));
  if (diffSeconds < 5) return "vừa xong";
  if (diffSeconds < 60) return `${diffSeconds} giây trước`;
  const diffMinutes = Math.floor(diffSeconds / 60);
  if (diffMinutes < 60) return `${diffMinutes} phút trước`;
  const diffHours = Math.floor(diffMinutes / 60);
  return `${diffHours} giờ trước`;
}

/** Đếm số từ đơn giản (tách theo khoảng trắng), dùng cho khối "Thống kê từ" */
export function countWords(text?: string | null): number {
  if (!text) return 0;
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).filter(Boolean).length;
}

/** Đếm số correction có "original" xuất hiện trong đoạn text cho trước — dùng để tách thống kê lỗi theo từng Task */
export function countMatchedCorrections(text: string | undefined | null, corrections: { original: string }[]): number {
  if (!text || !corrections || corrections.length === 0) return 0;
  let count = 0;
  for (const c of corrections) {
    if (!c?.original) continue;
    let idx = text.indexOf(c.original);
    if (idx === -1) idx = text.toLowerCase().indexOf(c.original.toLowerCase());
    if (idx !== -1) count++;
  }
  return count;
}

// Một mục có thể tô sáng trong bài làm gốc — 3 loại, mỗi loại 1 màu:
// - "correction": lỗi sai (vàng) — dữ liệu lấy từ mảng "corrections"
// - "upgrade": câu đã đúng được viết lại hay hơn (xanh dương) — từ "essay_upgrades"
// - "structure": câu gợi ý áp dụng cấu trúc nâng cao (xanh lá) — từ "advanced_structures"
// Dùng union thay vì union theo field riêng để 1 hàm render/1 state "active"
// xử lý được cả 3 loại, tránh lặp code cho từng loại.
export type HighlightItem =
  | { kind: "correction"; data: Correction }
  | { kind: "upgrade"; data: EssayUpgrade }
  | { kind: "structure"; data: AdvancedStructure };

function getHighlightOriginalText(item: HighlightItem): string | undefined {
  if (item.kind === "correction") return item.data.original;
  if (item.kind === "upgrade") return item.data.original;
  return item.data.original_sentence;
}

const HIGHLIGHT_KIND_STYLE: Record<HighlightItem["kind"], string> = {
  correction: "bg-amber-200/70 decoration-amber-500 hover:bg-amber-300/80",
  upgrade: "bg-sky-200/70 decoration-sky-500 hover:bg-sky-300/80",
  structure: "bg-emerald-200/70 decoration-emerald-500 hover:bg-emerald-300/80",
};

// Khi 1 vùng text được từ 2+ loại cùng trỏ tới (chồng lấn nhau) — vd một câu
// vừa là gợi ý nâng cấp cấu trúc, vừa là câu viết lại hay hơn — dùng màu tím
// riêng để báo hiệu "ở đây có nhiều phản hồi", thay vì chỉ hiện 1 loại và
// âm thầm giấu mất (những) loại còn lại.
const MIXED_HIGHLIGHT_STYLE = "bg-violet-200/70 decoration-violet-500 hover:bg-violet-300/80";

// Thứ tự ưu tiên khi cần chọn MỘT nhãn đại diện hiển thị cho cụm (chỉ dùng để
// đặt tooltip, không dùng để loại bỏ item nào — mọi item trong cụm đều được
// giữ lại và hiện đủ khi bấm vào).
const HIGHLIGHT_KIND_LABEL: Record<HighlightItem["kind"], string> = {
  correction: "lỗi sai",
  upgrade: "câu viết lại hay hơn",
  structure: "gợi ý cấu trúc nâng cao",
};

export type HighlightCluster = { start: number; end: number; items: HighlightItem[] };

/**
 * Tô sáng các đoạn liên quan (lỗi sai/nâng cấp câu/gợi ý cấu trúc) ngay trong
 * bài làm gốc. Với mỗi item, tìm vị trí câu gốc xuất hiện trong text (khớp
 * chính xác, fallback không phân biệt hoa/thường). Các item có vị trí chồng
 * lấn nhau (dù không hoàn toàn trùng khít) được GỘP thành 1 cụm (cluster) —
 * vùng tô sáng là hợp của mọi khoảng chồng lấn, và bấm vào sẽ trả về TOÀN BỘ
 * các item trong cụm đó cho onSelect, không bỏ sót item nào như trước.
 * Cụm chỉ có 1 loại dùng đúng màu của loại đó; cụm có từ 2 loại trở lên dùng
 * màu tím để báo hiệu "còn nhiều phản hồi khác ở đây". Cụm đang được chọn
 * (so khớp theo activeClusterStart) đổi sang màu xanh cyan.
 */
export function renderHighlightedAnswer(
  text: string,
  items: HighlightItem[],
  activeClusterStart: number | null,
  onSelect: (cluster: HighlightCluster) => void,
) {
  if (!text) return text;
  if (!items || items.length === 0) return text;

  type Match = { start: number; end: number; item: HighlightItem };
  const matches: Match[] = [];

  for (const item of items) {
    const original = getHighlightOriginalText(item);
    if (!original) continue;
    let idx = text.indexOf(original);
    if (idx === -1) {
      idx = text.toLowerCase().indexOf(original.toLowerCase());
    }
    if (idx === -1) continue;
    matches.push({ start: idx, end: idx + original.length, item });
  }

  if (matches.length === 0) return text;

  // Sắp xếp theo vị trí bắt đầu rồi gộp các match có khoảng chồng lấn nhau
  // thành từng cụm — khác với trước đây (loại bỏ match đến sau), giờ MỌI
  // match đều được giữ lại, chỉ gộp chung vùng hiển thị khi bị chồng lấn.
  matches.sort((a, b) => a.start - b.start);
  const clusters: HighlightCluster[] = [];
  for (const m of matches) {
    const last = clusters[clusters.length - 1];
    if (last && m.start < last.end) {
      last.end = Math.max(last.end, m.end);
      last.items.push(m.item);
    } else {
      clusters.push({ start: m.start, end: m.end, items: [m.item] });
    }
  }

  const nodes: any[] = [];
  let cursor = 0;
  clusters.forEach((cluster, i) => {
    if (cluster.start > cursor) nodes.push(text.slice(cursor, cluster.start));
    const isActive = activeClusterStart === cluster.start;
    const kinds = new Set(cluster.items.map((it) => it.kind));
    const style = kinds.size > 1 ? MIXED_HIGHLIGHT_STYLE : HIGHLIGHT_KIND_STYLE[cluster.items[0].kind];
    const title =
      cluster.items.length > 1
        ? `${cluster.items.length} phản hồi ở đây — bấm để xem tất cả`
        : `Bấm để xem chi tiết (${HIGHLIGHT_KIND_LABEL[cluster.items[0].kind]})`;
    nodes.push(
      <button
        key={i}
        type="button"
        onClick={() => onSelect(cluster)}
        title={title}
        className={`inline whitespace-normal text-left border-0 appearance-none p-0 m-0 [font:inherit] text-inherit align-baseline rounded-sm px-0.5 cursor-pointer underline decoration-2 underline-offset-2 transition-colors ${
          isActive ? "bg-cyan-300/80 decoration-cyan-600 ring-2 ring-cyan-500" : style
        }`}
      >
        {text.slice(cluster.start, cluster.end)}
        {cluster.items.length > 1 && <sup className="ml-0.5 font-bold not-italic">{cluster.items.length}</sup>}
      </button>,
    );
    cursor = cluster.end;
  });
  if (cursor < text.length) nodes.push(text.slice(cursor));

  return nodes;
}