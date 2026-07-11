"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const MAX_WARNINGS = 3;

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

        if (data.status === "disqualified") {
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

    const handleBlur = () => {
      if (document.visibilityState === "visible") {
        void reportViolation("window_blur");
      }
    };

    const handleFullscreenChange = () => {
      if (!document.fullscreenElement && document.visibilityState === "visible") {
        void reportViolation("fullscreen_exit");
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    window.addEventListener("blur", handleBlur);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      window.removeEventListener("blur", handleBlur);
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
