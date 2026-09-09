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
} from 'lucide-react';
import { patientsApi } from '../../services/patients';
import { clinicalApi } from '../../services/clinical';
import { servicesApi, type ServiceMaster } from '../../services/services';
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
    serviceId: forOp ? z.string().min(1, 'Service is required') : z.string().optional(),
    consultationFee: forOp
      ? z.string().min(1, 'Price is required').pipe(z.coerce.number().min(0, 'Price cannot be negative'))
      : z.string().optional(),
    paymentMethod: forOp ? z.enum(['CASH', 'UPI', 'CARD']) : z.enum(['CASH', 'UPI', 'CARD']).optional(),
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
      paymentMethod: 'CASH',
    },
  });

  const selectedServiceId = watch('serviceId');
  const paymentMethod = watch('paymentMethod');

  const sortedServices = useMemo(
    () => [...services].sort((a, b) => a.name.localeCompare(b.name)),
    [services],
  );

  useEffect(() => {
    if (!forOp) return;
    servicesApi
      .list({ activeOnly: true, limit: 200 })
      .then((res) => setServices(res.data || []))
      .catch(() => setServices([]));
  }, [forOp]);

  useEffect(() => {
    if (!forOp || !sortedServices.length) return;
    const current = watch('serviceId');
    if (current && sortedServices.some((s) => s.id === current)) return;
    const pick = sortedServices[0];
    setValue('serviceId', pick.id);
    setValue('consultationFee', String(pick.price));
  }, [forOp, sortedServices, setValue, watch]);

  useEffect(() => {
    if (!forOp || !selectedServiceId) return;
    const service = services.find((s) => s.id === selectedServiceId);
    if (service) setValue('consultationFee', String(service.price));
  }, [forOp, selectedServiceId, services, setValue]);

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
        const opCase = await clinicalApi.create({
          patientId: result.id,
          serviceId: data.serviceId!,
          consultationFee: data.consultationFee as number,
          paymentMethod: data.paymentMethod || 'CASH',
          paymentReference: data.paymentReference || undefined,
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

  const field = forOp ? 'input h-9' : 'input';
  const label = forOp ? 'label mb-1 text-xs' : 'label';

  return (
    <div className={forOp ? 'space-y-3' : 'max-w-5xl mx-auto space-y-3'}>
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="p-2 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className={`font-bold text-gray-900 text-xl`}>
            {forOp ? 'New OP registration' : 'New Patient'}
          </h1>
        </div>
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 flex items-center gap-2 text-sm">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="card p-4 space-y-3">
        <section>
          <h2 className="font-semibold text-gray-900 flex items-center gap-2 text-sm mb-2">
            <User className="w-4 h-4 text-blue-600" />
            Personal Information
          </h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-x-3 gap-y-2">
            <div className={forOp ? 'lg:col-span-2' : undefined}>
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
              {forOp ? (
                <>
                  <label htmlFor="age" className={label}>Age (years) *</label>
                  <input
                    {...register('age')}
                    id="age"
                    type="number"
                    min={0}
                    max={120}
                    className={field}
                    placeholder="e.g. 45"
                  />
                  {errors.age && <p className="mt-1 text-sm text-red-600">{errors.age.message}</p>}
                </>
              ) : (
                <>
                  <label htmlFor="dateOfBirth" className={label}>Date of Birth</label>
                  <input
                    {...register('dateOfBirth')}
                    id="dateOfBirth"
                    type="date"
                    className={field}
                    max={new Date().toISOString().split('T')[0]}
                  />
                  {errors.dateOfBirth && <p className="mt-1 text-sm text-red-600">{errors.dateOfBirth.message}</p>}
                </>
              )}
            </div>

            <div>
              <label htmlFor="gender" className={label}>Gender{forOp ? ' *' : ''}</label>
              <select {...register('gender')} id="gender" className={field}>
                {forOp && <option value="">Select gender</option>}
                <option value="MALE">Male</option>
                <option value="FEMALE">Female</option>
                <option value="OTHER">Other</option>
                {!forOp && <option value="UNKNOWN">Unknown</option>}
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

            <div className={forOp ? 'lg:col-span-2' : undefined}>
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
          {forOp ? (
            <div>
              <label htmlFor="addressLine" className={label}>Address *</label>
              <input
                {...register('address.line')}
                id="addressLine"
                type="text"
                className={field}
                placeholder="House / street, area, city, pincode"
              />
              {(() => {
                const lineErr =
                  errors.address && typeof errors.address === 'object' && 'line' in errors.address
                    ? (errors.address as { line?: { message?: string } }).line
                    : undefined;
                return lineErr?.message ? (
                  <p className="mt-1 text-sm text-red-600">{String(lineErr.message)}</p>
                ) : null;
              })()}
            </div>
          ) : (
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
          )}
        </section>

        {forOp && (
          <section>
            <h2 className="font-semibold text-gray-900 flex items-center gap-2 text-sm mb-2">
              <IndianRupee className="w-4 h-4 text-blue-600" />
              Service &amp; payment
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-3 gap-y-2">
              <div>
                <label htmlFor="serviceId" className={label}>Service *</label>
                <select {...register('serviceId')} id="serviceId" className={field}>
                  <option value="">
                    {sortedServices.length ? 'Select service' : 'No services — add under Service masters'}
                  </option>
                  {sortedServices.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} — ₹{Number(s.price).toFixed(2)}
                    </option>
                  ))}
                </select>
                {errors.serviceId && (
                  <p className="mt-1 text-sm text-red-600">{String(errors.serviceId.message)}</p>
                )}
                {!sortedServices.length && (
                  <p className="mt-1 text-xs text-amber-700">
                    Create services in Patients → Service masters first.
                  </p>
                )}
              </div>
              <div>
                <label htmlFor="consultationFee" className={label}>Price (₹) *</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">₹</span>
                  <input
                    {...register('consultationFee')}
                    id="consultationFee"
                    type="number"
                    min={0}
                    step="0.01"
                    className={`${field} pl-7`}
                    readOnly
                  />
                </div>
                {errors.consultationFee && (
                  <p className="mt-1 text-sm text-red-600">{String(errors.consultationFee.message)}</p>
                )}
              </div>
              <div className="md:col-span-2">
                <label className={label}>Mode of payment *</label>
                <div className="flex gap-2">
                  {PAY_METHODS.map((m) => (
                    <label
                      key={m.id}
                      className={`flex-1 cursor-pointer rounded-lg border px-3 py-2 text-center text-sm ${
                        paymentMethod === m.id
                          ? 'border-blue-500 bg-blue-50 text-blue-800'
                          : 'border-gray-200 text-gray-700'
                      }`}
                    >
                      <input
                        type="radio"
                        value={m.id}
                        className="sr-only"
                        {...register('paymentMethod')}
                      />
                      {m.label}
                    </label>
                  ))}
                </div>
              </div>
              {(paymentMethod === 'UPI' || paymentMethod === 'CARD') && (
                <div className="md:col-span-2">
                  <label htmlFor="paymentReference" className={label}>Payment reference</label>
                  <input
                    {...register('paymentReference')}
                    id="paymentReference"
                    type="text"
                    className={field}
                    placeholder="UPI / card reference (optional)"
                  />
                </div>
              )}
            </div>
          </section>
        )}

        {!forOp && (
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
        )}

        <div className={`flex justify-end gap-3 ${forOp ? 'pt-2' : 'pt-4 border-t border-gray-200'}`}>
          <button type="button" onClick={() => navigate(-1)} className="btn-secondary">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Cancel
          </button>
          <button type="submit" className="btn-primary" disabled={isLoading || (forOp && !sortedServices.length)}>
            {isLoading ? (
              <span className="flex items-center gap-2">
                <Loader2 className="w-5 h-5 animate-spin" />
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
