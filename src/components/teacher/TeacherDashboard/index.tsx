"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, X } from "lucide-react";
import { useTeacherAuth } from "@/hooks/teacher/useTeacherAuth";
import { useNow } from "@/hooks/useNow";
import { useSubmissions } from "@/hooks/teacher/useSubmissions";
import { useBulkActions } from "@/hooks/teacher/useBulkActions";
import { useTests } from "@/hooks/teacher/useTests";
import { useClasses } from "@/hooks/teacher/useClasses";
import SubmissionList from "../SubmissionList";
import SubmissionDetail from "../SubmissionDetail";
import ExamCreateForm from "../ExamCreateForm";
import ClassManagement from "../ClassManagement";
import GradingProgressModal from "../GradingProgressModal";
import DashboardHeader, { type DashboardTab } from "./DashboardHeader";
import ClassFilterTabs from "./ClassFilterTabs";
import ScrollbarStyles from "./ScrollbarStyles";
import { AuthCheckingScreen, SignInPromptScreen } from "./TeacherAuthScreens";

// Điều phối toàn bộ trang giáo viên: state (tab đang mở, bài đang chọn, bộ lọc
// lớp...), 4 hook nghiệp vụ (auth/submissions/bulk actions/tests+classes), rồi
// ghép JSX từ các component con trong cùng thư mục. File này không còn tự vẽ
// header/tab-strip/scrollbar-CSS nữa — logic state vẫn giữ nguyên 100% so với
// bản gốc, chỉ phần render được tách ra.
export default function TeacherDashboard() {
  const { authChecked, isAuthed, handleSignOut } = useTeacherAuth();
  const [activeTab, setActiveTab] = useState<DashboardTab>("submissions");
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

  if (!authChecked) return <AuthCheckingScreen />;
  if (!isAuthed) return <SignInPromptScreen />;

  const hasThirdColumn = (selectedSubmission?.feedback?.corrections?.length ?? 0) > 0;

  return (
    <main className="min-h-screen bg-slate-50 text-slate-950">
      <DashboardHeader
        realtimeStatus={realtimeStatus}
        justUpdated={justUpdated}
        lastRealtimeEventAt={lastRealtimeEventAt}
        now={now}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onSignOut={handleSignOut}
      />

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
            <ClassFilterTabs classes={classes} selectedClassId={selectedClassId} onSelect={setSelectedClassId} />

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

      <ScrollbarStyles />
    </main>
  );
}
