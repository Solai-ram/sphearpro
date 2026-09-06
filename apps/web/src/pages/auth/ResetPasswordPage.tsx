import { useState, useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Eye, EyeOff, Loader2, Lock, ArrowLeft, CheckCircle, AlertCircle } from 'lucide-react';
import { AuthShell } from '../../components/AuthShell';

const resetPasswordSchema = z
  .object({
    password: z.string().min(8, 'Password must be at least 8 characters'),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

type ResetPasswordForm = z.infer<typeof resetPasswordSchema>;

export function ResetPasswordPage() {
  const { token } = useParams<{ token: string }>();
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tokenValid, setTokenValid] = useState(true);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ResetPasswordForm>({
    resolver: zodResolver(resetPasswordSchema),
  });

  useEffect(() => {
    if (!token) {
      setError('Invalid reset link');
      setTokenValid(false);
    }
  }, [token]);

  const onSubmit = async (data: ResetPasswordForm) => {
    if (!token) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, newPassword: data.password }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || 'Password reset failed');
      }

      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Password reset failed');
    } finally {
      setIsLoading(false);
    }
  };

  if (!tokenValid) {
    return (
      <AuthShell>
        <div className="auth-form-head">
          <div className="w-14 h-14 mb-4 rounded-full bg-red-100 flex items-center justify-center">
            <AlertCircle className="w-7 h-7 text-red-600" />
          </div>
          <h2>Invalid link</h2>
          <p>This password reset link is invalid or has expired.</p>
        </div>
        <Link to="/forgot-password" className="btn-primary auth-submit mt-6">
          Request a new link
        </Link>
      </AuthShell>
    );
  }

  if (success) {
    return (
      <AuthShell>
        <div className="auth-form-head">
          <div className="w-14 h-14 mb-4 rounded-full bg-green-100 flex items-center justify-center">
            <CheckCircle className="w-7 h-7 text-green-600" />
          </div>
          <h2>Password updated</h2>
          <p>Your password has been reset. You can sign in with the new password.</p>
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
        <h2>Reset password</h2>
        <p>Choose a new password for your staff account.</p>
      </div>

      {error && (
        <div className="auth-alert" role="alert">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="auth-fields">
        <div>
          <label htmlFor="password" className="label">New password</label>
          <div className="auth-field">
            <Lock className="auth-field-icon" />
            <input
              {...register('password')}
              id="password"
              type={showPassword ? 'text' : 'password'}
              className="input"
              placeholder="At least 8 characters"
              autoComplete="new-password"
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

        <div>
          <label htmlFor="confirmPassword" className="label">Confirm password</label>
          <div className="auth-field">
            <Lock className="auth-field-icon" />
            <input
              {...register('confirmPassword')}
              id="confirmPassword"
              type={showPassword ? 'text' : 'password'}
              className="input"
              placeholder="Re-enter new password"
              autoComplete="new-password"
              disabled={isLoading}
            />
          </div>
          {errors.confirmPassword && <p className="auth-field-error">{errors.confirmPassword.message}</p>}
        </div>

        <button type="submit" className="btn-primary auth-submit" disabled={isLoading}>
          {isLoading ? (
            <span className="inline-flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              Resetting…
            </span>
          ) : (
            'Reset password'
          )}
        </button>
      </form>
    </AuthShell>
  );
}
