import { FormEvent, useEffect, useState, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { PRODUCT_NAME } from '../lib/product';
import { ProductLogo } from './ProductLogo';

type AuthShellProps = {
  children: ReactNode;
  /** login shows trial email CTA; signup focuses the free-trial promise */
  variant?: 'login' | 'signup' | 'default';
};

export function AuthShell({ children, variant = 'default' }: AuthShellProps) {
  const navigate = useNavigate();
  const [trialEmail, setTrialEmail] = useState('');

  useEffect(() => {
    document.title = PRODUCT_NAME;
  }, []);

  const startTrial = (event: FormEvent) => {
    event.preventDefault();
    const email = trialEmail.trim();
    const params = new URLSearchParams();
    if (email) params.set('email', email);
    navigate(`/signup${params.toString() ? `?${params}` : ''}`);
  };

  return (
    <div className="auth-screen">
      <div className="auth-panel auth-panel--trial">
        <aside className="auth-trial" aria-label="Free trial">
          <div className="auth-trial-inner">
            <p className="auth-trial-badge">7 days free</p>
            <h1 className="auth-trial-title">
              Unlimited clinic operations.
              <span> Start free today.</span>
            </h1>
            <p className="auth-trial-lead">
              Run patients, therapy, billing, and inventory in one place. Cancel anytime —
              no card required to begin your trial.
            </p>
            <p className="auth-trial-sub">
              Ready to try {PRODUCT_NAME}? Enter your work email to create your clinic.
            </p>

            {variant !== 'signup' ? (
              <form className="auth-trial-cta" onSubmit={startTrial}>
                <label className="sr-only" htmlFor="trial-email">
                  Email address
                </label>
                <input
                  id="trial-email"
                  type="email"
                  className="auth-trial-input"
                  placeholder="Email address"
                  value={trialEmail}
                  onChange={(e) => setTrialEmail(e.target.value)}
                  autoComplete="email"
                />
                <button type="submit" className="auth-trial-btn">
                  Get started
                  <span aria-hidden="true">›</span>
                </button>
              </form>
            ) : (
              <p className="auth-trial-signup-note">
                Complete the form to activate your 7-day free trial.
              </p>
            )}

            <div className="auth-trial-links">
              <Link to="/pricing">See pricing</Link>
              {variant !== 'login' && <Link to="/login">Already have an account? Sign in</Link>}
            </div>
          </div>
        </aside>

        <div className="auth-form">
          <div className="auth-form-brand">
            <ProductLogo className="auth-form-logo" />
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}
