import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  MapPin,
  Fingerprint,
  Smartphone,
  Clock,
  History,
  CalendarOff,
  LogIn,
  LogOut,
  AlertTriangle,
} from 'lucide-react';
import {
  attendanceApi,
  assertWithServerOptions,
  enrollWithServerOptions,
  getOrCreateDeviceKey,
  requestGps,
} from '../../services/attendance';

function formatTime(iso?: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function StatusBadge({ status }: { status?: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    PRESENT:  { label: 'Present',   cls: 'bg-emerald-100 text-emerald-800' },
    LATE:     { label: 'Late',      cls: 'bg-amber-100 text-amber-800' },
    ABSENT:   { label: 'Absent',    cls: 'bg-red-100 text-red-800' },
    ON_LEAVE: { label: 'On leave',  cls: 'bg-sky-100 text-sky-800' },
    HALF_DAY: { label: 'Half day',  cls: 'bg-violet-100 text-violet-800' },
    HOLIDAY:  { label: 'Holiday',   cls: 'bg-teal-100 text-teal-800' },
    WEEK_OFF: { label: 'Week off',  cls: 'bg-slate-100 text-slate-600' },
  };
  if (!status) return null;
  const s = map[status] ?? { label: status, cls: 'bg-slate-100 text-slate-600' };
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${s.cls}`}>
      {s.label}
    </span>
  );
}

export function AttendanceTodayPage() {
  const [data, setData] = useState<any>(null);
  const [device, setDevice] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState('');

  const load = useCallback(async () => {
    const [today, dev] = await Promise.all([attendanceApi.today(), attendanceApi.myDevice()]);
    setData(today);
    setDevice(dev);
  }, []);

  useEffect(() => {
    load().catch((err) => setError(err instanceof Error ? err.message : 'Failed to load'));
  }, [load]);

  const registerDevice = async () => {
    setBusy(true);
    setError(null);
    try {
      const deviceKey = getOrCreateDeviceKey();
      let challengeId: string | undefined;
      let registrationResponse: unknown;
      if (data?.settings?.biometricEnabled) {
        setStep('Preparing biometric enrollment…');
        const reg = await attendanceApi.webauthnRegistrationOptions();
        challengeId = reg.challengeId;
        setStep('Enrolling biometric…');
        registrationResponse = await enrollWithServerOptions(reg.options);
      }
      setStep('Registering device…');
      await attendanceApi.registerDevice({
        deviceKey,
        platform: navigator.userAgent.includes('iPhone')
          ? 'iOS'
          : navigator.userAgent.includes('Android')
            ? 'Android'
            : 'Web',
        deviceName: navigator.userAgent.slice(0, 80),
        challengeId,
        registrationResponse,
      });
      setInfo('Device registered successfully.');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Device registration failed');
    } finally {
      setBusy(false);
      setStep('');
    }
  };

  const punch = async (kind: 'in' | 'out') => {
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      const settings = data?.settings;
      setStep('Verifying location…');
      let gps: { latitude: number; longitude: number; accuracy?: number } | undefined;
      if (settings?.gpsEnabled !== false) {
        gps = await requestGps();
        setStep('Checking clinic area…');
      }
      setStep('Verifying device…');
      const deviceKey = getOrCreateDeviceKey();

      let challengeId: string;
      let authenticationResponse: unknown | undefined;
      if (settings?.biometricEnabled) {
        setStep('Requesting biometric challenge…');
        const auth = await attendanceApi.webauthnAuthenticationOptions(deviceKey);
        challengeId = auth.challengeId;
        if (!auth.options) {
          throw new Error('Biometric challenge incomplete. Re-register your device.');
        }
        setStep('Confirming biometric…');
        authenticationResponse = await assertWithServerOptions(auth.options);
      } else {
        setStep('Requesting challenge…');
        const ch = await attendanceApi.challenge();
        challengeId = ch.challengeId;
      }

      setStep('Registering attendance…');
      const body = { ...gps, deviceKey, challengeId, authenticationResponse };
      if (kind === 'in') await attendanceApi.checkIn(body);
      else await attendanceApi.checkOut(body);
      setInfo(kind === 'in' ? '✓ Checked in successfully.' : '✓ Checked out successfully.');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Attendance failed');
    } finally {
      setBusy(false);
      setStep('');
    }
  };

  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-[var(--primary)]" />
        <p className="text-sm text-[var(--muted)]">Loading attendance…</p>
      </div>
    );
  }

  const a = data.attendance;
  const checkedIn = Boolean(a?.checkIn);
  const checkedOut = Boolean(a?.checkOut);
  const needsDevice =
    (data.settings?.deviceBindingEnabled || data.settings?.biometricEnabled) && !device?.registered;
  const isLate = a?.status === 'LATE';
  const lateMinutes: number | undefined = a?.lateMinutes;
  const attendanceEnabled = data.settings?.enabled;

  return (
    <div className="mx-auto max-w-lg space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold">Today's Attendance</h1>
          <p className="text-sm text-[var(--muted)]">
            {new Date(data.date + 'T12:00:00').toLocaleDateString(undefined, {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            })}
          </p>
        </div>
        <div className="flex shrink-0 gap-1">
          <Link to="/attendance/history" className="btn-ghost text-sm inline-flex items-center gap-1">
            <History className="h-3.5 w-3.5" /> History
          </Link>
          <Link to="/attendance/leave" className="btn-ghost text-sm inline-flex items-center gap-1">
            <CalendarOff className="h-3.5 w-3.5" /> Leave
          </Link>
        </div>
      </div>

      {/* Alerts */}
      {error && (
        <div className="flex gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" /> {error}
        </div>
      )}
      {info && (
        <div className="flex gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
          <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" /> {info}
        </div>
      )}
      {!attendanceEnabled && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          Staff attendance is not enabled for this clinic yet. Ask an admin to configure it.
        </div>
      )}
      {data.punchBlocked && (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
          {data.punchBlockedReason || 'Check-in is not available today.'}
          {data.holiday?.name ? (
            <span className="ml-1 font-medium">({data.holiday.name})</span>
          ) : null}
        </div>
      )}

      {/* Main status card */}
      <div className="card overflow-hidden p-0">
        {/* Shift banner */}
        <div className="flex items-center justify-between gap-2 border-b px-4 py-3" style={{ borderColor: 'var(--border)' }}>
          <div className="flex items-center gap-2 text-sm">
            <Clock className="h-4 w-4 text-[var(--muted)]" />
            {data.shift ? (
              <span>
                <span className="font-medium">{data.shift.name}</span>
                <span className="text-[var(--muted)]"> · {data.shift.startTime} – {data.shift.endTime}</span>
              </span>
            ) : (
              <span className="text-[var(--muted)]">No shift assigned</span>
            )}
          </div>
          <div className="flex shrink-0 gap-1.5">
            {data.settings?.gpsEnabled && (
              <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600">
                <MapPin className="h-2.5 w-2.5" /> GPS
              </span>
            )}
            {data.settings?.deviceBindingEnabled && (
              <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600">
                <Smartphone className="h-2.5 w-2.5" /> Device
              </span>
            )}
            {data.settings?.biometricEnabled && (
              <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600">
                <Fingerprint className="h-2.5 w-2.5" /> Biometric
              </span>
            )}
          </div>
        </div>

        {/* Status display */}
        <div className="px-4 py-6 text-center space-y-3">
          {!checkedIn && (
            <div className="space-y-1">
              <p className="text-4xl font-bold tracking-tight text-[var(--muted)]">—</p>
              <p className="text-sm font-medium uppercase tracking-widest text-[var(--muted)]">Not checked in</p>
            </div>
          )}
          {checkedIn && !checkedOut && (
            <div className="space-y-2">
              <div className="flex items-center justify-center gap-4">
                <div className="text-center">
                  <p className="text-xs text-[var(--muted)] uppercase tracking-wide">Check-in</p>
                  <p className="text-3xl font-bold tabular-nums">{formatTime(a.checkIn)}</p>
                </div>
                <div className="text-[var(--muted)]">→</div>
                <div className="text-center">
                  <p className="text-xs text-[var(--muted)] uppercase tracking-wide">Check-out</p>
                  <p className="text-3xl font-bold tabular-nums text-[var(--muted)]">—</p>
                </div>
              </div>
              <div className="flex items-center justify-center gap-2">
                <StatusBadge status={a.status} />
                <span className="text-xs text-[var(--muted)] uppercase tracking-widest">Working</span>
              </div>
              {isLate && lateMinutes != null && lateMinutes > 0 && (
                <div className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 text-xs text-amber-700">
                  <AlertTriangle className="h-3 w-3" />
                  {lateMinutes} minutes late
                </div>
              )}
            </div>
          )}
          {checkedOut && (
            <div className="space-y-2">
              <div className="flex items-center justify-center gap-4">
                <div className="text-center">
                  <p className="text-xs text-[var(--muted)] uppercase tracking-wide">Check-in</p>
                  <p className="text-2xl font-bold tabular-nums">{formatTime(a.checkIn)}</p>
                </div>
                <div className="text-[var(--muted)]">→</div>
                <div className="text-center">
                  <p className="text-xs text-[var(--muted)] uppercase tracking-wide">Check-out</p>
                  <p className="text-2xl font-bold tabular-nums">{formatTime(a.checkOut)}</p>
                </div>
              </div>
              <p className="text-2xl font-bold text-[var(--primary)]">{a.workingHoursDisplay}</p>
              <div className="flex items-center justify-center gap-2">
                <StatusBadge status={a.status} />
                {isLate && lateMinutes != null && lateMinutes > 0 && (
                  <span className="text-xs text-amber-600">{lateMinutes}m late</span>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Device register + step progress */}
        <div className="space-y-3 px-4 pb-4">
          {busy && step && (
            <div className="flex items-center justify-center gap-2 rounded-xl bg-[var(--primary-soft)] py-2.5 text-sm text-[var(--primary-text)]">
              <Loader2 className="h-4 w-4 animate-spin" />
              {step}
            </div>
          )}

          {needsDevice && !busy && (
            <button type="button" className="btn-secondary w-full" onClick={registerDevice}>
              <Smartphone className="mr-2 h-4 w-4" />
              Register this device{data.settings?.biometricEnabled ? ' + biometric' : ''}
            </button>
          )}

          {attendanceEnabled && !checkedIn && !data.punchBlocked && (
            <button
              type="button"
              id="btn-check-in"
              className="btn-primary w-full py-3 text-base font-semibold"
              disabled={busy || needsDevice}
              onClick={() => punch('in')}
            >
              {busy ? (
                <Loader2 className="mx-auto h-5 w-5 animate-spin" />
              ) : (
                <span className="inline-flex items-center gap-2">
                  <LogIn className="h-5 w-5" /> Check In
                </span>
              )}
            </button>
          )}
          {attendanceEnabled && checkedIn && !checkedOut && (
            <button
              type="button"
              id="btn-check-out"
              className="w-full rounded-xl border-2 border-red-400 bg-red-50 py-3 text-base font-semibold text-red-700 transition hover:bg-red-100 disabled:opacity-50"
              disabled={busy || needsDevice}
              onClick={() => punch('out')}
            >
              {busy ? (
                <Loader2 className="mx-auto h-5 w-5 animate-spin" />
              ) : (
                <span className="inline-flex items-center gap-2">
                  <LogOut className="h-5 w-5" /> Check Out
                </span>
              )}
            </button>
          )}
          {checkedOut && (
            <div className="flex items-center justify-center gap-2 rounded-xl bg-emerald-50 py-3 text-sm font-medium text-emerald-700">
              <CheckCircle2 className="h-4 w-4" />
              Day complete — see you tomorrow!
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
