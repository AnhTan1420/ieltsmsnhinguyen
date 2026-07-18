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
      <main className="min-h-screen bg-slate-1000 flex flex-col items-center justify-center p-6 text-white text-center">
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
            <button onClick={clearError} className="ml-auto text-red-400 hover:text-red-600">
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
            <SubmissionList
              submissions={submissions}
              selectedId={selectedSubmission?.id ?? null}
              onSelect={setSelectedId}
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

            <SubmissionDetail
              selectedSubmission={selectedSubmission}
              isGrading={isGrading}
              isDeleting={isDeleting}
              isSavingComment={isSavingComment}
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
      `}} />
    </main>
  );
}
