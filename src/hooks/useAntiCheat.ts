"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// Cập nhật số lần cảnh cáo tối đa lên 5
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
  const reportingRef = useRef(false);
  const lastReasonAtRef = useRef(0);
  
  // Ref dùng để bỏ qua kiểm tra blur khi người dùng copy/paste hoặc click chuột phải
  const bypassBlurRef = useRef(false);

  const enterFullscreen = useCallback(async () => {
    if (!document.fullscreenElement) {
      await document.documentElement.requestFullscreen();
    }
  }, []);

  const reportViolation = useCallback(
    async (reason: AntiCheatReason) => {
      if (!enabled || !submissionId || isLocked || reportingRef.current) {
        return;
      }

      const now = Date.now();
      // Tránh việc spam API nếu các sự kiện nổ ra quá gần nhau (1.2s)
      if (now - lastReasonAtRef.current < 1200) {
        return;
      }

      reportingRef.current = true;
      lastReasonAtRef.current = now;

      try {
        const response = await fetch(`/api/submissions/${submissionId}/warning`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reason }),
        });

        if (!response.ok) return;

        const data = (await response.json()) as { warningCount: number; status: string };

        setWarnings(data.warningCount);
        onWarning?.(data.warningCount, reason);

        // Frontend tự động khóa nếu số lần cảnh cáo đạt mức MAX_WARNINGS (5 lần)
        // hoặc khi backend trả về status disqualified
        if (data.status === "disqualified" || data.warningCount >= MAX_WARNINGS) {
          setIsLocked(true);
          onDisqualified();
        }
      } finally {
        reportingRef.current = false;
      }
    },
    [enabled, isLocked, onDisqualified, onWarning, submissionId],
  );

  useEffect(() => {
    if (!enabled) return;

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        void reportViolation("tab_hidden");
      }
    };

    // Kích hoạt chế độ bỏ qua phạt blur trong 300ms khi dùng copy/paste/chuột phải
    const triggerBypass = () => {
      bypassBlurRef.current = true;
      setTimeout(() => {
        bypassBlurRef.current = false;
      }, 300);
    };

    const handleBlur = () => {
      // Đặt timeout 50ms để đồng bộ hóa chính xác với thời điểm bypassBlurRef bật lên
      setTimeout(() => {
        if (document.visibilityState === "visible" && !bypassBlurRef.current) {
          void reportViolation("window_blur");
        }
      }, 50);
    };

    const handleFocus = () => {
      bypassBlurRef.current = false;
    };

    const handleFullscreenChange = () => {
      if (!document.fullscreenElement && document.visibilityState === "visible") {
        void reportViolation("fullscreen_exit");
      }
    };

    // Lắng nghe các sự kiện cửa sổ
    document.addEventListener("visibilitychange", handleVisibilityChange);
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    window.addEventListener("blur", handleBlur);
    window.addEventListener("focus", handleFocus);

    // Lắng nghe các sự kiện copy, paste và menu chuột phải để cho phép người dùng thao tác
    window.addEventListener("contextmenu", triggerBypass);
    window.addEventListener("copy", triggerBypass);
    window.addEventListener("paste", triggerBypass);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      window.removeEventListener("blur", handleBlur);
      window.removeEventListener("focus", handleFocus);
      
      window.removeEventListener("contextmenu", triggerBypass);
      window.removeEventListener("copy", triggerBypass);
      window.removeEventListener("paste", triggerBypass);
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