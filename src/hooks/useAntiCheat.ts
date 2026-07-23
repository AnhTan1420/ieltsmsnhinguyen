"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getFullscreenElement, isFullscreenSupported, requestFullscreenSafe } from "@/lib/device-utils";

const MAX_WARNINGS = 5;

type AntiCheatReason = "tab_hidden" | "window_blur" | "fullscreen_exit";

type UseAntiCheatOptions = {
  submissionId: string | null;
  enabled: boolean;
  initialWarnings?: number;
  onWarning?: (warningCount: number, reason: AntiCheatReason) => void;
  onDisqualified: () => void;
};

export function useAntiCheat({
  submissionId,
  enabled,
  initialWarnings = 0,
  onWarning,
  onDisqualified,
}: UseAntiCheatOptions) {
  const [warnings, setWarnings] = useState(initialWarnings);
  const [isLocked, setIsLocked] = useState(false);
  // undefined = chưa xác định (SSR/lần render đầu), tránh lệch nội dung server/client.
  const [fullscreenSupported, setFullscreenSupported] = useState<boolean | undefined>(undefined);
  const lastViolationTimeRef = useRef(0);
  const localWarningCountRef = useRef(initialWarnings);
  const reportViolationRef = useRef<((reason: AntiCheatReason) => Promise<void>) | null>(null);

  const bypassBlurRef = useRef(false);
  const bypassTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isTabSwitchingRef = useRef(false);

  // Xác định khả năng fullscreen của thiết bị ngay khi mount (chỉ chạy ở client).
  // Đây là phát hiện tính năng một lần (feature detection), không phụ thuộc state
  // React nào khác nên không gây cascading renders.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setFullscreenSupported(isFullscreenSupported());
  }, []);

  // enterFullscreen không bao giờ throw nữa: nếu thiết bị không hỗ trợ
  // (ví dụ Safari iOS), trả về false và cho phép bài thi tiếp tục bình thường
  // thay vì chặn học sinh ngay từ màn hình "Vào phòng thi".
  const enterFullscreen = useCallback(async () => {
    const ok = await requestFullscreenSafe();
    setFullscreenSupported(isFullscreenSupported());
    return ok;
  }, []);

  const reportViolation = useCallback(
    async (reason: AntiCheatReason) => {
      if (!enabled || !submissionId || isLocked) return;

      // Debounce: 1000ms (1 second) to prevent rapid warnings from the same action
      // Also prevent duplicate warnings for the same reason within the debounce period
      const now = Date.now();
      if (now - lastViolationTimeRef.current < 2000) {
        return;
      }
      lastViolationTimeRef.current = now;

      // Increment local warning count (using ref to avoid stale closure)
      const newLocalCount = ++localWarningCountRef.current;
      setWarnings(newLocalCount);
      onWarning?.(newLocalCount, reason);

      // Check if reached limit locally (but don't call onDisqualified yet - wait for API)

      // Send to backend - allow all warnings to be saved
      // Note: Backend handles warning_count atomically, so overlapping calls are safe

      try {
        const response = await fetch(`/api/submissions/${submissionId}/warning`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reason }),
        });

        if (!response.ok) {
          // API failed but UI already updated locally
          return;
        }

        const data = (await response.json()) as { warningCount: number; status: string };

        // Sync with backend count if different
        if (data.warningCount !== newLocalCount) {
          setWarnings(data.warningCount);
        }

        // Call onDisqualified after API succeeds (to avoid race condition with PATCH request)
        if (data.status === "disqualified" || newLocalCount >= MAX_WARNINGS) {
          setIsLocked(true);
          onDisqualified();
        }
      } catch (error) {
        console.error("Failed to report violation", error);
      }
    },

    [enabled, isLocked, onDisqualified, onWarning, submissionId],
  );

  useEffect(() => {
    if (!enabled) return;
    reportViolationRef.current = reportViolation;

    const supportsFullscreen = isFullscreenSupported();

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        isTabSwitchingRef.current = true;
        void reportViolationRef.current?.("tab_hidden");
      } else {
        isTabSwitchingRef.current = false;
      }
    };

    // Hàm bỏ qua cảnh báo tạm thời (Bypass)
    const triggerBypass = () => {
      bypassBlurRef.current = true;
      if (bypassTimeoutRef.current) clearTimeout(bypassTimeoutRef.current);
      // Cho người dùng 1.5 giây an toàn để thực hiện copy/paste mà không bị cảnh cáo
      bypassTimeoutRef.current = setTimeout(() => {
        bypassBlurRef.current = false;
      }, 1500);
    };

    const handleBlur = () => {
      setTimeout(() => {
        // Only trigger if not already handling a tab switch
        if (document.visibilityState === "visible" && !bypassBlurRef.current && !isTabSwitchingRef.current) {
          void reportViolationRef.current?.("window_blur");
        }
      }, 1000);
    };

    const handleFocus = () => {
      bypassBlurRef.current = false;
      isTabSwitchingRef.current = false;
    };

    const handleFullscreenChange = () => {
      // Trên thiết bị không hỗ trợ Fullscreen API (Safari iOS), fullscreenElement
      // sẽ luôn là null - không được coi đó là hành vi gian lận.
      if (!supportsFullscreen) return;
      if (!getFullscreenElement() && document.visibilityState === "visible") {
        void reportViolationRef.current?.("fullscreen_exit");
      }
    };

    // Bắt sự kiện TỪ SỚM (Chuột phải hoặc giữ Ctrl/Cmd), đồng thời tận dụng
    // đây là một user-gesture để thử tự động vào lại fullscreen nếu bị rơi ra
    // ngoài ý muốn (ví dụ Android tự thoát fullscreen khi xoay màn hình).
    const handleEarlyInteraction = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof MouseEvent && e.button === 2) triggerBypass(); // Click chuột phải
      if (e instanceof KeyboardEvent && (e.ctrlKey || e.metaKey)) triggerBypass(); // Bấm Ctrl hoặc Cmd

      if (supportsFullscreen && !getFullscreenElement()) {
        void requestFullscreenSafe();
      }
    };

    // Ép hệ thống cho phép Copy/Paste (Stop propagation của các hàm chặn khác nếu có)
    const forceAllowEvent = (e: Event) => {
      e.stopPropagation();
      triggerBypass();
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    document.addEventListener("webkitfullscreenchange", handleFullscreenChange);
    document.addEventListener("mozfullscreenchange", handleFullscreenChange);
    document.addEventListener("MSFullscreenChange", handleFullscreenChange);
    window.addEventListener("blur", handleBlur);
    window.addEventListener("focus", handleFocus);

    // Lắng nghe chuột và phím
    window.addEventListener("mousedown", handleEarlyInteraction);
    window.addEventListener("keydown", handleEarlyInteraction);

    // Gắn capture phase để ghi đè mọi hàm block copy/paste ở cấp window
    window.addEventListener("contextmenu", forceAllowEvent, { capture: true });
    window.addEventListener("copy", forceAllowEvent, { capture: true });
    window.addEventListener("paste", forceAllowEvent, { capture: true });

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      document.removeEventListener("webkitfullscreenchange", handleFullscreenChange);
      document.removeEventListener("mozfullscreenchange", handleFullscreenChange);
      document.removeEventListener("MSFullscreenChange", handleFullscreenChange);
      window.removeEventListener("blur", handleBlur);
      window.removeEventListener("focus", handleFocus);
      window.removeEventListener("mousedown", handleEarlyInteraction);
      window.removeEventListener("keydown", handleEarlyInteraction);
      window.removeEventListener("contextmenu", forceAllowEvent, { capture: true });
      window.removeEventListener("copy", forceAllowEvent, { capture: true });
      window.removeEventListener("paste", forceAllowEvent, { capture: true });
    };
  }, [enabled, reportViolation]);

  return {
    warnings,
    maxWarnings: MAX_WARNINGS,
    isLocked,
    fullscreenSupported,
    enterFullscreen,
    reportViolation,
  };
}
