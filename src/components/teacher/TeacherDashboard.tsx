"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, BookOpen, Bot, ChevronRight, LogOut, Loader2, Radio, Users, X } from "lucide-react";
import { useTeacherAuth } from "@/hooks/teacher/useTeacherAuth";
import { useSubmissions } from "@/hooks/teacher/useSubmissions";
import { useBulkActions } from "@/hooks/teacher/useBulkActions";
import SubmissionList from "./SubmissionList";
import SubmissionDetail from "./SubmissionDetail";
import ExamCreateForm from "./ExamCreateForm";
import GradingProgressModal from "./GradingProgressModal";

export default function TeacherDashboard() {
  const { authChecked, isAuthed, handleSignOut } = useTeacherAuth();
  const [activeTab, setActiveTab] = useState<"submissions" | "tests">("submissions");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  // Trên mobile, danh sách bài làm và chi tiết bài làm không thể hiện cùng lúc
  // (không đủ chỗ) — dùng cờ này để chuyển đổi "màn hình" giữa 2 phần, giống
  // điều hướng master-detail quen thuộc trên app di động. Trên desktop (lg+)
  // cờ này không có tác dụng gì, cả 2 luôn hiện song song như cũ.
  const [mobileShowDetail, setMobileShowDetail] = useState(false);

  const {
    submissions,
    loadSubmissions,
    isGrading,
    gradingStep,
    handleGrade,
    isDeleting,
    handleDeleteSubmission,
    isSavingComment,
    handleSaveComment,
    submissionsError,
    setSubmissionsError,
  } = useSubmissions(isAuthed);

  const {
    selectionMode,
    selectedIds,
    toggleSelectionMode,
    toggleSelectId,
    toggleSelectAll,
    isBulkDeleting,
    handleBulkDelete,
    isDownloadingAll,
    handleDownloadAll,
    bulkActionsError,
    setBulkActionsError,
  } = useBulkActions(submissions, loadSubmissions);

  const error = submissionsError || bulkActionsError || formError;
  const clearError = () => {
    setSubmissionsError(null);
    setBulkActionsError(null);
    setFormError(null);
  };

  const selectedSubmission = useMemo(
    () => submissions.find((submission) => submission.id === selectedId) ?? submissions[0],
    [selectedId, submissions],
  );

  const handleSelectSubmission = (id: string) => {
    setSelectedId(id);
    setMobileShowDetail(true);
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

  const hasThirdColumn = (selectedSubmission?.feedback?.corrections?.length ?? 0) > 0;

  return (
    <main className="min-h-screen bg-slate-50 text-slate-950">
      {/* Thanh điều hướng trên cùng — dính đầu trang, gọn nhẹ thay vì banner gradient
          lớn chiếm nhiều chỗ như trước, phù hợp cho một dashboard dùng hằng ngày. */}
      <header className="sticky top-0 z-50 border-b border-slate-800 bg-slate-950">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="shrink-0 rounded-lg border border-cyan-500/30 bg-cyan-500/20 p-1.5">
              <Bot className="h-5 w-5 text-cyan-400" />
            </div>
            <div className="min-w-0">
              <h1 className="truncate text-base font-bold leading-tight text-white sm:text-lg">Teacher Workspace</h1>
              <p className="hidden truncate text-xs text-slate-400 sm:block">
                Quản lý đề thi và theo dõi bài làm học viên theo thời gian thực.
              </p>
            </div>
          </div>

          <button
            onClick={handleSignOut}
            className="flex shrink-0 items-center gap-1.5 rounded-xl border border-red-900/50 bg-red-950/30 px-3 py-2 text-xs font-bold text-red-400 transition-colors hover:text-red-300 sm:px-4 sm:text-sm"
          >
            <LogOut className="h-4 w-4" /> <span className="hidden sm:inline">Đăng xuất</span>
          </button>
        </div>

        {/* Tab strip — full-bleed, chia đều 2 nút trên mobile để dễ bấm bằng ngón cái */}
        <div className="mx-auto flex max-w-7xl gap-1 px-4 pb-0 sm:px-6">
          <button
            onClick={() => setActiveTab("submissions")}
            className={`flex flex-1 items-center justify-center gap-2 border-b-2 px-4 py-3 text-sm font-semibold transition-colors sm:flex-none ${
              activeTab === "submissions"
                ? "border-cyan-400 text-white"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <Radio className={`h-4 w-4 ${activeTab === "submissions" ? "animate-pulse text-cyan-400" : ""}`} />
            Theo dõi &amp; Chấm bài
          </button>
          <button
            onClick={() => setActiveTab("tests")}
            className={`flex flex-1 items-center justify-center gap-2 border-b-2 px-4 py-3 text-sm font-semibold transition-colors sm:flex-none ${
              activeTab === "tests"
                ? "border-cyan-400 text-white"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <BookOpen className="h-4 w-4" />
            Quản lý đề thi
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6">
        {error && (
          <div className="flex items-center gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-red-900 shadow-sm animate-in fade-in slide-in-from-top-2">
            <div className="shrink-0 rounded-full bg-red-100 p-2">
              <AlertTriangle className="h-5 w-5 text-red-600" />
            </div>
            <p className="text-sm font-medium">{error}</p>
            <button onClick={clearError} className="ml-auto shrink-0 p-1 text-red-400 hover:text-red-600">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {activeTab === "submissions" && (
          <section
            className={`grid items-start gap-6 ${
              hasThirdColumn ? "lg:grid-cols-[280px_1fr_260px]" : "lg:grid-cols-[280px_1fr]"
            }`}
          >
            <div className={mobileShowDetail ? "hidden lg:block" : "block"}>
              <SubmissionList
                submissions={submissions}
                selectedId={selectedSubmission?.id ?? null}
                onSelect={handleSelectSubmission}
                selectionMode={selectionMode}
                selectedIds={selectedIds}
                toggleSelectionMode={toggleSelectionMode}
                toggleSelectId={toggleSelectId}
                toggleSelectAll={toggleSelectAll}
                isBulkDeleting={isBulkDeleting}
                onBulkDelete={() =>
                  handleBulkDelete((deletedIds) => {
                    if (selectedId && deletedIds.includes(selectedId)) setSelectedId(null);
                  })
                }
                isDownloadingAll={isDownloadingAll}
                onDownloadAll={handleDownloadAll}
              />
            </div>

            <SubmissionDetail
              selectedSubmission={selectedSubmission}
              isGrading={isGrading}
              isDeleting={isDeleting}
              isSavingComment={isSavingComment}
              showOnMobile={mobileShowDetail}
              onBack={() => setMobileShowDetail(false)}
              onGrade={handleGrade}
              onDeleteSubmission={(submission) =>
                handleDeleteSubmission(submission, (id) => {
                  if (selectedId === id) setSelectedId(null);
                })
              }
              onSaveComment={handleSaveComment}
            />
          </section>
        )}

        {/* TAB TẠO ĐỀ THI */}
        {activeTab === "tests" && <ExamCreateForm onError={setFormError} />}
      </div>

      <GradingProgressModal isGrading={isGrading} gradingStep={gradingStep} />

      {/* Thêm chút CSS cho thanh cuộn (Scrollbar) nhìn mượt hơn */}
      <style dangerouslySetInnerHTML={{
        __html: `
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background-color: #cbd5e1; border-radius: 20px; }
        .custom-scrollbar:hover::-webkit-scrollbar-thumb { background-color: #94a3b8; }
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}} />
    </main>
  );
}
