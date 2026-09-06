import { useAuth } from './AuthContext';
import { formatCountdown, useIdleSessionTimeout } from './useIdleSessionTimeout';

/** 30 minutes of no mouse/keyboard/touch activity → logout */
export const IDLE_SESSION_MS = 30 * 60 * 1000;

export function IdleSessionBar() {
  const { user, logout } = useAuth();
  const remainingMs = useIdleSessionTimeout(IDLE_SESSION_MS, logout, Boolean(user));

  if (!user) return null;

  const urgent = remainingMs <= 5 * 60 * 1000;
  const critical = remainingMs <= 60 * 1000;

  return (
    <div
      className={`session-idle-bar print:hidden ${urgent ? 'session-idle-bar--urgent' : ''} ${critical ? 'session-idle-bar--critical' : ''}`}
      role="status"
      aria-live="polite"
      aria-label={`Session expires in ${formatCountdown(remainingMs)} if idle`}
    >
      <span className="session-idle-label">Session idle timeout</span>
      <span className="session-idle-clock">{formatCountdown(remainingMs)}</span>
    </div>
  );
}
