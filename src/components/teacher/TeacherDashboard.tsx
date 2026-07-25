"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, BookOpen, Bot, ChevronRight, GraduationCap, LogOut, Loader2, Radio, Users, X } from "lucide-react";
import { useTeacherAuth } from "@/hooks/teacher/useTeacherAuth";
import { useNow } from "@/hooks/useNow";
import { formatRelativeTime } from "./submission-utils";
import { useSubmissions } from "@/hooks/teacher/useSubmissions";
import { useBulkActions } from "@/hooks/teacher/useBulkActions";
import { useTests } from "@/hooks/teacher/useTests";
import { useClasses } from "@/hooks/teacher/useClasses";
import SubmissionList from "./SubmissionList";
import SubmissionDetail from "./SubmissionDetail";
import ExamCreateForm from "./ExamCreateForm";
import ClassManagement from "./ClassManagement";
import GradingProgressModal from "./GradingProgressModal";

export default function TeacherDashboard() {
  const { authChecked, isAuthed, handleSignOut } = useTeacherAuth();
  const [activeTab, setActiveTab] = useState<"submissions" | "tests" | "classes">("submissions");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  // Lớp đang được chọn ở thanh tab lọc trong "Theo dõi & Chấm bài" —
  // "all" = xem tất cả, "none" = chỉ các bài của đề chưa gắn lớp nào.
  const [selectedClassId, setSelectedClassId] = useState<string>("all");

  // Tick mỗi giây để nhãn "cập nhật lần cuối X trước" cạnh trạng thái realtime
  // tự nhảy số dù không có event mới nào — chỉ ảnh hưởng UI, không gọi mạng.
  const now = useNow();

  // Chấm trạng thái realtime chỉ nhấp nháy TRONG CHỐC LÁT khi vừa có sự kiện
  // mới, thay vì animate-pulse liên tục suốt cả ngày khi đã "connected" —
  // nhấp nháy vô thời hạn là chuyển động nền gây mỏi mắt/mất tập trung khi
  // giáo viên nhìn màn hình nhiều giờ liền.
  const [justUpdated, setJustUpdated] = useState(false);

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
    realtimeStatus,
    lastRealtimeEventAt,
  } = useSubmissions(isAuthed);

  // Danh sách lớp học + đề thi — dùng để hiện thanh tab lọc theo lớp ở
  // "Theo dõi & Chấm bài" và số đề thi/lớp ở tab "Quản lý lớp học".
  const { classes, loadClasses } = useClasses(setFormError);
  const { tests, loadTests } = useTests(setFormError);

  useEffect(() => {
    if (!isAuthed) return;
    void loadClasses();
    void loadTests();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthed]);

  useEffect(() => {
    if (!lastRealtimeEventAt) return;
    setJustUpdated(true);
    const timeout = setTimeout(() => setJustUpdated(false), 2500);
    return () => clearTimeout(timeout);
  }, [lastRealtimeEventAt]);

  const testCountByClass = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const test of tests) {
      if (!test.class_id) continue;
      counts[test.class_id] = (counts[test.class_id] ?? 0) + 1;
    }
    return counts;
  }, [tests]);

  // Lọc bài nộp theo lớp đang chọn ở thanh tab — phân loại dựa trên lớp của
  // ĐỀ THI mà bài nộp đó thuộc về (submission.tests.class_id), không cần cột
  // class_id riêng trên submissions.
  const filteredSubmissions = useMemo(() => {
    if (selectedClassId === "all") return submissions;
    if (selectedClassId === "none") return submissions.filter((s) => !s.tests?.class_id);
    return submissions.filter((s) => s.tests?.class_id === selectedClassId);
  }, [submissions, selectedClassId]);

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
  } = useBulkActions(filteredSubmissions, loadSubmissions);

  const error = submissionsError || bulkActionsError || formError;
  const clearError = () => {
    setSubmissionsError(null);
    setBulkActionsError(null);
    setFormError(null);
  };

  const selectedSubmission = useMemo(
    () => filteredSubmissions.find((submission) => submission.id === selectedId) ?? filteredSubmissions[0],
    [selectedId, filteredSubmissions],
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
              <p className="hidden items-center gap-1.5 truncate text-xs text-slate-400 sm:flex">
                <span
                  className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                    realtimeStatus === "connected"
                      ? justUpdated
                        ? "animate-pulse bg-emerald-400"
                        : "bg-emerald-400"
                      : realtimeStatus === "error"
                        ? "bg-red-400"
                        : "animate-pulse bg-slate-500"
                  }`}
                />
                {realtimeStatus === "connected"
                  ? "Đã kết nối realtime — bài làm & cảnh báo cập nhật tức thời"
                  : realtimeStatus === "error"
                    ? "Mất kết nối realtime — đang thử lại..."
                    : "Đang kết nối realtime..."}
                {realtimeStatus === "connected" && lastRealtimeEventAt && (
                  <span className="text-slate-500"> · cập nhật lần cuối {formatRelativeTime(lastRealtimeEventAt, now)}</span>
                )}
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
            <Radio className={`h-4 w-4 ${activeTab === "submissions" ? "text-cyan-400" : ""}`} />
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
          <button
            onClick={() => setActiveTab("classes")}
            className={`flex flex-1 items-center justify-center gap-2 border-b-2 px-4 py-3 text-sm font-semibold transition-colors sm:flex-none ${
              activeTab === "classes"
                ? "border-cyan-400 text-white"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <GraduationCap className="h-4 w-4" />
            Quản lý lớp học
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
          <>
            {/* Thanh tab lọc theo lớp học — chỉ đổi danh sách bài làm hiển thị,
                UI của SubmissionList/SubmissionDetail bên dưới giữ nguyên. */}
            {classes.length > 0 && (
              <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
                <button
                  onClick={() => setSelectedClassId("all")}
                  className={`shrink-0 flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-bold border transition-colors ${
                    selectedClassId === "all"
                      ? "bg-slate-900 text-white border-slate-900"
                      : "bg-white text-slate-500 border-slate-200 hover:border-slate-300 hover:text-slate-700"
                  }`}
                >
                  Tất cả
                </button>
                {classes.map((cls) => (
                  <button
                    key={cls.id}
                    onClick={() => setSelectedClassId(cls.id)}
                    className={`shrink-0 flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-bold border transition-colors ${
                      selectedClassId === cls.id
                        ? "bg-cyan-500 text-slate-900 border-cyan-500"
                        : "bg-white text-slate-500 border-slate-200 hover:border-slate-300 hover:text-slate-700"
                    }`}
                  >
                    <GraduationCap className="h-3.5 w-3.5" /> {cls.name}
                  </button>
                ))}
                <button
                  onClick={() => setSelectedClassId("none")}
                  className={`shrink-0 flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-bold border transition-colors ${
                    selectedClassId === "none"
                      ? "bg-slate-900 text-white border-slate-900"
                      : "bg-white text-slate-500 border-slate-200 hover:border-slate-300 hover:text-slate-700"
                  }`}
                >
                  Chưa phân lớp
                </button>
              </div>
            )}

            <section
              className={`grid items-start gap-6 ${
                hasThirdColumn ? "lg:grid-cols-[280px_1fr_260px]" : "lg:grid-cols-[280px_1fr]"
              }`}
            >
              <div className={mobileShowDetail ? "hidden lg:block" : "block"}>
                <SubmissionList
                  submissions={filteredSubmissions}
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
          </>
        )}

        {/* TAB TẠO ĐỀ THI */}
        {activeTab === "tests" && <ExamCreateForm onError={setFormError} />}

        {/* TAB QUẢN LÝ LỚP HỌC */}
        {activeTab === "classes" && <ClassManagement onError={setFormError} testCountByClass={testCountByClass} />}
      </div>

      <GradingProgressModal isGrading={isGrading} gradingStep={gradingStep} />

      {/* Thêm chút CSS cho thanh cuộn (Scrollbar) nhìn mượt hơn */}
      <style dangerouslySetInnerHTML={{
        __html: `
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar:hover::-webkit-scrollbar-thumb { background-color: #94a3b8; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background-color: #cbd5e1; border-radius: 20px; }
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        html { scrollbar-width: none; -ms-overflow-style: none; }
        html::-webkit-scrollbar { display: none; }
      `}} />
    </main>
  );
}