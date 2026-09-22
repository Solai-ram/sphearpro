import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Loader2, AlertCircle, Search, User, Users, Pill, Package, Check, ChevronDown, X, Calendar, Clock, Stethoscope } from 'lucide-react';
import { therapyApi } from '../../services/therapy';
import { patientsApi, type PatientSearchHit } from '../../services/patients';
import type { TherapyPackage } from '../../types/therapy';

type OpHit = { id: string; createdAt: string; chiefComplaint?: string | null; status?: string };

export function TherapyCreatePage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const presetPatientId = params.get('patientId') || '';
  const presetOpCaseId = params.get('opCaseId') || '';

  const [patientId, setPatientId] = useState(presetPatientId);
  const [opCaseId, setOpCaseId] = useState(presetOpCaseId);
  const [patientLabel, setPatientLabel] = useState('');
  const [opCases, setOpCases] = useState<OpHit[]>([]);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<PatientSearchHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [therapists, setTherapists] = useState<{ id: string; name: string }[]>([]);
  const [packages, setPackages] = useState<TherapyPackage[]>([]);

  // Multi-selection state
  const [selectedDoctorIds, setSelectedDoctorIds] = useState<string[]>([]);
  const [selectedPackageIds, setSelectedPackageIds] = useState<string[]>([]);
  const [isDoctorDropdownOpen, setIsDoctorDropdownOpen] = useState(false);
  const [isPackageDropdownOpen, setIsPackageDropdownOpen] = useState(false);
  const doctorDropdownRef = useRef<HTMLDivElement>(null);
  const packageDropdownRef = useRef<HTMLDivElement>(null);

  const [title, setTitle] = useState('');
  const [assessment, setAssessment] = useState('');
  const [selectedDaySlots, setSelectedDaySlots] = useState<string[]>([]);
  const [timeSlot, setTimeSlot] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleDaySlot = (slot: string) => {
    setSelectedDaySlots((prev) =>
      prev.includes(slot) ? prev.filter((s) => s !== slot) : [...prev, slot]
    );
  };

  useEffect(() => {
    therapyApi.getTherapists().then(setTherapists).catch(console.error);
    therapyApi.getPackages().then((res) => {
      const list = (res.data || []).filter((p) => p.isActive !== false);
      setPackages(list);
    }).catch(console.error);
  }, []);

  useEffect(() => {
    if (!patientId) return;
    patientsApi.getById<{ name: string; patientNumber: string }>(patientId).then((p) => {
      setPatientLabel(`${p.name} (${p.patientNumber})`);
    }).catch(() => undefined);
  }, [patientId]);

  // Click outside listener for custom dropdowns
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (doctorDropdownRef.current && !doctorDropdownRef.current.contains(event.target as Node)) {
        setIsDoctorDropdownOpen(false);
      }
      if (packageDropdownRef.current && !packageDropdownRef.current.contains(event.target as Node)) {
        setIsPackageDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const timer = setTimeout(async () => {
      if (patientId || query.trim().length < 2) {
        setResults([]);
        setSearching(false);
        return;
      }
      setSearching(true);
      try {
        setResults(await patientsApi.search(query.trim(), 10, { opRegistered: true }));
      } catch (err) {
        setResults([]);
        setError(err instanceof Error ? err.message : 'Patient search failed');
      } finally {
        setSearching(false);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [query, patientId]);

  const selectPatient = (hit: PatientSearchHit) => {
    setError(null);
    setPatientId(hit.id);
    setPatientLabel(`${hit.name} (${hit.patientNumber})`);
    const cases = (hit.opCases || []).filter((op): op is OpHit => Boolean(op.id));
    setOpCases(cases);
    setOpCaseId(presetOpCaseId || cases[0]?.id || '');
    setResults([]);
    setQuery('');
    if (!title && cases[0]?.chiefComplaint) {
      setTitle(`Therapy — ${cases[0].chiefComplaint}`);
    }
  };

  const clearPatient = () => {
    setPatientId('');
    setOpCaseId('');
    setPatientLabel('');
    setOpCases([]);
    setQuery('');
  };

  const toggleDoctor = (id: string) => {
    setSelectedDoctorIds((prev) =>
      prev.includes(id) ? prev.filter((d) => d !== id) : [...prev, id]
    );
  };

  const removeDoctor = (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setSelectedDoctorIds((prev) => prev.filter((d) => d !== id));
  };

  const togglePackage = (id: string) => {
    setSelectedPackageIds((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
    );
  };

  const removePackage = (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setSelectedPackageIds((prev) => prev.filter((p) => p !== id));
  };

  const selectedPackages = packages.filter((p) => selectedPackageIds.includes(p.id));
  const totalSessions = selectedPackages.reduce((sum, p) => sum + (p.totalSessions || 0), 0);
  const totalPrice = selectedPackages.reduce((sum, p) => sum + (Number(p.price) || 0), 0);

  const selectedDoctors = therapists.filter((t) => selectedDoctorIds.includes(t.id));

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!patientId || selectedDoctorIds.length === 0 || !title.trim()) return;
    setIsLoading(true);
    setError(null);
    try {
      const primaryDoctorId = selectedDoctorIds[0];
      const created = await therapyApi.createCase({
        patientId,
        opCaseId: opCaseId || undefined,
        therapistId: primaryDoctorId,
        doctorIds: selectedDoctorIds,
        title: title.trim(),
        assessment: assessment.trim() || undefined,
        daySlots: selectedDaySlots.length > 0 ? selectedDaySlots : undefined,
        timeSlot: timeSlot || undefined,
      });

      // Assign each selected package with distributed doctor allocation
      for (const packageId of selectedPackageIds) {
        await therapyApi.assignPackage(created.id, {
          packageId,
          doctorIds: selectedDoctorIds,
        });
      }

      navigate(`/therapy/${created.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create therapy case');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-3">
      <div className="flex items-center gap-3">
        <button type="button" onClick={() => navigate(-1)} className="p-2 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-xl font-bold">Therapy registration</h1>
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 flex items-center gap-2 text-sm">
          <AlertCircle className="w-5 h-5 shrink-0" /> {error}
        </div>
      )}

      <form onSubmit={onSubmit} className="card p-4 space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {/* Patient Selection */}
          <section>
            <h2 className="text-sm font-semibold text-gray-900 mb-2 flex items-center gap-2">
              <User className="w-4 h-4 text-blue-600" />
              OP patient *
            </h2>
            {patientId ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between px-2 py-1.5 bg-green-50 border border-green-200 rounded-lg">
                  <span className="text-sm font-medium text-green-800">{patientLabel || patientId}</span>
                  {!presetPatientId && (
                    <button type="button" className="text-sm text-blue-600" onClick={clearPatient}>Change</button>
                  )}
                </div>
                {opCases.length > 1 && (
                  <select className="input" value={opCaseId} onChange={(e) => setOpCaseId(e.target.value)}>
                    {opCases.map((op) => (
                      <option key={op.id} value={op.id}>
                        OP {new Date(op.createdAt).toLocaleDateString('en-IN')} — {op.chiefComplaint || 'OP visit'}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            ) : (
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  className="input pl-9"
                  type="search"
                  autoComplete="off"
                  placeholder="Name, phone, or patient ID"
                  value={query}
                  onChange={(e) => { setQuery(e.target.value); setError(null); }}
                />
                {searching && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 animate-spin" />}
                {results.length > 0 && (
                  <div className="absolute z-20 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow max-h-40 overflow-y-auto">
                    {results.map((hit) => (
                      <button
                        type="button"
                        key={hit.id}
                        className="w-full text-left px-3 py-2 hover:bg-gray-50 border-b last:border-0"
                        onClick={() => selectPatient(hit)}
                      >
                        <p className="font-medium text-gray-900">{hit.name}</p>
                        <p className="text-xs text-gray-500 font-mono">
                          {hit.patientNumber}{hit.phone ? ` · ${hit.phone}` : ''}
                        </p>
                      </button>
                    ))}
                  </div>
                )}
                {!searching && query.trim().length >= 2 && results.length === 0 && (
                  <p className="mt-1 text-xs text-amber-800">No OP-registered patient found.</p>
                )}
                {query.trim().length > 0 && query.trim().length < 2 && (
                  <p className="mt-1 text-xs text-gray-500">Type at least 2 characters.</p>
                )}
              </div>
            )}
          </section>

          {/* Multiple Doctors Selection */}
          <section ref={doctorDropdownRef} className="relative">
            <h2 className="text-sm font-semibold text-gray-900 mb-2 flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Users className="w-4 h-4 text-blue-600" />
                Doctors *
              </span>
              {selectedDoctorIds.length > 0 && (
                <span className="text-xs text-blue-600 font-normal">
                  {selectedDoctorIds.length} selected
                </span>
              )}
            </h2>

            <div
              className={`input min-h-[42px] h-auto py-1 px-2 flex flex-wrap items-center gap-1.5 cursor-pointer bg-white transition-colors ${
                isDoctorDropdownOpen ? 'ring-2 ring-blue-500 border-blue-500' : ''
              }`}
              onClick={() => setIsDoctorDropdownOpen(!isDoctorDropdownOpen)}
            >
              {selectedDoctors.length === 0 ? (
                <span className="text-gray-400 text-sm">Select doctor(s)...</span>
              ) : (
                selectedDoctors.map((doc, idx) => (
                  <span
                    key={doc.id}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium bg-blue-50 text-blue-800 border border-blue-200"
                  >
                    {idx === 0 && (
                      <span className="bg-blue-600 text-white text-[10px] px-1 py-0.2 rounded font-semibold">
                        Lead
                      </span>
                    )}
                    <span>{doc.name}</span>
                    <button
                      type="button"
                      onClick={(e) => removeDoctor(doc.id, e)}
                      className="text-blue-500 hover:text-blue-800 rounded p-0.5 hover:bg-blue-100"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))
              )}
              <ChevronDown className="w-4 h-4 text-gray-400 ml-auto shrink-0" />
            </div>

            {isDoctorDropdownOpen && (
              <div className="absolute z-30 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-52 overflow-y-auto py-1 divide-y divide-gray-100">
                {therapists.length === 0 ? (
                  <p className="p-3 text-xs text-gray-500">No doctors in staff. Add a DOCTOR user first.</p>
                ) : (
                  therapists.map((doc) => {
                    const isSelected = selectedDoctorIds.includes(doc.id);
                    return (
                      <div
                        key={doc.id}
                        onClick={() => toggleDoctor(doc.id)}
                        className={`px-3 py-2 flex items-center justify-between cursor-pointer text-sm hover:bg-blue-50/60 ${
                          isSelected ? 'bg-blue-50/40 text-blue-900 font-medium' : 'text-gray-700'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => {}}
                            className="rounded text-blue-600 focus:ring-blue-500 h-4 w-4"
                          />
                          <span>{doc.name}</span>
                        </div>
                        {isSelected && <Check className="w-4 h-4 text-blue-600" />}
                      </div>
                    );
                  })
                )}
              </div>
            )}

            {selectedDoctorIds.length > 1 ? (
              <p className="mt-1 text-xs text-blue-700">
                Sessions will be distributed round-robin across selected doctors. <strong>{selectedDoctors[0]?.name}</strong> is designated as Lead Doctor.
              </p>
            ) : selectedDoctorIds.length === 1 ? (
              <p className="mt-1 text-xs text-gray-500">Click to add co-doctors if multiple specialists are involved.</p>
            ) : (
              <p className="mt-1 text-xs text-red-500">At least one doctor is required.</p>
            )}
          </section>

          {/* Therapy Title */}
          <section>
            <h2 className="text-sm font-semibold text-gray-900 mb-2 flex items-center gap-2">
              <Pill className="w-4 h-4 text-blue-600" />
              Therapy title *
            </h2>
            <input
              className="input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              placeholder="e.g. Speech therapy"
            />
          </section>

          {/* Multiple Packages Selection */}
          <section ref={packageDropdownRef} className="relative">
            <h2 className="text-sm font-semibold text-gray-900 mb-2 flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Package className="w-4 h-4 text-blue-600" />
                Packages
              </span>
              {selectedPackageIds.length > 0 && (
                <span className="text-xs text-indigo-600 font-normal">
                  {selectedPackageIds.length} selected
                </span>
              )}
            </h2>

            <div
              className={`input min-h-[42px] h-auto py-1 px-2 flex flex-wrap items-center gap-1.5 cursor-pointer bg-white transition-colors ${
                isPackageDropdownOpen ? 'ring-2 ring-indigo-500 border-indigo-500' : ''
              }`}
              onClick={() => setIsPackageDropdownOpen(!isPackageDropdownOpen)}
            >
              {selectedPackages.length === 0 ? (
                <span className="text-gray-400 text-sm">Select package(s) (optional)...</span>
              ) : (
                selectedPackages.map((pkg) => (
                  <span
                    key={pkg.id}
                    className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium bg-indigo-50 text-indigo-900 border border-indigo-200"
                  >
                    <span className="font-semibold">{pkg.name}</span>
                    <span className="text-[11px] text-indigo-600 font-mono">
                      ({pkg.totalSessions} sess · ₹{pkg.price})
                    </span>
                    <button
                      type="button"
                      onClick={(e) => removePackage(pkg.id, e)}
                      className="text-indigo-400 hover:text-indigo-800 rounded p-0.5 hover:bg-indigo-100"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))
              )}
              <ChevronDown className="w-4 h-4 text-gray-400 ml-auto shrink-0" />
            </div>

            {isPackageDropdownOpen && (
              <div className="absolute z-30 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto py-1 divide-y divide-gray-100">
                {packages.length === 0 ? (
                  <p className="p-3 text-xs text-gray-500">
                    No catalog packages.{' '}
                    <Link to="/therapy/packages" className="text-blue-600">Create a package</Link>
                  </p>
                ) : (
                  packages.map((pkg) => {
                    const isSelected = selectedPackageIds.includes(pkg.id);
                    return (
                      <div
                        key={pkg.id}
                        onClick={() => togglePackage(pkg.id)}
                        className={`px-3 py-2 flex items-center justify-between cursor-pointer text-sm hover:bg-indigo-50/60 ${
                          isSelected ? 'bg-indigo-50/40 text-indigo-900 font-medium' : 'text-gray-700'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => {}}
                            className="rounded text-indigo-600 focus:ring-indigo-500 h-4 w-4"
                          />
                          <div>
                            <p className="font-medium">{pkg.name}</p>
                            <p className="text-xs text-gray-500">
                              {pkg.totalSessions} sessions · {String(pkg.frequency).replace(/_/g, ' ').toLowerCase()}
                              {pkg.validityDays ? ` · ${pkg.validityDays} days` : ''}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-gray-900 text-xs">₹{pkg.price}</span>
                          {isSelected && <Check className="w-4 h-4 text-indigo-600" />}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}

            {/* Packages Summary Breakdown */}
            {selectedPackages.length > 0 && (
              <div className="mt-2 p-2 bg-indigo-50/70 border border-indigo-100 rounded-lg flex items-center justify-between text-xs text-indigo-900">
                <span className="font-medium">
                  {selectedPackages.length} package{selectedPackages.length > 1 ? 's' : ''} selected · {totalSessions} total sessions
                </span>
                <span className="font-semibold text-indigo-900">
                  Total: ₹{totalPrice.toLocaleString('en-IN')}
                </span>
              </div>
            )}
          </section>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-start">
          {/* 1) Provisional diagnosis (renamed from Assessment) */}
          <section>
            <h2 className="text-sm font-semibold text-gray-900 mb-2 flex items-center gap-2">
              <Stethoscope className="w-4 h-4 text-blue-600" />
              Provisional diagnosis
            </h2>
            <input
              className="input"
              value={assessment}
              onChange={(e) => setAssessment(e.target.value)}
              placeholder="e.g. Speech articulation disorder, Stuttering, Language delay..."
            />
          </section>

          {/* 2 & 3) Day slot option (replacing Goals) */}
          <section className="space-y-2">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                <Calendar className="w-4 h-4 text-blue-600" />
                Day slots (Schedule)
              </h2>
              {selectedDaySlots.length > 0 && (
                <span className="text-xs text-blue-600 font-medium">
                  {selectedDaySlots.length} selected
                </span>
              )}
            </div>

            {/* Quick Preset Buttons */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                type="button"
                onClick={() => setSelectedDaySlots(['Every Monday', 'Every Wednesday', 'Every Friday'])}
                className="text-[11px] px-2 py-0.5 rounded bg-gray-100 hover:bg-gray-200 text-gray-700 transition-colors"
              >
                Mon, Wed, Fri
              </button>
              <button
                type="button"
                onClick={() => setSelectedDaySlots(['Every Tuesday', 'Every Thursday', 'Every Saturday'])}
                className="text-[11px] px-2 py-0.5 rounded bg-gray-100 hover:bg-gray-200 text-gray-700 transition-colors"
              >
                Tue, Thu, Sat
              </button>
              <button
                type="button"
                onClick={() => setSelectedDaySlots([
                  'Every Monday',
                  'Every Tuesday',
                  'Every Wednesday',
                  'Every Thursday',
                  'Every Friday',
                ])}
                className="text-[11px] px-2 py-0.5 rounded bg-gray-100 hover:bg-gray-200 text-gray-700 transition-colors"
              >
                Mon–Fri
              </button>
              {selectedDaySlots.length > 0 && (
                <button
                  type="button"
                  onClick={() => setSelectedDaySlots([])}
                  className="text-[11px] px-2 py-0.5 rounded text-red-600 hover:bg-red-50 transition-colors ml-auto"
                >
                  Clear
                </button>
              )}
            </div>

            {/* 7 Days of the Week Selection Buttons */}
            <div className="grid grid-cols-7 gap-1">
              {[
                { full: 'Every Monday', short: 'Mon' },
                { full: 'Every Tuesday', short: 'Tue' },
                { full: 'Every Wednesday', short: 'Wed' },
                { full: 'Every Thursday', short: 'Thu' },
                { full: 'Every Friday', short: 'Fri' },
                { full: 'Every Saturday', short: 'Sat' },
                { full: 'Every Sunday', short: 'Sun' },
              ].map((day) => {
                const isSelected = selectedDaySlots.includes(day.full);
                return (
                  <button
                    key={day.full}
                    type="button"
                    title={day.full}
                    onClick={() => toggleDaySlot(day.full)}
                    className={`py-1.5 px-1 rounded-md text-xs font-semibold text-center transition-all ${
                      isSelected
                        ? 'bg-blue-600 text-white shadow-xs ring-2 ring-blue-500'
                        : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    {day.short}
                  </button>
                );
              })}
            </div>

            {/* Preferred Time Slot */}
            <div className="flex items-center gap-2 pt-0.5">
              <span className="text-xs text-gray-500 shrink-0 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" /> Time:
              </span>
              <input
                className="input py-1 text-xs h-8"
                type="text"
                value={timeSlot}
                onChange={(e) => setTimeSlot(e.target.value)}
                placeholder="e.g. 10:00 AM (optional)"
              />
            </div>

            {/* Selected feedback */}
            {selectedDaySlots.length > 0 && (
              <p className="text-xs text-blue-700 bg-blue-50/80 px-2 py-1 rounded border border-blue-200">
                Scheduled on: <strong>{selectedDaySlots.join(', ')}</strong>
                {timeSlot ? ` at ${timeSlot}` : ''}
              </p>
            )}
          </section>
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <button type="button" className="btn-secondary" onClick={() => navigate(-1)}>Cancel</button>
          <button className="btn-primary" disabled={isLoading || !patientId || selectedDoctorIds.length === 0 || !title.trim()}>
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Start therapy'}
          </button>
        </div>
      </form>
    </div>
  );
}
