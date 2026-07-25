"use client";

import { useEffect, useRef, useState } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";
import type { GradingFeedback } from "@/lib/types";
import StudentResultPanel from "./StudentResultPanel";

// Học sinh không có tài khoản, nên endpoint chỉ cần đúng submissionId (UUID
// coi như "vé xem kết quả") — xem GET /api/submissions/[id]/route.ts.
const POLL_INTERVAL_MS = 6000;

type PollResult = {
  status?: string;
  feedback: GradingFeedback | null;
  teacher_comment: string | null;
  // Thêm để phục vụ nút "Xuất file" — xem downloadSubmissionDoc trong StudentResultPanel.
  student_name?: string;
  content?: string | null;
  tests?: { task1_prompt: string; task2_prompt: string; image_url: string | null } | null;
};

// Kết quả chỉ được coi là "sẵn sàng" hiển thị khi CẢ HAI điều kiện sau đều
// đúng: (1) AI đã chấm xong (feedback khác null) VÀ (2) giáo viên đã viết
// nhận xét (teacher_comment không rỗng) — coi việc giáo viên viết nhận xét là
// bước "duyệt" cuối cùng trước khi học sinh được xem điểm, tránh học sinh thấy
// điểm AI thô chưa qua kiểm tra của giáo viên. Nếu muốn đổi sang "chỉ cần AI
// chấm xong là hiện luôn", chỉ cần bỏ điều kiện teacher_comment bên dưới.
function isReady(result: PollResult | null): result is PollResult & { feedback: GradingFeedback } {
  return Boolean(result?.feedback && result.teacher_comment && result.teacher_comment.trim());
}

// MÀN HÌNH 3: NỘP BÀI THÀNH CÔNG — sau đó tự động chờ + hiện kết quả ngay khi
// có, không cần học sinh tải lại trang.
export default function SubmittedScreen({ submissionId }: { submissionId: string | null }) {
  const [result, setResult] = useState<PollResult | null>(null);
  const [pollError, setPollError] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!submissionId) return;

    let cancelled = false;

    const poll = async () => {
      try {
        const res = await fetch(`/api/submissions/${submissionId}`);
        if (!res.ok) throw new Error("poll failed");
        const data = (await res.json()) as PollResult;
        if (cancelled) return;
        setPollError(false);
        setResult(data);
        // Đã đủ điều kiện hiển thị: dừng poll, khỏi tốn request nữa.
        if (isReady(data) && timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }
      } catch {
        if (!cancelled) setPollError(true);
      }
    };

    void poll();
    timerRef.current = setInterval(poll, POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [submissionId]);

  const ready = isReady(result);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 bg-slate-50 p-6 text-slate-950">
      {!ready && (
        <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <CheckCircle2 className="mx-auto mb-4 h-16 w-16 text-emerald-500" />
          <h1 className="mb-2 text-2xl font-bold text-slate-900">Nộp bài thành công!</h1>
          <p className="mb-6 text-slate-500">
            Bạn đã hoàn thành bài thi IELTS Writing một cách an toàn. Hệ thống AI đang chấm bài và giáo viên sẽ xem lại
            kết quả sớm nhất.
          </p>

          <div className="flex items-center justify-center gap-2.5 rounded-2xl bg-cyan-50 border border-cyan-100 px-4 py-3 text-sm font-semibold text-cyan-700">
            <Loader2 className="h-4 w-4 animate-spin" />
            Đang chờ chấm bài — kết quả sẽ tự hiện ở đây
          </div>

          {pollError && (
            <p className="mt-4 text-xs text-slate-400">
              Không kiểm tra được trạng thái ngay lúc này, hệ thống sẽ tự thử lại sau ít phút.
            </p>
          )}

          <p className="mt-4 text-xs text-slate-400">Bạn có thể để yên trang này, không cần tải lại.</p>
        </div>
      )}

      {ready && (
        <>
          <div className="flex items-center gap-2 text-emerald-600 font-semibold">
            <CheckCircle2 className="h-5 w-5" />
            Bài của bạn đã được chấm xong!
          </div>
          <StudentResultPanel
            feedback={result.feedback}
            teacherComment={result.teacher_comment}
            studentName={result.student_name}
            content={result.content}
            tests={result.tests}
          />
        </>
      )}
    </main>
  );
}