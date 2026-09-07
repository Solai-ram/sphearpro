import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Building2, Loader2, MapPin, ShieldCheck, UserRound } from 'lucide-react';
import { fetchWithRetry, setAccessToken } from '../../lib/api';
import { useAuth } from '../../auth/AuthContext';
import { PRODUCT_NAME } from '../../lib/product';
import { ProductLogo } from '../../components/ProductLogo';

const INDIAN_STATES = [
  'Andaman and Nicobar Islands',
  'Andhra Pradesh',
  'Arunachal Pradesh',
  'Assam',
  'Bihar',
  'Chandigarh',
  'Chhattisgarh',
  'Dadra and Nagar Haveli and Daman and Diu',
  'Delhi',
  'Goa',
  'Gujarat',
  'Haryana',
  'Himachal Pradesh',
  'Jammu and Kashmir',
  'Jharkhand',
  'Karnataka',
  'Kerala',
  'Ladakh',
  'Lakshadweep',
  'Madhya Pradesh',
  'Maharashtra',
  'Manipur',
  'Meghalaya',
  'Mizoram',
  'Nagaland',
  'Odisha',
  'Puducherry',
  'Punjab',
  'Rajasthan',
  'Sikkim',
  'Tamil Nadu',
  'Telangana',
  'Tripura',
  'Uttar Pradesh',
  'Uttarakhand',
  'West Bengal',
] as const;

const schema = z
  .object({
    clinicName: z.string().min(2, 'Clinic name is required'),
    street: z.string().max(200).optional(),
    city: z.string().min(2, 'City is required'),
    state: z.string().min(2, 'State is required'),
    pincode: z.string().regex(/^[1-9][0-9]{5}$/, 'Enter a valid 6-digit PIN code'),
    rciNumber: z.string().max(40).optional(),
    adminName: z.string().min(2, 'Your name is required'),
    email: z.string().email('Enter a valid clinic email'),
    phone: z.string().optional(),
    password: z.string().min(8, 'At least 8 characters'),
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

type FormInput = z.input<typeof schema>;
type FormOutput = z.output<typeof schema>;

function slugFrom(name: string | undefined) {
  return String(name || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48);
}

export function ClinicSignupPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { refresh } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormInput, unknown, FormOutput>({
    resolver: zodResolver(schema) as never,
    defaultValues: {
      street: '',
      city: '',
      state: '',
      pincode: '',
      rciNumber: '',
      phone: '',
      email: searchParams.get('email') || '',
    },
  });

  useEffect(() => {
    document.title = `Create clinic · ${PRODUCT_NAME}`;
  }, []);

  return (
    <div className="signup-screen">
      <div className="signup-screen-glow" aria-hidden="true" />
      <div className="signup-screen-grid" aria-hidden="true" />

      <div className="signup-shell">
        <header className="signup-topbar">
          <Link to="/pricing" className="signup-brand" aria-label={PRODUCT_NAME}>
            <ProductLogo className="signup-logo" />
          </Link>
          <nav className="signup-top-links">
            <Link to="/pricing">Pricing</Link>
            <Link to="/login">Sign in</Link>
          </nav>
        </header>

        <main className="signup-main">
          <div className="signup-card">
            <header className="signup-header">
              <p className="signup-kicker">7-day free trial</p>
              <h1>Create your clinic</h1>
              <p>
                One form to open {PRODUCT_NAME} — patients, therapy, billing, and inventory ready
                in minutes.
              </p>
            </header>

            <form
              className="signup-form"
              onSubmit={handleSubmit(async (values) => {
                setError(null);
                try {
                  const res = await fetchWithRetry('/api/auth/clinic-signup', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      clinicName: values.clinicName,
                      slug: slugFrom(values.clinicName) || `clinic-${Date.now().toString(36)}`,
                      adminName: values.adminName,
                      email: values.email,
                      password: values.password,
                      phone: values.phone?.trim() || undefined,
                      rciNumber: values.rciNumber?.trim() || undefined,
                      address: {
                        street: values.street?.trim() || undefined,
                        city: values.city.trim(),
                        state: values.state.trim(),
                        pincode: values.pincode.trim(),
                      },
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
                } catch (e: unknown) {
                  setError(e instanceof Error ? e.message : 'Signup failed');
                }
              })}
            >
              <section className="signup-section">
                <div className="signup-section-head">
                  <Building2 aria-hidden="true" />
                  <div>
                    <h2>Clinic details</h2>
                    <p>How your clinic appears across {PRODUCT_NAME}.</p>
                  </div>
                </div>

                <div className="signup-grid">
                  <label className="signup-field signup-field--full">
                    <span>Clinic name</span>
                    <input
                      autoComplete="organization"
                      placeholder="e.g. Harmony Speech & Hearing"
                      {...register('clinicName')}
                    />
                    {errors.clinicName && <em className="signup-error-text">{errors.clinicName.message}</em>}
                  </label>

                  <label className="signup-field signup-field--full">
                    <span>Clinic email</span>
                    <input
                      type="email"
                      autoComplete="email"
                      placeholder="clinic@example.com"
                      {...register('email')}
                    />
                    {errors.email ? (
                      <em className="signup-error-text">{errors.email.message}</em>
                    ) : (
                      <small>Used for clinic contact and your admin login</small>
                    )}
                  </label>

                  <label className="signup-field signup-field--full">
                    <span>
                      RCI number <span className="signup-optional">optional</span>
                    </span>
                    <input
                      autoComplete="off"
                      placeholder="Rehabilitation Council of India registration"
                      {...register('rciNumber')}
                    />
                    {errors.rciNumber ? (
                      <em className="signup-error-text">{errors.rciNumber.message}</em>
                    ) : (
                      <small>For RCI-registered clinics and professionals</small>
                    )}
                  </label>
                </div>
              </section>

              <section className="signup-section">
                <div className="signup-section-head">
                  <MapPin aria-hidden="true" />
                  <div>
                    <h2>Clinic address</h2>
                    <p>Used on invoices, receipts, and clinic profile.</p>
                  </div>
                </div>

                <div className="signup-grid">
                  <label className="signup-field signup-field--full">
                    <span>
                      Street address <span className="signup-optional">optional</span>
                    </span>
                    <input
                      autoComplete="street-address"
                      placeholder="Building, street, landmark"
                      {...register('street')}
                    />
                    {errors.street && <em className="signup-error-text">{errors.street.message}</em>}
                  </label>

                  <label className="signup-field">
                    <span>City</span>
                    <input autoComplete="address-level2" placeholder="City" {...register('city')} />
                    {errors.city && <em className="signup-error-text">{errors.city.message}</em>}
                  </label>

                  <label className="signup-field">
                    <span>State</span>
                    <select {...register('state')} defaultValue="">
                      <option value="" disabled>
                        Select state
                      </option>
                      {INDIAN_STATES.map((state) => (
                        <option key={state} value={state}>
                          {state}
                        </option>
                      ))}
                    </select>
                    {errors.state && <em className="signup-error-text">{errors.state.message}</em>}
                  </label>

                  <label className="signup-field">
                    <span>PIN code</span>
                    <input
                      inputMode="numeric"
                      autoComplete="postal-code"
                      placeholder="560001"
                      maxLength={6}
                      {...register('pincode')}
                    />
                    {errors.pincode && <em className="signup-error-text">{errors.pincode.message}</em>}
                  </label>
                </div>
              </section>

              <section className="signup-section">
                <div className="signup-section-head">
                  <UserRound aria-hidden="true" />
                  <div>
                    <h2>Admin account</h2>
                    <p>You will sign in with the clinic email as admin.</p>
                  </div>
                </div>

                <div className="signup-grid">
                  <label className="signup-field">
                    <span>Your full name</span>
                    <input autoComplete="name" placeholder="Dr. Asha Iyer" {...register('adminName')} />
                    {errors.adminName && (
                      <em className="signup-error-text">{errors.adminName.message}</em>
                    )}
                  </label>

                  <label className="signup-field">
                    <span>
                      Phone <span className="signup-optional">optional</span>
                    </span>
                    <input autoComplete="tel" placeholder="+91 98XXX XXXXX" {...register('phone')} />
                  </label>

                  <label className="signup-field">
                    <span>Password</span>
                    <input type="password" autoComplete="new-password" {...register('password')} />
                    {errors.password && (
                      <em className="signup-error-text">{errors.password.message}</em>
                    )}
                  </label>

                  <label className="signup-field">
                    <span>Confirm password</span>
                    <input
                      type="password"
                      autoComplete="new-password"
                      {...register('confirmPassword')}
                    />
                    {errors.confirmPassword && (
                      <em className="signup-error-text">{errors.confirmPassword.message}</em>
                    )}
                  </label>
                </div>
              </section>

              <div className="signup-assurance">
                <ShieldCheck aria-hidden="true" />
                <p>No card required to start. Cancel anytime during the trial.</p>
              </div>

              {error && <div className="signup-error">{error}</div>}

              <button type="submit" className="signup-submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
                Create clinic & continue
              </button>
            </form>

            <p className="signup-footer">
              Already have an account? <Link to="/login">Sign in</Link>
            </p>
          </div>
        </main>
      </div>
    </div>
  );
}
