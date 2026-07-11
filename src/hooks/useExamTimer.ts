"use client";

import { useEffect, useRef, useState } from "react";

type UseExamTimerOptions = {
  startedAt: string | null; // ISO timestamp from the server, so refresh/reopen can't extend time
  durationMinutes: number;
  enabled: boolean;
  onExpire: () => void;
};

export function useExamTimer({ startedAt, durationMinutes, enabled, onExpire }: UseExamTimerOptions) {
  const [secondsLeft, setSecondsLeft] = useState(durationMinutes * 60);
  const expiredRef = useRef(false);

  useEffect(() => {
    if (!enabled || !startedAt) return;

    const deadline = new Date(startedAt).getTime() + durationMinutes * 60 * 1000;

    const tick = () => {
      const remaining = Math.max(0, Math.round((deadline - Date.now()) / 1000));
      setSecondsLeft(remaining);

      if (remaining <= 0 && !expiredRef.current) {
        expiredRef.current = true;
        onExpire();
      }
    };

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [enabled, startedAt, durationMinutes, onExpire]);

  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;
  const formatted = `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;

  return { secondsLeft, formatted, isLow: secondsLeft <= 5 * 60 };
}
