"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AlertTriangle, Info, Send, ShieldAlert, Timer, User } from "lucide-react";
import { useAntiCheat } from "@/hooks/useAntiCheat";
import { useExamTimer } from "@/hooks/useExamTimer";
import { exitFullscreenSafe } from "@/lib/device-utils";
import { AUTOSAVE_INTERVAL_MS, TASK1_MIN_WORDS, TASK2_MIN_WORDS, countWords, scrollToRef } from "@/lib/student-test-utils";
import NavPill from "./NavPill";
import TaskCard from "./TaskCard";
import SetupScreen from "./SetupScreen";
import DisqualifiedScreen from "./DisqualifiedScreen";
import SubmittedScreen from "./SubmittedScreen";
import ImageZoomOverlay from "./ImageZoomOverlay";

export interface StudentTestProps {
  testId: string;
  title: string;
  task1Prompt: string | null;
  task2Prompt: string | null;
  imageUrl: string | null;
  durationMinutes: number;
}

type Step = "setup" | "testing" | "submitted" | "disqualified";

export default function StudentTest({
  testId,
  title,
  task1Prompt,
  task2Prompt,
  imageUrl,
  durationMinutes,
}: StudentTestProps) {
  const [step, setStep] = useState<Step>("setup");
  const [studentName, setStudentName] = useState("");

  const [task1Answer, setTask1Answer] = useState("");
  const [task2Answer, setTask2Answer] = useState("");

  const [submissionId, setSubmissionId] = useState<string | null>(null);
  const [startedAt, setStartedAt] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isImageZoomed, setIsImageZoomed] = useState(false);

  const task1Ref = useRef<HTMLElement | null>(null);
  const task2Ref = useRef<HTMLElement | null>(null);
  const submitRef = useRef<HTMLDivElement | null>(null);

  // Keep the latest answers in refs so the timer's onExpire callback (created once)
  // can always read the current text without needing to be re-created every keystroke.
  const answersRef = useRef({ task1Answer: "", task2Answer: "" });
  useEffect(() => {
    answersRef.current = { task1Answer, task2Answer };
  }, [task1Answer, task2Answer]);

  // Đóng ảnh phóng to bằng phím Esc cho tiện thao tác trong lúc thi.
  useEffect(() => {
    if (!isImageZoomed) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsImageZoomed(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isImageZoomed]);

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
      } catch (err) {
        setError(err instanceof Error ? err.message : "Có lỗi xảy ra khi nộp bài.");
      } finally {
        setIsSubmitting(false);
      }
    },
    [submissionId, buildCombinedContent],
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
            status: "disqualified"
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
      // Cố gắng bật fullscreen ngay lập tức (cần gọi đồng bộ ngay trong handler
      // click/submit do quy tắc bảo mật của trình duyệt về requestFullscreen()).
      // Trên các thiết bị không hỗ trợ (ví dụ Safari iOS), hàm này sẽ không throw
      // mà chỉ trả về false, bài thi vẫn tiếp tục bình thường - chỉ là không
      // ở chế độ toàn màn hình. Việc giám sát chuyển tab/thoát app vẫn hoạt động.
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

  if (step === "setup") {
    return (
      <SetupScreen
        title={title}
        durationMinutes={durationMinutes}
        studentName={studentName}
        onStudentNameChange={setStudentName}
        error={error}
        isSubmitting={isSubmitting}
        onSubmit={handleStartTest}
        fullscreenSupported={fullscreenSupported}
      />
    );
  }

  if (step === "disqualified" || isLocked || warnings >= maxWarnings) {
    return <DisqualifiedScreen warnings={warnings} maxWarnings={maxWarnings} />;
  }

  if (step === "submitted") {
    return <SubmittedScreen />;
  }

  // ==========================================
  // MÀN HÌNH 4: GIAO DIỆN LÀM BÀI CHÍNH
  // ==========================================
  const task1Words = countWords(task1Answer);
  const task2Words = countWords(task2Answer);
  const hasTask1 = Boolean(task1Prompt || imageUrl);
  const hasTask2 = Boolean(task2Prompt);

  return (
    <main className="min-h-screen bg-slate-50 text-slate-950">
      {/* Thanh trên cùng dính đầu trang: đồng hồ luôn hiển thị dù cuộn xuống Task 2,
          tránh học sinh phải kéo lên để biết còn bao nhiêu thời gian. */}
      <header className="sticky top-0 z-40 border-b border-white/5 bg-[#0b0f17]/95 backdrop-blur supports-[backdrop-filter]:bg-[#0b0f17]/80">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-3">
          <div className="min-w-0">
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.25em] text-cyan-400/80">
              IELTS Writing Test
            </p>
            <h1 className="truncate text-lg font-bold leading-tight text-white">{title}</h1>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <div className="hidden items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-slate-300 sm:flex">
              <User className="h-3.5 w-3.5 text-slate-400" />
              <span className="font-semibold text-white">{studentName}</span>
            </div>
            <div
              className={`flex items-center gap-2 rounded-full px-4 py-2 font-mono text-lg font-bold tabular-nums ${
                isLow
                  ? "animate-pulse bg-red-500/15 text-red-300 ring-1 ring-red-500/40"
                  : "bg-cyan-500/10 text-cyan-300 ring-1 ring-cyan-500/20"
              }`}
            >
              <Timer className="h-4 w-4" />
              {formatted}
            </div>
          </div>
        </div>

        {/* Sub-nav: nhảy nhanh giữa các phần, không mất dấu đang làm tới đâu.
            Chỉ hiện pill của task thực sự tồn tại trong đề (đề có thể chỉ có Task 2). */}
        <div className="border-t border-white/5">
          <div className="no-scrollbar mx-auto flex max-w-6xl items-center gap-2 overflow-x-auto px-6 py-2.5">
            {hasTask1 && <NavPill label="Task 1" done={task1Words > 0} onClick={() => scrollToRef(task1Ref)} />}
            {hasTask2 && <NavPill label="Task 2" done={task2Words > 0} onClick={() => scrollToRef(task2Ref)} />}
            <span className="flex-1" />
            <button
              type="button"
              onClick={() => scrollToRef(submitRef)}
              className="shrink-0 whitespace-nowrap rounded-full border border-cyan-500/20 px-3 py-1.5 text-xs font-semibold text-cyan-400 transition hover:border-cyan-500/40 hover:text-cyan-300"
            >
              Đi tới nộp bài →
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-6 py-8">
        {fullscreenSupported === false && (
          <div className="mb-6 flex items-center gap-3 rounded-2xl border border-sky-200 bg-sky-50 p-4 text-sm text-sky-800">
            <Info className="h-5 w-5 shrink-0" />
            Trình duyệt trên thiết bị này không hỗ trợ chế độ toàn màn hình (thường gặp trên Safari
            iPhone/iPad), nên bài thi sẽ chạy ở chế độ bình thường. Hệ thống vẫn giám sát việc chuyển
            tab/ứng dụng khác như bình thường.
          </div>
        )}

        {warnings > 0 && (
          <div
            className={`mb-6 flex items-center justify-between gap-4 rounded-2xl px-6 py-4 shadow-sm ${
              warnings >= maxWarnings
                ? "animate-pulse border border-red-400 bg-red-200 text-red-900"
                : "border border-red-300 bg-red-100 text-red-800"
            }`}
          >
            <div className="flex items-center gap-3 font-semibold">
              <ShieldAlert className="h-6 w-6 shrink-0 text-red-600" />
              <span>
                {warnings >= maxWarnings
                  ? "Bạn đã vi phạm quá số lần cho phép! Bài thi bị hủy."
                  : `Cảnh báo vi phạm quy chế thi: Bạn đã thoát toàn màn hình hoặc chuyển tab. ${
                      warnings >= maxWarnings - 1 ? "Lần tiếp theo bài thi sẽ bị hủy!" : ""
                    }`}
              </span>
            </div>
            <span className="shrink-0 rounded-lg bg-red-200 px-3 py-1 text-lg font-bold">
              {warnings} / {maxWarnings}
            </span>
          </div>
        )}

        {error && (
          <div className="mb-6 flex items-center gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 font-semibold text-red-900">
            <AlertTriangle className="h-5 w-5 shrink-0" /> {error}
          </div>
        )}

        <form onSubmit={handleSubmitFinal} className="space-y-8">
          {hasTask1 && (
            <TaskCard
              taskNumber={1}
              prompt={task1Prompt}
              imageUrl={imageUrl}
              answer={task1Answer}
              onAnswerChange={setTask1Answer}
              minWords={TASK1_MIN_WORDS}
              sectionRef={task1Ref}
              onImageZoom={() => setIsImageZoomed(true)}
            />
          )}

          {hasTask2 && (
            <TaskCard
              taskNumber={2}
              prompt={task2Prompt}
              answer={task2Answer}
              onAnswerChange={setTask2Answer}
              minWords={TASK2_MIN_WORDS}
              sectionRef={task2Ref}
            />
          )}

          <div ref={submitRef} className="flex scroll-mt-32 flex-col items-center gap-4 pb-16 pt-4 text-center">
            <div className="flex items-center gap-6 text-sm font-medium text-slate-500">
              <span>
                Task 1: <strong className="text-slate-800">{task1Words}</strong> từ
              </span>
              <span className="h-4 w-px bg-slate-200" />
              <span>
                Task 2: <strong className="text-slate-800">{task2Words}</strong> từ
              </span>
            </div>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center gap-2 rounded-2xl bg-cyan-600 px-8 py-4 text-lg font-bold text-white transition-all hover:bg-cyan-500 hover:shadow-lg hover:shadow-cyan-500/30 disabled:opacity-50"
            >
              <Send className="h-5 w-5" />
              {isSubmitting ? "Đang xử lý..." : "Hoàn thành & Nộp bài"}
            </button>
            <p className="max-w-sm text-xs text-slate-400">Sau khi nộp, bạn sẽ không thể chỉnh sửa lại bài làm.</p>
          </div>
        </form>
      </div>

      {imageUrl && isImageZoomed && (
        <ImageZoomOverlay imageUrl={imageUrl} onClose={() => setIsImageZoomed(false)} />
      )}
    </main>
  );
}
