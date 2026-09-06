import { useEffect, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2, ArrowLeft, User, IndianRupee, Calendar, AlertCircle, CheckCircle, Search, Printer } from 'lucide-react';
import { clinicalApi } from '../../services/clinical';
import { patientsApi, type PatientSearchHit } from '../../services/patients';

const PAY_METHODS = [
  { id: 'CASH' as const, label: 'Cash' },
  { id: 'UPI' as const, label: 'UPI' },
  { id: 'CARD' as const, label: 'Card' },
];

const createOpCaseSchema = z.object({
  patientId: z.string().min(1, 'Patient is required'),
  consultationFee: z.string().min(1, 'Consultation fee is required').pipe(z.coerce.number().min(0, 'Fee cannot be negative')),
  paymentMethod: z.enum(['CASH', 'UPI', 'CARD']),
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
  const [selectedPatientName, setSelectedPatientName] = useState('');
  const [lastOpSummary, setLastOpSummary] = useState<string | null>(null);
  const [createdCaseId, setCreatedCaseId] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<CreateOpCaseFormInput, unknown, CreateOpCaseForm>({
    // zodResolver input/output diverge when schemas use .pipe(z.coerce…)
    resolver: zodResolver(createOpCaseSchema) as any,
    defaultValues: {
      paymentMethod: 'CASH',
      vitals: {},
    },
  });

  useEffect(() => {
    if (!presetPatientId) return;
    setValue('patientId', presetPatientId);
    patientsApi.getById<{ name: string; patientNumber: string }>(presetPatientId).then((p) => {
      setSelectedPatientName(`${p.name} (${p.patientNumber})`);
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
  }, [patientSearch, isReview]);

  const lastOpLabel = (patient: PatientSearchHit) => {
    const last = patient.opCases?.[0];
    if (!last) return null;
    const when = new Date(last.createdAt).toLocaleDateString();
    return last.chiefComplaint ? `Last OP ${when} — ${last.chiefComplaint}` : `Last OP ${when}`;
  };

  const searchPatients = async (query: string) => {
    setIsSearching(true);
    try {
      setSearchResults(await patientsApi.search(query, 10, { opRegistered: isReview }));
    } catch (err) {
      console.error('Patient search failed:', err);
    } finally {
      setIsSearching(false);
    }
  };

  const handlePatientSelect = (patient: PatientSearchHit) => {
    setValue('patientId', patient.id);
    setSelectedPatientName(`${patient.name} (${patient.patientNumber})`);
    setLastOpSummary(lastOpLabel(patient));
    setSearchResults([]);
    setPatientSearch('');
  };

  const onSubmit = async (data: CreateOpCaseForm) => {
    setIsLoading(true);
    setError(null);

    try {
      const billing = {
        consultationFee: data.consultationFee,
        paymentMethod: data.paymentMethod,
        paymentReference: data.paymentReference || undefined,
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
    <div className="max-w-5xl mx-auto space-y-3">
      <div className="flex items-center gap-4">
        <button onClick={() => navigate(-1)} className="p-2 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-xl font-bold text-gray-900">
            {isReview ? 'OP review registration' : presetPatientId ? 'New OP registration' : 'New OP Case'}
          </h1>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-lg bg-red-50 border border-red-200 text-red-700 flex items-center gap-2">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="card p-4 space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* Step 1: Patient Selection */}
        <section>
          <h2 className="text-sm font-semibold text-gray-900 mb-2 flex items-center gap-2">
            <User className="w-4 h-4 text-blue-600" />
            {isReview ? 'Returning OP patient' : presetPatientId ? 'Patient' : 'Patient'}
          </h2>
          {!presetPatientId && (
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="search"
              id="patientSearch"
              placeholder={isReview
                ? 'Search a previously OP-registered patient...'
                : 'Search patient by name, phone, or patient number...'}
              className="input pl-10"
              onChange={(e) => setPatientSearch(e.target.value)}
              autoComplete="off"
            />
            {isSearching && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 animate-spin" />}
            {errors.patientId && (
              <p className="mt-1 text-sm text-red-600">{errors.patientId.message}</p>
            )}
          </div>
          )}
          {!presetPatientId && searchResults.length > 0 && (
            <div className="mt-2 border border-gray-200 rounded-lg bg-white max-h-32 overflow-y-auto">
              {searchResults.map((patient) => (
                <button
                  type="button"
                  key={patient.id}
                  onClick={() => handlePatientSelect(patient)}
                  className="w-full px-4 py-2 text-left hover:bg-gray-50 border-b last:border-0 flex items-center justify-between"
                >
                  <div>
                    <p className="font-medium text-gray-900">{patient.name}</p>
                    <p className="text-sm text-gray-500 flex items-center gap-2">
                      <span className="font-mono">{patient.patientNumber}</span>
                      {patient.phone && <span>• {patient.phone}</span>}
                    </p>
                    {isReview && lastOpLabel(patient) && (
                      <p className="text-xs text-blue-700 mt-0.5">{lastOpLabel(patient)}</p>
                    )}
                  </div>
                  <CheckCircle className="w-5 h-5 text-green-500" />
                </button>
              ))}
            </div>
          )}
          {watch('patientId') && (
            <div className="mt-2 px-2 py-1.5 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-center gap-2">
                <User className="w-4 h-4 text-green-600" />
                <span className="text-sm text-green-800 font-medium">{selectedPatientName || 'Patient selected'}</span>
              </div>
              {isReview && lastOpSummary && (
                <p className="text-sm text-green-800 mt-1 ml-7">{lastOpSummary}</p>
              )}
            </div>
          )}
          {isReview && !watch('patientId') && (
            <p className="mt-1 text-xs text-gray-500">Only previous OP patients. Use New OP for a first visit.</p>
          )}
        </section>

        {/* Step 2: Consultation fee */}
        <section>
          <h2 className="text-sm font-semibold text-gray-900 mb-2 flex items-center gap-2">
            <IndianRupee className="w-4 h-4 text-blue-600" />
            Consultation fees
          </h2>
          <label htmlFor="consultationFee" className="label">Amount *</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">₹</span>
            <input
              {...register('consultationFee')}
              id="consultationFee"
              type="number"
              min="0"
              step="0.01"
              className="input pl-7"
              placeholder="0.00"
            />
          </div>
          {errors.consultationFee && <p className="mt-1 text-sm text-red-600">{errors.consultationFee.message}</p>}
          <label className="label mt-3">Mode of payment *</label>
          <div className="flex gap-2">
            {PAY_METHODS.map((m) => (
              <label
                key={m.id}
                className={`flex-1 text-center text-sm px-3 py-2 rounded-lg border cursor-pointer ${
                  watch('paymentMethod') === m.id
                    ? 'border-blue-600 bg-blue-50 text-blue-700 font-medium'
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
              className="input mt-2"
              placeholder={watch('paymentMethod') === 'UPI' ? 'UPI reference (optional)' : 'Card approval / last 4 (optional)'}
            />
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

        <div className="flex justify-end gap-4 pt-4 border-t border-gray-200">
          <button type="button" onClick={() => navigate(-1)} className="btn-secondary">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Cancel
          </button>
          <button type="submit" className="btn-primary" disabled={isLoading}>
                {isLoading ? (
              <span className="flex items-center gap-2">
                <Loader2 className="w-5 h-5 animate-spin" />
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