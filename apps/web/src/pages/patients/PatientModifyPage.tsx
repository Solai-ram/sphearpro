import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2, ArrowLeft, User, Phone, Mail, AlertCircle, CheckCircle, Search } from 'lucide-react';
import { patientsApi, type PatientSearchHit } from '../../services/patients';
import { ageFromDob, dobFromAgeYears, formatAddress } from '../../lib/age';

const schema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  age: z.string().trim().min(1, 'Age is required').pipe(z.coerce.number().int().min(0).max(120)),
  gender: z.string().min(1, 'Gender is required').pipe(z.enum(['MALE', 'FEMALE', 'OTHER'])),
  phone: z.string().optional(),
  email: z.string().email('Invalid email').optional().or(z.literal('')),
  address: z.string().trim().min(1, 'Address is required'),
});

type FormInput = z.input<typeof schema>;
type FormValues = z.output<typeof schema>;

type PatientRecord = {
  id: string;
  name: string;
  patientNumber: string;
  phone?: string;
  email?: string;
  gender?: string;
  dateOfBirth?: string;
  address?: Record<string, string>;
};

export function PatientModifyPage() {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<PatientSearchHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [patient, setPatient] = useState<PatientRecord | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormInput, unknown, FormValues>({
    // zodResolver input/output diverge when schemas use .pipe(z.coerce…)
    resolver: zodResolver(schema) as any,
  });

  useEffect(() => {
    const timer = setTimeout(async () => {
      if (query.trim().length < 2 || patient) {
        setResults([]);
        return;
      }
      setSearching(true);
      try {
        setResults(await patientsApi.search(query.trim(), 10));
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [query, patient]);

  const selectPatient = async (hit: PatientSearchHit) => {
    setError(null);
    setResults([]);
    setQuery('');
    try {
      const data = await patientsApi.getById<PatientRecord>(hit.id);
      setPatient(data);
      const age = ageFromDob(data.dateOfBirth);
      reset({
        name: data.name,
        age: age == null ? '' : String(age),
        gender: data.gender === 'FEMALE' || data.gender === 'MALE' || data.gender === 'OTHER' ? data.gender : '',
        phone: data.phone || '',
        email: data.email || '',
        address: formatAddress(data.address),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load patient');
    }
  };

  const onSubmit = async (data: FormValues) => {
    if (!patient) return;
    setIsLoading(true);
    setError(null);
    try {
      await patientsApi.update(patient.id, {
        name: data.name,
        dateOfBirth: dobFromAgeYears(data.age),
        gender: data.gender,
        phone: data.phone || undefined,
        email: data.email || undefined,
        address: { line: data.address },
      });
      navigate(`/patients/${patient.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update patient');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-4 max-w-4xl mx-auto">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="p-2 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Patients Modify</h1>
          <p className="text-sm text-gray-500">Find an existing patient and update their details</p>
        </div>
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 flex items-center gap-2 text-sm">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="card p-4 space-y-3">
        <label className="label mb-1 text-xs" htmlFor="modify-search">Search patient</label>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            id="modify-search"
            type="search"
            className="input h-9 pl-9"
            placeholder="Name, phone, or patient number"
            value={patient ? `${patient.name} (${patient.patientNumber})` : query}
            onChange={(e) => {
              setPatient(null);
              setQuery(e.target.value);
            }}
          />
          {searching && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-gray-400" />}
        </div>
        {results.length > 0 && (
          <div className="border border-gray-200 rounded-lg bg-white max-h-60 overflow-y-auto">
            {results.map((hit) => (
              <button
                type="button"
                key={hit.id}
                onClick={() => selectPatient(hit)}
                className="w-full px-4 py-2 text-left hover:bg-gray-50 border-b last:border-0"
              >
                <p className="font-medium text-gray-900">{hit.name}</p>
                <p className="text-sm text-gray-500 font-mono">
                  {hit.patientNumber}{hit.phone ? ` · ${hit.phone}` : ''}
                </p>
              </button>
            ))}
          </div>
        )}
      </div>

      {patient && (
        <form onSubmit={handleSubmit(onSubmit)} className="card p-4 space-y-3">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-x-3 gap-y-2">
            <div className="lg:col-span-2">
              <label className="label mb-1 text-xs" htmlFor="mod-name">Full Name *</label>
              <input {...register('name')} id="mod-name" className="input h-9" />
              {errors.name && <p className="mt-1 text-sm text-red-600">{errors.name.message}</p>}
            </div>
            <div>
              <label className="label mb-1 text-xs" htmlFor="mod-age">Age (years) *</label>
              <input {...register('age')} id="mod-age" type="number" min={0} max={120} className="input h-9" />
              {errors.age && <p className="mt-1 text-sm text-red-600">{errors.age.message}</p>}
            </div>
            <div>
              <label className="label mb-1 text-xs" htmlFor="mod-gender">Gender *</label>
              <select {...register('gender')} id="mod-gender" className="input h-9">
                <option value="">Select gender</option>
                <option value="MALE">Male</option>
                <option value="FEMALE">Female</option>
                <option value="OTHER">Other</option>
              </select>
              {errors.gender && <p className="mt-1 text-sm text-red-600">{errors.gender.message}</p>}
            </div>
            <div>
              <label className="label mb-1 text-xs" htmlFor="mod-phone">Phone</label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input {...register('phone')} id="mod-phone" className="input h-9 pl-9" />
              </div>
            </div>
            <div className="lg:col-span-3">
              <label className="label mb-1 text-xs" htmlFor="mod-email">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input {...register('email')} id="mod-email" type="email" className="input h-9 pl-9" />
              </div>
              {errors.email && <p className="mt-1 text-sm text-red-600">{errors.email.message}</p>}
            </div>
          </div>
          <div>
            <label className="label mb-1 text-xs" htmlFor="mod-address">Address *</label>
            <textarea {...register('address')} id="mod-address" rows={2} className="input" />
            {errors.address && <p className="mt-1 text-sm text-red-600">{errors.address.message}</p>}
          </div>
          <div className="flex justify-end gap-3 pt-1">
            <button type="button" className="btn-secondary" onClick={() => { setPatient(null); reset(); }}>
              Change patient
            </button>
            <button type="submit" className="btn-primary" disabled={isLoading}>
              {isLoading ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Saving...
                </span>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Save changes
                </>
              )}
            </button>
          </div>
        </form>
      )}

      {!patient && (
        <p className="text-sm text-gray-500 flex items-center gap-2">
          <User className="w-4 h-4" />
          Search and select a patient to edit name, age, gender, and address.
        </p>
      )}
    </div>
  );
}
