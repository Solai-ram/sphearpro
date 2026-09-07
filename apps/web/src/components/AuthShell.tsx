import { useEffect, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { PRODUCT_NAME } from '../lib/product';
import { ProductLogo } from './ProductLogo';

type AuthShellProps = {
  children: ReactNode;
  /** login shows trial CTA */
  variant?: 'login' | 'signup' | 'default';
};

export function AuthShell({ children, variant = 'default' }: AuthShellProps) {
  const navigate = useNavigate();

  useEffect(() => {
    document.title = PRODUCT_NAME;
  }, []);

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
              Ready to try {PRODUCT_NAME}? Create your clinic to start your free trial.
            </p>

            <div className="auth-trial-cta">
              <button type="button" className="auth-trial-btn" onClick={() => navigate('/signup')}>
                <span className="auth-trial-btn-label">Get started</span>
                <span className="auth-trial-btn-arrow" aria-hidden="true">
                  →
                </span>
              </button>
            </div>

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
