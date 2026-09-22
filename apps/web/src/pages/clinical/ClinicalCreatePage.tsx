import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2, ArrowLeft, User, IndianRupee, Calendar, AlertCircle, CheckCircle, Search, Printer, Stethoscope, FlaskConical, X, ChevronDown, Check, Phone, Mail, MapPin, Clock } from 'lucide-react';
import { clinicalApi } from '../../services/clinical';
import { patientsApi, type PatientSearchHit } from '../../services/patients';
import { servicesApi, type ServiceMaster } from '../../services/services';
import { labApi } from '../../services/lab';
import type { LabProcedure } from '../../types/lab';
import type { BillingItemInput } from '../../types/clinical';

const PAY_METHODS = [
  { id: 'CASH' as const, label: 'Cash' },
  { id: 'UPI' as const, label: 'UPI' },
  { id: 'CARD' as const, label: 'Card' },
];

const createOpCaseSchema = z.object({
  patientId: z.string().min(1, 'Patient is required'),
  serviceId: z.string().optional(),
  consultationFee: z.union([z.string(), z.number()]).optional(),
  discount: z.union([z.string(), z.number()]).optional(),
  paymentMethod: z.enum(['CASH', 'UPI', 'CARD']).optional(),
  paymentReference: z.string().optional(),
  chiefComplaint: z.string().optional(),
  vitals: z.object({
    bloodPressure: z.string().optional(),
    heartRate: z.string().optional(),
    temperature: z.string().optional(),
    respiratoryRate: z.string().optional(),
    oxygenSaturation: z.string().optional(),
    weight: z.string().optional(),
    height: z.string().optional(),
    bmi: z.string().optional(),
  }).optional(),
});

type CreateOpCaseFormInput = z.input<typeof createOpCaseSchema>;
type CreateOpCaseForm = z.output<typeof createOpCaseSchema>;

export function ClinicalCreatePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [params] = useSearchParams();
  const presetPatientId = params.get('patientId') || '';
  const isReview = params.get('mode') === 'review' || location.pathname.startsWith('/patients/op-review');
  const isOpRegistration = isReview || location.pathname.startsWith('/patients/op-new');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchResults, setSearchResults] = useState<PatientSearchHit[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [patientSearch, setPatientSearch] = useState('');
  const [selectedPatient, setSelectedPatient] = useState<PatientSearchHit | any | null>(null);
  const [selectedPatientName, setSelectedPatientName] = useState('');
  const [lastOpSummary, setLastOpSummary] = useState<string | null>(null);
  const [createdCaseId, setCreatedCaseId] = useState<string | null>(null);
  const [services, setServices] = useState<ServiceMaster[]>([]);
  const [audioProcedures, setAudioProcedures] = useState<LabProcedure[]>([]);
  const [selectedServices, setSelectedServices] = useState<ServiceMaster[]>([]);
  const [selectedAudios, setSelectedAudios] = useState<LabProcedure[]>([]);
  const [isServiceDropdownOpen, setIsServiceDropdownOpen] = useState(false);
  const [isAudioDropdownOpen, setIsAudioDropdownOpen] = useState(false);
  const [serviceSearch, setServiceSearch] = useState('');
  const [audioSearch, setAudioSearch] = useState('');
  const [customDiscount, setCustomDiscount] = useState<string>('');

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<CreateOpCaseFormInput, unknown, CreateOpCaseForm>({
    resolver: zodResolver(createOpCaseSchema) as any,
    defaultValues: {
      paymentMethod: 'CASH',
      serviceId: '',
      consultationFee: '' as any,
      discount: '' as any,
      vitals: {},
    },
  });

  const filteredServices = useMemo(
    () => [...services].sort((a, b) => {
      if (isReview) {
        if (a.category === 'REVIEW' && b.category !== 'REVIEW') return -1;
        if (b.category === 'REVIEW' && a.category !== 'REVIEW') return 1;
      } else {
        if (a.category === 'CONSULTATION' && b.category !== 'CONSULTATION') return -1;
        if (b.category === 'CONSULTATION' && a.category !== 'CONSULTATION') return 1;
      }
      return a.name.localeCompare(b.name);
    }),
    [services, isReview],
  );

  const displayedServices = useMemo(() => {
    if (!serviceSearch.trim()) return filteredServices;
    const q = serviceSearch.toLowerCase();
    return filteredServices.filter(
      (s) => s.name.toLowerCase().includes(q) || s.code.toLowerCase().includes(q) || s.category.toLowerCase().includes(q)
    );
  }, [filteredServices, serviceSearch]);

  const audioList = useMemo(() => {
    const isAudiology = (p: LabProcedure) =>
      p.department?.toLowerCase().includes('audio') ||
      p.department?.toLowerCase().includes('vestibular') ||
      ['PTA', 'IMP', 'OAE', 'BERA', 'VNG', 'PTA2'].includes(p.code) ||
      p.name.toLowerCase().includes('audiom') ||
      p.name.toLowerCase().includes('audio') ||
      p.name.toLowerCase().includes('bera') ||
      p.name.toLowerCase().includes('oae') ||
      p.name.toLowerCase().includes('tympan') ||
      p.name.toLowerCase().includes('hearing') ||
      p.name.toLowerCase().includes('speech');

    const audios = audioProcedures.filter(isAudiology);
    return audios.length > 0 ? audios : audioProcedures;
  }, [audioProcedures]);

  const displayedAudios = useMemo(() => {
    if (!audioSearch.trim()) return audioList;
    const q = audioSearch.toLowerCase();
    return audioProcedures.filter(
      (p) => p.name.toLowerCase().includes(q) || p.code.toLowerCase().includes(q) || p.department?.toLowerCase().includes(q)
    );
  }, [audioList, audioProcedures, audioSearch]);

  useEffect(() => {
    servicesApi
      .list({ activeOnly: true, limit: 200 })
      .then((res) => setServices(res.data || []))
      .catch(() => setServices([]));
    labApi
      .getProcedures({ limit: 200 })
      .then((res) => setAudioProcedures((res.data || []).filter((p) => p.isActive !== false)))
      .catch(() => setAudioProcedures([]));
  }, []);

  const toggleService = (svc: ServiceMaster) => {
    setSelectedServices((prev) =>
      prev.some((s) => s.id === svc.id) ? prev.filter((s) => s.id !== svc.id) : [...prev, svc]
    );
  };

  const toggleAudio = (proc: LabProcedure) => {
    setSelectedAudios((prev) =>
      prev.some((a) => a.id === proc.id) ? prev.filter((a) => a.id !== proc.id) : [...prev, proc]
    );
  };

  const removeService = (id: string) => {
    setSelectedServices((prev) => prev.filter((s) => s.id !== id));
  };

  const removeAudio = (id: string) => {
    setSelectedAudios((prev) => prev.filter((a) => a.id !== id));
  };

  const clearAllBilling = () => {
    setSelectedServices([]);
    setSelectedAudios([]);
    setCustomDiscount('');
  };

  const servicesSubtotal = selectedServices.reduce((sum, s) => sum + Number(s.price || 0), 0);
  const audiosSubtotal = selectedAudios.reduce((sum, a) => sum + Number(a.price || 0), 0);
  const totalSubtotal = servicesSubtotal + audiosSubtotal;
  const initialDiscount = selectedServices.reduce((sum, s) => sum + Number(s.discount || 0), 0);
  const totalDiscount = customDiscount !== '' ? Number(customDiscount || 0) : initialDiscount;
  const netPayable = Math.max(0, totalSubtotal - totalDiscount);
  const hasBillingItems = selectedServices.length > 0 || selectedAudios.length > 0;

  const calculateAge = (dobString?: string | null) => {
    if (!dobString) return null;
    const dob = new Date(dobString);
    if (isNaN(dob.getTime())) return null;
    const today = new Date();
    let age = today.getFullYear() - dob.getFullYear();
    const m = today.getMonth() - dob.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) {
      age--;
    }
    return age;
  };

  const formatAddress = (addr?: Record<string, any> | string | null) => {
    if (!addr) return null;
    if (typeof addr === 'string') return addr.trim() || null;
    const parts = [
      addr.line || addr.street,
      addr.area,
      addr.city,
      addr.state,
      addr.pincode,
      addr.country,
    ].filter(Boolean);
    return parts.length > 0 ? parts.join(', ') : null;
  };

  const formatGender = (g?: string | null) => {
    if (!g) return null;
    if (g === 'MALE') return 'Male';
    if (g === 'FEMALE') return 'Female';
    if (g === 'OTHER') return 'Other';
    return g;
  };

  const formatEmergencyContact = (ec?: Record<string, any> | null) => {
    if (!ec) return null;
    const name = ec.name;
    const rel = ec.relationship;
    const phone = ec.phone;
    if (!name && !phone) return null;
    return {
      name: name || 'Contact',
      relationship: rel ? `(${rel})` : '',
      phone: phone || null,
    };
  };

  useEffect(() => {
    if (!presetPatientId) return;
    setValue('patientId', presetPatientId);
    patientsApi.getById<any>(presetPatientId).then((p) => {
      setSelectedPatient(p);
      setSelectedPatientName(`${p.name} (${p.patientNumber})`);
      setLastOpSummary(lastOpLabel(p));
    }).catch(() => undefined);
  }, [presetPatientId, setValue]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (patientSearch.length >= 2) {
        searchPatients(patientSearch);
      } else {
        setSearchResults([]);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [patientSearch]);

  const lastOpLabel = (patient: any) => {
    const last = patient?.opCases?.[0];
    if (!last) return null;
    const when = new Date(last.createdAt).toLocaleDateString();
    return last.chiefComplaint ? `Last OP ${when} — ${last.chiefComplaint}` : `Last OP ${when}`;
  };

  const searchPatients = async (query: string) => {
    setIsSearching(true);
    try {
      setSearchResults(await patientsApi.search(query, 10));
    } catch (err) {
      console.error('Patient search failed:', err);
    } finally {
      setIsSearching(false);
    }
  };

  const handlePatientSelect = (patient: PatientSearchHit) => {
    setValue('patientId', patient.id);
    setSelectedPatient(patient);
    setSelectedPatientName(`${patient.name} (${patient.patientNumber})`);
    setLastOpSummary(lastOpLabel(patient));
    setSearchResults([]);
    setPatientSearch('');
    patientsApi.getById<any>(patient.id).then((fullPatient) => {
      if (fullPatient) {
        setSelectedPatient((prev: any) => ({ ...prev, ...fullPatient }));
      }
    }).catch(() => undefined);
  };

  const handleClearPatient = () => {
    setValue('patientId', '');
    setSelectedPatient(null);
    setSelectedPatientName('');
    setLastOpSummary(null);
    setPatientSearch('');
    setSearchResults([]);
  };

  const onSubmit = async (data: CreateOpCaseForm) => {
    setIsLoading(true);
    setError(null);

    try {
      let remainingDiscount = totalDiscount > 0 ? totalDiscount : 0;
      const billingItems: BillingItemInput[] = [];

      for (const s of selectedServices) {
        const itemPrice = Number(s.price || 0);
        const itemDiscount = Math.min(itemPrice, remainingDiscount);
        remainingDiscount -= itemDiscount;
        billingItems.push({
          billableType: 'OTHER',
          description: s.name,
          quantity: 1,
          unitPrice: itemPrice,
          discount: itemDiscount,
          referenceId: s.id,
        });
      }

      for (const a of selectedAudios) {
        const itemPrice = Number(a.price || 0);
        const itemDiscount = Math.min(itemPrice, remainingDiscount);
        remainingDiscount -= itemDiscount;
        billingItems.push({
          billableType: 'LAB_TEST',
          description: a.name + (a.code ? ` (${a.code})` : ''),
          quantity: 1,
          unitPrice: itemPrice,
          discount: itemDiscount,
          referenceId: a.id,
        });
      }

      const hasBilling = billingItems.length > 0 && netPayable > 0;

      const billing = {
        serviceId: selectedServices[0]?.id || undefined,
        consultationFee: hasBilling ? netPayable : undefined,
        discount: totalDiscount > 0 ? totalDiscount : undefined,
        paymentMethod: hasBilling ? (data.paymentMethod || 'CASH') : undefined,
        paymentReference: hasBilling ? (data.paymentReference || undefined) : undefined,
        billingItems: billingItems.length > 0 ? billingItems : undefined,
      };

      const opCase = isReview
        ? await clinicalApi.createReview({
            patientId: data.patientId,
            ...billing,
          })
        : await clinicalApi.create({
            patientId: data.patientId,
            ...billing,
            ...(isOpRegistration
              ? {}
              : {
                  chiefComplaint: data.chiefComplaint,
                  vitals: Object.keys(data.vitals || {}).some((k) => (data.vitals as any)[k])
                    ? data.vitals
                    : undefined,
                }),
          });

      setCreatedCaseId(opCase.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : isReview ? 'Failed to register OP review' : 'Failed to create OP case');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-3">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-lg font-bold text-gray-900">
          {isReview ? 'OP review registration' : isOpRegistration ? 'New OP registration' : 'New OP Case'}
        </h1>
      </div>

      {error && (
        <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 flex items-center gap-2.5 text-sm">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="card p-5 lg:p-6 space-y-4">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Step 1: Patient Selection */}
        <section className="lg:col-span-7 space-y-3.5">
          <div className="flex items-center gap-2 pb-2 border-b border-gray-100">
            <User className="w-4 h-4 text-blue-600" />
            <h2 className="text-xs font-semibold text-gray-800 tracking-wider uppercase">
              {isReview ? 'Returning OP patient' : 'Patient Selection'}
            </h2>
          </div>
          {!watch('patientId') ? (
            <div className="space-y-3">
              {!presetPatientId && (
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="search"
                    id="patientSearch"
                    placeholder={
                      isReview
                        ? 'Search returning OP patient by name, phone, or MRN...'
                        : 'Search patient by name, phone, or MRN...'
                    }
                    className="input pl-9 pr-9 text-sm w-full bg-white shadow-xs focus:ring-2 focus:ring-blue-500"
                    value={patientSearch}
                    onChange={(e) => setPatientSearch(e.target.value)}
                    autoComplete="off"
                    autoFocus
                  />
                  {isSearching && (
                    <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-blue-500 animate-spin" />
                  )}
                </div>
              )}

              {errors.patientId && (
                <p className="text-xs text-red-600 flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>{errors.patientId.message}</span>
                </p>
              )}

              {!presetPatientId && searchResults.length > 0 && (
                <div className="border border-gray-200 rounded-xl bg-white max-h-52 overflow-y-auto divide-y divide-gray-100 shadow-md">
                  {searchResults.map((patient) => {
                    const age = calculateAge(patient.dateOfBirth);
                    const gender = formatGender(patient.gender);
                    const lastOp = lastOpLabel(patient);
                    return (
                      <button
                        type="button"
                        key={patient.id}
                        onClick={() => handlePatientSelect(patient)}
                        className="w-full px-3.5 py-2.5 text-left hover:bg-blue-50/70 transition-colors flex items-center justify-between group"
                      >
                        <div className="min-w-0 pr-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-xs text-gray-900 group-hover:text-blue-700">
                              {patient.name}
                            </span>
                            <span className="font-mono text-[11px] text-gray-600 bg-gray-100 px-1.5 py-0.5 rounded border border-gray-200">
                              {patient.patientNumber}
                            </span>
                            {(gender || age != null) && (
                              <span className="text-[11px] text-gray-500">
                                {[gender, age != null ? `${age}y` : null].filter(Boolean).join(', ')}
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-gray-500 mt-1 flex items-center gap-3">
                            {patient.phone && (
                              <span className="flex items-center gap-1">
                                <Phone className="w-3 h-3 text-gray-400" />
                                {patient.phone}
                              </span>
                            )}
                            {formatAddress(patient.address) && (
                              <span className="flex items-center gap-1 truncate max-w-[200px]">
                                <MapPin className="w-3 h-3 text-gray-400 shrink-0" />
                                <span className="truncate">{formatAddress(patient.address)}</span>
                              </span>
                            )}
                          </div>
                          {isReview && lastOp && (
                            <p className="text-[10px] text-blue-700 mt-1 flex items-center gap-1 bg-blue-50 px-2 py-0.5 rounded border border-blue-100 w-fit">
                              <Clock className="w-3 h-3 text-blue-500 shrink-0" />
                              <span>{lastOp}</span>
                            </p>
                          )}
                        </div>
                        <div className="shrink-0 text-blue-600 font-medium text-xs opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 bg-white px-2 py-1 rounded border border-blue-200 shadow-2xs">
                          <span>Select</span>
                          <CheckCircle className="w-3.5 h-3.5 text-blue-600" />
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}

              {searchResults.length === 0 && !isSearching && !presetPatientId && (
                <div className="p-4 rounded-xl bg-gray-50/70 border border-dashed border-gray-200 text-center text-xs text-gray-500 space-y-1">
                  <User className="w-5 h-5 text-gray-400 mx-auto" />
                  <p className="font-medium text-gray-700">
                    {isReview ? 'Search returning OP patient' : 'Search registered patient'}
                  </p>
                  <p className="text-gray-400 text-[11px]">
                    Type at least 2 characters to search by name, contact phone, or MRN.
                  </p>
                </div>
              )}
            </div>
          ) : (
            /* Registered Patient Details Card */
            <div className="rounded-xl border border-blue-200 bg-gradient-to-br from-blue-50/40 via-white to-gray-50/50 p-4 shadow-2xs space-y-3.5">
              {/* Header with avatar, name, MRN, and change button */}
              <div className="flex items-start justify-between gap-3 pb-3 border-b border-blue-100">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center text-base shadow-xs shrink-0">
                    {(selectedPatient?.name || selectedPatientName || 'P')[0]?.toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-base font-bold text-gray-900 truncate">
                        {selectedPatient?.name || selectedPatientName}
                      </h3>
                      <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded-md bg-blue-100 text-blue-800 border border-blue-200">
                        {selectedPatient?.patientNumber || ''}
                      </span>
                      <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block"></span>
                        {isReview ? 'Returning OP Patient' : 'Registered Patient'}
                      </span>
                    </div>
                    <p className="text-[11px] text-gray-500 mt-0.5">
                      Demographic &amp; contact profile from new registration
                    </p>
                  </div>
                </div>

                {!presetPatientId && (
                  <button
                    type="button"
                    onClick={handleClearPatient}
                    className="text-xs font-medium text-gray-600 hover:text-blue-700 bg-white hover:bg-blue-50 border border-gray-200 hover:border-blue-300 rounded-lg px-2.5 py-1.5 transition-colors flex items-center gap-1.5 shadow-2xs shrink-0"
                    title="Search or select a different patient"
                  >
                    <Search className="w-3.5 h-3.5" />
                    <span>Change patient</span>
                  </button>
                )}
              </div>

              {/* All registered patient details in clean 2-column or 3-column grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs">
                {/* Age & Date of Birth */}
                <div className="bg-white p-2.5 rounded-lg border border-gray-100 shadow-2xs">
                  <span className="text-[11px] text-gray-400 font-medium block">Age &amp; DOB</span>
                  <p className="font-semibold text-gray-800 mt-0.5">
                    {calculateAge(selectedPatient?.dateOfBirth) != null
                      ? `${calculateAge(selectedPatient?.dateOfBirth)} yrs`
                      : '—'}
                    {selectedPatient?.dateOfBirth && (
                      <span className="text-gray-500 font-normal text-[11px] ml-1.5">
                        ({new Date(selectedPatient.dateOfBirth).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })})
                      </span>
                    )}
                  </p>
                </div>

                {/* Gender */}
                <div className="bg-white p-2.5 rounded-lg border border-gray-100 shadow-2xs">
                  <span className="text-[11px] text-gray-400 font-medium block">Gender</span>
                  <p className="font-semibold text-gray-800 mt-0.5">
                    {formatGender(selectedPatient?.gender) || '—'}
                  </p>
                </div>

                {/* Primary Phone */}
                <div className="bg-white p-2.5 rounded-lg border border-gray-100 shadow-2xs">
                  <span className="text-[11px] text-gray-400 font-medium block">Primary Phone</span>
                  <p className="font-semibold text-gray-800 mt-0.5 flex items-center gap-1">
                    <Phone className="w-3 h-3 text-gray-400 shrink-0" />
                    <span>{selectedPatient?.phone || '—'}</span>
                  </p>
                </div>

                {/* Alternate Phone */}
                <div className="bg-white p-2.5 rounded-lg border border-gray-100 shadow-2xs">
                  <span className="text-[11px] text-gray-400 font-medium block">Alternate Phone</span>
                  <p className="font-semibold text-gray-800 mt-0.5">
                    {selectedPatient?.alternatePhone || <span className="text-gray-400 font-normal">None</span>}
                  </p>
                </div>

                {/* Email */}
                <div className="bg-white p-2.5 rounded-lg border border-gray-100 shadow-2xs sm:col-span-2">
                  <span className="text-[11px] text-gray-400 font-medium block">Email Address</span>
                  <p className="font-semibold text-gray-800 mt-0.5 flex items-center gap-1 truncate">
                    <Mail className="w-3 h-3 text-gray-400 shrink-0" />
                    <span className="truncate">{selectedPatient?.email || <span className="text-gray-400 font-normal">Not provided</span>}</span>
                  </p>
                </div>

                {/* Registered Address */}
                <div className="bg-white p-2.5 rounded-lg border border-gray-100 shadow-2xs sm:col-span-2">
                  <span className="text-[11px] text-gray-400 font-medium block">Registered Address</span>
                  <p className="font-semibold text-gray-800 mt-0.5 flex items-start gap-1">
                    <MapPin className="w-3 h-3 text-gray-400 mt-0.5 shrink-0" />
                    <span className="line-clamp-2">
                      {formatAddress(selectedPatient?.address) || <span className="text-gray-400 font-normal">No address recorded</span>}
                    </span>
                  </p>
                </div>

                {/* Emergency Contact */}
                <div className="bg-white p-2.5 rounded-lg border border-gray-100 shadow-2xs sm:col-span-1">
                  <span className="text-[11px] text-gray-400 font-medium block">Emergency Contact</span>
                  {(() => {
                    const ec = formatEmergencyContact(selectedPatient?.emergencyContact);
                    if (!ec) return <p className="text-gray-400 font-normal mt-0.5">None recorded</p>;
                    return (
                      <div className="mt-0.5">
                        <p className="font-semibold text-gray-800 truncate">
                          {ec.name} <span className="text-gray-500 font-normal text-[10px]">{ec.relationship}</span>
                        </p>
                        {ec.phone && <p className="text-gray-600 font-mono text-[11px]">{ec.phone}</p>}
                      </div>
                    );
                  })()}
                </div>
              </div>

              {/* Previous OP Visit History / Review Banner */}
              {isReview && (
                <div className="p-2.5 rounded-lg bg-blue-50/80 border border-blue-200/80 flex items-start gap-2 text-xs">
                  <Clock className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                  <div className="min-w-0">
                    <span className="font-semibold text-blue-900 block">Previous OP Visit History</span>
                    <p className="text-blue-800 mt-0.5 text-[11px]">
                      {lastOpSummary || lastOpLabel(selectedPatient) || 'First recorded OP review for this patient.'}
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}
        </section>

        {/* Step 2: Service & Audio Billing (Optional) */}
        <section className="lg:col-span-5 space-y-3.5">
          <div className="flex items-center justify-between pb-2 border-b border-gray-100">
            <div className="flex items-center gap-2">
              <IndianRupee className="w-4 h-4 text-blue-600" />
              <h2 className="text-xs font-semibold text-gray-800 tracking-wider uppercase">
                Service &amp; Audio Billing
              </h2>
            </div>
            <span className="text-xs px-2.5 py-0.5 rounded-full font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
              Optional (Free)
            </span>
          </div>

          {/* Multi-select Buttons / Triggers */}
          <div className="grid grid-cols-2 gap-3">
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setIsServiceDropdownOpen((prev) => !prev);
                  setIsAudioDropdownOpen(false);
                }}
                className={`w-full flex items-center justify-between px-3 py-2 text-sm font-medium rounded-lg border transition-colors ${
                  isServiceDropdownOpen
                    ? 'border-blue-500 bg-blue-50 text-blue-800 ring-2 ring-blue-100'
                    : selectedServices.length > 0
                    ? 'border-blue-300 bg-blue-50/50 text-blue-900'
                    : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                <span className="flex items-center gap-2 truncate">
                  <Stethoscope className="w-4 h-4 text-blue-600 shrink-0" />
                  <span className="truncate">Services ({selectedServices.length})</span>
                </span>
                <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${isServiceDropdownOpen ? 'rotate-180' : ''}`} />
              </button>

              {/* Service Dropdown Menu */}
              {isServiceDropdownOpen && (
                <div className="absolute left-0 right-0 top-full mt-1.5 z-30 bg-white rounded-xl border border-gray-200 shadow-xl p-3 space-y-2.5">
                  <div className="relative">
                    <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={serviceSearch}
                      onChange={(e) => setServiceSearch(e.target.value)}
                      placeholder="Search services..."
                      className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-gray-200 focus:outline-none focus:border-blue-500"
                      onClick={(e) => e.stopPropagation()}
                    />
                  </div>
                  <div className="max-h-48 overflow-y-auto space-y-1">
                    {displayedServices.length === 0 ? (
                      <p className="text-xs text-gray-400 text-center py-3">No services found</p>
                    ) : (
                      displayedServices.map((s) => {
                        const isSelected = selectedServices.some((item) => item.id === s.id);
                        return (
                          <div
                            key={s.id}
                            onClick={() => toggleService(s)}
                            className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg cursor-pointer text-xs transition-colors ${
                              isSelected ? 'bg-blue-50 text-blue-900 font-medium' : 'hover:bg-gray-50 text-gray-700'
                            }`}
                          >
                            <div className="flex items-center gap-2 truncate pr-2">
                              <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                                isSelected ? 'bg-blue-600 border-blue-600 text-white' : 'border-gray-300'
                              }`}>
                                {isSelected && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                              </div>
                              <span className="truncate">{s.name}</span>
                            </div>
                            <span className="shrink-0 font-mono text-gray-500">₹{Number(s.price).toFixed(2)}</span>
                          </div>
                        );
                      })
                    )}
                  </div>
                  <div className="pt-2 border-t border-gray-100 flex justify-end">
                    <button
                      type="button"
                      onClick={() => setIsServiceDropdownOpen(false)}
                      className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                    >
                      Done
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setIsAudioDropdownOpen((prev) => !prev);
                  setIsServiceDropdownOpen(false);
                }}
                className={`w-full flex items-center justify-between px-3 py-2 text-sm font-medium rounded-lg border transition-colors ${
                  isAudioDropdownOpen
                    ? 'border-purple-500 bg-purple-50 text-purple-800 ring-2 ring-purple-100'
                    : selectedAudios.length > 0
                    ? 'border-purple-300 bg-purple-50/50 text-purple-900'
                    : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                <span className="flex items-center gap-2 truncate">
                  <FlaskConical className="w-4 h-4 text-purple-600 shrink-0" />
                  <span className="truncate">Audio Tests ({selectedAudios.length})</span>
                </span>
                <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${isAudioDropdownOpen ? 'rotate-180' : ''}`} />
              </button>

              {/* Audio Dropdown Menu */}
              {isAudioDropdownOpen && (
                <div className="absolute left-0 right-0 top-full mt-1 z-30 bg-white rounded-lg border border-gray-200 shadow-lg p-2 space-y-2">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={audioSearch}
                      onChange={(e) => setAudioSearch(e.target.value)}
                      placeholder="Search audio tests (PTA, IMP, BERA)..."
                      className="w-full pl-8 pr-2 py-1 text-xs rounded border border-gray-200 focus:outline-none focus:border-purple-500"
                      onClick={(e) => e.stopPropagation()}
                    />
                  </div>
                  <div className="max-h-48 overflow-y-auto space-y-1">
                    {displayedAudios.length === 0 ? (
                      <p className="text-xs text-gray-400 text-center py-2">No audio tests found</p>
                    ) : (
                      displayedAudios.map((a) => {
                        const isSelected = selectedAudios.some((item) => item.id === a.id);
                        return (
                          <div
                            key={a.id}
                            onClick={() => toggleAudio(a)}
                            className={`flex items-center justify-between px-2 py-1.5 rounded cursor-pointer text-xs transition-colors ${
                              isSelected ? 'bg-purple-50 text-purple-900 font-medium' : 'hover:bg-gray-50 text-gray-700'
                            }`}
                          >
                            <div className="flex items-center gap-2 truncate pr-2">
                              <div className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 ${
                                isSelected ? 'bg-purple-600 border-purple-600 text-white' : 'border-gray-300'
                              }`}>
                                {isSelected && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                              </div>
                              <span className="truncate">{a.name} {a.code ? `(${a.code})` : ''}</span>
                            </div>
                            <span className="shrink-0 font-mono text-gray-500">₹{Number(a.price).toFixed(2)}</span>
                          </div>
                        );
                      })
                    )}
                  </div>
                  <div className="pt-1 border-t border-gray-100 flex justify-end">
                    <button
                      type="button"
                      onClick={() => setIsAudioDropdownOpen(false)}
                      className="text-xs text-purple-600 hover:text-purple-700 font-medium"
                    >
                      Done
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Selected Items List or Free Notice */}
          {!hasBillingItems ? (
            <div className="p-4 bg-emerald-50/80 border border-dashed border-emerald-200 rounded-xl text-emerald-900 flex items-start gap-3">
              <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <h3 className="font-semibold text-sm">Free Registration (₹0.00)</h3>
                <p className="text-emerald-700 text-xs mt-0.5 leading-relaxed">
                  No services or audio tests selected. Registration proceeds without fees.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-2.5">
              <div className="flex items-center justify-between text-xs text-gray-500">
                <span className="font-medium">Selected Items ({selectedServices.length + selectedAudios.length})</span>
                <button
                  type="button"
                  onClick={clearAllBilling}
                  className="text-red-500 hover:text-red-700 font-medium hover:underline text-xs"
                >
                  Clear all (free)
                </button>
              </div>
              <div className="max-h-32 overflow-y-auto space-y-1.5 p-2 bg-gray-50/70 rounded-xl border border-gray-200/80">
                {selectedServices.map((s) => (
                  <div key={s.id} className="flex items-center justify-between px-3 py-1.5 bg-white rounded-lg border border-gray-200 text-xs">
                    <div className="flex items-center gap-2 truncate">
                      <Stethoscope className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                      <span className="truncate font-medium text-gray-800">{s.name}</span>
                      <span className="text-[10px] px-1.5 py-0.5 bg-blue-50 text-blue-700 font-medium rounded">Service</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="font-mono font-medium text-gray-700">₹{Number(s.price).toFixed(2)}</span>
                      <button
                        type="button"
                        onClick={() => removeService(s.id)}
                        className="text-gray-400 hover:text-red-500 p-0.5 rounded transition-colors"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
                {selectedAudios.map((a) => (
                  <div key={a.id} className="flex items-center justify-between px-3 py-1.5 bg-white rounded-lg border border-gray-200 text-xs">
                    <div className="flex items-center gap-2 truncate">
                      <FlaskConical className="w-3.5 h-3.5 text-purple-500 shrink-0" />
                      <span className="truncate font-medium text-gray-800">{a.name} {a.code ? `(${a.code})` : ''}</span>
                      <span className="text-[10px] px-1.5 py-0.5 bg-purple-50 text-purple-700 font-medium rounded">Audio</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="font-mono font-medium text-gray-700">₹{Number(a.price).toFixed(2)}</span>
                      <button
                        type="button"
                        onClick={() => removeAudio(a.id)}
                        className="text-gray-400 hover:text-red-500 p-0.5 rounded transition-colors"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Subtotal, Discount & Net Payable */}
              <div className="grid grid-cols-2 gap-3 pt-1">
                <div>
                  <label htmlFor="customDiscount" className="label text-xs text-emerald-700 font-semibold mb-1">
                    Discount (₹)
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-emerald-600 text-sm">₹</span>
                    <input
                      id="customDiscount"
                      type="number"
                      min="0"
                      step="0.01"
                      value={customDiscount}
                      onChange={(e) => setCustomDiscount(e.target.value)}
                      placeholder="0.00"
                      className="input pl-7 border-emerald-300 bg-emerald-50/30 text-emerald-900 font-medium text-sm"
                    />
                  </div>
                </div>
                <div className="flex flex-col justify-end">
                  <div className="flex justify-between items-center bg-gray-50 h-[2.35rem] px-3 rounded-lg border border-gray-200 text-sm">
                    <span className="text-gray-600 font-medium text-xs">Net:</span>
                    <span className="font-mono font-bold text-blue-600 text-sm">
                      ₹{netPayable.toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Payment Method (Only when netPayable > 0) */}
              {netPayable > 0 && (
                <div className="pt-1">
                  <label className="label text-xs mb-1">Payment Method</label>
                  <div className="flex gap-2">
                    {PAY_METHODS.map((m) => (
                      <label
                        key={m.id}
                        className={`flex-1 text-center text-xs py-2 px-3 rounded-lg border cursor-pointer font-medium transition-colors ${
                          watch('paymentMethod') === m.id
                            ? 'border-blue-600 bg-blue-50 text-blue-700 shadow-sm'
                            : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                        }`}
                      >
                        <input type="radio" className="sr-only" value={m.id} {...register('paymentMethod')} />
                        {m.label}
                      </label>
                    ))}
                  </div>
                  {(watch('paymentMethod') === 'UPI' || watch('paymentMethod') === 'CARD') && (
                    <input
                      {...register('paymentReference')}
                      className="input mt-2 text-sm"
                      placeholder={watch('paymentMethod') === 'UPI' ? 'UPI reference (optional)' : 'Card approval / last 4 (optional)'}
                    />
                  )}
                </div>
              )}
            </div>
          )}
        </section>
        </div>

        {!isOpRegistration && (
        <section>
          <h2 className="text-sm font-semibold text-gray-900 mb-2 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-blue-600" />
            Complaint & vitals
          </h2>
          <div className="space-y-2">
            <div>
              <label htmlFor="chiefComplaint" className="label">Chief Complaint</label>
              <textarea
                {...register('chiefComplaint')}
                id="chiefComplaint"
                rows={2}
                className="input"
                placeholder={isReview ? "Today's reason for this return visit..." : "Patient's main reason for visit..."}
              />
            </div>

            <div>
              <h3 className="text-xs font-medium text-gray-900 mb-1">Vitals (optional)</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                <div>
                  <label htmlFor="bp" className="label">Blood Pressure</label>
                  <input
                    {...register('vitals.bloodPressure')}
                    id="bp"
                    type="text"
                    className="input"
                    placeholder="120/80"
                  />
                </div>
                <div>
                  <label htmlFor="hr" className="label">Heart Rate (bpm)</label>
                  <input
                    {...register('vitals.heartRate')}
                    id="hr"
                    type="text"
                    className="input"
                    placeholder="72"
                  />
                </div>
                <div>
                  <label htmlFor="temp" className="label">Temperature (°F/°C)</label>
                  <input
                    {...register('vitals.temperature')}
                    id="temp"
                    type="text"
                    className="input"
                    placeholder="98.6"
                  />
                </div>
                <div>
                  <label htmlFor="rr" className="label">Resp. Rate (/min)</label>
                  <input
                    {...register('vitals.respiratoryRate')}
                    id="rr"
                    type="text"
                    className="input"
                    placeholder="16"
                  />
                </div>
                <div>
                  <label htmlFor="spo2" className="label">SpO2 (%)</label>
                  <input
                    {...register('vitals.oxygenSaturation')}
                    id="spo2"
                    type="text"
                    className="input"
                    placeholder="98"
                  />
                </div>
                <div>
                  <label htmlFor="weight" className="label">Weight (kg)</label>
                  <input
                    {...register('vitals.weight')}
                    id="weight"
                    type="text"
                    className="input"
                    placeholder="70"
                  />
                </div>
                <div>
                  <label htmlFor="height" className="label">Height (cm)</label>
                  <input
                    {...register('vitals.height')}
                    id="height"
                    type="text"
                    className="input"
                    placeholder="170"
                  />
                </div>
                <div>
                  <label htmlFor="bmi" className="label">BMI</label>
                  <input
                    {...register('vitals.bmi')}
                    id="bmi"
                    type="text"
                    className="input"
                    placeholder="24.2"
                  />
                </div>
              </div>
            </div>
          </div>
        </section>
        )}

        <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
          <button type="button" onClick={() => navigate(-1)} className="btn-secondary py-2 px-4 text-sm font-medium">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Cancel
          </button>
          <button type="submit" className="btn-primary py-2 px-5 text-sm font-semibold" disabled={isLoading}>
            {isLoading ? (
              <span className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                {isReview ? 'Registering review...' : 'Creating...'}
              </span>
            ) : (
              <>
                <CheckCircle className="w-4 h-4 mr-2" />
                {isReview ? 'Register OP review' : 'Create OP Case'}
              </>
            )}
          </button>
        </div>
      </form>

      {createdCaseId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="card max-w-md w-full p-6 space-y-4 shadow-xl">
            <div className="flex items-start gap-3">
              <div className="h-10 w-10 rounded-full bg-green-100 text-green-700 flex items-center justify-center shrink-0">
                <CheckCircle className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900">
                  {isReview ? 'OP review registered' : 'OP case created'}
                </h2>
                <p className="text-sm text-gray-500 mt-1">Do you want to print the receipt?</p>
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => navigate('/patients')}
              >
                No, skip
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={() => navigate(`/patients/op-receipt/${createdCaseId}${isReview ? '?type=review' : ''}`)}
              >
                <Printer className="w-4 h-4 mr-2" />
                Yes, print receipt
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}