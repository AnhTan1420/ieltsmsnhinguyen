import { useCallback, useEffect, useRef, useState } from "react";
import { useAntiCheat } from "@/hooks/useAntiCheat";
import { useExamTimer } from "@/hooks/useExamTimer";
import { exitFullscreenSafe } from "@/lib/device-utils";
import { AUTOSAVE_INTERVAL_MS } from "@/lib/student-test-utils";

export type StudentTestStep = "setup" | "testing" | "submitted" | "disqualified";

type UseStudentTestStateArgs = {
  testId: string;
  durationMinutes: number;
  blockCopyPaste: boolean;
};

// Cấu hình thời gian lưu trữ màn hình chờ/kết quả (1 tiếng = 60 phút * 60 giây * 1000 ms)
const RESULT_EXPIRY_TIME_MS = 60 * 60 * 1000;
const getStorageKey = (testId: string) => `test_submission_state_${testId}`;

// Toàn bộ state + effect + handler của trang làm bài học sinh: khôi phục
// trạng thái "đã nộp" từ localStorage khi F5, chặn copy/paste theo cờ đề thi,
// autosave định kỳ, nối với useAntiCheat/useExamTimer, và các hàm bắt đầu/nộp
// bài. StudentTest.tsx (component) chỉ còn lo phần render, gọi hook này để
// lấy state + handler.
export function useStudentTestState({ testId, durationMinutes, blockCopyPaste }: UseStudentTestStateArgs) {
  const [step, setStep] = useState<StudentTestStep>("setup");
  const [studentName, setStudentName] = useState("");

  const [task1Answer, setTask1Answer] = useState("");
  const [task2Answer, setTask2Answer] = useState("");

  const [submissionId, setSubmissionId] = useState<string | null>(null);
  const [startedAt, setStartedAt] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // LOGIC KIỂM TRA TRẠNG THÁI LƯU TRỮ (LOCALSTORAGE) KHI TRANG VỪA LOAD
  useEffect(() => {
    if (!testId) return;

    const storageKey = getStorageKey(testId);
    const storedData = localStorage.getItem(storageKey);

    if (storedData) {
      try {
        const parsed = JSON.parse(storedData);
        const currentTime = new Date().getTime();

        if (currentTime < parsed.expiryTime) {
          // Còn hạn: Khôi phục lại trạng thái "submitted"
          setStep(parsed.step);
          setSubmissionId(parsed.submissionId);

          // Cài đặt bộ đếm giờ tự động reset khi đúng 5 phút trôi qua (khi user đang treo máy ở trang kết quả)
          const timeRemaining = parsed.expiryTime - currentTime;
          const timer = setTimeout(() => {
            localStorage.removeItem(storageKey);
            window.location.reload();
          }, timeRemaining);

          return () => clearTimeout(timer);
        } else {
          // Hết hạn (> 5 phút): Xóa dữ liệu cũ, hệ thống tự động ở màn "setup" để làm bài lại
          localStorage.removeItem(storageKey);
        }
      } catch {
        localStorage.removeItem(storageKey);
      }
    }
  }, [testId]);

  // Keep the latest answers in refs so the timer's onExpire callback (created once)
  // can always read the current text without needing to be re-created every keystroke.
  const answersRef = useRef({ task1Answer: "", task2Answer: "" });
  useEffect(() => {
    answersRef.current = { task1Answer, task2Answer };
  }, [task1Answer, task2Answer]);

  // Tính năng "Chặn copy/paste" — giáo viên bật/tắt theo từng đề thi trong panel
  // "Chỉnh sửa Đề thi". Khi bật, học sinh không thể copy/paste/cut trong lúc làm
  // bài (step "testing"); chỉ ngăn hành vi mặc định của trình duyệt, không chặn
  // gõ phím bình thường. Tắt cờ này thì không gắn listener nào -> copy/paste
  // hoạt động bình thường như cũ.
  //
  // Gắn ở CAPTURE PHASE (tham số thứ 3 = true) thay vì bubble mặc định, để
  // listener này chạy SỚM NHẤT trong pha capture, trước khi sự kiện lan tới
  // bất kỳ phần tử con nào (textarea, input...) — tránh trường hợp 1 handler
  // khác gọi stopPropagation() khiến document không nhận được sự kiện nữa.
  const blockCopyPasteRef = useRef(blockCopyPaste);
  useEffect(() => {
    blockCopyPasteRef.current = blockCopyPaste;
  }, [blockCopyPaste]);

  useEffect(() => {
    if (step !== "testing") return;

    const preventClipboardAction = (e: ClipboardEvent) => {
      if (!blockCopyPasteRef.current) return;
      e.preventDefault();
      e.stopPropagation();
    };

    document.addEventListener("copy", preventClipboardAction, true);
    document.addEventListener("paste", preventClipboardAction, true);
    document.addEventListener("cut", preventClipboardAction, true);

    return () => {
      document.removeEventListener("copy", preventClipboardAction, true);
      document.removeEventListener("paste", preventClipboardAction, true);
      document.removeEventListener("cut", preventClipboardAction, true);
    };
  }, [step]);

  // Lớp phòng thủ thứ 2, gắn thẳng trên React onCopy/onPaste/onCut của <form> làm
  // bài — dùng cùng cờ blockCopyPaste, phòng khi 1 phần tử con nào đó (vd thư
  // viện textarea) chặn sự kiện lan tới document ở trên.
  const handleClipboardEvent = useCallback(
    (e: React.ClipboardEvent) => {
      if (blockCopyPaste && step === "testing") {
        e.preventDefault();
      }
    },
    [blockCopyPaste, step],
  );

  const buildCombinedContent = useCallback(
    (t1: string, t2: string) =>
      `=== THÔNG TIN HỌC SINH ===\nHọ và tên: ${studentName}\n\n=== TASK 1 ===\n${t1}\n\n=== TASK 2 ===\n${t2}`,
    [studentName],
  );

  const finalizeSubmission = useCallback(
    async (reason: "manual" | "timeout") => {
      if (!submissionId) return;
      setIsSubmitting(true);
      setError(null);

      const { task1Answer: t1, task2Answer: t2 } = answersRef.current;
      const combinedContent = buildCombinedContent(t1, t2);

      try {
        const response = await fetch(`/api/submissions/${submissionId}/submit`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: combinedContent, reason }),
        });

        if (!response.ok) {
          const data = await response.json().catch(() => ({}));
          throw new Error(data.error ?? "Có lỗi xảy ra khi nộp bài.");
        }

        await exitFullscreenSafe();
        setStep("submitted");

        // Ghi lại trạng thái vào bộ nhớ cục bộ để chống F5 (Lưu trong 1 tiếng)
        const storageKey = getStorageKey(testId);
        localStorage.setItem(
          storageKey,
          JSON.stringify({
            step: "submitted",
            submissionId,
            expiryTime: new Date().getTime() + RESULT_EXPIRY_TIME_MS,
          }),
        );
      } catch (err) {
        setError(err instanceof Error ? err.message : "Có lỗi xảy ra khi nộp bài.");
      } finally {
        setIsSubmitting(false);
      }
    },
    [submissionId, buildCombinedContent, testId],
  );

  const handleTimeExpired = useCallback(() => {
    void finalizeSubmission("timeout");
  }, [finalizeSubmission]);

  const { warnings, maxWarnings, isLocked, fullscreenSupported, enterFullscreen } = useAntiCheat({
    submissionId,
    enabled: step === "testing",
    onWarning: (warningCount, reason) => {
      console.warn(`Cảnh báo lần ${warningCount} do: ${reason}`);
    },
    onDisqualified: () => {
      setStep("disqualified");
      // Auto-save answers when disqualified
      if (submissionId) {
        const { task1Answer: t1, task2Answer: t2 } = answersRef.current;
        const combinedContent = buildCombinedContent(t1, t2);
        void fetch(`/api/submissions/${submissionId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            content: combinedContent,
            end_reason: "disqualified",
            status: "disqualified",
          }),
        }).catch((err) => console.error("Không lưu được bài làm khi hủy thi:", err));
      }
    },
  });

  const { formatted, isLow } = useExamTimer({
    startedAt,
    durationMinutes,
    enabled: step === "testing",
    onExpire: handleTimeExpired,
  });

  // Autosave periodically so the teacher dashboard can watch the essay live.
  useEffect(() => {
    if (step !== "testing" || !submissionId) return;

    const interval = setInterval(() => {
      const { task1Answer: t1, task2Answer: t2 } = answersRef.current;
      const combinedContent = buildCombinedContent(t1, t2);
      void fetch(`/api/submissions/${submissionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: combinedContent }),
      }).catch((err) => console.error("Autosave thất bại:", err));
    }, AUTOSAVE_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [step, submissionId, buildCombinedContent]);

  const handleStartTest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentName.trim()) {
      setError("Vui lòng nhập họ và tên của bạn.");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await enterFullscreen();

      const response = await fetch("/api/submissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ testId, studentName: studentName.trim() }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Không thể khởi tạo bài thi.");

      setSubmissionId(data.submissionId);
      setStartedAt(data.startedAt);
      setStep("testing");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể khởi tạo bài thi. Vui lòng thử lại.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmitFinal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!task1Answer.trim() && !task2Answer.trim()) {
      setError("Vui lòng làm ít nhất một phần bài thi trước khi nộp.");
      return;
    }
    await finalizeSubmission("manual");
  };

  return {
    step,
    studentName,
    setStudentName,
    task1Answer,
    setTask1Answer,
    task2Answer,
    setTask2Answer,
    submissionId,
    isSubmitting,
    error,
    warnings,
    maxWarnings,
    isLocked,
    fullscreenSupported,
    formatted,
    isLow,
    handleClipboardEvent,
    handleStartTest,
    handleSubmitFinal,
  };
}
