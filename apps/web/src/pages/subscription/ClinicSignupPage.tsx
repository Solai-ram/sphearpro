import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2 } from 'lucide-react';
import { AuthShell } from '../../components/AuthShell';
import { fetchWithRetry, setAccessToken } from '../../lib/api';
import { useAuth } from '../../auth/AuthContext';
import { PRODUCT_NAME } from '../../lib/product';

const schema = z
  .object({
    clinicName: z.string().min(2, 'Clinic name is required'),
    slug: z
      .string()
      .min(2)
      .max(48)
      .regex(/^[a-z0-9-]+$/, 'Lowercase letters, numbers, hyphens only'),
    adminName: z.string().min(2, 'Your name is required'),
    email: z.string().email(),
    password: z.string().min(8, 'At least 8 characters'),
    confirmPassword: z.string(),
    phone: z.string().optional(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

type Form = z.infer<typeof schema>;

export function ClinicSignupPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { refresh } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: {
      slug: '',
      email: searchParams.get('email') || '',
    },
  });

  const clinicName = watch('clinicName');

  return (
    <AuthShell variant="signup">
      <div className="w-full max-w-md">
        <h1 className="text-2xl font-semibold tracking-tight">Start your 7-day free trial</h1>
        <p className="mt-2 text-sm text-[var(--muted)]">
          Create your {PRODUCT_NAME} clinic — full access for 7 days, then subscribe to continue.
        </p>

        <form
          className="mt-8 space-y-4"
          onSubmit={handleSubmit(async (values) => {
            setError(null);
            try {
              const res = await fetchWithRetry('/api/auth/clinic-signup', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  clinicName: values.clinicName,
                  slug: values.slug,
                  adminName: values.adminName,
                  email: values.email,
                  password: values.password,
                  phone: values.phone || undefined,
                }),
              });
              const json = await res.json().catch(() => ({}));
              if (!res.ok) {
                throw new Error(
                  json?.error?.message || json?.message || `Signup failed (${res.status})`,
                );
              }
              if (json.accessToken) setAccessToken(json.accessToken);
              await refresh().catch(() => undefined);
              navigate('/subscription/checkout', { replace: true });
            } catch (e: any) {
              setError(e?.message || 'Signup failed');
            }
          })}
        >
          <div>
            <label className="text-sm font-medium">Clinic name</label>
            <input
              className="mt-1 w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm"
              {...register('clinicName', {
                onChange: (e) => {
                  const slug = String(e.target.value || '')
                    .toLowerCase()
                    .replace(/[^a-z0-9]+/g, '-')
                    .replace(/^-|-$/g, '')
                    .slice(0, 48);
                  if (!watch('slug') || watch('slug') === slugFrom(clinicName)) {
                    setValue('slug', slug);
                  }
                },
              })}
            />
            {errors.clinicName && (
              <p className="mt-1 text-xs text-red-600">{errors.clinicName.message}</p>
            )}
          </div>

          <div>
            <label className="text-sm font-medium">Clinic slug</label>
            <input
              className="mt-1 w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 font-mono text-sm"
              {...register('slug')}
            />
            {errors.slug && <p className="mt-1 text-xs text-red-600">{errors.slug.message}</p>}
          </div>

          <div>
            <label className="text-sm font-medium">Admin name</label>
            <input
              className="mt-1 w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm"
              {...register('adminName')}
            />
            {errors.adminName && (
              <p className="mt-1 text-xs text-red-600">{errors.adminName.message}</p>
            )}
          </div>

          <div>
            <label className="text-sm font-medium">Work email</label>
            <input
              type="email"
              className="mt-1 w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm"
              {...register('email')}
            />
            {errors.email && <p className="mt-1 text-xs text-red-600">{errors.email.message}</p>}
          </div>

          <div>
            <label className="text-sm font-medium">Phone (optional)</label>
            <input
              className="mt-1 w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm"
              {...register('phone')}
            />
          </div>

          <div>
            <label className="text-sm font-medium">Password</label>
            <input
              type="password"
              className="mt-1 w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm"
              {...register('password')}
            />
            {errors.password && (
              <p className="mt-1 text-xs text-red-600">{errors.password.message}</p>
            )}
          </div>

          <div>
            <label className="text-sm font-medium">Confirm password</label>
            <input
              type="password"
              className="mt-1 w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm"
              {...register('confirmPassword')}
            />
            {errors.confirmPassword && (
              <p className="mt-1 text-xs text-red-600">{errors.confirmPassword.message}</p>
            )}
          </div>

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}

          <button type="submit" className="btn-primary flex w-full justify-center gap-2" disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
            Create clinic & continue
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-[var(--muted)]">
          Already have an account?{' '}
          <Link to="/login" className="text-[var(--primary-text)] underline">
            Sign in
          </Link>
        </p>
      </div>
    </AuthShell>
  );
}

function slugFrom(name: string | undefined) {
  return String(name || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48);
}
