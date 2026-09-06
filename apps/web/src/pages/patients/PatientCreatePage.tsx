import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2, ArrowLeft, User, Phone, Mail, MapPin, AlertCircle, CheckCircle } from 'lucide-react';
import { patientsApi } from '../../services/patients';
import { dobFromAgeYears } from '../../lib/age';

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
  });
}

type PatientForm = z.infer<ReturnType<typeof patientSchema>>;

export function PatientCreatePage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const forOp = params.get('intent') === 'op';
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<PatientForm>({
    resolver: zodResolver(patientSchema(forOp)),
    defaultValues: {
      gender: forOp ? undefined : 'UNKNOWN',
      address: forOp ? { line: '' } : { country: 'India' },
      emergencyContact: {},
    },
  });

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
        navigate(`/patients/op-new?patientId=${result.id}`);
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
              {errors.address && 'line' in errors.address && errors.address.line && (
                <p className="mt-1 text-sm text-red-600">{errors.address.line.message}</p>
              )}
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
          <button type="submit" className="btn-primary" disabled={isLoading}>
            {isLoading ? (
              <span className="flex items-center gap-2">
                <Loader2 className="w-5 h-5 animate-spin" />
                Creating...
              </span>
            ) : (
              <>
                <CheckCircle className="w-4 h-4 mr-2" />
                {forOp ? 'Continue' : 'Create Patient'}
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}