import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Loader2,
  ArrowLeft,
  User,
  Phone,
  Mail,
  MapPin,
  AlertCircle,
  CheckCircle,
  IndianRupee,
  Printer,
  Stethoscope,
  FlaskConical,
  X,
  ChevronDown,
  Check,
  Search,
} from 'lucide-react';
import { patientsApi } from '../../services/patients';
import { clinicalApi } from '../../services/clinical';
import { servicesApi, type ServiceMaster } from '../../services/services';
import { labApi } from '../../services/lab';
import type { LabProcedure } from '../../types/lab';
import type { BillingItemInput } from '../../types/clinical';
import { dobFromAgeYears } from '../../lib/age';

const PAY_METHODS = [
  { id: 'CASH' as const, label: 'Cash' },
  { id: 'UPI' as const, label: 'UPI' },
  { id: 'CARD' as const, label: 'Card' },
];

const requiredText = (message: string) => z.string().trim().min(1, message);

function patientSchema(forOp: boolean) {
  return z.object({
    name: z.string().min(2, 'Name must be at least 2 characters'),
    dateOfBirth: z.string().optional(),
    age: forOp
      ? requiredText('Age is required').pipe(z.coerce.number().int().min(0, 'Age must be 0 or more').max(120, 'Age must be 120 or less'))
      : z.union([z.literal(''), z.coerce.number().int().min(0).max(120)]).optional(),
    gender: forOp
      ? requiredText('Gender is required').pipe(z.enum(['MALE', 'FEMALE', 'OTHER']))
      : z.enum(['MALE', 'FEMALE', 'OTHER', 'UNKNOWN']).optional(),
    phone: z.string().optional(),
    alternatePhone: z.string().optional(),
    email: z.string().email('Invalid email').optional().or(z.literal('')),
    address: forOp
      ? z.object({ line: requiredText('Address is required') })
      : z.object({
          street: z.string().optional(),
          city: z.string().optional(),
          state: z.string().optional(),
          pincode: z.string().optional(),
          country: z.string().optional(),
        }),
    emergencyContact: z.object({
      name: z.string().optional(),
      phone: z.string().optional(),
      relationship: z.string().optional(),
    }).optional(),
    serviceId: z.string().optional(),
    consultationFee: z.union([z.string(), z.number()]).optional(),
    discount: z.union([z.string(), z.number()]).optional(),
    paymentMethod: z.enum(['CASH', 'UPI', 'CARD']).optional(),
    paymentReference: z.string().optional(),
  });
}

type PatientFormInput = z.input<ReturnType<typeof patientSchema>>;
type PatientForm = z.output<ReturnType<typeof patientSchema>>;

export function PatientCreatePage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const forOp = params.get('intent') === 'op';
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [services, setServices] = useState<ServiceMaster[]>([]);
  const [audioProcedures, setAudioProcedures] = useState<LabProcedure[]>([]);
  const [selectedServices, setSelectedServices] = useState<ServiceMaster[]>([]);
  const [selectedAudios, setSelectedAudios] = useState<LabProcedure[]>([]);
  const [isServiceDropdownOpen, setIsServiceDropdownOpen] = useState(false);
  const [isAudioDropdownOpen, setIsAudioDropdownOpen] = useState(false);
  const [serviceSearch, setServiceSearch] = useState('');
  const [audioSearch, setAudioSearch] = useState('');
  const [customDiscount, setCustomDiscount] = useState<string>('');
  const [createdCaseId, setCreatedCaseId] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<PatientFormInput, unknown, PatientForm>({
    // zodResolver input/output diverge when schemas use .pipe(z.coerce…)
    resolver: zodResolver(patientSchema(forOp)) as any,
    defaultValues: {
      gender: forOp ? undefined : 'UNKNOWN',
      address: forOp ? { line: '' } : { country: 'India' },
      emergencyContact: {},
      serviceId: '',
      consultationFee: '',
      discount: '',
      paymentMethod: 'CASH',
    },
  });

  const sortedServices = useMemo(
    () => [...services].sort((a, b) => {
      if (a.category === 'CONSULTATION' && b.category !== 'CONSULTATION') return -1;
      if (b.category === 'CONSULTATION' && a.category !== 'CONSULTATION') return 1;
      return a.name.localeCompare(b.name);
    }),
    [services],
  );

  const displayedServices = useMemo(() => {
    if (!serviceSearch.trim()) return sortedServices;
    const q = serviceSearch.toLowerCase();
    return sortedServices.filter(
      (s) => s.name.toLowerCase().includes(q) || s.code.toLowerCase().includes(q) || s.category.toLowerCase().includes(q)
    );
  }, [sortedServices, serviceSearch]);

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
    if (!forOp) return;
    servicesApi
      .list({ activeOnly: true, limit: 200 })
      .then((res) => setServices(res.data || []))
      .catch(() => setServices([]));
    labApi
      .getProcedures({ limit: 200 })
      .then((res) => setAudioProcedures((res.data || []).filter((p) => p.isActive !== false)))
      .catch(() => setAudioProcedures([]));
  }, [forOp]);

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

  const onSubmit = async (data: PatientForm) => {
    setIsLoading(true);
    setError(null);

    try {
      const address = forOp
        ? { line: (data.address as { line?: string }).line }
        : data.address;
      const addressValues = Object.values(address || {}).filter(Boolean);
      const ageValue = typeof data.age === 'number' ? data.age : undefined;
      const payload = {
        name: data.name,
        dateOfBirth: forOp
          ? (ageValue != null ? dobFromAgeYears(ageValue) : undefined)
          : data.dateOfBirth || undefined,
        gender: data.gender,
        phone: data.phone || undefined,
        alternatePhone: data.alternatePhone || undefined,
        email: data.email || undefined,
        address: addressValues.length > 0 ? address : undefined,
        emergencyContact: forOp
          ? undefined
          : Object.keys(data.emergencyContact || {}).length > 0
            ? data.emergencyContact
            : undefined,
      };

      const result = await patientsApi.create(payload);
      if (forOp && result?.id) {
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

        const opCase = await clinicalApi.create({
          patientId: result.id,
          serviceId: selectedServices[0]?.id || undefined,
          consultationFee: hasBilling ? netPayable : undefined,
          discount: totalDiscount > 0 ? totalDiscount : undefined,
          paymentMethod: hasBilling ? (data.paymentMethod || 'CASH') : undefined,
          paymentReference: hasBilling ? (data.paymentReference || undefined) : undefined,
          billingItems: billingItems.length > 0 ? billingItems : undefined,
        });
        setCreatedCaseId(opCase.id);
      } else {
        navigate(`/patients/${result.id}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create patient');
    } finally {
      setIsLoading(false);
    }
  };

  const field = 'input';
  const label = 'label';

  return (
    <div className="max-w-6xl mx-auto space-y-3">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="font-bold text-gray-900 text-lg">
          {forOp ? 'New OP registration' : 'New Patient'}
        </h1>
      </div>

      {error && (
        <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 flex items-center gap-2.5 text-sm">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className={`card ${forOp ? 'p-5 lg:p-6 space-y-4' : 'p-6 space-y-4'}`}>
        {forOp ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left Column: Patient Details */}
            <div className="lg:col-span-7 space-y-3">
              <div className="flex items-center gap-2 pb-2 border-b border-gray-100">
                <User className="w-4 h-4 text-blue-600" />
                <h2 className="font-semibold text-gray-800 text-xs tracking-wider uppercase">Patient Information</h2>
              </div>

              <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                <div className="col-span-2">
                  <label htmlFor="name" className={label}>Full Name *</label>
                  <input
                    {...register('name')}
                    id="name"
                    type="text"
                    className={`${field} font-medium`}
                    placeholder="Patient's full name"
                  />
                  {errors.name && <p className="mt-1 text-xs text-red-600">{errors.name.message}</p>}
                </div>

                <div>
                  <label htmlFor="age" className={label}>Age (years) *</label>
                  <input
                    {...register('age')}
                    id="age"
                    type="number"
                    min={0}
                    max={120}
                    className={field}
                    placeholder="e.g. 45"
                    onChange={(e) => {
                      const val = e.target.value;
                      setValue('age', val as any);
                      const num = Number(val);
                      if (!isNaN(num) && num >= 0 && num <= 120) {
                        const d = new Date();
                        d.setFullYear(d.getFullYear() - num);
                        setValue('dateOfBirth', d.toISOString().split('T')[0]);
                      }
                    }}
                  />
                  {errors.age && <p className="mt-1 text-xs text-red-600">{errors.age.message}</p>}
                </div>

                <div>
                  <label htmlFor="gender" className={label}>Gender *</label>
                  <select {...register('gender')} id="gender" className={field}>
                    <option value="">Select gender</option>
                    <option value="MALE">Male</option>
                    <option value="FEMALE">Female</option>
                    <option value="OTHER">Other</option>
                  </select>
                  {errors.gender && <p className="mt-1 text-xs text-red-600">{errors.gender.message}</p>}
                </div>

                <div>
                  <label htmlFor="phone" className={label}>Phone Number</label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      {...register('phone')}
                      id="phone"
                      type="tel"
                      className={`${field} pl-9`}
                      placeholder="+91 98765 43210"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="alternatePhone" className={label}>Alternate Phone</label>
                  <input
                    {...register('alternatePhone')}
                    id="alternatePhone"
                    type="tel"
                    className={field}
                    placeholder="Alternate number"
                  />
                </div>

                <div>
                  <label htmlFor="dateOfBirth" className={label}>Date of Birth (optional)</label>
                  <input
                    {...register('dateOfBirth')}
                    id="dateOfBirth"
                    type="date"
                    className={field}
                    max={new Date().toISOString().split('T')[0]}
                    onChange={(e) => {
                      const dob = e.target.value;
                      setValue('dateOfBirth', dob);
                      if (dob) {
                        const birth = new Date(dob);
                        const today = new Date();
                        let a = today.getFullYear() - birth.getFullYear();
                        const m = today.getMonth() - birth.getMonth();
                        if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) a--;
                        if (a >= 0 && a <= 120) setValue('age', a);
                      }
                    }}
                  />
                </div>

                <div>
                  <label htmlFor="email" className={label}>Email (optional)</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      {...register('email')}
                      id="email"
                      type="email"
                      className={`${field} pl-9`}
                      placeholder="email@example.com"
                    />
                  </div>
                  {errors.email && <p className="mt-1 text-xs text-red-600">{errors.email.message}</p>}
                </div>

                <div className="col-span-2">
                  <label htmlFor="addressLine" className={label}>Address *</label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      {...register('address.line')}
                      id="addressLine"
                      type="text"
                      className={`${field} pl-9`}
                      placeholder="House / street, area, city, pincode"
                    />
                  </div>
                  {(() => {
                    const lineErr =
                      errors.address && typeof errors.address === 'object' && 'line' in errors.address
                        ? (errors.address as { line?: { message?: string } }).line
                        : undefined;
                    return lineErr?.message ? (
                      <p className="mt-1 text-xs text-red-600">{String(lineErr.message)}</p>
                    ) : null;
                  })()}
                </div>
              </div>
            </div>

            {/* Right Column: Service & Audio Billing */}
            <div className="lg:col-span-5 space-y-3.5">
              <div className="flex items-center justify-between pb-2 border-b border-gray-100">
                <div className="flex items-center gap-2">
                  <IndianRupee className="w-4 h-4 text-blue-600" />
                  <h2 className="font-semibold text-gray-800 text-xs tracking-wider uppercase">Service &amp; Audio Billing</h2>
                </div>
                <span className="text-xs px-2.5 py-0.5 rounded-full font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                  Optional (Free)
                </span>
              </div>

              {/* Multi-select Buttons */}
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

                  {isAudioDropdownOpen && (
                    <div className="absolute left-0 right-0 top-full mt-1.5 z-30 bg-white rounded-xl border border-gray-200 shadow-xl p-3 space-y-2.5">
                      <div className="relative">
                        <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          value={audioSearch}
                          onChange={(e) => setAudioSearch(e.target.value)}
                          placeholder="Search audio tests (PTA, IMP)..."
                          className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-gray-200 focus:outline-none focus:border-purple-500"
                          onClick={(e) => e.stopPropagation()}
                        />
                      </div>
                      <div className="max-h-48 overflow-y-auto space-y-1">
                        {displayedAudios.length === 0 ? (
                          <p className="text-xs text-gray-400 text-center py-3">No audio tests found</p>
                        ) : (
                          displayedAudios.map((a) => {
                            const isSelected = selectedAudios.some((item) => item.id === a.id);
                            return (
                              <div
                                key={a.id}
                                onClick={() => toggleAudio(a)}
                                className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg cursor-pointer text-xs transition-colors ${
                                  isSelected ? 'bg-purple-50 text-purple-900 font-medium' : 'hover:bg-gray-50 text-gray-700'
                                }`}
                              >
                                <div className="flex items-center gap-2 truncate pr-2">
                                  <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
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
                      <div className="pt-2 border-t border-gray-100 flex justify-end">
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

              {/* Selected Items or Free Notice */}
              {!hasBillingItems ? (
                <div className="p-4 bg-emerald-50/80 border border-dashed border-emerald-200 rounded-xl text-emerald-900 flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                  <div>
                    <h3 className="font-semibold text-sm">Free Registration (₹0.00)</h3>
                    <p className="text-emerald-700 text-xs mt-0.5 leading-relaxed">
                      No services or audio tests selected. Registration will proceed without any fees or bill generation.
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
                      <label htmlFor="patientCustomDiscount" className="label text-xs text-emerald-700 font-semibold mb-1">
                        Discount (₹)
                      </label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-emerald-600 text-sm">₹</span>
                        <input
                          id="patientCustomDiscount"
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
                          placeholder={watch('paymentMethod') === 'UPI' ? 'UPI transaction reference (optional)' : 'Card approval / last 4 digits (optional)'}
                        />
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        ) : (
          <>
            <section>
              <h2 className="font-semibold text-gray-900 flex items-center gap-2 text-sm mb-2">
                <User className="w-4 h-4 text-blue-600" />
                Personal Information
              </h2>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-x-3 gap-y-2">
                <div>
                  <label htmlFor="name" className={label}>Full Name *</label>
                  <input
                    {...register('name')}
                    id="name"
                    type="text"
                    className={field}
                    placeholder="John Doe"
                  />
                  {errors.name && <p className="mt-1 text-sm text-red-600">{errors.name.message}</p>}
                </div>
                <div>
                  <label htmlFor="dateOfBirth" className={label}>Date of Birth</label>
                  <input
                    {...register('dateOfBirth')}
                    id="dateOfBirth"
                    type="date"
                    className={field}
                    max={new Date().toISOString().split('T')[0]}
                  />
                  {errors.dateOfBirth && <p className="mt-1 text-sm text-red-600">{errors.dateOfBirth.message}</p>}
                </div>
                <div>
                  <label htmlFor="gender" className={label}>Gender</label>
                  <select {...register('gender')} id="gender" className={field}>
                    <option value="MALE">Male</option>
                    <option value="FEMALE">Female</option>
                    <option value="OTHER">Other</option>
                    <option value="UNKNOWN">Unknown</option>
                  </select>
                  {errors.gender && <p className="mt-1 text-sm text-red-600">{errors.gender.message}</p>}
                </div>
                <div>
                  <label htmlFor="phone" className={label}>Phone Number</label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      {...register('phone')}
                      id="phone"
                      type="tel"
                      className={`${field} pl-9`}
                      placeholder="+91 98765 43210"
                    />
                  </div>
                </div>
                <div>
                  <label htmlFor="alternatePhone" className={label}>Alternate Phone</label>
                  <input
                    {...register('alternatePhone')}
                    id="alternatePhone"
                    type="tel"
                    className={field}
                    placeholder="+91 98765 43210"
                  />
                </div>
                <div>
                  <label htmlFor="email" className={label}>Email</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      {...register('email')}
                      id="email"
                      type="email"
                      className={`${field} pl-9`}
                      placeholder="john@example.com"
                    />
                  </div>
                  {errors.email && <p className="mt-1 text-sm text-red-600">{errors.email.message}</p>}
                </div>
              </div>
            </section>

            <section>
              <h2 className="font-semibold text-gray-900 flex items-center gap-2 text-sm mb-2">
                <MapPin className="w-4 h-4 text-blue-600" />
                Address
              </h2>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-x-3 gap-y-2">
                <div>
                  <label htmlFor="street" className={label}>Street</label>
                  <input
                    {...register('address.street')}
                    id="street"
                    type="text"
                    className={field}
                    placeholder="123 Main Street"
                  />
                </div>
                <div>
                  <label htmlFor="city" className={label}>City</label>
                  <input
                    {...register('address.city')}
                    id="city"
                    type="text"
                    className={field}
                    placeholder="Mumbai"
                  />
                </div>
                <div>
                  <label htmlFor="state" className={label}>State</label>
                  <input
                    {...register('address.state')}
                    id="state"
                    type="text"
                    className={field}
                    placeholder="Maharashtra"
                  />
                </div>
                <div>
                  <label htmlFor="pincode" className={label}>Pincode</label>
                  <input
                    {...register('address.pincode')}
                    id="pincode"
                    type="text"
                    className={field}
                    placeholder="400001"
                  />
                </div>
                <div>
                  <label htmlFor="country" className={label}>Country</label>
                  <input
                    {...register('address.country')}
                    id="country"
                    type="text"
                    className={field}
                    placeholder="India"
                  />
                </div>
              </div>
            </section>

            <section>
              <h2 className="text-sm font-semibold text-gray-900 mb-2 flex items-center gap-2">
                <User className="w-4 h-4 text-blue-600" />
                Emergency Contact
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                <div>
                  <label htmlFor="emergencyName" className="label">Name</label>
                  <input
                    {...register('emergencyContact.name')}
                    id="emergencyName"
                    type="text"
                    className="input"
                    placeholder="Jane Doe"
                  />
                </div>
                <div>
                  <label htmlFor="emergencyPhone" className="label">Phone</label>
                  <input
                    {...register('emergencyContact.phone')}
                    id="emergencyPhone"
                    type="tel"
                    className="input"
                    placeholder="+91 98765 43210"
                  />
                </div>
                <div>
                  <label htmlFor="emergencyRelationship" className="label">Relationship</label>
                  <input
                    {...register('emergencyContact.relationship')}
                    id="emergencyRelationship"
                    type="text"
                    className="input"
                    placeholder="Spouse / Parent / Child"
                  />
                </div>
              </div>
            </section>
          </>
        )}

        <div className={`flex justify-end gap-3 ${forOp ? 'pt-4 border-t border-gray-100' : 'pt-4 border-t border-gray-200'}`}>
          <button type="button" onClick={() => navigate(-1)} className="btn-secondary py-2 px-4 text-sm font-medium">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Cancel
          </button>
          <button type="submit" className="btn-primary py-2 px-5 text-sm font-semibold" disabled={isLoading}>
            {isLoading ? (
              <span className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                {forOp ? 'Registering...' : 'Creating...'}
              </span>
            ) : (
              <>
                <CheckCircle className="w-4 h-4 mr-2" />
                {forOp ? 'Register OP' : 'Create Patient'}
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
                <h2 className="text-lg font-semibold text-gray-900">OP registered</h2>
                <p className="text-sm text-gray-500 mt-1">Bill created. Do you want to print the receipt?</p>
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button type="button" className="btn-secondary" onClick={() => navigate('/patients')}>
                No, skip
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={() => navigate(`/patients/op-receipt/${createdCaseId}`)}
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
