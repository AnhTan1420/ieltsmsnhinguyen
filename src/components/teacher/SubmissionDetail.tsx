"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  BookOpen,
  Bot,
  Check,
  ChevronDown,
  ChevronUp,
  Clock,
  Download,
  Timer,
  FileCheck2,
  FileDown,
  Image as ImageIcon,
  Lightbulb,
  Loader2,
  Radio,
  ShieldAlert,
  Sparkles,
  Trash2,
  Wand2,
  X,
} from "lucide-react";
import type { SubmissionRow } from "@/lib/types";
import { parseSubmissionContent } from "@/lib/grading/parse";
import { downloadSubmissionDoc, downloadSubmissionRawText } from "@/lib/teacher/exportDoc";
import { useNow } from "@/hooks/useNow";
import {
  statusLabels,
  statusStyles,
  renderHighlightedAnswer,
  formatDateTime,
  formatDuration,
  formatRelativeTime,
  type HighlightItem,
} from "./submission-utils";
import GradingResultPanel from "./GradingResultPanel";

type SubmissionDetailProps = {
  selectedSubmission: SubmissionRow | undefined;
  isGrading: boolean;
  isDeleting: boolean;
  isSavingComment: boolean;
  onGrade: (submission: SubmissionRow, forceTaskType?: "task1" | "task2" | "both") => void;
  onDeleteSubmission: (submission: SubmissionRow) => void;
  onSaveComment: (submissionId: string, comment: string) => void;
  // true khi đang ở "màn hình chi tiết" trên mobile (điều hướng master-detail) —
  // ở lg+ trở lên giá trị này không quan trọng, panel luôn hiện song song danh sách.
  showOnMobile: boolean;
  onBack: () => void;
};

// Panel chi tiết bài làm — hiển thị Task 1/Task 2 (tô sáng lỗi nếu đã chấm), nút chấm điểm/
// xuất file/xóa, nhận xét giáo viên, kết quả AI (GradingResultPanel) và panel "Chi tiết phản hồi".
export default function SubmissionDetail({
  selectedSubmission,
  isGrading,
  isDeleting,
  isSavingComment,
  onGrade,
  onDeleteSubmission,
  onSaveComment,
  showOnMobile,
  onBack,
}: SubmissionDetailProps) {
  // Tick mỗi giây để nhãn "cập nhật X giây trước" tự nhảy số dù không có
  // event realtime mới nào — chỉ ảnh hưởng UI, không gọi mạng.
  const now = useNow();
  const [teacherCommentDraft, setTeacherCommentDraft] = useState("");
  const [expandedTasks, setExpandedTasks] = useState<{ task1: boolean; task2: boolean }>({
    task1: false,
    task2: false,
  });
  const [activeHighlight, setActiveHighlight] = useState<HighlightItem | null>(null);
  const [showExportToast, setShowExportToast] = useState(false);

  // Đồng bộ nội dung nhận xét + thu gọn lại các Task mỗi khi chọn bài làm khác
  useEffect(() => {
    setTeacherCommentDraft((selectedSubmission as any)?.teacher_comment ?? "");
    setExpandedTasks({ task1: false, task2: false });
    setActiveHighlight(null);
  }, [selectedSubmission?.id]);

  // Đóng bottom-sheet "Chi tiết phản hồi" trên mobile bằng phím Esc.
  useEffect(() => {
    if (!activeHighlight) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setActiveHighlight(null);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [activeHighlight]);

  // Tách sẵn nội dung Task 1 / Task 2 từ bài làm thô
  const parsedContent = useMemo(() => parseSubmissionContent(selectedSubmission?.content), [selectedSubmission?.content]);

  // Gộp cả 3 loại phản hồi có thể highlight trong bài làm gốc (lỗi sai, nâng
  // cấp câu, gợi ý cấu trúc) thành 1 danh sách dùng chung cho CẢ Task 1 lẫn
  // Task 2 — giống cách "corrections" trước đây vẫn dùng chung 1 mảng cho cả
  // 2 task: renderHighlightedAnswer tự khớp text nên phần không thuộc đúng
  // task đang hiển thị sẽ tự động không tìm thấy vị trí và bị bỏ qua.
  const allHighlightItems: HighlightItem[] = useMemo(() => {
    const feedback = selectedSubmission?.feedback;
    if (!feedback) return [];
    return [
      ...(feedback.corrections ?? []).map((data) => ({ kind: "correction" as const, data })),
      ...(feedback.essay_upgrades ?? []).map((data) => ({ kind: "upgrade" as const, data })),
      ...(feedback.advanced_structures ?? []).map((data) => ({ kind: "structure" as const, data })),
    ];
  }, [selectedSubmission?.feedback]);

  const handleExportRawText = async () => {
    if (!selectedSubmission) return;
    await downloadSubmissionRawText(selectedSubmission.student_name, {
      task1Prompt: selectedSubmission.tests?.task1_prompt,
      task1ImageUrl: selectedSubmission.tests?.image_url,
      task1Answer: parsedContent.task1Answer,
      task2Prompt: selectedSubmission.tests?.task2_prompt,
      task2Answer: parsedContent.task2Answer,
    });
    setShowExportToast(true);
    setTimeout(() => setShowExportToast(false), 3000);
  };

  const handleDownloadDoc = () => {
    if (!selectedSubmission) return;
    void downloadSubmissionDoc(
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
    );
  };

  const hasHighlightableFeedback = allHighlightItems.length > 0;

  // Nội dung dùng chung cho cả cột "Chi tiết phản hồi" trên desktop lẫn bottom-sheet
  // trên mobile — tránh lặp JSX 2 lần cho cùng một nội dung. Nội dung khác nhau
  // theo loại highlight đang được chọn (lỗi sai / nâng cấp câu / gợi ý cấu trúc).
  const activeHighlightDetail = (() => {
    if (!activeHighlight) {
      return (
        <p className="text-sm text-slate-400 italic leading-relaxed">
          Bấm vào đoạn được tô sáng trong bài làm để xem chi tiết — vàng là lỗi sai, xanh dương là câu được viết lại hay hơn, xanh lá là gợi ý cấu trúc nâng cao.
        </p>
      );
    }

    if (activeHighlight.kind === "correction") {
      const c = activeHighlight.data;
      return (
        <div className="space-y-4">
          <div className="flex items-start gap-2.5">
            <div className="bg-cyan-50 text-cyan-600 rounded-full p-1.5 shrink-0">
              <Lightbulb className="h-3.5 w-3.5" />
            </div>
            <p className="text-sm font-semibold text-slate-800 leading-relaxed whitespace-pre-wrap">"{c.original}"</p>
          </div>
          <div>
            <p className="text-xs font-bold text-slate-500 mb-1">Giải thích:</p>
            <p className="text-sm text-slate-600 leading-relaxed">{c.explanation}</p>
          </div>
          <div>
            <p className="text-xs font-bold text-slate-500 mb-2">Gợi ý:</p>
            <div className="rounded-xl bg-red-50 border border-red-100 p-3 text-sm text-red-700 leading-relaxed line-through decoration-red-300/60 whitespace-pre-wrap">
              {c.original}
            </div>
            <div className="flex justify-center py-1 text-slate-300">↓</div>
            <div className="rounded-xl bg-emerald-50 border border-emerald-100 p-3 text-sm text-emerald-800 font-medium leading-relaxed whitespace-pre-wrap">
              {c.corrected}
            </div>
          </div>
        </div>
      );
    }

    if (activeHighlight.kind === "upgrade") {
      const u = activeHighlight.data;
      return (
        <div className="space-y-4">
          <div className="flex items-start gap-2.5">
            <div className="bg-sky-50 text-sky-600 rounded-full p-1.5 shrink-0">
              <Sparkles className="h-3.5 w-3.5" />
            </div>
            <p className="text-sm font-semibold text-slate-800 leading-relaxed">Câu này đã đúng — có thể viết hay hơn</p>
          </div>
          <div>
            <p className="text-xs font-bold text-slate-500 mb-1">Ghi chú:</p>
            <p className="text-sm text-slate-600 leading-relaxed">{u.note}</p>
          </div>
          <div>
            <p className="text-xs font-bold text-slate-500 mb-2">Nâng cấp:</p>
            <div className="rounded-xl bg-slate-50 border border-slate-200 p-3 text-sm text-slate-600 leading-relaxed whitespace-pre-wrap">
              {u.original}
            </div>
            <div className="flex justify-center py-1 text-slate-300">↓</div>
            <div className="rounded-xl bg-sky-50 border border-sky-100 p-3 text-sm text-sky-800 font-medium leading-relaxed whitespace-pre-wrap">
              {u.upgraded}
            </div>
          </div>
        </div>
      );
    }

    const s = activeHighlight.data;
    return (
      <div className="space-y-4">
        <div className="flex items-start gap-2.5">
          <div className="bg-emerald-50 text-emerald-600 rounded-full p-1.5 shrink-0">
            <Wand2 className="h-3.5 w-3.5" />
          </div>
          <p className="text-xs font-bold uppercase tracking-wide text-emerald-700 leading-relaxed">{s.structure_name}</p>
        </div>
        {s.original_sentence && (
          <div>
            <p className="text-xs font-bold text-slate-500 mb-2">Câu gốc → Áp dụng cấu trúc:</p>
            <div className="rounded-xl bg-slate-50 border border-slate-200 p-3 text-sm text-slate-600 leading-relaxed whitespace-pre-wrap">
              {s.original_sentence}
            </div>
            <div className="flex justify-center py-1 text-slate-300">↓</div>
          </div>
        )}
        <div className="rounded-xl bg-emerald-50 border border-emerald-100 p-3 text-sm text-emerald-800 font-medium leading-relaxed italic whitespace-pre-wrap">
          {s.example_sentence_en}
        </div>
        <div>
          <p className="text-xs font-bold text-slate-500 mb-1">Giải thích:</p>
          <p className="text-sm text-slate-600 leading-relaxed">{s.explanation_vi}</p>
        </div>
      </div>
    );
  })();

  return (
    <>
      {/* Chi tiết Bài làm */}
      <div
        className={`${showOnMobile ? "flex" : "hidden lg:flex"} flex-col rounded-3xl bg-white shadow-sm border border-slate-200/60 overflow-hidden lg:sticky lg:top-24 lg:max-h-[calc(100vh-7rem)] min-h-0`}
      >
        {/* Nút quay lại danh sách — chỉ có tác dụng/hiện trên mobile */}
        <button
          type="button"
          onClick={onBack}
          className="flex lg:hidden items-center gap-1.5 px-4 py-3 text-sm font-bold text-slate-600 border-b border-slate-100 bg-slate-50 hover:bg-slate-100 transition-colors shrink-0"
        >
          <ArrowLeft className="h-4 w-4" /> Danh sách bài làm
        </button>

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
            <div className="p-5 sm:p-6 border-b border-slate-100 bg-white shrink-0">
              <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
                <div>
                  <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">{selectedSubmission.student_name}</h2>
                  <p className="text-sm font-medium text-cyan-700 mt-1">{selectedSubmission.tests?.title}</p>
                </div>
                <span className={`text-xs font-bold px-3 py-1.5 rounded-full border ${statusStyles[selectedSubmission.status] || "bg-slate-50 border-slate-200 text-slate-600"}`}>
                  {statusLabels[selectedSubmission.status] || selectedSubmission.status}
                </span>
              </div>

              {/* Thời gian nộp bài + thời gian đã làm bài */}
              <div className="flex flex-wrap items-center gap-4 mb-4 text-xs font-semibold text-slate-500">
                <span className="flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5 text-slate-400" />
                  Nộp bài:{" "}
                  <span className="text-slate-700">
                    {selectedSubmission.submitted_at ? formatDateTime(selectedSubmission.submitted_at) : "Chưa nộp"}
                  </span>
                </span>
                <span className="flex items-center gap-1.5">
                  <Timer className="h-3.5 w-3.5 text-slate-400" />
                  Thời gian làm bài:{" "}
                  <span className="text-slate-700">
                    {formatDuration(selectedSubmission.started_at, selectedSubmission.submitted_at)}
                    {selectedSubmission.status === "in_progress" && " (đang tính...)"}
                  </span>
                </span>
              </div>

              {selectedSubmission.warning_count > 0 && (
                <div className="flex items-center gap-3 rounded-2xl bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200/60 p-4 text-sm font-semibold text-amber-900">
                  <div className="bg-amber-100 p-2 rounded-full text-amber-600 shrink-0"><ShieldAlert className="h-5 w-5" /></div>
                  Học sinh đã vi phạm quy chế thoát trang {selectedSubmission.warning_count}/5 lần!
                </div>
              )}
            </div>

            {/* Submission Body */}
            <div className="p-4 sm:p-6 space-y-8 bg-slate-50/30 overflow-y-auto custom-scrollbar flex-1 min-h-0">
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
                          onClick={handleExportRawText}
                          className="group p-2 rounded-lg text-slate-400 hover:bg-cyan-50 hover:text-cyan-600 hover:shadow-sm border border-transparent hover:border-cyan-200 transition-all"
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
                      {selectedSubmission.updated_at && (
                        <span className="font-medium text-blue-400">
                          · cập nhật {formatRelativeTime(selectedSubmission.updated_at, now)}
                        </span>
                      )}
                    </span>
                  )}
                </div>

                {/* Gợi ý cách xem lỗi tô sáng — chỉ hiện khi đã có kết quả chấm */}
                {hasHighlightableFeedback && (
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mb-3 text-xs font-semibold bg-slate-50 border border-slate-100 rounded-lg px-3 py-2 w-fit">
                    <span className="flex items-center gap-1.5 text-amber-700">
                      <span className="inline-block h-3 w-3 rounded-sm bg-amber-200/70 border border-amber-400 shrink-0" /> Lỗi sai
                    </span>
                    <span className="flex items-center gap-1.5 text-sky-700">
                      <span className="inline-block h-3 w-3 rounded-sm bg-sky-200/70 border border-sky-400 shrink-0" /> Câu nên viết hay hơn
                    </span>
                    <span className="flex items-center gap-1.5 text-emerald-700">
                      <span className="inline-block h-3 w-3 rounded-sm bg-emerald-200/70 border border-emerald-400 shrink-0" /> Gợi ý cấu trúc nâng cao
                    </span>
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
                        className="w-full flex items-center justify-between gap-2 bg-slate-900 text-white px-4 sm:px-5 py-3.5 hover:bg-slate-800 transition-colors"
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
                        <div className="p-4 sm:p-5 space-y-4">
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
                            <div className="whitespace-pre-wrap font-serif text-[15px] leading-[2] bg-[#fcfcfc] border border-slate-200 rounded-xl px-4 sm:px-6 py-6 text-slate-800 tracking-wide selection:bg-cyan-200 min-h-[120px]">
                              {parsedContent.task1Answer ? (
                                renderHighlightedAnswer(
                                  parsedContent.task1Answer,
                                  allHighlightItems,
                                  activeHighlight,
                                  setActiveHighlight,
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
                        className="w-full flex items-center justify-between gap-2 bg-slate-900 text-white px-4 sm:px-5 py-3.5 hover:bg-slate-800 transition-colors"
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
                        <div className="p-4 sm:p-5 space-y-4">
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
                            <div className="whitespace-pre-wrap font-serif text-[15px] leading-[2] bg-[#fcfcfc] border border-slate-200 rounded-xl px-4 sm:px-6 py-6 text-slate-800 tracking-wide selection:bg-cyan-200 min-h-[120px]">
                              {parsedContent.task2Answer ? (
                                renderHighlightedAnswer(
                                  parsedContent.task2Answer,
                                  allHighlightItems,
                                  activeHighlight,
                                  setActiveHighlight,
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
              <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-3 pt-6 border-t border-slate-200">

                {/* Nút chính: Chấm cả 2 Task - Ưu tiên hiển thị nổi bật nhất */}
                <button
                  onClick={() => onGrade(selectedSubmission, "both")}
                  disabled={isGrading || selectedSubmission.status === "in_progress" || !selectedSubmission.content}
                  className="flex w-full sm:w-auto items-center justify-center gap-2 bg-slate-900 hover:bg-black text-white px-5 py-2.5 rounded-lg text-sm font-semibold shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Chấm cả hai bài cùng lúc và tính trung bình cộng điểm Overall"
                >
                  {isGrading ? (
                    <Loader2 className="h-4 w-4 animate-spin shrink-0" />
                  ) : (
                    <Bot className="h-4 w-4 text-cyan-400 animate-pulse shrink-0" />
                  )}
                  <span>{selectedSubmission.feedback ? "AI Chấm lại cả 2 Task" : "AI Chấm cả 2 Task"}</span>
                </button>

                {/* Cụm nút phụ: Chấm riêng lẻ - Giao diện sáng (Outline) để phân biệt hoàn toàn với nút chính */}
                <div className="flex w-full sm:w-auto items-center gap-3">
                  <button
                    onClick={() => onGrade(selectedSubmission, "task1")}
                    disabled={isGrading || selectedSubmission.status === "in_progress" || !selectedSubmission.content}
                    className="flex-1 sm:flex-none flex justify-center bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 px-4 py-2.5 rounded-lg text-sm font-medium shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                    title="Chấm đơn lẻ chỉ đề bài Task 1"
                  >
                    Chấm riêng Task 1
                  </button>

                  <button
                    onClick={() => onGrade(selectedSubmission, "task2")}
                    disabled={isGrading || selectedSubmission.status === "in_progress" || !selectedSubmission.content}
                    className="flex-1 sm:flex-none flex justify-center bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 px-4 py-2.5 rounded-lg text-sm font-medium shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                    title="Chấm đơn lẻ chỉ đề bài Task 2"
                  >
                    Chấm riêng Task 2
                  </button>
                </div>

              <button
                onClick={handleDownloadDoc}
                disabled={!selectedSubmission.content}
                className="flex items-center justify-center gap-2 rounded-xl bg-white border border-slate-200 px-5 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-50 hover:text-cyan-700 hover:border-cyan-200 disabled:opacity-50 w-full sm:w-auto"
              >
                <FileDown className="h-4 w-4" /> Xuất File DOC
              </button>

              <button
                onClick={() => onDeleteSubmission(selectedSubmission)}
                disabled={isDeleting}
                className="flex items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700 transition hover:bg-red-100 disabled:opacity-50 w-full sm:w-auto sm:ml-auto"
              >
                <Trash2 className="h-4 w-4" /> Xóa bài
              </button>

              {selectedSubmission.status === "in_progress" && (
                <div className="w-full mt-2 flex items-center gap-2 text-xs font-medium text-slate-500 bg-slate-100/50 p-3 rounded-xl border border-slate-200 border-dashed">
                  <Clock className="h-4 w-4 shrink-0" /> Hệ thống đang chờ học sinh ấn nút nộp bài để có thể chấm điểm.
                </div>
              )}
            </div>

            {/* Nhận xét bổ sung của giáo viên */}
            <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-sm space-y-3">
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
                  onClick={() => onSaveComment(selectedSubmission.id, teacherCommentDraft)}
                  disabled={isSavingComment}
                  className="flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white hover:bg-emerald-500 shadow-sm transition disabled:opacity-50 w-full sm:w-auto"
                >
                  {isSavingComment ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                  Gửi nhận xét
                </button>
              </div>
            </div>

            {/* AI Feedback UI Premium */}
            {selectedSubmission.feedback && (
              <GradingResultPanel
                feedback={selectedSubmission.feedback}
                task1Answer={parsedContent.task1Answer}
                task2Answer={parsedContent.task2Answer}
              />
            )}
          </div>
          </div>
        )}
    </div >

      { hasHighlightableFeedback && (
        <>
          {/* Panel "Chi tiết phản hồi" trên desktop — cột thứ 3 cố định, cuộn riêng */}
          <div className="hidden lg:flex lg:flex-col rounded-3xl bg-white p-5 shadow-sm border border-slate-200/60 lg:sticky lg:top-24 lg:max-h-[calc(100vh-7rem)] overflow-y-auto custom-scrollbar">
            <h3 className="text-sm font-black text-slate-900 flex items-center gap-2 pb-3 border-b border-slate-100 shrink-0">
              <Lightbulb className="h-4 w-4 text-amber-500" /> Chi tiết phản hồi
            </h3>
            <div className="mt-4">{activeHighlightDetail}</div>
          </div>

          {/* Trên mobile: cửa sổ trượt lên từ dưới khi bấm vào đoạn tô sáng, thay vì
              chiếm chỗ cố định như 1 cột riêng (không đủ chỗ trên màn hình nhỏ). */}
          <div
            className={`lg:hidden fixed inset-0 z-[90] ${activeHighlight ? "pointer-events-auto" : "pointer-events-none"}`}
            aria-hidden={!activeHighlight}
          >
            <div
              className={`absolute inset-0 bg-slate-950/50 transition-opacity duration-300 ${activeHighlight ? "opacity-100" : "opacity-0"
                }`}
              onClick={() => setActiveHighlight(null)}
            />
            <div
              className={`absolute inset-x-0 bottom-0 max-h-[75vh] overflow-y-auto custom-scrollbar rounded-t-3xl bg-white p-5 pb-8 shadow-2xl transition-transform duration-300 ${activeHighlight ? "translate-y-0" : "translate-y-full"
                }`}
            >
              <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-slate-200" />
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                  <Lightbulb className="h-4 w-4 text-amber-500" /> Chi tiết phản hồi
                </h3>
                <button
                  type="button"
                  onClick={() => setActiveHighlight(null)}
                  className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                  aria-label="Đóng"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="mt-4">{activeHighlightDetail}</div>
            </div>
          </div>
        </>
      )
}
    </>
  );
}
