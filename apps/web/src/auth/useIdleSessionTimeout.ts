import { useCallback, useEffect, useRef, useState } from 'react';

const ACTIVITY_EVENTS: (keyof WindowEventMap)[] = [
  'mousedown',
  'mousemove',
  'keydown',
  'scroll',
  'touchstart',
  'click',
  'wheel',
];

/** Idle session timer — resets on user activity; calls onTimeout when idleMs elapses. */
export function useIdleSessionTimeout(idleMs: number, onTimeout: () => void, enabled: boolean) {
  const [remainingMs, setRemainingMs] = useState(idleMs);
  const deadlineRef = useRef(Date.now() + idleMs);
  const onTimeoutRef = useRef(onTimeout);
  onTimeoutRef.current = onTimeout;

  const bump = useCallback(() => {
    deadlineRef.current = Date.now() + idleMs;
    setRemainingMs(idleMs);
  }, [idleMs]);

  useEffect(() => {
    if (!enabled) return;

    bump();

    let throttleUntil = 0;
    const onActivity = () => {
      const now = Date.now();
      if (now < throttleUntil) return;
      throttleUntil = now + 500;
      bump();
    };

    for (const event of ACTIVITY_EVENTS) {
      window.addEventListener(event, onActivity, { passive: true });
    }
    const onVisible = () => {
      if (document.visibilityState === 'visible') onActivity();
    };
    document.addEventListener('visibilitychange', onVisible);

    const tick = window.setInterval(() => {
      const left = Math.max(0, deadlineRef.current - Date.now());
      setRemainingMs(left);
      if (left <= 0) {
        window.clearInterval(tick);
        onTimeoutRef.current();
      }
    }, 250);

    return () => {
      for (const event of ACTIVITY_EVENTS) {
        window.removeEventListener(event, onActivity);
      }
      document.removeEventListener('visibilitychange', onVisible);
      window.clearInterval(tick);
    };
  }, [enabled, idleMs, bump]);

  return remainingMs;
}

export function formatCountdown(ms: number) {
  const totalSec = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}
