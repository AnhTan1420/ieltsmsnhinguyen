"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Download, FileCheck2, Radio } from "lucide-react";
import type { SubmissionRow } from "@/lib/types";
import { parseSubmissionContent } from "@/lib/grading/parse";
import { downloadSubmissionDoc, downloadSubmissionRawText } from "@/lib/teacher/exportDoc";
import { useNow } from "@/hooks/useNow";
import { formatRelativeTime, type HighlightCluster, type HighlightItem } from "@/lib/teacher/submission-utils";
import GradingResultPanel from "../GradingResultPanel";
import SubmissionHeader from "./SubmissionHeader";
import TaskAnswerBlock from "./TaskAnswerBlock";
import HighlightDetailPanel from "./HighlightDetailPanel";
import SubmissionActions from "./SubmissionActions";
import TeacherCommentBox from "./TeacherCommentBox";

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

// Panel chi tiết bài làm — điều phối state (task đang mở, cụm highlight đang
// chọn, nháp nhận xét) và ghép các khối con lại: SubmissionHeader, 2x
// TaskAnswerBlock, SubmissionActions, TeacherCommentBox, GradingResultPanel,
// HighlightDetailPanel. Từng khối UI cụ thể nằm ở file riêng trong cùng thư
// mục — file này chỉ lo state + luồng dữ liệu giữa chúng.
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
  const [activeCluster, setActiveCluster] = useState<HighlightCluster | null>(null);
  const [showExportToast, setShowExportToast] = useState(false);

  // Đồng bộ nội dung nhận xét + thu gọn lại các Task mỗi khi chọn bài làm khác
  useEffect(() => {
    setTeacherCommentDraft(selectedSubmission?.teacher_comment ?? "");
    setExpandedTasks({ task1: false, task2: false });
    setActiveCluster(null);
  }, [selectedSubmission?.id]);

  // Tách sẵn nội dung Task 1 / Task 2 từ bài làm thô
  const parsedContent = useMemo(() => parseSubmissionContent(selectedSubmission?.content), [selectedSubmission?.content]);

  // Gộp cả 3 loại phản hồi có thể highlight trong bài làm gốc (lỗi sai, nâng
  // cấp câu, gợi ý cấu trúc) thành 1 danh sách dùng chung cho CẢ Task 1 lẫn
  // Task 2 — renderHighlightedAnswer tự khớp text nên phần không thuộc đúng
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
            <SubmissionHeader submission={selectedSubmission} />

            {/* Submission Body */}
            <div className="p-4 sm:p-6 space-y-8 bg-slate-50/30 overflow-y-auto custom-scrollbar flex-1 min-h-0">
              <div>
                <div className="flex items-center justify-between mb-4 border-b border-slate-200/80 pb-3">
                  <div className="flex items-center gap-2">
                    <label className="text-[15px] font-bold text-slate-800 flex items-center gap-2">
                      <FileCheck2 className="h-5 w-5 text-slate-500" /> Nội dung bài làm
                    </label>

                    {selectedSubmission.content && (
                      <div className="relative flex items-center">
                        <button
                          onClick={handleExportRawText}
                          className="group p-2 rounded-lg text-slate-400 hover:bg-cyan-50 hover:text-cyan-600 hover:shadow-sm border border-transparent hover:border-cyan-200 transition-all"
                          title="Xuất bài làm (Đề bài + Task 1/2)"
                        >
                          <Download className="h-4 w-4" />
                        </button>

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
                    <span className="flex items-center gap-1.5 text-violet-700">
                      <span className="inline-block h-3 w-3 rounded-sm bg-violet-200/70 border border-violet-400 shrink-0" /> Nhiều phản hồi ở đây
                    </span>
                  </div>
                )}

                {!selectedSubmission.content?.trim() ? (
                  <div className="flex items-center justify-center min-h-[200px] bg-[#fcfcfc] border border-slate-300 rounded-xl">
                    <span className="text-slate-400 italic font-sans text-sm">Học sinh chưa nhập nội dung nào...</span>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <TaskAnswerBlock
                      taskNumber={1}
                      prompt={selectedSubmission.tests?.task1_prompt}
                      imageUrl={selectedSubmission.tests?.image_url}
                      answer={parsedContent.task1Answer}
                      expanded={expandedTasks.task1}
                      onToggleExpanded={() => setExpandedTasks((prev) => ({ ...prev, task1: !prev.task1 }))}
                      highlightItems={allHighlightItems}
                      activeClusterStart={activeCluster?.start ?? null}
                      onSelectCluster={setActiveCluster}
                    />
                    <TaskAnswerBlock
                      taskNumber={2}
                      prompt={selectedSubmission.tests?.task2_prompt}
                      answer={parsedContent.task2Answer}
                      expanded={expandedTasks.task2}
                      onToggleExpanded={() => setExpandedTasks((prev) => ({ ...prev, task2: !prev.task2 }))}
                      highlightItems={allHighlightItems}
                      activeClusterStart={activeCluster?.start ?? null}
                      onSelectCluster={setActiveCluster}
                    />
                  </div>
                )}
              </div>

              <SubmissionActions
                submission={selectedSubmission}
                isGrading={isGrading}
                isDeleting={isDeleting}
                onGrade={onGrade}
                onDownloadDoc={handleDownloadDoc}
                onDeleteSubmission={onDeleteSubmission}
              />

              <TeacherCommentBox
                value={teacherCommentDraft}
                onChange={setTeacherCommentDraft}
                onSave={() => onSaveComment(selectedSubmission.id, teacherCommentDraft)}
                isSaving={isSavingComment}
              />

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
      </div>

      {hasHighlightableFeedback && (
        <HighlightDetailPanel activeCluster={activeCluster} onClose={() => setActiveCluster(null)} />
      )}
    </>
  );
}
