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
  const reportingRef = useRef(false);
  const lastReasonAtRef = useRef(0);
  const lastViolationTimeRef = useRef(0);
  const isProcessingViolationRef = useRef(false);
  const reportViolationRef = useRef<((reason: AntiCheatReason) => Promise<void>) | null>(null);

  const bypassBlurRef = useRef(false);
  const bypassTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const enterFullscreen = useCallback(async () => {
    if (!document.fullscreenElement) {
      await document.documentElement.requestFullscreen();
    }
  }, []);

  const reportViolation = useCallback(
    async (reason: AntiCheatReason) => {
      if (!enabled || !submissionId || isLocked) return;

      // Prevent re-entry: if already processing a violation, ignore new ones
      if (isProcessingViolationRef.current) return;
      isProcessingViolationRef.current = true;

      // Store the latest function in ref for event handlers
      reportViolationRef.current = reportViolation;

      // Debounce: wait 800ms to group rapid events (tab switch fires blur + visibilitychange)
      const now = Date.now();
      if (now - lastViolationTimeRef.current < 800) {
        isProcessingViolationRef.current = false;
        return;
      }
      lastViolationTimeRef.current = now;

      // Immediately increment local warning count
      const newLocalCount = warnings + 1;
      setWarnings(newLocalCount);
      onWarning?.(newLocalCount, reason);

      // Check if reached limit locally
      if (newLocalCount >= MAX_WARNINGS) {
        setIsLocked(true);
        onDisqualified();
      }

      // Send to backend (no rate limit to ensure all warnings are saved)
      if (reportingRef.current) return;
      reportingRef.current = true;

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
        // Note: warnings state may be tagged, so we use the backend's value as source of truth
        if (data.warningCount !== newLocalCount) {
          setWarnings(data.warningCount);
          if (data.warningCount >= MAX_WARNINGS) {
            setIsLocked(true);
            onDisqualified();
          }
        }

        // If backend says disqualified, ensure UI reflects it
        if (data.status === "disqualified") {
          setIsLocked(true);
          onDisqualified();
        }
      } finally {
        reportingRef.current = false;
        isProcessingViolationRef.current = false;
      }
    },
    [enabled, isLocked, onDisqualified, onWarning, submissionId, warnings],
  );

  useEffect(() => {
    if (!enabled) return;
    reportViolationRef.current = reportViolation;

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") void reportViolationRef.current?.("tab_hidden");
    };

    // Hàm bỏ qua cảnh cáo tạm thời (Bypass)
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
        if (document.visibilityState === "visible" && !bypassBlurRef.current) {
          void reportViolationRef.current?.("window_blur");
        }
      }, 100);
    };

    const handleFocus = () => {
      bypassBlurRef.current = false;
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