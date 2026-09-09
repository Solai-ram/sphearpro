import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  AlertCircle,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  Mail,
  Package,
  Receipt,
  Stethoscope,
  Users,
} from 'lucide-react';
import { useAuth } from '../../auth/AuthContext';
import { AuthShell } from '../../components/AuthShell';
import { fetchWithRetry, setAccessToken, fetchApi } from '../../lib/api';

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

type LoginForm = z.infer<typeof loginSchema>;

const DEMO_LOGINS = import.meta.env.DEV
  ? ([
      { role: 'Admin', email: 'admin@hislite.local', password: 'Admin@12345', icon: Users },
      { role: 'Doctor', email: 'ananya.reddy@hislite.local', password: 'Staff@12345', icon: Stethoscope },
      { role: 'Billing', email: 'kavya.menon@hislite.local', password: 'Staff@12345', icon: Receipt },
      { role: 'Inventory', email: 'rohit.gupta@hislite.local', password: 'Staff@12345', icon: Package },
    ] as const)
  : [];

function safeRedirectPath(pathname: string | undefined): string {
  if (!pathname || typeof pathname !== 'string') return '/dashboard';
  if (!/^\/[A-Za-z0-9/_-]*$/.test(pathname) || pathname.startsWith('//')) return '/dashboard';
  return pathname;
}

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const { refresh } = useAuth();
  const from = safeRedirectPath((location.state as { from?: Location })?.from?.pathname);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  const signIn = async (email: string, password: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetchWithRetry('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, password }),
      });

      const raw = await response.text();
      let result: { accessToken?: string; refreshToken?: string; message?: string } = {};
      if (raw) {
        try {
          result = JSON.parse(raw);
        } catch {
          throw new Error(
            response.ok
              ? 'Server returned an invalid response'
              : 'Cannot reach the API. Waiting for the server to finish restarting — try again in a moment.',
          );
        }
      } else if (!response.ok) {
        throw new Error('Cannot reach the API. Waiting for the server to finish restarting — try again in a moment.');
      }

      if (!response.ok) {
        throw new Error(result.message || 'Login failed');
      }

      if (!result.accessToken) {
        throw new Error('Login response was incomplete');
      }

      setAccessToken(result.accessToken);
      await refresh();

      const me = await fetchApi<{ roles?: string[]; setupComplete?: boolean }>('/auth/me');
      const roles = me.roles || [];
      const isPlatformOnly = roles.includes('SUPER_ADMIN') && !roles.includes('ADMIN');
      if (isPlatformOnly) {
        navigate('/platform', { replace: true });
      } else if (me.setupComplete === false && roles.includes('ADMIN')) {
        navigate('/setup', { replace: true });
      } else {
        navigate(from, { replace: true });
      }
    } catch (err) {
      if (err instanceof TypeError) {
        setError('Cannot reach the API. Waiting for the server to finish restarting — try again in a moment.');
      } else {
        setError(err instanceof Error ? err.message : 'Login failed');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthShell variant="login">
      <div className="auth-form-head">
        <h2>Sign in</h2>
      </div>

      {error && (
        <div className="auth-alert" role="alert">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit((data) => signIn(data.email, data.password))} className="auth-fields">
        <div>
          <label htmlFor="email" className="label">Email</label>
          <div className="auth-field">
            <Mail className="auth-field-icon" />
            <input
              {...register('email')}
              id="email"
              type="email"
              className="input"
              placeholder="enter your email"
              autoComplete="username"
              disabled={isLoading}
            />
          </div>
          {errors.email && <p className="auth-field-error">{errors.email.message}</p>}
        </div>

        <div>
          <label htmlFor="password" className="label">Password</label>
          <div className="auth-field">
            <Lock className="auth-field-icon" />
            <input
              {...register('password')}
              id="password"
              type={showPassword ? 'text' : 'password'}
              className="input"
              placeholder="Password"
              autoComplete="current-password"
              disabled={isLoading}
            />
            <button
              type="button"
              className="auth-field-toggle"
              onClick={() => setShowPassword((open) => !open)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          {errors.password && <p className="auth-field-error">{errors.password.message}</p>}
        </div>

        <button type="submit" className="btn-primary auth-submit" disabled={isLoading}>
          {isLoading ? (
            <span className="inline-flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              Signing in…
            </span>
          ) : (
            'Sign in'
          )}
        </button>

        <div className="auth-after-submit">
          <Link to="/forgot-password" className="auth-link">Forgot password?</Link>
        </div>
      </form>

      {DEMO_LOGINS.length > 0 && (
        <div className="auth-demo">
          <ul>
            {DEMO_LOGINS.map((account) => (
              <li key={account.role}>
                <button
                  type="button"
                  disabled={isLoading}
                  onClick={() => signIn(account.email, account.password)}
                >
                  <account.icon />
                  {account.role}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </AuthShell>
  );
}
