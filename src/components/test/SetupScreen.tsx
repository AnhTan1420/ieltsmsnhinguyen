import { Maximize, ShieldAlert, Smartphone, Timer, User } from "lucide-react";

type Props = {
  title: string;
  durationMinutes: number;
  studentName: string;
  onStudentNameChange: (value: string) => void;
  error: string | null;
  isSubmitting: boolean;
  onSubmit: (e: React.FormEvent) => void;
  // undefined = chưa xác định được (trước khi client mount xong), false = thiết bị
  // không hỗ trợ Fullscreen API (điển hình: Safari trên iPhone/iPad).
  fullscreenSupported?: boolean;
};

// MÀN HÌNH 1: NHẬP TÊN TRƯỚC KHI THI
export default function SetupScreen({
  title,
  durationMinutes,
  studentName,
  onStudentNameChange,
  error,
  isSubmitting,
  onSubmit,
  fullscreenSupported,
}: Props) {
  const noFullscreen = fullscreenSupported === false;
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
              {noFullscreen ? (
                <>
                  <Smartphone className="mt-0.5 h-4 w-4 shrink-0 text-cyan-600" />
                  Thiết bị này không hỗ trợ chế độ toàn màn hình (thường gặp trên Safari
                  iPhone/iPad) — bài thi sẽ chạy ở chế độ bình thường, không ảnh hưởng đến
                  việc làm bài.
                </>
              ) : (
                <>
                  <Maximize className="mt-0.5 h-4 w-4 shrink-0 text-cyan-600" />
                  Bài thi chạy toàn màn hình (fullscreen) trong suốt thời gian làm bài.
                </>
              )}
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

          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <label htmlFor="student-name" className="mb-1 block text-sm font-semibold text-slate-700">
                Họ và tên của bạn
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                <input
                  id="student-name"
                  type="text"
                  required
                  className="w-full rounded-xl border border-slate-300 py-3 pl-10 pr-4 outline-none focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10"
                  placeholder="Ví dụ: Nguyễn Văn A"
                  value={studentName}
                  onChange={(e) => onStudentNameChange(e.target.value)}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting || !studentName.trim()}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 py-3.5 font-bold text-white transition hover:bg-slate-800 disabled:opacity-50"
            >
              <Maximize className="h-5 w-5" />
              {isSubmitting ? "Đang tải bài thi..." : noFullscreen ? "Vào phòng thi" : "Vào phòng thi (Bật Fullscreen)"}
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
