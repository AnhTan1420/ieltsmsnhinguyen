import { CheckCircle2, ZoomIn } from "lucide-react";
import { countWords } from "@/lib/student-test-utils";
import type { RefObject } from "react";

type TaskCardProps = {
  taskNumber: 1 | 2;
  prompt: string | null;
  imageUrl?: string | null;
  answer: string;
  onAnswerChange: (value: string) => void;
  minWords: number;
  sectionRef: RefObject<HTMLElement | null>;
  onImageZoom?: () => void;
};

// Thẻ 1 Task: panel trái là "tờ đề" (nền giấy ngà, chữ serif — mô phỏng cảm
// giác đọc đề thi in giấy thật), panel phải là khung viết bài + thanh tiến độ
// số từ tối thiểu (điều học sinh IELTS luôn lo lắng nhất khi làm bài).
export default function TaskCard({
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
          <label htmlFor={`task${taskNumber}-answer`} className="mb-2 text-sm font-semibold text-slate-700">
            Bài làm Task {taskNumber} của bạn
          </label>
          <textarea
            id={`task${taskNumber}-answer`}
            className="min-h-[320px] w-full flex-1 resize-y rounded-2xl border border-slate-300 p-4 font-serif text-base leading-[1.9] text-slate-800 outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10 sm:text-[15px]"
            placeholder="Nhập bài làm tiếng Anh..."
            value={answer}
            onChange={(e) => onAnswerChange(e.target.value)}
            spellCheck={false}
            autoCorrect="off"
            autoCapitalize="off"
            autoComplete="off"
            data-gramm="false"
            data-gramm_editor="false"
            data-enable-grammarly="false"
            data-ms-editor="false"
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
