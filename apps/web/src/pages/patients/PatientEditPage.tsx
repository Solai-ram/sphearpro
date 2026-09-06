import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2, ArrowLeft, AlertCircle, CheckCircle } from 'lucide-react';
import { patientsApi } from '../../services/patients';

const patientSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  dateOfBirth: z.string().optional(),
  gender: z.enum(['MALE', 'FEMALE', 'OTHER', 'UNKNOWN']).optional(),
  phone: z.string().optional(),
  alternatePhone: z.string().optional(),
  email: z.string().email('Invalid email').optional().or(z.literal('')),
  address: z.object({
    street: z.string().optional(),
    city: z.string().optional(),
    state: z.string().optional(),
    pincode: z.string().optional(),
    country: z.string().optional(),
  }).optional(),
  emergencyContact: z.object({
    name: z.string().optional(),
    phone: z.string().optional(),
    relationship: z.string().optional(),
  }).optional(),
});

type PatientForm = z.infer<typeof patientSchema>;

export function PatientEditPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<PatientForm>({
    resolver: zodResolver(patientSchema),
  });

  useEffect(() => {
    const fetchPatient = async () => {
      try {
        if (!id) return;
        const data = await patientsApi.getById<PatientForm & { dateOfBirth?: string }>(id);
        reset({
          name: data.name,
          dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth).toISOString().split('T')[0] : '',
          gender: data.gender,
          phone: data.phone || '',
          alternatePhone: data.alternatePhone || '',
          email: data.email || '',
          address: data.address || {},
          emergencyContact: data.emergencyContact || {},
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load patient');
      } finally {
        setInitialLoading(false);
      }
    };

    if (id) {
      fetchPatient();
    }
  }, [id, reset]);

  const onSubmit = async (data: PatientForm) => {
    if (!id) return;
    setIsLoading(true);
    setError(null);

    try {
      const payload = {
        name: data.name,
        dateOfBirth: data.dateOfBirth || undefined,
        gender: data.gender,
        phone: data.phone || undefined,
        alternatePhone: data.alternatePhone || undefined,
        email: data.email || undefined,
        address: Object.keys(data.address || {}).length > 0 ? data.address : undefined,
        emergencyContact: Object.keys(data.emergencyContact || {}).length > 0 ? data.emergencyContact : undefined,
      };

      await patientsApi.update(id, payload);
      navigate(`/patients/${id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update patient');
    } finally {
      setIsLoading(false);
    }
  };

  if (initialLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-3">
      <div className="flex items-center gap-4">
        <button onClick={() => navigate(-1)} className="p-2 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Edit Patient</h1>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-lg bg-red-50 border border-red-200 text-red-700 flex items-center gap-2">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="card p-4 space-y-3">
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-x-3 gap-y-2">
          <div>
            <label htmlFor="name" className="label">Full Name *</label>
            <input {...register('name')} id="name" type="text" className="input" />
            {errors.name && <p className="mt-1 text-sm text-red-600">{errors.name.message}</p>}
          </div>
          <div>
            <label htmlFor="dateOfBirth" className="label">Date of Birth</label>
            <input
              {...register('dateOfBirth')}
              id="dateOfBirth"
              type="date"
              className="input"
              max={new Date().toISOString().split('T')[0]}
            />
          </div>
          <div>
            <label htmlFor="gender" className="label">Gender</label>
            <select {...register('gender')} id="gender" className="input">
              <option value="MALE">Male</option>
              <option value="FEMALE">Female</option>
              <option value="OTHER">Other</option>
              <option value="UNKNOWN">Unknown</option>
            </select>
          </div>
          <div>
            <label htmlFor="phone" className="label">Phone Number</label>
            <input {...register('phone')} id="phone" type="tel" className="input" />
          </div>
          <div>
            <label htmlFor="alternatePhone" className="label">Alternate Phone</label>
            <input {...register('alternatePhone')} id="alternatePhone" type="tel" className="input" />
          </div>
          <div>
            <label htmlFor="email" className="label">Email</label>
            <input {...register('email')} id="email" type="email" className="input" />
            {errors.email && <p className="mt-1 text-sm text-red-600">{errors.email.message}</p>}
          </div>
        </div>

        <div>
          <h3 className="text-sm font-semibold text-gray-900 mb-2">Address</h3>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-x-3 gap-y-2">
            <div>
              <label htmlFor="street" className="label">Street</label>
              <input {...register('address.street')} id="street" type="text" className="input" />
            </div>
            <div>
              <label htmlFor="city" className="label">City</label>
              <input {...register('address.city')} id="city" type="text" className="input" />
            </div>
            <div>
              <label htmlFor="state" className="label">State</label>
              <input {...register('address.state')} id="state" type="text" className="input" />
            </div>
            <div>
              <label htmlFor="pincode" className="label">Pincode</label>
              <input {...register('address.pincode')} id="pincode" type="text" className="input" />
            </div>
            <div>
              <label htmlFor="country" className="label">Country</label>
              <input {...register('address.country')} id="country" type="text" className="input" />
            </div>
          </div>
        </div>

        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Emergency Contact</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label htmlFor="emergencyName" className="label">Name</label>
              <input {...register('emergencyContact.name')} id="emergencyName" type="text" className="input" />
            </div>
            <div>
              <label htmlFor="emergencyPhone" className="label">Phone</label>
              <input {...register('emergencyContact.phone')} id="emergencyPhone" type="tel" className="input" />
            </div>
            <div>
              <label htmlFor="emergencyRelationship" className="label">Relationship</label>
              <input {...register('emergencyContact.relationship')} id="emergencyRelationship" type="text" className="input" />
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-4 pt-4 border-t border-gray-200">
          <button type="button" onClick={() => navigate(-1)} className="btn-secondary">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Cancel
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
                Save Changes
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}