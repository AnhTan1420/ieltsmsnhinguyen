"use client";

import { Info, ShieldAlert } from "lucide-react";

// Banner cảnh báo vi phạm (thoát fullscreen/chuyển tab) — đổi màu đậm hơn và
// nhấp nháy khi chạm ngưỡng cảnh báo cuối cùng trước khi bị hủy bài.
export function AntiCheatWarningBanner({ warnings, maxWarnings }: { warnings: number; maxWarnings: number }) {
  if (warnings <= 0) return null;
  return (
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
  );
}

// Thông báo trình duyệt không hỗ trợ fullscreen (thường gặp Safari iPhone/iPad) — bài thi vẫn
// chạy bình thường, chỉ không ép được toàn màn hình.
export function FullscreenUnsupportedNotice() {
  return (
    <div className="mb-6 flex items-center gap-3 rounded-2xl border border-sky-200 bg-sky-50 p-4 text-sm text-sky-800">
      <Info className="h-5 w-5 shrink-0" />
      Trình duyệt trên thiết bị này không hỗ trợ chế độ toàn màn hình (thường gặp trên Safari
      iPhone/iPad), nên bài thi sẽ chạy ở chế độ bình thường. Hệ thống vẫn giám sát việc chuyển
      tab/ứng dụng khác như bình thường.
    </div>
  );
}
