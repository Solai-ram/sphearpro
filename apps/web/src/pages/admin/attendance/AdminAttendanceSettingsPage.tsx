import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft, Loader2, Save, Plus, MapPin, Clock,
  CheckCircle2, AlertCircle, UserCheck,
} from 'lucide-react';
import { attendanceApi } from '../../../services/attendance';
import { usersApi } from '../../../services/admin';

const WEEK_DAYS = [
  [0, 'Sunday'], [1, 'Monday'], [2, 'Tuesday'], [3, 'Wednesday'],
  [4, 'Thursday'], [5, 'Friday'], [6, 'Saturday'],
] as const;

const COMMON_TIMEZONES = [
  'Asia/Kolkata', 'Asia/Dubai', 'Asia/Singapore', 'Asia/Tokyo',
  'Europe/London', 'America/New_York', 'America/Los_Angeles', 'UTC',
];

export function AdminAttendanceSettingsPage() {
  const [form, setForm]           = useState<any>(null);
  const [shifts, setShifts]       = useState<any[]>([]);
  const [assignments, setAssignments] = useState<any[]>([]);
  const [staff, setStaff]         = useState<any[]>([]);
  const [shiftForm, setShiftForm] = useState({ name: 'General', startTime: '09:00', endTime: '18:00', graceMinutes: '' as any });
  const [assignForm, setAssignForm] = useState({ userId: '', shiftId: '' });
  const [saving, setSaving]       = useState(false);
  const [msg, setMsg]             = useState<string | null>(null);
  const [error, setError]         = useState<string | null>(null);
  const [addingShift, setAddingShift] = useState(false);
  const [assigning, setAssigning] = useState(false);

  const load = async () => {
    const [s, sh, asg, users] = await Promise.all([
      attendanceApi.getSettings(),
      attendanceApi.listShifts(),
      attendanceApi.listShiftAssignments(),
      usersApi.list({ limit: 200, status: 'ACTIVE' }),
    ]);
    setForm(s);
    setShifts(sh);
    setAssignments(asg);
    setStaff(users.data || []);
  };

  useEffect(() => {
    load().catch((err) => setError(err instanceof Error ? err.message : 'Failed to load'));
  }, []);

  const save = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setMsg(null);
    try {
      await attendanceApi.updateSettings({
        enabled:              form.enabled,
        gpsEnabled:           form.gpsEnabled,
        deviceBindingEnabled: form.deviceBindingEnabled,
        biometricEnabled:     form.biometricEnabled,
        latitude:             Number(form.latitude),
        longitude:            Number(form.longitude),
        radiusMeters:         Number(form.radiusMeters),
        maxAccuracyMeters:    Number(form.maxAccuracyMeters),
        timezone:             form.timezone || 'Asia/Kolkata',
        weekOffDays:          Array.isArray(form.weekOffDays) ? form.weekOffDays.map(Number) : [0],
      });
      setMsg('Settings saved successfully.');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const addShift = async (e: FormEvent) => {
    e.preventDefault();
    setAddingShift(true);
    setError(null);
    try {
      await attendanceApi.createShift({
        ...shiftForm,
        graceMinutes: Number(shiftForm.graceMinutes || 0),
      });
      setShiftForm({ name: 'General', startTime: '09:00', endTime: '18:00', graceMinutes: '' as any });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add shift');
    } finally {
      setAddingShift(false);
    }
  };

  const assignShift = async (e: FormEvent) => {
    e.preventDefault();
    if (!assignForm.userId || !assignForm.shiftId) return;
    setAssigning(true);
    setError(null);
    try {
      await attendanceApi.assignShift(assignForm);
      setAssignForm({ userId: '', shiftId: '' });
      setMsg('Shift assigned.');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Assignment failed');
    } finally {
      setAssigning(false);
    }
  };

  const useMyLocation = () => {
    navigator.geolocation.getCurrentPosition((pos) => {
      setForm((f: any) => ({ ...f, latitude: pos.coords.latitude, longitude: pos.coords.longitude }));
    });
  };

  if (!form) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-[var(--primary)]" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Link to="/admin/attendance" className="btn-ghost p-2">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <h1 className="text-xl font-bold">Attendance settings</h1>
      </div>

      {msg   && <div className="flex gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700"><CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />{msg}</div>}
      {error && <div className="flex gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700"><AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />{error}</div>}

      {/* Main settings form */}
      <form className="card space-y-5 p-5" onSubmit={save}>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">General</h2>

        {/* Toggles */}
        <div className="space-y-3">
          {(
            [
              ['enabled',              'Enable staff attendance',            'Staff can check in / out using the app'],
              ['gpsEnabled',           'GPS geofence verification',          'Check-in only allowed within clinic radius'],
              ['deviceBindingEnabled', 'Device binding',                     'Staff must use a registered device'],
              ['biometricEnabled',     'Biometric confirmation (WebAuthn)',  'Require fingerprint/face on each punch'],
            ] as const
          ).map(([key, label, desc]) => (
            <label key={key} className="flex cursor-pointer items-start gap-3">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={Boolean(form[key])}
                onChange={(e) => setForm({ ...form, [key]: e.target.checked })}
              />
              <div>
                <p className="text-sm font-medium">{label}</p>
                <p className="text-xs text-[var(--muted)]">{desc}</p>
              </div>
            </label>
          ))}
        </div>

        <hr style={{ borderColor: 'var(--border)' }} />

        {/* GPS Location */}
        <div>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">Clinic location</h2>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Latitude</label>
              <input
                className="input"
                type="number"
                step="any"
                value={form.latitude ?? ''}
                onChange={(e) => setForm({ ...form, latitude: e.target.value })}
                placeholder="e.g. 13.0827"
              />
            </div>
            <div>
              <label className="label">Longitude</label>
              <input
                className="input"
                type="number"
                step="any"
                value={form.longitude ?? ''}
                onChange={(e) => setForm({ ...form, longitude: e.target.value })}
                placeholder="e.g. 80.2707"
              />
            </div>
            <div>
              <label className="label">Allowed radius (meters)</label>
              <input
                className="input"
                type="number"
                min={50}
                value={form.radiusMeters}
                onChange={(e) => setForm({ ...form, radiusMeters: e.target.value })}
              />
            </div>
            <div>
              <label className="label">Max GPS accuracy (meters)</label>
              <input
                className="input"
                type="number"
                min={10}
                value={form.maxAccuracyMeters}
                onChange={(e) => setForm({ ...form, maxAccuracyMeters: e.target.value })}
              />
            </div>
          </div>
          <button type="button" className="btn-secondary mt-3 inline-flex items-center gap-1.5 text-sm" onClick={useMyLocation}>
            <MapPin className="h-3.5 w-3.5" /> Use my current location
          </button>
        </div>

        <hr style={{ borderColor: 'var(--border)' }} />

        {/* Timezone + week-off */}
        <div className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">Schedule</h2>
          <div>
            <label className="label">Timezone</label>
            <select
              className="input"
              value={form.timezone || 'Asia/Kolkata'}
              onChange={(e) => setForm({ ...form, timezone: e.target.value })}
            >
              {COMMON_TIMEZONES.map((tz) => <option key={tz} value={tz}>{tz}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Week-off days</label>
            <p className="mb-2 text-xs text-[var(--muted)]">Unmarked staff on these days are auto-marked WEEK_OFF, not ABSENT.</p>
            <div className="flex flex-wrap gap-2">
              {WEEK_DAYS.map(([day, label]) => {
                const selected = (form.weekOffDays || [0]).map(Number).includes(day);
                return (
                  <label
                    key={day}
                    className={`cursor-pointer rounded-lg border px-3 py-1.5 text-sm transition ${selected ? 'border-[var(--primary)] bg-[var(--primary-soft)] text-[var(--primary-text)] font-medium' : 'border-[var(--border)] text-[var(--muted)] hover:border-[var(--primary)]'}`}
                  >
                    <input
                      type="checkbox"
                      className="sr-only"
                      checked={selected}
                      onChange={(e) => {
                        const current = new Set((form.weekOffDays || [0]).map(Number));
                        if (e.target.checked) current.add(day); else current.delete(day);
                        setForm({ ...form, weekOffDays: Array.from(current).sort() });
                      }}
                    />
                    {label.slice(0, 3)}
                  </label>
                );
              })}
            </div>
          </div>
        </div>

        <button type="submit" className="btn-primary inline-flex items-center gap-2" disabled={saving}>
          <Save className="h-4 w-4" />
          {saving ? 'Saving…' : 'Save settings'}
        </button>
      </form>

      {/* Shifts */}
      <div className="card space-y-4 p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">Shifts</h2>

        {shifts.length > 0 ? (
          <ul className="divide-y text-sm" style={{ borderColor: 'var(--border)' }}>
            {shifts.map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-2 py-2.5">
                <div className="flex items-center gap-2">
                  <Clock className="h-3.5 w-3.5 text-[var(--muted)]" />
                  <span className="font-medium">{s.name}</span>
                  <span className="text-[var(--muted)]">{s.startTime} – {s.endTime}</span>
                  <span className="text-xs text-[var(--muted)]">(grace {s.graceMinutes}m)</span>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-[var(--muted)]">No shifts configured yet.</p>
        )}

        <form className="grid grid-cols-2 gap-2 border-t pt-3" style={{ borderColor: 'var(--border)' }} onSubmit={addShift}>
          <input
            className="input col-span-2 sm:col-span-1"
            placeholder="Shift name"
            value={shiftForm.name}
            onChange={(e) => setShiftForm({ ...shiftForm, name: e.target.value })}
            required
          />
          <input
            className="input"
            type="number"
            placeholder="Grace (min)"
            value={shiftForm.graceMinutes === 0 ? '' : (shiftForm.graceMinutes ?? '')}
            onChange={(e) => setShiftForm({ ...shiftForm, graceMinutes: e.target.value === '' ? ('' as any) : Number(e.target.value) })}
          />
          <input
            className="input"
            type="time"
            value={shiftForm.startTime}
            onChange={(e) => setShiftForm({ ...shiftForm, startTime: e.target.value })}
            required
          />
          <input
            className="input"
            type="time"
            value={shiftForm.endTime}
            onChange={(e) => setShiftForm({ ...shiftForm, endTime: e.target.value })}
            required
          />
          <button type="submit" className="btn-secondary col-span-2 inline-flex items-center justify-center gap-1.5" disabled={addingShift}>
            {addingShift ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Plus className="h-4 w-4" />Add shift</>}
          </button>
        </form>
      </div>

      {/* Assign staff to shifts */}
      <div className="card space-y-4 p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">Shift assignments</h2>

        {assignments.length > 0 ? (
          <ul className="divide-y text-sm" style={{ borderColor: 'var(--border)' }}>
            {assignments.map((a) => (
              <li key={a.id} className="flex items-center justify-between gap-2 py-2.5">
                <div className="flex items-center gap-2">
                  <UserCheck className="h-3.5 w-3.5 text-[var(--muted)]" />
                  <span className="font-medium">{a.user?.name}</span>
                  <span className="text-[var(--muted)]">→ {a.shift?.name}</span>
                  <span className="text-xs text-[var(--muted)]">({a.shift?.startTime}–{a.shift?.endTime})</span>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-[var(--muted)]">No active assignments.</p>
        )}

        <form className="grid grid-cols-1 gap-2 border-t pt-3 sm:grid-cols-2" style={{ borderColor: 'var(--border)' }} onSubmit={assignShift}>
          <select
            className="input"
            value={assignForm.userId}
            onChange={(e) => setAssignForm({ ...assignForm, userId: e.target.value })}
            required
          >
            <option value="">Select staff…</option>
            {staff.map((u) => (
              <option key={u.id} value={u.id}>{u.name} ({u.staffType || 'STAFF'})</option>
            ))}
          </select>
          <select
            className="input"
            value={assignForm.shiftId}
            onChange={(e) => setAssignForm({ ...assignForm, shiftId: e.target.value })}
            required
          >
            <option value="">Select shift…</option>
            {shifts.map((s) => (
              <option key={s.id} value={s.id}>{s.name} ({s.startTime}–{s.endTime})</option>
            ))}
          </select>
          <button type="submit" className="btn-secondary sm:col-span-2 inline-flex items-center justify-center gap-1.5" disabled={assigning}>
            {assigning ? <Loader2 className="h-4 w-4 animate-spin" /> : <><UserCheck className="h-4 w-4" />Assign shift</>}
          </button>
        </form>
      </div>
    </div>
  );
}
