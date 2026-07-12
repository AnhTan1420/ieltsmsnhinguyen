"use client";

import { useCallback, useEffect, useRef, useState } from "react";

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
  const lastViolationTimeRef = useRef(0);
  const localWarningCountRef = useRef(initialWarnings);
  const reportViolationRef = useRef<((reason: AntiCheatReason) => Promise<void>) | null>(null);

  const bypassBlurRef = useRef(false);
  const bypassTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isTabSwitchingRef = useRef(false);

  const enterFullscreen = useCallback(async () => {
    if (!document.fullscreenElement) {
      await document.documentElement.requestFullscreen();
    }
  }, []);

  const reportViolation = useCallback(
    async (reason: AntiCheatReason) => {
      if (!enabled || !submissionId || isLocked) return;

      // Store the latest function in ref for event handlers
      reportViolationRef.current = reportViolation;

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

    [enabled, isLocked, onDisqualified, onWarning, submissionId, warnings],
  );

  useEffect(() => {
    if (!enabled) return;
    reportViolationRef.current = reportViolation;

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
      if (!document.fullscreenElement && document.visibilityState === "visible") {
        void reportViolationRef.current?.("fullscreen_exit");
      }
    };

    // Bắt sự kiện TỪ SỚM (Chuột phải hoặc giữ Ctrl/Cmd)
    const handleEarlyInteraction = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof MouseEvent && e.button === 2) triggerBypass(); // Click chuột phải
      if (e instanceof KeyboardEvent && (e.ctrlKey || e.metaKey)) triggerBypass(); // Bấm Ctrl hoặc Cmd
    };

    // Ép hệ thống cho phép Copy/Paste (Stop propagation của các hàm chặn khác nếu có)
    const forceAllowEvent = (e: Event) => {
      e.stopPropagation();
      triggerBypass();
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    document.addEventListener("fullscreenchange", handleFullscreenChange);
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
    enterFullscreen,
    reportViolation,
  };
}