"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Tiny shared cooldown timer for "Resend confirmation email" buttons. After
 * `start()` is called the hook counts down `initialSeconds` once a second
 * and exposes `remaining` so the UI can render a label like "Resend (28s)".
 *
 * Both /auth/signup (post-signup "check your email" state) and /auth/login
 * (the email-not-confirmed recovery card) use this so we stay below
 * Supabase's SMTP rate limit even if the user spams the button.
 */
export function useResendCooldown({
  initialSeconds = 30,
}: { initialSeconds?: number } = {}): {
  remaining: number;
  isCoolingDown: boolean;
  start: () => void;
} {
  const [remaining, setRemaining] = useState(0);
  // Hold the interval id in a ref so a re-render can't accidentally leak
  // multiple intervals — only one tick loop is ever live at a time.
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clear = useCallback(() => {
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const start = useCallback(() => {
    clear();
    setRemaining(initialSeconds);
    intervalRef.current = setInterval(() => {
      setRemaining((prev) => {
        if (prev <= 1) {
          clear();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, [clear, initialSeconds]);

  useEffect(() => {
    return clear;
  }, [clear]);

  return {
    remaining,
    isCoolingDown: remaining > 0,
    start,
  };
}
