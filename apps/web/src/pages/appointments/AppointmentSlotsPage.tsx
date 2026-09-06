import { useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, Loader2, Pencil, Plus, Save, Trash2, X } from 'lucide-react';
import {
  appointmentsApi,
  type ProviderScheduleRow,
  type SlotTemplate,
} from '../../services/appointments';

type Doctor = { id: string; name: string; staffType?: string };
type SlotDraft = { label: string; startTime: string; endTime: string };

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const EMPTY_SLOT: SlotDraft = { label: '', startTime: '09:00', endTime: '09:45' };

function defaultSchedule(): ProviderScheduleRow[] {
  return DAYS.map((_, dayOfWeek) => ({
    dayOfWeek,
    startTime: '09:00',
    endTime: '17:15',
    isAvailable: dayOfWeek !== 0,
  }));
}

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

export function AppointmentSlotsPage() {
  const [slots, setSlots] = useState<SlotTemplate[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [slotDraft, setSlotDraft] = useState<SlotDraft>(EMPTY_SLOT);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [doctorId, setDoctorId] = useState('');
  const [schedule, setSchedule] = useState<ProviderScheduleRow[]>(defaultSchedule);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [permissionMessage, setPermissionMessage] = useState<string | null>(null);

  const loadBase = async () => {
    setLoading(true);
    setError(null);
    try {
      const [slotRows, doctorRows] = await Promise.all([
        appointmentsApi.listSlots(),
        appointmentsApi.getDoctors(),
      ]);
      setSlots(slotRows);
      setDoctors([...doctorRows].sort((a, b) => a.name.localeCompare(b.name)));
      if (!doctorId && doctorRows[0]) setDoctorId(doctorRows[0].id);
    } catch (loadError) {
      setError(errorMessage(loadError, 'Failed to load slot settings'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadBase(); }, []);

  useEffect(() => {
    if (!doctorId) {
      setSchedule(defaultSchedule());
      return;
    }
    setPermissionMessage(null);
    appointmentsApi.getDoctorSchedule(doctorId)
      .then((rows) => {
        const byDay = new Map(rows.map((row) => [row.dayOfWeek, row]));
        setSchedule(defaultSchedule().map((fallback) => byDay.get(fallback.dayOfWeek) || fallback));
      })
      .catch((loadError) => setError(errorMessage(loadError, 'Failed to load doctor schedule')));
  }, [doctorId]);

  const resetDraft = () => {
    setEditingId(null);
    setSlotDraft(EMPTY_SLOT);
  };

  const saveSlot = async () => {
    if (!slotDraft.startTime || !slotDraft.endTime) return;
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      if (editingId) {
        const updated = await appointmentsApi.updateSlot(editingId, slotDraft);
        setSlots((current) => current.map((slot) => (slot.id === updated.id ? updated : slot)));
        setMessage('Slot updated');
      } else {
        const created = await appointmentsApi.createSlot(slotDraft);
        setSlots((current) => [...current, created].sort((a, b) => a.startTime.localeCompare(b.startTime)));
        setMessage('Slot created');
      }
      resetDraft();
    } catch (saveError) {
      setError(errorMessage(saveError, 'Failed to save slot'));
    } finally {
      setSaving(false);
    }
  };

  const toggleSlot = async (slot: SlotTemplate) => {
    setSaving(true);
    setError(null);
    try {
      const updated = await appointmentsApi.updateSlot(slot.id, { isActive: !slot.isActive });
      setSlots((current) => current.map((row) => (row.id === updated.id ? updated : row)));
    } catch (saveError) {
      setError(errorMessage(saveError, 'Failed to update slot'));
    } finally {
      setSaving(false);
    }
  };

  const deleteSlot = async (slot: SlotTemplate) => {
    if (!window.confirm(`Delete ${slot.label || `${slot.startTime}–${slot.endTime}`}?`)) return;
    setSaving(true);
    setError(null);
    try {
      await appointmentsApi.deleteSlot(slot.id);
      setSlots((current) => current.filter((row) => row.id !== slot.id));
      if (editingId === slot.id) resetDraft();
    } catch (deleteError) {
      setError(errorMessage(deleteError, 'Failed to delete slot'));
    } finally {
      setSaving(false);
    }
  };

  const updateSchedule = (dayOfWeek: number, patch: Partial<ProviderScheduleRow>) => {
    setSchedule((current) => current.map((row) => (
      row.dayOfWeek === dayOfWeek ? { ...row, ...patch } : row
    )));
  };

  const saveSchedule = async () => {
    if (!doctorId) return;
    setSaving(true);
    setError(null);
    setMessage(null);
    setPermissionMessage(null);
    try {
      const updated = await appointmentsApi.setDoctorSchedule(
        doctorId,
        schedule.map(({ dayOfWeek, startTime, endTime, isAvailable }) => ({
          dayOfWeek,
          startTime,
          endTime,
          isAvailable,
        })),
      );
      setSchedule(updated);
      setMessage('Doctor availability saved');
    } catch (saveError) {
      const detail = errorMessage(saveError, 'Failed to save doctor availability');
      if (/403|forbidden|permission/i.test(detail)) {
        setPermissionMessage('You do not have staff.edit permission. Ask an administrator to update doctor availability.');
      } else {
        setError(detail);
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="page-title">Slot timings</h1>
          <p className="page-subtitle">Therapy visits only — manage clinic slots and doctor weekly hours</p>
        </div>
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 flex items-center gap-2 text-sm">
          <AlertCircle className="w-5 h-5 shrink-0" /> {error}
        </div>
      )}
      {permissionMessage && (
        <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 flex items-center gap-2 text-sm">
          <AlertCircle className="w-5 h-5 shrink-0" /> {permissionMessage}
        </div>
      )}
      {message && (
        <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 flex items-center gap-2 text-sm">
          <CheckCircle2 className="w-5 h-5 shrink-0" /> {message}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-blue-600" /></div>
      ) : (
        <>
          <section className="card p-4 space-y-4">
            <div>
              <h2 className="text-base font-semibold text-gray-900">Clinic slot templates</h2>
              <p className="text-sm text-gray-500">These times populate availability and the day schedule.</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_9rem_9rem_auto] gap-2 items-end">
              <div>
                <label className="label">Label</label>
                <input
                  className="input"
                  value={slotDraft.label}
                  placeholder="Morning 1"
                  onChange={(event) => setSlotDraft((current) => ({ ...current, label: event.target.value }))}
                />
              </div>
              <div>
                <label className="label">Start</label>
                <input
                  type="time"
                  className="input"
                  value={slotDraft.startTime}
                  onChange={(event) => setSlotDraft((current) => ({ ...current, startTime: event.target.value }))}
                />
              </div>
              <div>
                <label className="label">End</label>
                <input
                  type="time"
                  className="input"
                  value={slotDraft.endTime}
                  onChange={(event) => setSlotDraft((current) => ({ ...current, endTime: event.target.value }))}
                />
              </div>
              <div className="flex gap-2">
                <button type="button" className="btn-primary" disabled={saving} onClick={saveSlot}>
                  {editingId ? <Save className="w-4 h-4 mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
                  {editingId ? 'Update' : 'Add'}
                </button>
                {editingId && (
                  <button type="button" className="btn-secondary" onClick={resetDraft} aria-label="Cancel edit">
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-left">
                  <tr>
                    <th className="px-3 py-2 font-semibold text-gray-600">Label</th>
                    <th className="px-3 py-2 font-semibold text-gray-600">Start</th>
                    <th className="px-3 py-2 font-semibold text-gray-600">End</th>
                    <th className="px-3 py-2 font-semibold text-gray-600">Active</th>
                    <th className="px-3 py-2 font-semibold text-gray-600 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {slots.map((slot) => (
                    <tr key={slot.id} className="border-t">
                      <td className="px-3 py-2 font-medium text-gray-900">{slot.label || '—'}</td>
                      <td className="px-3 py-2">{slot.startTime}</td>
                      <td className="px-3 py-2">{slot.endTime}</td>
                      <td className="px-3 py-2">
                        <label className="inline-flex items-center gap-2 cursor-pointer">
                          <input type="checkbox" checked={slot.isActive} disabled={saving} onChange={() => toggleSlot(slot)} />
                          <span className={slot.isActive ? 'badge-success' : 'badge-gray'}>{slot.isActive ? 'Active' : 'Inactive'}</span>
                        </label>
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex justify-end gap-1">
                          <button
                            type="button"
                            className="btn-secondary px-2"
                            onClick={() => {
                              setEditingId(slot.id);
                              setSlotDraft({ label: slot.label || '', startTime: slot.startTime, endTime: slot.endTime });
                            }}
                            aria-label="Edit slot"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button type="button" className="btn-secondary px-2 text-red-700" onClick={() => deleteSlot(slot)} aria-label="Delete slot">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {slots.length === 0 && <p className="text-sm text-gray-500 text-center py-8">No clinic slot templates yet.</p>}
            </div>
          </section>

          <section className="card p-4 space-y-4">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-gray-900">Doctor weekly availability</h2>
                <p className="text-sm text-gray-500">Set the normal working window for each weekday.</p>
              </div>
              <div className="w-full sm:w-72">
                <label className="label">Doctor</label>
                <select className="input" value={doctorId} onChange={(event) => setDoctorId(event.target.value)}>
                  <option value="">Select doctor</option>
                  {doctors.map((doctor) => <option key={doctor.id} value={doctor.id}>{doctor.name}</option>)}
                </select>
              </div>
            </div>

            <div className="divide-y border rounded-lg">
              {schedule.map((row) => (
                <div key={row.dayOfWeek} className="grid grid-cols-1 sm:grid-cols-[8rem_7rem_1fr_1fr] gap-3 items-center p-3">
                  <span className="font-medium text-gray-900">{DAYS[row.dayOfWeek]}</span>
                  <label className="inline-flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={row.isAvailable}
                      onChange={(event) => updateSchedule(row.dayOfWeek, { isAvailable: event.target.checked })}
                    />
                    Available
                  </label>
                  <input
                    type="time"
                    className="input"
                    value={row.startTime}
                    disabled={!row.isAvailable}
                    onChange={(event) => updateSchedule(row.dayOfWeek, { startTime: event.target.value })}
                  />
                  <input
                    type="time"
                    className="input"
                    value={row.endTime}
                    disabled={!row.isAvailable}
                    onChange={(event) => updateSchedule(row.dayOfWeek, { endTime: event.target.value })}
                  />
                </div>
              ))}
            </div>

            <button type="button" className="btn-primary" disabled={saving || !doctorId} onClick={saveSchedule}>
              {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
              Save weekly availability
            </button>
          </section>
        </>
      )}
    </div>
  );
}
