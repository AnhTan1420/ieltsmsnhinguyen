"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  CheckCircle2,
  AlertTriangle,
  Send,
  User,
  Maximize,
  ShieldAlert,
  Timer,
  ZoomIn,
  X,
} from "lucide-react";
import { useAntiCheat } from "@/hooks/useAntiCheat";
import { useExamTimer } from "@/hooks/useExamTimer";

export interface StudentTestProps {
  testId: string;
  title: string;
  task1Prompt: string | null;
  task2Prompt: string | null;
  imageUrl: string | null;
  durationMinutes: number;
}

type Step = "setup" | "testing" | "submitted" | "disqualified";

const AUTOSAVE_INTERVAL_MS = 5000;

// Số từ tối thiểu theo band descriptor thật của IELTS Writing — khớp với
// TASK_CONFIG.task1/task2.minWords bên `src/lib/grading/prompt.ts` để thanh
// tiến độ hiển thị cho học sinh và mức phạt AI chấm ở phía sau dùng chung một
// "sự thật" duy nhất, không lệch số với nhau.
const TASK1_MIN_WORDS = 150;
const TASK2_MIN_WORDS = 250;

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter((w) => w.length > 0).length;
}

function scrollToRef(ref: React.RefObject<HTMLElement | null>) {
  ref.current?.scrollIntoView({ behavior: "smooth", block: "start" });
}

// Pill điều hướng nhanh trong thanh sub-nav dính đầu trang — tích xanh khi
// học sinh đã bắt đầu gõ bài, giúp định vị "mình đang ở đâu" trong bài thi.
function NavPill({ label, done, onClick }: { label: string; done: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 py-1.5 text-xs font-bold transition ${
        done
          ? "bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/30"
          : "bg-white/5 text-slate-300 ring-1 ring-white/10 hover:bg-white/10"
      }`}
    >
      {done && <CheckCircle2 className="h-3.5 w-3.5" />}
      {label}
    </button>
  );
}

type TaskCardProps = {
  taskNumber: 1 | 2;
  prompt: string | null;
  imageUrl?: string | null;
  answer: string;
  onAnswerChange: (value: string) => void;
  minWords: number;
  sectionRef: React.RefObject<HTMLElement | null>;
  onImageZoom?: () => void;
};

// Thẻ 1 Task: panel trái là "tờ đề" (nền giấy ngà, chữ serif — mô phỏng cảm
// giác đọc đề thi in giấy thật), panel phải là khung viết bài + thanh tiến độ
// số từ tối thiểu (điều học sinh IELTS luôn lo lắng nhất khi làm bài).
function TaskCard({
  taskNumber,
  prompt,
  imageUrl,
  answer,
  onAnswerChange,
  minWords,
  sectionRef,
  onImageZoom,
}: TaskCardProps) {
  const words = countWords(answer);
  const pct = Math.min(100, Math.round((words / minWords) * 100));
  const met = words >= minWords;

  return (
    <section ref={sectionRef} className="scroll-mt-32 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
      <div className="grid lg:grid-cols-2">
        {/* Panel đề bài — "tờ giấy thi" */}
        <div className="relative border-b border-[#E4D9B8] bg-[#F6F1E2] p-6 sm:p-8 lg:border-b-0 lg:border-r">
          <span
            aria-hidden
            className="pointer-events-none absolute -top-3 right-4 select-none font-serif text-[110px] leading-none text-[#E9DFC0]"
          >
            {taskNumber}
          </span>
          <div className="relative">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-900 px-3 py-1 text-xs font-bold uppercase tracking-wider text-white">
              Task {taskNumber}
            </span>
            <p className="mt-4 whitespace-pre-wrap font-serif text-[17px] leading-[1.85] text-slate-800">{prompt}</p>

            {imageUrl && (
              <button
                type="button"
                onClick={onImageZoom}
                className="group mt-5 block w-full overflow-hidden rounded-xl border border-[#E4D9B8] bg-white text-left transition hover:border-cyan-300"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={imageUrl} alt="Biểu đồ minh họa Task 1" className="max-h-[440px] w-full object-contain" />
                <span className="flex items-center justify-center gap-1.5 border-t border-[#E4D9B8] bg-white/80 py-2 text-xs font-semibold text-slate-500 transition group-hover:text-cyan-700">
                  <ZoomIn className="h-3.5 w-3.5" /> Bấm để phóng to
                </span>
              </button>
            )}
          </div>
        </div>

        {/* Panel bài làm */}
        <div className="flex flex-col p-6 sm:p-8">
          <label className="mb-2 text-sm font-semibold text-slate-700">Bài làm Task {taskNumber} của bạn</label>
          <textarea
            className="min-h-[320px] w-full flex-1 resize-y rounded-2xl border border-slate-300 p-4 font-serif text-[15px] leading-[1.9] text-slate-800 outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10"
            placeholder="Nhập bài làm tiếng Anh..."
            value={answer}
            onChange={(e) => onAnswerChange(e.target.value)}
          />

          <div className="mt-3">
            <div className="mb-1.5 flex items-center justify-between text-xs font-semibold">
              <span className={`flex items-center gap-1 ${met ? "text-emerald-600" : "text-slate-600"}`}>
                {met && <CheckCircle2 className="h-3.5 w-3.5" />}
                {words} / {minWords} từ
              </span>
              <span className="text-slate-400">
                {met ? "Đã đạt yêu cầu tối thiểu" : `Còn thiếu ${minWords - words} từ`}
              </span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
              <div
                className={`h-full rounded-full transition-all duration-500 ${met ? "bg-emerald-500" : "bg-amber-400"}`}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

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

        if (document.fullscreenElement) {
          await document.exitFullscreen().catch(() => {});
        }
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

  const { warnings, maxWarnings, isLocked, enterFullscreen } = useAntiCheat({
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
        }).catch(() => {});
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
      }).catch(() => {});
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
      // Force fullscreen immediately (must be called synchronously from the click/submit
      // handler due to browser security rules around requestFullscreen()).
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

  // ==========================================
  // MÀN HÌNH 1: NHẬP TÊN TRƯỚC KHI THI
  // ==========================================
  if (step === "setup") {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-slate-50 p-6 text-slate-950">
        <div className="w-full max-w-md">
          <div className="mb-6 text-center">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-900 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.2em] text-white">
              IELTS Writing Test
            </span>
          </div>

          <div className="w-full rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
            <h1 className="mb-1 font-serif text-2xl font-bold leading-snug text-slate-900">{title}</h1>
            <p className="mb-6 text-sm text-slate-500">
              Thời gian làm bài: <strong className="font-semibold text-slate-700">{durationMinutes} phút</strong>
            </p>

            <ul className="mb-6 space-y-2.5 text-sm leading-relaxed text-slate-600">
              <li className="flex items-start gap-2.5">
                <Maximize className="mt-0.5 h-4 w-4 shrink-0 text-cyan-600" />
                Bài thi chạy toàn màn hình (fullscreen) trong suốt thời gian làm bài.
              </li>
              <li className="flex items-start gap-2.5">
                <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                Hệ thống giám sát hành vi thoát fullscreen / chuyển tab — tối đa 5 lần vi phạm trước khi bài bị hủy.
              </li>
              <li className="flex items-start gap-2.5">
                <Timer className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                Bài sẽ tự động nộp khi hết giờ, kể cả khi bạn chưa bấm nút nộp.
              </li>
            </ul>

            {error && (
              <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>
            )}

            <form onSubmit={handleStartTest} className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-semibold text-slate-700">Họ và tên của bạn</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    required
                    className="w-full rounded-xl border border-slate-300 py-3 pl-10 pr-4 outline-none focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10"
                    placeholder="Ví dụ: Nguyễn Văn A"
                    value={studentName}
                    onChange={(e) => setStudentName(e.target.value)}
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting || !studentName.trim()}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 py-3.5 font-bold text-white transition hover:bg-slate-800 disabled:opacity-50"
              >
                <Maximize className="h-5 w-5" />
                {isSubmitting ? "Đang tải bài thi..." : "Vào phòng thi (Bật Fullscreen)"}
              </button>
            </form>
          </div>
        </div>
      </main>
    );
  }

  // ==========================================
  // MÀN HÌNH 2: BỊ HỦY BÀI THI (GIAN LẬN)
  // ==========================================
  if (step === "disqualified" || isLocked || warnings >= maxWarnings) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-slate-950 p-6 text-center text-white">
        <ShieldAlert className="mb-4 h-20 w-20 text-red-500" />
        <h1 className="mb-2 text-3xl font-bold text-red-500">BÀI THI BỊ HỦY</h1>
        <p className="max-w-md text-slate-400">
          Bạn đã vi phạm quy chế thi (thoát toàn màn hình hoặc chuyển tab) {warnings} lần.
          {warnings >= maxWarnings && ` Giới hạn tối đa là ${maxWarnings} lần.`}
          Bài làm của bạn đã bị khóa và đánh dấu gian lận.
        </p>
      </main>
    );
  }

  // ==========================================
  // MÀN HÌNH 3: NỘP BÀI THÀNH CÔNG
  // ==========================================
  if (step === "submitted") {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-slate-50 p-6 text-slate-950">
        <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <CheckCircle2 className="mx-auto mb-4 h-16 w-16 text-emerald-500" />
          <h1 className="mb-2 text-2xl font-bold text-slate-900">Nộp bài thành công!</h1>
          <p className="mb-6 text-slate-500">
            Bạn đã hoàn thành bài thi IELTS Writing một cách an toàn. Hệ thống AI đang chấm bài và giáo viên sẽ xem
            lại kết quả sớm nhất.
          </p>
        </div>
      </main>
    );
  }

  // ==========================================
  // MÀN HÌNH 4: GIAO DIỆN LÀM BÀI CHÍNH
  // ==========================================
  const task1Words = countWords(task1Answer);
  const task2Words = countWords(task2Answer);

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

        {/* Sub-nav: nhảy nhanh giữa các phần, không mất dấu đang làm tới đâu */}
        <div className="border-t border-white/5">
          <div className="no-scrollbar mx-auto flex max-w-6xl items-center gap-2 overflow-x-auto px-6 py-2.5">
            <NavPill label="Task 1" done={task1Words > 0} onClick={() => scrollToRef(task1Ref)} />
            <NavPill label="Task 2" done={task2Words > 0} onClick={() => scrollToRef(task2Ref)} />
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
          {(task1Prompt || imageUrl) && (
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

          {task2Prompt && (
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

      {/* Ảnh biểu đồ Task 1 phóng to */}
      {imageUrl && isImageZoomed && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/90 p-6 backdrop-blur-sm"
          onClick={() => setIsImageZoomed(false)}
        >
          <button
            type="button"
            onClick={() => setIsImageZoomed(false)}
            className="absolute right-5 top-5 rounded-full bg-white/10 p-2 text-white transition hover:bg-white/20"
            aria-label="Đóng"
          >
            <X className="h-5 w-5" />
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imageUrl}
            alt="Biểu đồ Task 1 (phóng to)"
            className="max-h-[88vh] max-w-[92vw] w-auto rounded-2xl border border-white/10 bg-white object-contain shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </main>
  );
}
