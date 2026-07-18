"use client";

import { useEffect, useState } from "react";
import { supabase, getAuthHeader } from "@/lib/supabase";
import type { SubmissionRow } from "@/lib/types";
import { GRADING_STEPS } from "@/components/teacher/GradingProgressModal";

// Quản lý danh sách bài nộp: tải + theo dõi realtime, chấm điểm (AI), xóa, lưu nhận xét.
export function useSubmissions(isAuthed: boolean) {
  const [submissions, setSubmissions] = useState<SubmissionRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isGrading, setIsGrading] = useState(false);
  const [gradingStep, setGradingStep] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSavingComment, setIsSavingComment] = useState(false);

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
      await loadSubmissions();
    };
    void load();

    const channel = supabase
      .channel("teacher-submissions")
      .on("postgres_changes", { event: "*", schema: "public", table: "submissions" }, () => void loadSubmissions())
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthed]);

  // Mô phỏng tiến trình chấm điểm ở phía client (backend không stream tiến độ thật),
  // mỗi bước hiển thị ~3 giây, dừng lại ở bước cuối để chờ kết quả thật từ server.
  useEffect(() => {
    if (!isGrading) {
      setGradingStep(0);
      return;
    }
    const interval = setInterval(() => {
      setGradingStep((prev) => (prev < GRADING_STEPS.length - 1 ? prev + 1 : prev));
    }, 3000);
    return () => clearInterval(interval);
  }, [isGrading]);

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
      taskType,
    };

    if (taskType === "both") {
      payload.task1Prompt = submission.tests.task1_prompt;
      payload.task2Prompt = submission.tests.task2_prompt;
    } else {
      payload.testPrompt = taskType === "task1" ? submission.tests.task1_prompt : submission.tests.task2_prompt;
    }

    try {
      const response = await fetch("/api/grade", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await getAuthHeader()) },
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

  // Xóa bài nộp: gọi qua API route (xác thực server-side), KHÔNG gọi thẳng
  // supabase.from("submissions").delete() từ client nữa. Bảng submissions
  // không có policy RLS cho phép ghi trực tiếp từ client (chỉ service-role
  // key trong API route mới ghi được) — route bên dưới tự kiểm tra người gọi
  // đã đăng nhập trước khi dùng service-role key để xóa.
  const handleDeleteSubmission = async (submission: SubmissionRow, onDeleted?: (id: string) => void) => {
    if (!window.confirm(`Xóa vĩnh viễn bài làm của học viên "${submission.student_name}"?`)) return;

    setIsDeleting(true);
    setError(null);

    try {
      const response = await fetch(`/api/submissions/${submission.id}`, {
        method: "DELETE",
        headers: { ...(await getAuthHeader()) },
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error ?? "Không thể xóa bài làm.");

      onDeleted?.(submission.id);
      void loadSubmissions();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể xóa bài làm.");
    } finally {
      setIsDeleting(false);
    }
  };

  // Lưu nhận xét bổ sung của giáo viên vào cột teacher_comment — cũng đi qua
  // API route có xác thực thay vì update thẳng từ client, cùng lý do như trên.
  const handleSaveComment = async (submissionId: string, comment: string) => {
    setIsSavingComment(true);
    setError(null);

    try {
      const response = await fetch(`/api/submissions/${submissionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...(await getAuthHeader()) },
        body: JSON.stringify({ teacher_comment: comment }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error ?? "Không thể lưu nhận xét.");
      void loadSubmissions();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể lưu nhận xét.");
    } finally {
      setIsSavingComment(false);
    }
  };

  return {
    submissions,
    loadSubmissions,
    isGrading,
    gradingStep,
    handleGrade,
    isDeleting,
    handleDeleteSubmission,
    isSavingComment,
    handleSaveComment,
    submissionsError: error,
    setSubmissionsError: setError,
  };
}
