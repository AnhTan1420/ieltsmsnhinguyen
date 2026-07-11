"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CheckCircle2, AlertTriangle, Send, User, Maximize, ShieldAlert, Timer } from "lucide-react";
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

  // Keep the latest answers in refs so the timer's onExpire callback (created once)
  // can always read the current text without needing to be re-created every keystroke.
  const answersRef = useRef({ task1Answer: "", task2Answer: "" });
  useEffect(() => {
    answersRef.current = { task1Answer, task2Answer };
  }, [task1Answer, task2Answer]);

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
      <main className="min-h-screen bg-slate-100 flex flex-col items-center justify-center p-6 text-slate-950">
        <div className="bg-white p-8 rounded-3xl shadow-sm max-w-md w-full border border-slate-200">
          <h1 className="text-2xl font-bold text-slate-900 mb-2">{title}</h1>
          <p className="text-slate-500 mb-6 text-sm">
            Vui lòng điền thông tin của bạn. Bài thi sẽ chạy toàn màn hình, có giới hạn {durationMinutes} phút, và hệ
            thống sẽ giám sát hành vi thoát toàn màn hình / chuyển tab (tối đa {3} lần vi phạm).
          </p>

          {error && (
            <div className="mb-4 text-sm p-3 bg-red-50 text-red-700 rounded-xl border border-red-200">{error}</div>
          )}

          <form onSubmit={handleStartTest} className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">Họ và tên của bạn</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  type="text"
                  required
                  className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-300 focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10 outline-none"
                  placeholder="Ví dụ: Nguyễn Văn A"
                  value={studentName}
                  onChange={(e) => setStudentName(e.target.value)}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting || !studentName.trim()}
              className="w-full flex items-center justify-center gap-2 bg-slate-950 text-white px-4 py-3.5 rounded-xl font-bold hover:bg-slate-800 transition disabled:opacity-50"
            >
              <Maximize className="w-5 h-5" />
              {isSubmitting ? "Đang tải bài thi..." : "Vào phòng thi (Bật Fullscreen)"}
            </button>
          </form>
        </div>
      </main>
    );
  }

  // ==========================================
  // MÀN HÌNH 2: BỊ HỦY BÀI THI (GIAN LẬN)
  // ==========================================
  if (step === "disqualified" || isLocked) {
    return (
      <main className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-white text-center">
        <ShieldAlert className="w-20 h-20 text-red-500 mb-4" />
        <h1 className="text-3xl font-bold text-red-500 mb-2">BÀI THI BỊ HỦY</h1>
        <p className="text-slate-400 max-w-md">
          Bạn đã vi phạm quy chế thi (thoát toàn màn hình hoặc chuyển tab) quá {maxWarnings} lần cho phép. Bài làm của
          bạn đã bị khóa và đánh dấu gian lận.
        </p>
      </main>
    );
  }

  // ==========================================
  // MÀN HÌNH 3: NỘP BÀI THÀNH CÔNG
  // ==========================================
  if (step === "submitted") {
    return (
      <main className="min-h-screen bg-slate-100 flex flex-col items-center justify-center p-6 text-slate-950">
        <div className="bg-white p-8 rounded-3xl shadow-sm text-center max-w-md w-full border border-slate-200">
          <CheckCircle2 className="w-16 h-16 text-emerald-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-slate-900 mb-2">Nộp bài thành công!</h1>
          <p className="text-slate-500 mb-6">
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
  return (
    <main className="min-h-screen bg-slate-50 p-6 text-slate-950">
      <div className="mx-auto max-w-5xl">
        {warnings > 0 && (
          <div className="mb-6 flex items-center justify-between bg-red-100 border border-red-300 text-red-800 px-6 py-4 rounded-2xl shadow-sm animate-pulse">
            <div className="flex items-center gap-3 font-semibold">
              <ShieldAlert className="w-6 h-6 text-red-600" />
              <span>Cảnh báo vi phạm quy chế thi: Bạn đã thoát toàn màn hình hoặc chuyển tab.</span>
            </div>
            <span className="font-bold text-lg bg-red-200 px-3 py-1 rounded-lg">
              {warnings} / {maxWarnings}
            </span>
          </div>
        )}

        <header className="mb-6 rounded-3xl bg-slate-950 p-6 text-white shadow-lg flex justify-between items-end flex-wrap gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-300 mb-2">IELTS WRITING TEST</p>
            <h1 className="text-3xl font-bold line-clamp-1">{title}</h1>
          </div>
          <div className="flex items-center gap-4">
            <div
              className={`flex items-center gap-2 rounded-2xl px-4 py-2 font-mono text-xl font-bold ${
                isLow ? "bg-red-500/20 text-red-300 animate-pulse" : "bg-white/10 text-cyan-300"
              }`}
            >
              <Timer className="w-5 h-5" />
              {formatted}
            </div>
            <div className="text-right text-slate-400 text-sm hidden md:block">
              <p>
                Học sinh: <span className="font-bold text-white">{studentName}</span>
              </p>
            </div>
          </div>
        </header>

        {error && (
          <div className="mb-6 flex items-center gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 font-semibold text-red-900">
            <AlertTriangle className="h-5 w-5" /> {error}
          </div>
        )}

        <form onSubmit={handleSubmitFinal} className="space-y-8">
          {(task1Prompt || imageUrl) && (
            <section className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200 grid lg:grid-cols-2 gap-6">
              <div className="bg-slate-50 rounded-2xl p-5 border border-slate-100 h-fit">
                <h2 className="text-xl font-bold text-slate-900 mb-3 flex items-center gap-2">
                  <span className="bg-cyan-100 text-cyan-800 px-3 py-1 rounded-lg text-sm">Task 1</span>
                </h2>
                <p className="whitespace-pre-wrap text-slate-700 leading-relaxed font-serif">{task1Prompt}</p>
                {imageUrl && (
                  <div className="mt-4 rounded-xl border border-slate-200 overflow-hidden bg-white">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={imageUrl} alt="Task 1 Illustration" className="w-full h-auto object-contain max-h-[400px]" />
                  </div>
                )}
              </div>
              <div className="flex flex-col h-full">
                <label className="text-sm font-semibold text-slate-700 mb-2">Bài làm Task 1 của bạn</label>
                <textarea
                  className="w-full flex-1 min-h-[300px] rounded-2xl border border-slate-300 p-4 focus:border-cyan-500 outline-none resize-y font-serif leading-relaxed"
                  placeholder="Nhập bài làm tiếng Anh..."
                  value={task1Answer}
                  onChange={(e) => setTask1Answer(e.target.value)}
                  onPaste={(e) => {
                    e.preventDefault();
                    alert("Không được phép Paste bài!");
                  }}
                />
                <div className="text-right mt-2 text-xs font-medium text-slate-500">
                  Word count: {task1Answer.trim().split(/\s+/).filter((w) => w.length > 0).length}
                </div>
              </div>
            </section>
          )}

          {task2Prompt && (
            <section className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200 grid lg:grid-cols-2 gap-6">
              <div className="bg-slate-50 rounded-2xl p-5 border border-slate-100 h-fit">
                <h2 className="text-xl font-bold text-slate-900 mb-3 flex items-center gap-2">
                  <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded-lg text-sm">Task 2</span>
                </h2>
                <p className="whitespace-pre-wrap text-slate-700 leading-relaxed font-serif">{task2Prompt}</p>
              </div>
              <div className="flex flex-col h-full">
                <label className="text-sm font-semibold text-slate-700 mb-2">Bài làm Task 2 của bạn</label>
                <textarea
                  className="w-full flex-1 min-h-[400px] rounded-2xl border border-slate-300 p-4 focus:border-cyan-500 outline-none resize-y font-serif leading-relaxed"
                  placeholder="Nhập bài làm tiếng Anh..."
                  value={task2Answer}
                  onChange={(e) => setTask2Answer(e.target.value)}
                  onPaste={(e) => {
                    e.preventDefault();
                    alert("Không được phép Paste bài!");
                  }}
                />
                <div className="text-right mt-2 text-xs font-medium text-slate-500">
                  Word count: {task2Answer.trim().split(/\s+/).filter((w) => w.length > 0).length}
                </div>
              </div>
            </section>
          )}

          <div className="flex justify-end pt-4 pb-12">
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center gap-2 bg-cyan-600 text-white px-8 py-4 rounded-2xl font-bold text-lg hover:bg-cyan-500 hover:shadow-lg hover:shadow-cyan-500/30 transition-all disabled:opacity-50"
            >
              <Send className="w-5 h-5" />
              {isSubmitting ? "Đang xử lý..." : "Hoàn thành & Nộp bài"}
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}
