import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Mail, Loader2, ArrowLeft, CheckCircle, AlertCircle } from 'lucide-react';
import { AuthShell } from '../../components/AuthShell';

const forgotPasswordSchema = z.object({
  email: z.string().email('Invalid email address'),
});

type ForgotPasswordForm = z.infer<typeof forgotPasswordSchema>;

export function ForgotPasswordPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotPasswordForm>({
    resolver: zodResolver(forgotPasswordSchema),
  });

  const onSubmit = async (data: ForgotPasswordForm) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || 'Request failed');
      }

      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Request failed');
    } finally {
      setIsLoading(false);
    }
  };

  if (success) {
    return (
      <AuthShell>
        <div className="auth-form-head">
          <div className="w-14 h-14 mb-4 rounded-full bg-green-100 flex items-center justify-center">
            <CheckCircle className="w-7 h-7 text-green-600" />
          </div>
          <h2>Check your email</h2>
          <p>If an account exists for that email, you will receive a password reset link shortly.</p>
        </div>
        <Link to="/login" className="btn-primary auth-submit mt-6">
          <ArrowLeft className="w-4 h-4" />
          Back to sign in
        </Link>
      </AuthShell>
    );
  }

  return (
    <AuthShell>
      <Link to="/login" className="auth-back">
        <ArrowLeft className="w-4 h-4" /> Back to sign in
      </Link>
      <div className="auth-form-head">
        <h2>Forgot password</h2>
      </div>

      {error && (
        <div className="auth-alert" role="alert">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="auth-fields">
        <div>
          <label htmlFor="email" className="label">Email</label>
          <div className="auth-field">
            <Mail className="auth-field-icon" />
            <input
              {...register('email')}
              id="email"
              type="email"
              className="input"
              placeholder="you@clinic.com"
              autoComplete="username"
              disabled={isLoading}
            />
          </div>
          {errors.email && <p className="auth-field-error">{errors.email.message}</p>}
        </div>

        <button type="submit" className="btn-primary auth-submit" disabled={isLoading}>
          {isLoading ? (
            <span className="inline-flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              Sending…
            </span>
          ) : (
            'Send reset link'
          )}
        </button>
      </form>
    </AuthShell>
  );
}
