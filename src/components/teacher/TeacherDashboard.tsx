"use client";

import { useEffect, useMemo, useState } from "react";
import JSZip from "jszip";
import {
  AlertTriangle,
  Bot,
  Clock,
  FileCheck2,
  FileDown,
  ShieldAlert,
  Users,
  Plus,
  Edit3,
  Copy,
  Check,
  BookOpen,
  Trash2,
  UploadCloud,
  Image as ImageIcon,
  Radio,
  Loader2,
  Sparkles,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  LogOut,
  Download,
  CheckSquare,
  Square,
  Archive,
  X,
  Type,
  Lightbulb,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import type { SubmissionRow, TestRow } from "@/lib/types";
import { useRouter } from "next/navigation";

const statusStyles: Record<string, string> = {
  in_progress: "bg-blue-50 text-blue-700 border-blue-200",
  completed: "bg-emerald-50 text-emerald-700 border-emerald-200",
  disqualified: "bg-red-50 text-red-700 border-red-200",
};

const statusLabels: Record<string, string> = {
  in_progress: "Đang làm bài",
  completed: "Đã nộp",
  disqualified: "Hủy bài làm",
};

// Các bước hiển thị trong modal "Đang chấm điểm bài viết" — chỉ mô phỏng tiến trình
// ở phía client (backend không stream tiến độ thật), dừng lại ở bước cuối chờ kết quả thật.
const GRADING_STEPS = [
  "Phân tích ngữ pháp chuyên sâu",
  "Tối ưu từ vựng theo mục tiêu",
  "Đánh giá tính mạch lạc và chính xác của câu",
  "Chấm điểm overall",
  "Đối chiếu lại với các bài có band điểm tương tự",
];

// Tách nội dung bài làm thô (chứa === THÔNG TIN HỌC SINH ===, === TASK 1 ===, === TASK 2 ===)
// thành 2 phần: bài làm Task 1 và bài làm Task 2, bỏ hẳn khối thông tin học sinh khỏi hiển thị.
function parseSubmissionContent(raw: string | null | undefined) {
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

/** Đếm số từ đơn giản (tách theo khoảng trắng), dùng cho khối "Thống kê từ" */
function countWords(text?: string | null): number {
  if (!text) return 0;
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).filter(Boolean).length;
}

/** Đếm số correction có "original" xuất hiện trong đoạn text cho trước — dùng để tách thống kê lỗi theo từng Task */
function countMatchedCorrections(text: string | undefined | null, corrections: { original: string }[]): number {
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

type Correction = { original: string; corrected: string; explanation: string };

/**
 * Tô sáng các đoạn bị AI sửa ngay trong bài làm gốc. Với mỗi correction, tìm vị trí
 * "original" xuất hiện trong text (khớp chính xác, fallback không phân biệt hoa/thường),
 * bỏ qua các correction không tìm thấy hoặc bị chồng lấn vị trí với correction trước đó.
 * Bấm vào đoạn tô vàng sẽ gọi onSelect để hiện chi tiết ở panel "Chi tiết phản hồi" bên cạnh.
 * Đoạn đang được chọn (activeCorrection) sẽ đổi sang màu xanh cyan để phân biệt.
 */
function renderHighlightedAnswer(
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
    let idx = text.indexOf(correction.original);
    if (idx === -1) {
      idx = text.toLowerCase().indexOf(correction.original.toLowerCase());
    }
    if (idx === -1) continue;
    matches.push({ start: idx, end: idx + correction.original.length, correction });
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
        className={`inline whitespace-normal border-0 appearance-none p-0 m-0 [font:inherit] text-inherit align-baseline rounded-sm px-0.5 cursor-pointer underline decoration-2 underline-offset-2 transition-colors ${
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

/** Trả về bản sao sections với task1ImageUrl đã chuyển sang base64 (nếu tải được), giữ nguyên URL cũ nếu lỗi.
 * cache (tuỳ chọn) giúp tránh tải lại cùng 1 ảnh nhiều lần khi export hàng loạt (nhiều học sinh chung 1 đề thi). */
async function resolveSectionsImage(sections: ExportSections, cache?: Map<string, string>): Promise<ExportSections> {
  if (!sections.task1ImageUrl) return sections;
  const url = sections.task1ImageUrl;

  const cached = cache?.get(url);
  if (cached) return { ...sections, task1ImageUrl: cached };

  const base64 = await imageUrlToBase64(url);
  if (!base64) return sections;

  cache?.set(url, base64);
  return { ...sections, task1ImageUrl: base64 };
}

type ExportSections = {
  task1Prompt?: string;
  task1ImageUrl?: string | null;
  task1Answer?: string;
  task2Prompt?: string;
  task2Answer?: string;
  teacherComment?: string;
};

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
    html += `<div style="text-align:center;margin-bottom:10px;">
      <img src="${sections.task1ImageUrl}" style="max-width:500px;max-height:350px;border:1px solid #e2e8f0;border-radius:8px;" />
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
    "<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'><head><meta charset='utf-8'><title>Export HTML To Doc</title><style>body { font-family: 'Times New Roman', serif; line-height: 1.6; color: #1e293b; } .feedback-box { background: #f0fdfa; border: 1px solid #ccfbf1; padding: 15px; border-radius: 8px; margin-top: 20px; } .correction { background: #fff; border: 1px solid #e2e8f0; padding: 10px; margin-bottom: 10px; border-radius: 4px; } .wrong { color: #ef4444; text-decoration: line-through; } .right { color: #10b981; font-weight: bold; } .reason { color: #64748b; font-size: 0.9em; }</style></head><body>";
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

// Nâng cấp: Export File DOC đầy đủ — đề bài, ảnh Task 1, bài làm từng Task, nhận xét giáo viên và Feedback AI nếu có.
// Chuyển ảnh Task 1 sang base64 trước khi build HTML để ảnh luôn hiển thị được khi mở bằng Word.
async function handleDownloadDoc(studentName: string, sections: ExportSections, feedback?: any) {
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

/** Tránh trùng tên file khi nhiều học sinh trùng tên trong cùng 1 lượt tải zip */
function makeUniqueFileName(base: string, used: Map<string, number>): string {
  const safeBase = base.replace(/\s+/g, "_").replace(/[\\/:*?"<>|]/g, "");
  const count = used.get(safeBase) ?? 0;
  used.set(safeBase, count + 1);
  return count === 0 ? `${safeBase}.doc` : `${safeBase}_${count + 1}.doc`;
}

export default function TeacherDashboard() {
  const [authChecked, setAuthChecked] = useState(false);
  const [isAuthed, setIsAuthed] = useState(false);
  const [activeTab, setActiveTab] = useState<"submissions" | "tests">("submissions");
  const [submissions, setSubmissions] = useState<SubmissionRow[]>([]);
  const [tests, setTests] = useState<TestRow[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isGrading, setIsGrading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingTest, setEditingTest] = useState<Partial<TestRow> | null>(null);
  const [isSavingTest, setIsSavingTest] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showExportToast, setShowExportToast] = useState(false); // State cho Toast Export Text
  const [teacherCommentDraft, setTeacherCommentDraft] = useState(""); // Nội dung nhận xét đang soạn
  const [isSavingComment, setIsSavingComment] = useState(false); // Trạng thái đang lưu nhận xét
  const [expandedTasks, setExpandedTasks] = useState<{ task1: boolean; task2: boolean }>({
    task1: false,
    task2: false,
  }); // Trạng thái thu gọn / mở rộng từng Task
  const [activeCorrection, setActiveCorrection] = useState<Correction | null>(null); // Correction đang được chọn để xem ở panel "Chi tiết phản hồi"
  const router = useRouter();

  // ── State cho tính năng Chọn nhiều / Xóa hàng loạt / Tải tất cả ──
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [isDownloadingAll, setIsDownloadingAll] = useState(false);

  // ── State cho modal "Đang chấm điểm bài viết" ──
  const [gradingStep, setGradingStep] = useState(0);

  useEffect(() => {
    if (!isGrading) {
      setGradingStep(0);
      return;
    }
    // Mỗi bước hiển thị ~3 giây, dừng lại ở bước cuối để chờ kết quả thật từ server
    const interval = setInterval(() => {
      setGradingStep((prev) => (prev < GRADING_STEPS.length - 1 ? prev + 1 : prev));
    }, 3000);
    return () => clearInterval(interval);
  }, [isGrading]);

  // Hàm xử lý Export nhanh (icon Download cạnh tiêu đề) — theo cấu trúc Task 1 / Task 2 giống UI
  const handleExportRawText = async (studentName: string, sections: ExportSections) => {
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

    // Hiển thị Toast thông báo
    setShowExportToast(true);
    setTimeout(() => setShowExportToast(false), 3000);
  };

  // Hàm đăng xuất
  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push("/login"); // Chuyển về trang login
  };

  // Logic Auto Sign Out sau 30 phút (1,800,000 ms)
  useEffect(() => {
    if (!isAuthed) return;

    let timeoutId: NodeJS.Timeout;

    const resetTimer = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        handleSignOut();
        alert("Phiên làm việc đã hết hạn sau 30 phút không hoạt động.");
      }, 1000 * 60 * 30); // 30 phút
    };

    // Lắng nghe các hành động của người dùng
    window.addEventListener("mousemove", resetTimer);
    window.addEventListener("keydown", resetTimer);

    // Khởi tạo bộ đếm lần đầu
    resetTimer();

    return () => {
      window.removeEventListener("mousemove", resetTimer);
      window.removeEventListener("keydown", resetTimer);
      clearTimeout(timeoutId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthed]);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setIsAuthed(Boolean(data.user));
      setAuthChecked(true);
    });
  }, []);

  const selectedSubmission = useMemo(
    () => submissions.find((submission) => submission.id === selectedId) ?? submissions[0],
    [selectedId, submissions],
  );

  // Đồng bộ nội dung nhận xét + thu gọn lại các Task mỗi khi chọn bài làm khác
  useEffect(() => {
    setTeacherCommentDraft((selectedSubmission as any)?.teacher_comment ?? "");
    setExpandedTasks({ task1: false, task2: false });
    setActiveCorrection(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSubmission?.id]);

  // Tách sẵn nội dung Task 1 / Task 2 từ bài làm thô
  const parsedContent = useMemo(
    () => parseSubmissionContent(selectedSubmission?.content),
    [selectedSubmission?.content],
  );

  const loadTests = async () => {
    try {
      const { data, error: testError } = await supabase.from("tests").select("*").order("created_at", { ascending: false });
      if (testError) setError(testError.message);
      else setTests((data ?? []) as TestRow[]);
    } catch (err) {
      console.error(err);
    }
  };

  const loadSubmissions = async () => {
    try {
      const { data, error: loadError } = await supabase
        .from("submissions")
        .select("*, tests(title, task1_prompt, task2_prompt, image_url, duration_minutes)")
        .order("created_at", { ascending: false });
      if (loadError) return setError(loadError.message);
      setSubmissions((data ?? []) as SubmissionRow[]);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (!isAuthed) return;

    const load = async () => {
      await Promise.all([loadSubmissions(), loadTests()]);
    };
    void load();

    const channel = supabase
      .channel("teacher-submissions")
      .on("postgres_changes", { event: "*", schema: "public", table: "submissions" }, () => void loadSubmissions())
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [isAuthed]);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !editingTest) return;

    setIsUploading(true);
    setError(null);

    const fileExt = file.name.split(".").pop();
    const fileName = `${Math.random().toString(36).substring(2)}_${Date.now()}.${fileExt}`;
    const filePath = `task1/${fileName}`;

    const { error: uploadError, data } = await supabase.storage.from("test-images").upload(filePath, file);

    if (uploadError) {
      setError(`Lỗi tải ảnh: ${uploadError.message}`);
    } else if (data) {
      const { data: publicUrlData } = supabase.storage.from("test-images").getPublicUrl(filePath);
      setEditingTest({ ...editingTest, image_url: publicUrlData.publicUrl });
    }
    setIsUploading(false);
  };

  const handleSaveTest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTest?.title) return;

    setIsSavingTest(true);
    setError(null);

    const testData = {
      title: editingTest.title,
      task1_prompt: editingTest.task1_prompt || "",
      task2_prompt: editingTest.task2_prompt || "",
      image_url: editingTest.image_url || null,
      duration_minutes: 60,
    };

    let responseError = null;
    if (editingTest.id) {
      const { error: updateError } = await supabase.from("tests").update(testData).eq("id", editingTest.id);
      responseError = updateError;
    } else {
      const { error: insertError } = await supabase.from("tests").insert([testData]);
      responseError = insertError;
    }

    setIsSavingTest(false);
    if (responseError) setError(responseError.message);
    else {
      setEditingTest(null);
      void loadTests();
    }
  };

  const handleDeleteTest = async (id: string) => {
    if (!window.confirm("Cảnh báo: Hành động này sẽ xóa vĩnh viễn đề thi và TẤT CẢ bài nộp liên quan. Bạn có chắc chắn?")) return;

    const { error: deleteError } = await supabase.from("tests").delete().eq("id", id);
    if (deleteError) setError(deleteError.message);
    else {
      if (editingTest?.id === id) setEditingTest(null);
      void loadTests();
    }
  };

  const copyTestLink = (testId: string) => {
    const link = `${window.location.origin}/test/${testId}`;
    void navigator.clipboard.writeText(link);
    setCopiedId(testId);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleGrade = async (submission: SubmissionRow, forceTaskType?: "task1" | "task2" | "both") => {
    if (!submission.content || !submission.tests) return;

    setIsGrading(true);
    setError(null);

    // Xác định taskType cần chấm: Ưu tiên lựa chọn thủ công, tiếp theo là cột task_type trong DB, mặc định là cả hai ("both")
    const taskType = forceTaskType || (submission as any).task_type || "both";

    // Chuẩn bị payload tùy biến theo loại chấm bài
    let payload: any = {
      submissionId: submission.id,
      content: submission.content,
      taskType
    };

    if (taskType === "both") {
      payload.task1Prompt = submission.tests.task1_prompt;
      payload.task2Prompt = submission.tests.task2_prompt;
    } else {
      payload.testPrompt = taskType === "task1"
        ? submission.tests.task1_prompt
        : submission.tests.task2_prompt;
    }

    try {
      const response = await fetch("/api/grade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Chấm bài thất bại.");
      void loadSubmissions();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Chấm bài thất bại.");
    } finally {
      setIsGrading(false);
    }
  };

  const handleDeleteSubmission = async (submission: SubmissionRow) => {
    if (!window.confirm(`Xóa vĩnh viễn bài làm của học viên "${submission.student_name}"?`)) return;

    setIsDeleting(true);
    setError(null);

    const { error: deleteError } = await supabase.from("submissions").delete().eq("id", submission.id);
    setIsDeleting(false);

    if (deleteError) return setError(deleteError.message);
    if (selectedId === submission.id) setSelectedId(null);
    void loadSubmissions();
  };

  // Lưu nhận xét bổ sung của giáo viên vào cột teacher_comment
  const handleSaveComment = async () => {
    if (!selectedSubmission) return;
    setIsSavingComment(true);
    setError(null);

    const { error: updateError } = await supabase
      .from("submissions")
      .update({ teacher_comment: teacherCommentDraft })
      .eq("id", selectedSubmission.id);

    setIsSavingComment(false);
    if (updateError) setError(updateError.message);
    else void loadSubmissions();
  };

  // ─────────────────────────────────────────────────────────────
  // Chọn nhiều / Xóa hàng loạt
  // ─────────────────────────────────────────────────────────────
  const toggleSelectionMode = () => {
    setSelectionMode((prev) => !prev);
    setSelectedIds(new Set()); // reset lựa chọn mỗi lần bật/tắt
  };

  const toggleSelectId = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    setSelectedIds((prev) => {
      if (prev.size === submissions.length) return new Set();
      return new Set(submissions.map((s) => s.id));
    });
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    if (
      !window.confirm(
        `Xóa vĩnh viễn ${selectedIds.size} bài làm đã chọn? Hành động này không thể hoàn tác.`,
      )
    )
      return;

    setIsBulkDeleting(true);
    setError(null);

    const ids = Array.from(selectedIds);
    const { error: deleteError } = await supabase.from("submissions").delete().in("id", ids);

    setIsBulkDeleting(false);

    if (deleteError) return setError(deleteError.message);

    if (selectedId && ids.includes(selectedId)) setSelectedId(null);
    setSelectedIds(new Set());
    setSelectionMode(false);
    void loadSubmissions();
  };

  // ─────────────────────────────────────────────────────────────
  // Tải tất cả bài làm (zip) — nếu đang chọn nhiều thì chỉ zip các bài
  // đã chọn, ngược lại zip toàn bộ danh sách hiện có. Mỗi file .doc bên
  // trong zip có cấu trúc y hệt UI: đề bài + ảnh Task 1 + bài làm từng
  // Task + nhận xét giáo viên + kết quả chấm AI (nếu có).
  // ─────────────────────────────────────────────────────────────
  const handleDownloadAll = async () => {
    const targets =
      selectionMode && selectedIds.size > 0
        ? submissions.filter((s) => selectedIds.has(s.id))
        : submissions;

    const withContent = targets.filter((s) => s.content && s.content.trim().length > 0);

    if (withContent.length === 0) {
      setError("Không có bài làm nào có nội dung để tải.");
      return;
    }

    setIsDownloadingAll(true);
    setError(null);

    try {
      const zip = new JSZip();
      const usedNames = new Map<string, number>();
      const imageCache = new Map<string, string>(); // Cache base64 theo URL — nhiều học sinh chung 1 đề thi sẽ dùng chung cache, tránh tải lại ảnh nhiều lần

      for (const submission of withContent) {
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
    } catch (err) {
      setError(err instanceof Error ? `Lỗi khi tạo file zip: ${err.message}` : "Lỗi khi tạo file zip.");
    } finally {
      setIsDownloadingAll(false);
    }
  };

  if (!authChecked) {
    return (
      <main className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-cyan-600" />
          <p className="text-sm font-medium text-slate-500">Đang tải dữ liệu...</p>
        </div>
      </main>
    );
  }

  if (!isAuthed) {
    return (
      <main className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-white text-center">
        <div className="bg-slate-900/50 p-10 rounded-3xl border border-slate-800 max-w-lg w-full backdrop-blur-xl">
          <div className="mx-auto bg-cyan-950/50 w-20 h-20 rounded-full flex items-center justify-center mb-6 border border-cyan-900">
            <Users className="w-10 h-10 text-cyan-400" />
          </div>
          <h1 className="text-2xl font-bold mb-3 tracking-tight">Khu vực dành cho Giáo viên</h1>
          <p className="text-slate-400 mb-8 leading-relaxed text-sm">
            Học sinh không cần tài khoản để thi. Trang này chỉ dành cho giáo viên — vui lòng đăng nhập để tạo đề và theo dõi bài làm.
          </p>
          <a href="/login?next=/teacher" className="inline-flex items-center justify-center w-full gap-2 rounded-xl bg-cyan-500 px-6 py-3.5 font-bold text-slate-950 hover:bg-cyan-400 transition-all shadow-[0_0_20px_rgba(6,182,212,0.3)] hover:shadow-[0_0_30px_rgba(6,182,212,0.5)]">
            Đăng nhập ngay <ChevronRight className="h-5 w-5" />
          </a>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50/50 text-slate-950 pb-12">
      {/* Header Banner */}
      <div className="bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 pb-24 pt-8 px-6 text-white border-b border-slate-800">
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-cyan-500/20 rounded-lg border border-cyan-500/30">
                  <Bot className="h-6 w-6 text-cyan-400" />
                </div>
                <h1 className="text-3xl font-bold tracking-tight">Teacher Workspace</h1>
              </div>
              <p className="text-slate-400 text-sm">Quản lý đề thi và theo dõi tiến độ làm bài của học viên theo thời gian thực.</p>
            </div>

            <button
              onClick={handleSignOut}
              className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-red-400 hover:text-red-300 transition-colors bg-red-950/30 border border-red-900/50 rounded-xl"
            >
              <LogOut className="h-4 w-4" /> Đăng xuất
            </button>

            {/* Tabs */}
            <div className="flex gap-2 rounded-xl bg-slate-900/80 p-1.5 border border-slate-700/50 backdrop-blur-md w-fit">
              <button
                onClick={() => setActiveTab("submissions")}
                className={`flex items-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-lg transition-all duration-200 ${activeTab === "submissions" ? "bg-cyan-500 text-slate-950 shadow-md" : "text-slate-400 hover:text-white hover:bg-white/5"
                  }`}
              >
                <Radio className={`h-4 w-4 ${activeTab === "submissions" ? "animate-pulse" : ""}`} />
                Theo dõi & Chấm bài
              </button>
              <button
                onClick={() => setActiveTab("tests")}
                className={`flex items-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-lg transition-all duration-200 ${activeTab === "tests" ? "bg-white text-slate-900 shadow-md" : "text-slate-400 hover:text-white hover:bg-white/5"
                  }`}
              >
                <BookOpen className="h-4 w-4" />
                Quản lý đề thi
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-6 -mt-16 relative z-10 space-y-6">
        {error && (
          <div className="p-4 bg-red-50 text-red-900 rounded-2xl border border-red-200 flex items-center gap-3 shadow-sm animate-in fade-in slide-in-from-top-2">
            <div className="bg-red-100 p-2 rounded-full"><AlertTriangle className="h-5 w-5 text-red-600" /></div>
            <p className="font-medium text-sm">{error}</p>
            <button onClick={() => setError(null)} className="ml-auto text-red-400 hover:text-red-600">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {activeTab === "submissions" && (
          <section
            className={`grid gap-6 items-start ${
              (selectedSubmission?.feedback?.corrections?.length ?? 0) > 0
                ? "lg:grid-cols-[280px_1fr_260px]"
                : "lg:grid-cols-[280px_1fr]"
            }`}
          >
            {/* Sidebar Danh sách */}
            <div className="rounded-3xl bg-white p-5 shadow-sm border border-slate-200/60 sticky top-6 max-h-[85vh] flex flex-col">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                  Bài làm <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full text-xs">{submissions.length}</span>
                </h2>
                <button
                  onClick={toggleSelectionMode}
                  className={`flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg border transition-colors ${selectionMode
                    ? "bg-slate-900 text-white border-slate-900"
                    : "bg-white text-slate-500 border-slate-200 hover:border-slate-300 hover:text-slate-700"
                    }`}
                  title="Bật/tắt chế độ chọn nhiều bài"
                >
                  {selectionMode ? <CheckSquare className="h-3.5 w-3.5" /> : <Square className="h-3.5 w-3.5" />}
                  Chọn nhiều
                </button>
              </div>

              {/* Thanh công cụ: chọn tất cả + xóa hàng loạt + tải tất cả */}
              <div className="flex items-center gap-2 py-3 border-b border-slate-100 mb-1">
                {selectionMode && (
                  <button
                    onClick={toggleSelectAll}
                    className="text-xs font-semibold text-cyan-700 hover:text-cyan-800 px-2 py-1"
                  >
                    {selectedIds.size === submissions.length && submissions.length > 0 ? "Bỏ chọn tất cả" : "Chọn tất cả"}
                  </button>
                )}

                <div className="ml-auto flex items-center gap-2">
                  {selectionMode && selectedIds.size > 0 && (
                    <button
                      onClick={handleBulkDelete}
                      disabled={isBulkDeleting}
                      className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg border border-red-200 bg-red-50 text-red-700 hover:bg-red-100 transition-colors disabled:opacity-50"
                    >
                      {isBulkDeleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                      Xóa đã chọn ({selectedIds.size})
                    </button>
                  )}

                  <button
                    onClick={handleDownloadAll}
                    disabled={isDownloadingAll || submissions.length === 0}
                    className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg border border-cyan-200 bg-cyan-50 text-cyan-700 hover:bg-cyan-100 transition-colors disabled:opacity-50"
                    title={
                      selectionMode && selectedIds.size > 0
                        ? `Tải ${selectedIds.size} bài đã chọn dưới dạng .zip`
                        : "Tải toàn bộ bài làm dưới dạng .zip"
                    }
                  >
                    {isDownloadingAll ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Archive className="h-3.5 w-3.5" />}
                    Tải {selectionMode && selectedIds.size > 0 ? `(${selectedIds.size})` : "tất cả"}
                  </button>
                </div>
              </div>

              <div className="space-y-3 overflow-y-auto pr-2 pb-2 custom-scrollbar mt-3">
                {submissions.length === 0 && (
                  <div className="text-center py-12 px-4 border-2 border-dashed border-slate-100 rounded-2xl">
                    <Clock className="mx-auto h-8 w-8 text-slate-300 mb-2" />
                    <p className="text-sm text-slate-500 font-medium">Chưa có học sinh nào nộp bài</p>
                  </div>
                )}

                {submissions.map((submission) => (
                  <div key={submission.id} className="relative">
                    {selectionMode && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleSelectId(submission.id);
                        }}
                        className="absolute top-4 right-4 z-10 p-1 rounded-md bg-white shadow-sm border border-slate-200"
                        title="Chọn bài này"
                      >
                        {selectedIds.has(submission.id) ? (
                          <CheckSquare className="h-4 w-4 text-cyan-600" />
                        ) : (
                          <Square className="h-4 w-4 text-slate-400" />
                        )}
                      </button>
                    )}

                    <button
                      onClick={() =>
                        selectionMode ? toggleSelectId(submission.id) : setSelectedId(submission.id)
                      }
                      className={`w-full text-left p-4 rounded-2xl border transition-all duration-200 group ${selectedSubmission?.id === submission.id && !selectionMode
                        ? "border-cyan-400 bg-cyan-50/50 ring-4 ring-cyan-50"
                        : selectionMode && selectedIds.has(submission.id)
                          ? "border-cyan-300 bg-cyan-50/30"
                          : "border-slate-100 bg-white hover:border-slate-300 hover:bg-slate-50 hover:-translate-y-0.5 hover:shadow-sm"
                        }`}
                    >
                      <div className="flex justify-between items-start gap-2 mb-1.5 pr-6">
                        <span className="font-bold text-slate-900 group-hover:text-cyan-700 transition-colors">{submission.student_name}</span>
                        {submission.status === "in_progress" && (
                          <span className="flex items-center gap-1.5 text-[10px] font-bold text-blue-600 bg-blue-100 px-2 py-0.5 rounded-full">
                            <span className="h-1.5 w-1.5 rounded-full bg-blue-500 animate-pulse" /> LIVE
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 line-clamp-1 font-medium mb-3">{submission.tests?.title ?? "Đề đã bị xóa"}</p>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full border ${statusStyles[submission.status] || "bg-slate-50 text-slate-600 border-slate-200"}`}>
                          {statusLabels[submission.status] || submission.status}
                        </span>
                        {submission.warning_count > 0 && (
                          <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200 flex items-center gap-1">
                            <ShieldAlert className="h-3 w-3" /> {submission.warning_count}/5
                          </span>
                        )}
                        {submission.band_score != null && (
                          <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-slate-900 text-white border border-slate-900 shadow-sm flex items-center gap-1">
                            <Sparkles className="h-3 w-3 text-cyan-400" /> Band {submission.band_score}
                          </span>
                        )}
                      </div>
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Chi tiết Bài làm */}
            <div className="rounded-3xl bg-white shadow-sm border border-slate-200/60 overflow-hidden sticky top-6 max-h-[85vh] flex flex-col">
              {!selectedSubmission ? (
                <div className="flex flex-col items-center justify-center py-32 px-6 text-center bg-slate-50/50">
                  <div className="bg-slate-100 p-4 rounded-full mb-4">
                    <FileCheck2 className="h-10 w-10 text-slate-400" />
                  </div>
                  <h3 className="text-lg font-bold text-slate-700 mb-2">Chưa chọn bài làm</h3>
                  <p className="text-sm text-slate-500 max-w-sm">Vui lòng chọn một bài làm từ danh sách bên trái để xem chi tiết hoặc thực hiện chấm điểm.</p>
                </div>
              ) : (
                <div className="flex flex-col min-h-0 flex-1">
                  {/* Submission Header */}
                  <div className="p-6 border-b border-slate-100 bg-white shrink-0">
                    <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
                      <div>
                        <h2 className="text-2xl font-black text-slate-900 tracking-tight">{selectedSubmission.student_name}</h2>
                        <p className="text-sm font-medium text-cyan-700 mt-1">{selectedSubmission.tests?.title}</p>
                      </div>
                      <span className={`text-xs font-bold px-3 py-1.5 rounded-full border ${statusStyles[selectedSubmission.status] || "bg-slate-50 border-slate-200 text-slate-600"}`}>
                        {statusLabels[selectedSubmission.status] || selectedSubmission.status}
                      </span>
                    </div>

                    {selectedSubmission.warning_count > 0 && (
                      <div className="flex items-center gap-3 rounded-2xl bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200/60 p-4 text-sm font-semibold text-amber-900">
                        <div className="bg-amber-100 p-2 rounded-full text-amber-600"><ShieldAlert className="h-5 w-5" /></div>
                        Học sinh đã vi phạm quy chế thoát trang {selectedSubmission.warning_count}/5 lần!
                      </div>
                    )}
                  </div>

                  {/* Submission Body */}
                  <div className="p-6 space-y-8 bg-slate-50/30 overflow-y-auto custom-scrollbar flex-1 min-h-0">
                    <div>
                      <div className="flex items-center justify-between mb-4 border-b border-slate-200/80 pb-3">
                        {/* Cấu trúc Flexbox: Tiêu đề + Nút Export nằm cạnh nhau */}
                        <div className="flex items-center gap-2">
                          <label className="text-[15px] font-bold text-slate-800 flex items-center gap-2">
                            <FileCheck2 className="h-5 w-5 text-slate-500" /> Nội dung bài làm
                          </label>

                          {/* Nút Export (Chỉ hiển thị khi có nội dung) */}
                          {selectedSubmission.content && (
                            <div className="relative flex items-center">
                              <button
                                onClick={() =>
                                  handleExportRawText(selectedSubmission.student_name, {
                                    task1Prompt: selectedSubmission.tests?.task1_prompt,
                                    task1ImageUrl: selectedSubmission.tests?.image_url,
                                    task1Answer: parsedContent.task1Answer,
                                    task2Prompt: selectedSubmission.tests?.task2_prompt,
                                    task2Answer: parsedContent.task2Answer,
                                  })
                                }
                                className="group p-1.5 rounded-lg text-slate-400 hover:bg-cyan-50 hover:text-cyan-600 hover:shadow-sm border border-transparent hover:border-cyan-200 transition-all"
                                title="Xuất bài làm (Đề bài + Task 1/2)"
                              >
                                <Download className="h-4 w-4" />
                              </button>

                              {/* Toast Notification (Mini tooltip hiện khi xuất thành công) */}
                              {showExportToast && (
                                <span className="absolute left-full ml-2 whitespace-nowrap bg-emerald-100 text-emerald-700 text-xs font-bold px-2 py-1 rounded shadow-sm animate-in fade-in slide-in-from-left-2 z-10">
                                  Đã xuất file!
                                </span>
                              )}
                            </div>
                          )}
                        </div>

                        {selectedSubmission.status === "in_progress" && (
                          <span className="flex items-center gap-1.5 text-xs font-bold text-blue-600 bg-blue-50 px-3 py-1 rounded-full border border-blue-100">
                            <Radio className="h-3.5 w-3.5 animate-pulse" /> Đang Live...
                          </span>
                        )}
                      </div>

                      {/* Gợi ý cách xem lỗi tô sáng — chỉ hiện khi đã có kết quả chấm */}
                      {(selectedSubmission.feedback?.corrections?.length ?? 0) > 0 && (
                        <div className="flex items-center gap-2 mb-3 text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 w-fit">
                          <span className="inline-block h-3 w-3 rounded-sm bg-amber-200/70 border border-amber-400" />
                          Bấm vào phần được tô vàng để xem chi tiết đề xuất sửa ở khung bên phải
                        </div>
                      )}

                      {/* Giao diện hiển thị bài làm theo từng Task — mặc định thu gọn, bấm để xem đầy đủ.
                          Bài làm có tô sáng lỗi (nếu đã chấm điểm) ngay trong phần "Bài làm học sinh". */}
                      {!selectedSubmission.content?.trim() ? (
                        <div className="flex items-center justify-center min-h-[200px] bg-[#fcfcfc] border border-slate-300 rounded-xl">
                          <span className="text-slate-400 italic font-sans text-sm">Học sinh chưa nhập nội dung nào...</span>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          {/* TASK 1 */}
                          <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-sm">
                            <button
                              type="button"
                              onClick={() => setExpandedTasks((prev) => ({ ...prev, task1: !prev.task1 }))}
                              className="w-full flex items-center justify-between gap-2 bg-slate-900 text-white px-5 py-3 hover:bg-slate-800 transition-colors"
                            >
                              <span className="flex items-center gap-2 font-black tracking-wide text-sm">
                                <ImageIcon className="h-4 w-4 text-cyan-400" /> TASK 1
                              </span>
                              <span className="flex items-center gap-1 text-xs font-bold text-cyan-300">
                                {expandedTasks.task1 ? (
                                  <>Thu gọn <ChevronUp className="h-3.5 w-3.5" /></>
                                ) : (
                                  <>Xem đầy đủ <ChevronDown className="h-3.5 w-3.5" /></>
                                )}
                              </span>
                            </button>

                            {expandedTasks.task1 ? (
                              <div className="p-5 space-y-4">
                                {selectedSubmission.tests?.task1_prompt && (
                                  <div className="rounded-xl bg-slate-50 border border-slate-200 border-l-4 border-l-cyan-400 p-4">
                                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Đề bài</p>
                                    <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
                                      {selectedSubmission.tests.task1_prompt}
                                    </p>
                                  </div>
                                )}

                                {selectedSubmission.tests?.image_url && (
                                  <div className="flex justify-center bg-white border border-slate-200 rounded-xl p-3">
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img
                                      src={selectedSubmission.tests.image_url}
                                      alt="Minh họa đề Task 1"
                                      className="max-h-[360px] object-contain rounded-lg"
                                    />
                                  </div>
                                )}

                                <div>
                                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">Bài làm học sinh</p>
                                  <div className="whitespace-pre-wrap font-serif text-[15px] leading-[2] bg-[#fcfcfc] border border-slate-200 rounded-xl px-6 py-6 text-slate-800 tracking-wide selection:bg-cyan-200 min-h-[120px]">
                                    {parsedContent.task1Answer ? (
                                      renderHighlightedAnswer(
                                        parsedContent.task1Answer,
                                        selectedSubmission.feedback?.corrections ?? [],
                                        activeCorrection,
                                        setActiveCorrection,
                                      )
                                    ) : (
                                      <span className="text-slate-400 italic font-sans text-sm">Học sinh chưa làm Task 1...</span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setExpandedTasks((prev) => ({ ...prev, task1: true }))}
                                className="w-full text-left p-4 hover:bg-slate-50 transition-colors"
                              >
                                <p className="text-sm text-slate-500 line-clamp-2 leading-relaxed">
                                  {parsedContent.task1Answer || (
                                    <span className="italic text-slate-400">Học sinh chưa làm Task 1...</span>
                                  )}
                                </p>
                                <p className="mt-2 text-[11px] font-bold text-cyan-600">
                                  Bấm để xem đề bài{selectedSubmission.tests?.image_url ? ", ảnh minh họa" : ""} và toàn bộ bài làm →
                                </p>
                              </button>
                            )}
                          </div>

                          {/* TASK 2 */}
                          <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-sm">
                            <button
                              type="button"
                              onClick={() => setExpandedTasks((prev) => ({ ...prev, task2: !prev.task2 }))}
                              className="w-full flex items-center justify-between gap-2 bg-slate-900 text-white px-5 py-3 hover:bg-slate-800 transition-colors"
                            >
                              <span className="flex items-center gap-2 font-black tracking-wide text-sm">
                                <BookOpen className="h-4 w-4 text-cyan-400" /> TASK 2
                              </span>
                              <span className="flex items-center gap-1 text-xs font-bold text-cyan-300">
                                {expandedTasks.task2 ? (
                                  <>Thu gọn <ChevronUp className="h-3.5 w-3.5" /></>
                                ) : (
                                  <>Xem đầy đủ <ChevronDown className="h-3.5 w-3.5" /></>
                                )}
                              </span>
                            </button>

                            {expandedTasks.task2 ? (
                              <div className="p-5 space-y-4">
                                {selectedSubmission.tests?.task2_prompt && (
                                  <div className="rounded-xl bg-slate-50 border border-slate-200 border-l-4 border-l-cyan-400 p-4">
                                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Đề bài</p>
                                    <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
                                      {selectedSubmission.tests.task2_prompt}
                                    </p>
                                  </div>
                                )}

                                <div>
                                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">Bài làm học sinh</p>
                                  <div className="whitespace-pre-wrap font-serif text-[15px] leading-[2] bg-[#fcfcfc] border border-slate-200 rounded-xl px-6 py-6 text-slate-800 tracking-wide selection:bg-cyan-200 min-h-[120px]">
                                    {parsedContent.task2Answer ? (
                                      renderHighlightedAnswer(
                                        parsedContent.task2Answer,
                                        selectedSubmission.feedback?.corrections ?? [],
                                        activeCorrection,
                                        setActiveCorrection,
                                      )
                                    ) : (
                                      <span className="text-slate-400 italic font-sans text-sm">Học sinh chưa làm Task 2...</span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setExpandedTasks((prev) => ({ ...prev, task2: true }))}
                                className="w-full text-left p-4 hover:bg-slate-50 transition-colors"
                              >
                                <p className="text-sm text-slate-500 line-clamp-2 leading-relaxed">
                                  {parsedContent.task2Answer || (
                                    <span className="italic text-slate-400">Học sinh chưa làm Task 2...</span>
                                  )}
                                </p>
                                <p className="mt-2 text-[11px] font-bold text-cyan-600">Bấm để xem đề bài và toàn bộ bài làm →</p>
                              </button>
                            )}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Action Buttons */}
                    <div className="flex flex-wrap items-center gap-3 pt-6 border-t border-slate-200">
                      {/* Cụm nút chấm điểm đa lựa chọn: Chấm cả 2 Task hoặc Chấm riêng lẻ */}
                      <div className="flex items-center rounded-xl bg-slate-900 border border-slate-800 overflow-hidden shadow-sm">
                        <button
                          onClick={() => handleGrade(selectedSubmission, "both")}
                          disabled={isGrading || selectedSubmission.status === "in_progress" || !selectedSubmission.content}
                          className="flex items-center gap-2 bg-slate-950 hover:bg-slate-900 text-white px-5 py-2.5 text-sm font-bold transition disabled:opacity-50"
                          title="Chấm cả hai bài cùng lúc và tính trung bình cộng điểm Overall"
                        >
                          {isGrading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bot className="h-4 w-4 text-cyan-400 animate-pulse" />}
                          {selectedSubmission.feedback ? "AI Chấm lại cả 2 Task" : "AI Chấm cả 2 Task"}
                        </button>
                        <button
                          onClick={() => handleGrade(selectedSubmission, "task1")}
                          disabled={isGrading || selectedSubmission.status === "in_progress" || !selectedSubmission.content}
                          className="bg-slate-900 hover:bg-slate-800 text-slate-300 border-l border-slate-800/60 px-3.5 py-2.5 text-xs font-semibold transition disabled:opacity-50"
                          title="Chấm đơn lẻ chỉ đề bài Task 1"
                        >
                          Chấm riêng Task 1
                        </button>
                        <button
                          onClick={() => handleGrade(selectedSubmission, "task2")}
                          disabled={isGrading || selectedSubmission.status === "in_progress" || !selectedSubmission.content}
                          className="bg-slate-900 hover:bg-slate-800 text-slate-300 border-l border-slate-800/60 px-3.5 py-2.5 text-xs font-semibold transition disabled:opacity-50"
                          title="Chấm đơn lẻ chỉ đề bài Task 2"
                        >
                          Chấm riêng Task 2
                        </button>
                      </div>

                      <button
                        onClick={() =>
                          handleDownloadDoc(
                            selectedSubmission.student_name,
                            {
                              task1Prompt: selectedSubmission.tests?.task1_prompt,
                              task1ImageUrl: selectedSubmission.tests?.image_url,
                              task1Answer: parsedContent.task1Answer,
                              task2Prompt: selectedSubmission.tests?.task2_prompt,
                              task2Answer: parsedContent.task2Answer,
                              teacherComment: teacherCommentDraft,
                            },
                            selectedSubmission.feedback,
                          )
                        }
                        disabled={!selectedSubmission.content}
                        className="flex items-center gap-2 rounded-xl bg-white border border-slate-200 px-5 py-2.5 text-sm font-bold text-slate-700 transition hover:bg-slate-50 hover:text-cyan-700 hover:border-cyan-200 disabled:opacity-50"
                      >
                        <FileDown className="h-4 w-4" /> Xuất File DOC
                      </button>

                      <button
                        onClick={() => handleDeleteSubmission(selectedSubmission)}
                        disabled={isDeleting}
                        className="ml-auto flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-bold text-red-700 transition hover:bg-red-100 disabled:opacity-50"
                      >
                        <Trash2 className="h-4 w-4" /> Xóa bài
                      </button>

                      {selectedSubmission.status === "in_progress" && (
                        <div className="w-full mt-2 flex items-center gap-2 text-xs font-medium text-slate-500 bg-slate-100/50 p-3 rounded-xl border border-slate-200 border-dashed">
                          <Clock className="h-4 w-4" /> Hệ thống đang chờ học sinh ấn nút nộp bài để có thể chấm điểm.
                        </div>
                      )}
                    </div>

                    {/* Nhận xét bổ sung của giáo viên */}
                    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-3">
                      <label className="text-sm font-bold text-slate-800 flex items-center gap-2">
                        <FileCheck2 className="h-4 w-4 text-slate-500" /> Nhận xét bổ sung của giáo viên
                      </label>
                      <textarea
                        rows={4}
                        className="w-full rounded-xl border border-slate-300 p-3 text-sm focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 focus:outline-none transition-all resize-none shadow-sm"
                        placeholder="Viết nhận xét cho học sinh..."
                        value={teacherCommentDraft}
                        onChange={(e) => setTeacherCommentDraft(e.target.value)}
                      />
                      <div className="flex justify-end">
                        <button
                          onClick={handleSaveComment}
                          disabled={isSavingComment}
                          className="flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-emerald-500 shadow-sm transition disabled:opacity-50"
                        >
                          {isSavingComment ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                          Gửi nhận xét
                        </button>
                      </div>
                    </div>

                    {/* AI Feedback UI Premium */}
                    {selectedSubmission.feedback && (
                      <div className="mt-8 rounded-3xl border border-cyan-200/60 bg-gradient-to-br from-cyan-50/80 to-white overflow-hidden shadow-sm">
                        <div className="p-6 border-b border-cyan-100 bg-white/50 backdrop-blur-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
                          <div className="flex items-center gap-3">
                            <div className="bg-cyan-100 p-2.5 rounded-2xl">
                              <Sparkles className="h-6 w-6 text-cyan-600" />
                            </div>
                            <div>
                              <h3 className="text-lg font-black text-slate-900 tracking-tight">Đánh giá từ AI Examiner</h3>
                              <p className="text-xs font-medium text-cyan-700">Tự động phân tích theo tiêu chuẩn IELTS</p>
                            </div>
                          </div>
                          <div className="bg-slate-900 text-white px-5 py-2 rounded-2xl flex items-center gap-2 shadow-md">
                            <span className="text-sm font-medium text-slate-300">Overall</span>
                            <span className="text-2xl font-black text-cyan-400">{selectedSubmission.feedback.overall_band}</span>
                          </div>
                        </div>

                        <div className="p-6 space-y-8">
                          {/* Thống kê từ & lỗi — tách riêng theo từng Task */}
                          <div className="grid gap-3 sm:grid-cols-2">
                            {[
                              { label: "Task 1", text: parsedContent.task1Answer, icon: <ImageIcon className="h-3.5 w-3.5" /> },
                              { label: "Task 2", text: parsedContent.task2Answer, icon: <BookOpen className="h-3.5 w-3.5" /> },
                            ].map((task) => {
                              const errorCount = countMatchedCorrections(task.text, selectedSubmission.feedback?.corrections ?? []);
                              return (
                                <div key={task.label} className="rounded-2xl bg-white border border-slate-200/60 shadow-sm p-4 space-y-3">
                                  <p className="text-xs font-bold text-slate-500 flex items-center gap-1.5">
                                    {task.icon} {task.label}
                                  </p>
                                  <div className="flex items-center gap-4">
                                    <div className="flex items-center gap-2">
                                      <div className="bg-slate-100 p-1.5 rounded-lg shrink-0"><Type className="h-3.5 w-3.5 text-slate-500" /></div>
                                      <div>
                                        <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Số từ</p>
                                        <p className="text-base font-black text-slate-900">
                                          {countWords(task.text)} <span className="text-[10px] font-medium text-slate-400">từ</span>
                                        </p>
                                      </div>
                                    </div>
                                    {(selectedSubmission.feedback?.corrections?.length ?? 0) > 0 && (
                                      <div className="flex items-center gap-2">
                                        <div className="bg-amber-100 p-1.5 rounded-lg shrink-0"><AlertTriangle className="h-3.5 w-3.5 text-amber-600" /></div>
                                        <div>
                                          <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Số lỗi</p>
                                          <p className="text-base font-black text-slate-900">
                                            {errorCount} <span className="text-[10px] font-medium text-slate-400">lỗi</span>
                                          </p>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>

                          <div className="bg-white rounded-2xl p-5 border border-cyan-100/50 shadow-sm relative">
                            <div className="absolute top-0 left-0 w-1 h-full bg-cyan-400 rounded-l-2xl"></div>
                            <p className="text-[15px] leading-relaxed text-slate-700 italic whitespace-pre-line">
                              {selectedSubmission.feedback.examiner_summary}
                            </p>
                          </div>

                          <div className="grid gap-5 sm:grid-cols-2">
                            {/* Task 1 Card */}
                            {selectedSubmission.feedback.task1 && (
                              <div className="rounded-2xl bg-white border border-slate-200/60 shadow-sm overflow-hidden hover:border-cyan-300 transition-colors">
                                <div className="bg-slate-50 px-5 py-3 border-b border-slate-100 flex items-center justify-between">
                                  <span className="font-bold text-slate-800 flex items-center gap-2">
                                    <ImageIcon className="h-4 w-4 text-slate-400" /> Task 1
                                  </span>
                                  {/* Giữ nguyên Band điểm lẻ */}
                                  <span className="rounded-full bg-cyan-100 text-cyan-800 text-xs font-bold px-3 py-1">
                                    Band {selectedSubmission.feedback.task1.band}
                                  </span>
                                </div>
                                <div className="p-5">
                                  <dl className="space-y-3 text-sm">
                                    {[
                                      { label: "Task Achievement", score: selectedSubmission.feedback.task1.TA },
                                      { label: "Coherence & Cohesion", score: selectedSubmission.feedback.task1.CC },
                                      { label: "Lexical Resource", score: selectedSubmission.feedback.task1.LR },
                                      { label: "Grammar", score: selectedSubmission.feedback.task1.GRA }
                                    ].map((item, i) => (
                                      <div key={i} className="flex justify-between items-center pb-2 border-b border-slate-50 last:border-0 last:pb-0">
                                        <dt className="text-slate-500 font-medium">{item.label}</dt>
                                        {/* Ép kiểu về số nguyên ở đây 👇 */}
                                        <dd className="font-bold text-slate-900 bg-slate-50 px-2 py-0.5 rounded text-xs">
                                          {item.score !== undefined && item.score !== null && !isNaN(Number(item.score))
                                            ? Math.round(Number(item.score))
                                            : item.score}
                                        </dd>
                                      </div>
                                    ))}
                                  </dl>
                                </div>
                              </div>
                            )}

                            {/* Task 2 Card */}
                            {selectedSubmission.feedback.task2 && (
                              <div className="rounded-2xl bg-white border border-slate-200/60 shadow-sm overflow-hidden hover:border-cyan-300 transition-colors">
                                <div className="bg-slate-50 px-5 py-3 border-b border-slate-100 flex items-center justify-between">
                                  <span className="font-bold text-slate-800 flex items-center gap-2">
                                    <BookOpen className="h-4 w-4 text-slate-400" /> Task 2
                                  </span>
                                  {/* Giữ nguyên Band điểm lẻ */}
                                  <span className="rounded-full bg-cyan-100 text-cyan-800 text-xs font-bold px-3 py-1">
                                    Band {selectedSubmission.feedback.task2.band}
                                  </span>
                                </div>
                                <div className="p-5">
                                  <dl className="space-y-3 text-sm">
                                    {[
                                      { label: "Task Response", score: selectedSubmission.feedback.task2.TR },
                                      { label: "Coherence & Cohesion", score: selectedSubmission.feedback.task2.CC },
                                      { label: "Lexical Resource", score: selectedSubmission.feedback.task2.LR },
                                      { label: "Grammar", score: selectedSubmission.feedback.task2.GRA }
                                    ].map((item, i) => (
                                      <div key={i} className="flex justify-between items-center pb-2 border-b border-slate-50 last:border-0 last:pb-0">
                                        <dt className="text-slate-500 font-medium">{item.label}</dt>
                                        {/* Ép kiểu về số nguyên ở đây 👇 */}
                                        <dd className="font-bold text-slate-900 bg-slate-50 px-2 py-0.5 rounded text-xs">
                                          {item.score !== undefined && item.score !== null && !isNaN(Number(item.score))
                                            ? Math.round(Number(item.score))
                                            : item.score}
                                        </dd>
                                      </div>
                                    ))}
                                  </dl>
                                </div>
                              </div>
                            )}
                          </div>

                          {/* Corrections Diff */}
                          {selectedSubmission.feedback.corrections && selectedSubmission.feedback.corrections.length > 0 && (
                            <div className="pt-4">
                              <h4 className="font-black text-slate-900 mb-4 text-lg flex items-center gap-2">
                                Lỗi sai & Đề xuất sửa
                              </h4>
                              <div className="space-y-4">
                                {selectedSubmission.feedback.corrections.map((correction: any, index: number) => (
                                  <div
                                    key={index}
                                    className="rounded-2xl bg-white border border-slate-200/80 p-5 shadow-sm space-y-3"
                                  >
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                      <div className="rounded-xl bg-red-50/50 border border-red-100 p-3">
                                        <span className="block text-[10px] font-bold text-red-400 uppercase tracking-wider mb-1">Bản gốc</span>
                                        <p className="text-[14px] text-red-700 line-through decoration-red-300/50">
                                          {correction.original}
                                        </p>
                                      </div>
                                      <div className="rounded-xl bg-emerald-50/50 border border-emerald-100 p-3">
                                        <span className="block text-[10px] font-bold text-emerald-500 uppercase tracking-wider mb-1">Đề xuất sửa</span>
                                        <p className="text-[14px] text-emerald-800 font-medium">
                                          {correction.corrected}
                                        </p>
                                      </div>
                                    </div>
                                    <div className="flex items-start gap-2.5 rounded-xl bg-slate-50 p-3">
                                      <Bot className="h-5 w-5 shrink-0 text-cyan-600 mt-0.5" />
                                      <p className="text-sm text-slate-600 leading-relaxed font-medium">
                                        {correction.explanation}
                                      </p>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Panel "Chi tiết phản hồi" — tách riêng thành 1 cột/card độc lập, chỉ hiện khi bài đã có kết quả chấm */}
            {(selectedSubmission?.feedback?.corrections?.length ?? 0) > 0 && (
              <div className="rounded-3xl bg-white p-5 shadow-sm border border-slate-200/60 sticky top-6 max-h-[85vh] overflow-y-auto custom-scrollbar">
                <h3 className="text-sm font-black text-slate-900 flex items-center gap-2 pb-3 border-b border-slate-100">
                  <Lightbulb className="h-4 w-4 text-amber-500" /> Chi tiết phản hồi
                </h3>

                {activeCorrection ? (
                  <div className="space-y-4 mt-4">
                    <div className="flex items-start gap-2.5">
                      <div className="bg-cyan-50 text-cyan-600 rounded-full p-1.5 shrink-0">
                        <Lightbulb className="h-3.5 w-3.5" />
                      </div>
                      <p className="text-sm font-semibold text-slate-800 leading-relaxed">
                        "{activeCorrection.original}"
                      </p>
                    </div>

                    <div>
                      <p className="text-xs font-bold text-slate-500 mb-1">Giải thích:</p>
                      <p className="text-sm text-slate-600 leading-relaxed">{activeCorrection.explanation}</p>
                    </div>

                    <div>
                      <p className="text-xs font-bold text-slate-500 mb-2">Gợi ý:</p>
                      <div className="rounded-xl bg-red-50 border border-red-100 p-3 text-sm text-red-700 leading-relaxed line-through decoration-red-300/60">
                        {activeCorrection.original}
                      </div>
                      <div className="flex justify-center py-1 text-slate-300">↓</div>
                      <div className="rounded-xl bg-emerald-50 border border-emerald-100 p-3 text-sm text-emerald-800 font-medium leading-relaxed">
                        {activeCorrection.corrected}
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-slate-400 italic leading-relaxed mt-4">
                    Bấm vào đoạn được tô vàng trong bài làm bên trái để xem chi tiết đề xuất sửa từ AI.
                  </p>
                )}
              </div>
            )}
          </section>
        )}

        {/* TAB TẠO ĐỀ THI */}
        {activeTab === "tests" && (
          <section className="grid gap-6 lg:grid-cols-[1fr_450px] items-start">
            <div className="rounded-3xl bg-white p-6 shadow-sm border border-slate-200/60 sticky top-6">
              <div className="flex items-center justify-between border-b border-slate-100 pb-5 mb-5">
                <div>
                  <h2 className="text-xl font-bold text-slate-900">Ngân hàng Đề thi</h2>
                  <p className="text-sm text-slate-500 font-medium mt-1">Danh sách các đề IELTS Writing bạn đã tạo</p>
                </div>
                <button
                  onClick={() => setEditingTest({ title: "", task1_prompt: "", task2_prompt: "", image_url: null })}
                  className="flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-bold text-white hover:bg-slate-800 shadow-sm transition-all hover:shadow-md"
                >
                  <Plus className="h-4 w-4" /> Soạn đề mới
                </button>
              </div>

              <div className="grid gap-4 max-h-[650px] overflow-y-auto pr-2 custom-scrollbar">
                {tests.map((test) => (
                  <div key={test.id} className="p-5 border border-slate-200 rounded-2xl bg-white hover:border-cyan-300 hover:shadow-md transition-all group relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-1 h-full bg-slate-200 group-hover:bg-cyan-400 transition-colors"></div>
                    <div className="flex justify-between items-start mb-3">
                      <h3 className="font-bold text-lg text-slate-800 group-hover:text-cyan-800 pl-2 pr-4">{test.title}</h3>
                      <div className="flex gap-1 bg-slate-50 rounded-lg p-1 border border-slate-100 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => setEditingTest(test)} className="p-2 text-slate-400 hover:text-cyan-600 hover:bg-white rounded-md transition" title="Sửa đề">
                          <Edit3 className="h-4 w-4" />
                        </button>
                        <button onClick={() => handleDeleteTest(test.id)} className="p-2 text-slate-400 hover:text-red-600 hover:bg-white rounded-md transition" title="Xóa đề">
                          <Trash2 className="h-4 w-4" />
                        </button>
                        <button onClick={() => copyTestLink(test.id)} className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-white rounded-md transition" title="Copy Link">
                          {copiedId === test.id ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>
                    <div className="pl-2 flex items-center gap-4 text-xs font-medium text-slate-500">
                      <span className="flex items-center gap-1.5"><Clock className="h-3.5 w-3.5" /> {test.duration_minutes} phút</span>
                      <span className="flex items-center gap-1.5"><BookOpen className="h-3.5 w-3.5" /> Full Test (Task 1 & 2)</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-3xl bg-white p-6 shadow-sm border border-slate-200/60 sticky top-6">
              <div className="border-b border-slate-100 pb-5 mb-6">
                <h2 className="text-xl font-bold text-slate-900">{editingTest?.id ? "Chỉnh sửa Đề thi" : "Khởi tạo Đề thi Mới"}</h2>
                <p className="text-sm text-slate-500 font-medium mt-1">
                  {editingTest?.id ? "Cập nhật nội dung câu hỏi hoặc ảnh minh họa." : "Tạo bài thi chuẩn format IELTS Writing."}
                </p>
              </div>

              {editingTest ? (
                <form onSubmit={handleSaveTest} className="space-y-6">
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">Tiêu đề chung</label>
                    <input
                      type="text"
                      className="w-full rounded-xl border border-slate-300 p-3 text-sm focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 focus:outline-none transition-all shadow-sm"
                      value={editingTest.title || ""}
                      onChange={(e) => setEditingTest({ ...editingTest, title: e.target.value })}
                      placeholder="VD: Mock Test 01 - Academic"
                      required
                    />
                  </div>

                  <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200/80 space-y-4 shadow-sm">
                    <div className="flex items-center gap-2 font-black text-slate-800 text-base">
                      <ImageIcon className="h-5 w-5 text-cyan-600" /> Writing Task 1
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-600 mb-2 uppercase tracking-wide">Yêu cầu đề bài</label>
                      <textarea
                        rows={3}
                        className="w-full rounded-xl border border-slate-300 p-3 text-sm focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 focus:outline-none transition-all resize-none shadow-sm"
                        value={editingTest.task1_prompt || ""}
                        onChange={(e) => setEditingTest({ ...editingTest, task1_prompt: e.target.value })}
                        placeholder="The graph below shows..."
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-600 mb-2 uppercase tracking-wide">Ảnh Biểu đồ / Bản đồ</label>
                      {editingTest.image_url ? (
                        <div className="mb-2 relative w-full h-40 rounded-xl border border-slate-200 overflow-hidden bg-white group">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={editingTest.image_url} alt="Task 1" className="object-contain w-full h-full p-2" />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <button
                              type="button"
                              onClick={() => setEditingTest({ ...editingTest, image_url: null })}
                              className="bg-red-500 text-white rounded-full p-3 hover:bg-red-600 shadow-lg transform hover:scale-105 transition-all"
                            >
                              <Trash2 className="h-5 w-5" />
                            </button>
                          </div>
                        </div>
                      ) : (
                        <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-xl cursor-pointer hover:bg-slate-100 hover:border-cyan-300 bg-white border-slate-300 transition-all group">
                          <div className="flex flex-col items-center justify-center pt-5 pb-6 text-slate-500 group-hover:text-cyan-600 transition-colors">
                            {isUploading ? (
                              <Loader2 className="w-8 h-8 animate-spin text-cyan-500" />
                            ) : (
                              <UploadCloud className="w-8 h-8 mb-2" />
                            )}
                            <p className="text-xs font-bold">{isUploading ? "Đang tải ảnh lên máy chủ..." : "Click hoặc kéo thả ảnh vào đây"}</p>
                          </div>
                          <input type="file" className="hidden" accept="image/png, image/jpeg" onChange={handleImageUpload} disabled={isUploading} />
                        </label>
                      )}
                    </div>
                  </div>

                  <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200/80 space-y-4 shadow-sm">
                    <div className="flex items-center gap-2 font-black text-slate-800 text-base">
                      <BookOpen className="h-5 w-5 text-cyan-600" /> Writing Task 2
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-600 mb-2 uppercase tracking-wide">Yêu cầu đề bài</label>
                      <textarea
                        rows={5}
                        className="w-full rounded-xl border border-slate-300 p-3 text-sm focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 focus:outline-none transition-all resize-none shadow-sm"
                        value={editingTest.task2_prompt || ""}
                        onChange={(e) => setEditingTest({ ...editingTest, task2_prompt: e.target.value })}
                        placeholder="Some people think that..."
                      />
                    </div>
                  </div>

                  <div className="flex gap-3 pt-4 border-t border-slate-100">
                    <button type="button" onClick={() => setEditingTest(null)} className="flex-1 rounded-xl border border-slate-200 py-3 text-sm font-bold text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors">
                      Hủy bỏ
                    </button>
                    <button
                      type="submit"
                      disabled={isSavingTest}
                      className="flex-[2] rounded-xl bg-cyan-500 py-3 text-sm font-bold text-slate-900 hover:bg-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.2)] hover:shadow-[0_0_20px_rgba(6,182,212,0.4)] transition-all disabled:opacity-50"
                    >
                      {isSavingTest ? "Đang lưu..." : "Lưu Đề thi"}
                    </button>
                  </div>

                  {editingTest.id && (
                    <button
                      type="button"
                      onClick={() => copyTestLink(editingTest.id!)}
                      className="w-full flex items-center justify-center gap-2 rounded-xl border-2 border-emerald-500 bg-emerald-50 py-3 text-sm font-bold text-emerald-700 hover:bg-emerald-100 transition-colors mt-2"
                    >
                      {copiedId === editingTest.id ? (
                        <>
                          <Check className="h-5 w-5" /> Đã sao chép Link Gửi cho Học sinh
                        </>
                      ) : (
                        <>
                          <Copy className="h-5 w-5" /> Copy Link thi để gửi cho Học sinh
                        </>
                      )}
                    </button>
                  )}
                </form>
              ) : (
                <div className="flex flex-col items-center justify-center py-24 text-slate-400 text-center px-4 bg-slate-50/50 rounded-2xl border-2 border-dashed border-slate-200">
                  <div className="bg-white p-4 rounded-full shadow-sm border border-slate-100 mb-4">
                    <BookOpen className="h-8 w-8 text-cyan-200" />
                  </div>
                  <p className="text-sm font-medium">Bấm vào nút <strong className="text-slate-700">"Soạn đề mới"</strong><br />hoặc chọn đề từ danh sách để bắt đầu.</p>
                </div>
              )}
            </div>
          </section>
        )}
      </div>

      {/* Modal "Đang chấm điểm bài viết" — hiện fullscreen overlay khi isGrading = true */}
      {isGrading && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-8 text-center animate-in fade-in zoom-in-95">
            <div className="mx-auto mb-5 h-16 w-16 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg">
              <Loader2 className="h-8 w-8 text-white animate-spin" />
            </div>
            <h3 className="text-xl font-black text-slate-900 mb-1">Đang chấm điểm bài viết</h3>
            <p className="text-sm text-slate-500 mb-6">AI đang phân tích chi tiết bài viết của bạn</p>

            <div className="space-y-3 text-left mb-6">
              {GRADING_STEPS.map((step, i) => (
                <div key={step} className="flex items-center gap-3">
                  {i < gradingStep ? (
                    <Check className="h-5 w-5 text-emerald-500 shrink-0" />
                  ) : i === gradingStep ? (
                    <Loader2 className="h-5 w-5 text-cyan-500 animate-spin shrink-0" />
                  ) : (
                    <Clock className="h-5 w-5 text-slate-300 shrink-0" />
                  )}
                  <span
                    className={`text-sm font-medium ${i < gradingStep ? "text-emerald-600" : i === gradingStep ? "text-slate-800" : "text-slate-400"
                      }`}
                  >
                    {step}
                  </span>
                </div>
              ))}
            </div>

            <div className="h-2 rounded-full bg-slate-100 overflow-hidden mb-2">
              <div
                className="h-full bg-gradient-to-r from-cyan-500 to-blue-600 transition-all duration-500"
                style={{ width: `${((gradingStep + 1) / GRADING_STEPS.length) * 100}%` }}
              />
            </div>
            <p className="text-xs font-semibold text-slate-500">
              {gradingStep + 1}/{GRADING_STEPS.length} bước hoàn thành
            </p>
          </div>
        </div>
      )}

      {/* Thêm chút CSS cho thanh cuộn (Scrollbar) nhìn mượt hơn */}
      <style dangerouslySetInnerHTML={{
        __html: `
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background-color: #cbd5e1; border-radius: 20px; }
        .custom-scrollbar:hover::-webkit-scrollbar-thumb { background-color: #94a3b8; }
      `}} />
    </main>
  );
}
