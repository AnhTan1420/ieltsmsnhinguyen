"use client";

import { useEffect, useRef, useState } from "react";
import { AlertTriangle, Send } from "lucide-react";
import { useStudentTestState } from "@/hooks/useStudentTestState";
import { TASK1_MIN_WORDS, TASK2_MIN_WORDS, countWords } from "@/lib/student-test-utils";
import ExamHeader from "./ExamHeader";
import { AntiCheatWarningBanner, FullscreenUnsupportedNotice } from "./AntiCheatWarningBanner";
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
  blockCopyPaste?: boolean;
}


// Orchestrator: gọi useStudentTestState() để lấy toàn bộ state/handler, tự lo
// duy nhất phần UI cục bộ còn lại (phóng to ảnh Task 1) và ghép các màn hình
// (setup/testing/submitted/disqualified) + ExamHeader + 2x TaskCard lại.
export default function StudentTest({
  testId,
  title,
  task1Prompt,
  task2Prompt,
  imageUrl,
  durationMinutes,
  blockCopyPaste = false,
}: StudentTestProps) {
  const [isImageZoomed, setIsImageZoomed] = useState(false);
  const task1Ref = useRef<HTMLElement | null>(null);
  const task2Ref = useRef<HTMLElement | null>(null);
  const submitRef = useRef<HTMLDivElement | null>(null);

  // Đóng ảnh phóng to bằng phím Esc cho tiện thao tác trong lúc thi.
  useEffect(() => {
    if (!isImageZoomed) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsImageZoomed(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isImageZoomed]);

  const {
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
  } = useStudentTestState({ testId, durationMinutes, blockCopyPaste });

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
    return <SubmittedScreen submissionId={submissionId} />;
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
      <ExamHeader
        title={title}
        studentName={studentName}
        formatted={formatted}
        isLow={isLow}
        hasTask1={hasTask1}
        hasTask2={hasTask2}
        task1Done={task1Words > 0}
        task2Done={task2Words > 0}
        task1Ref={task1Ref}
        task2Ref={task2Ref}
        submitRef={submitRef}
      />

      <div className="mx-auto max-w-6xl px-6 py-8">
        {fullscreenSupported === false && <FullscreenUnsupportedNotice />}

        <AntiCheatWarningBanner warnings={warnings} maxWarnings={maxWarnings} />

        {error && (
          <div className="mb-6 flex items-center gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 font-semibold text-red-900">
            <AlertTriangle className="h-5 w-5 shrink-0" /> {error}
          </div>
        )}

        <form onSubmit={handleSubmitFinal} onCopy={handleClipboardEvent} onPaste={handleClipboardEvent} onCut={handleClipboardEvent} className="space-y-8">
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
