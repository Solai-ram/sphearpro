import { Link } from 'react-router-dom';
import { AlertTriangle } from 'lucide-react';
import { useSubscriptionAccess } from '../auth/SubscriptionAccess';
import { useAuth } from '../auth/AuthContext';

export function SubscriptionBanner() {
  const { isGrace, isRestricted, access } = useSubscriptionAccess();
  const { hasRole } = useAuth();

  if (isRestricted) {
    return (
      <div className="print:hidden border-b border-amber-300 bg-amber-50 px-4 py-2.5 text-sm text-amber-950">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2">
          <p className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              Clinic access is restricted ({access?.status || 'inactive'}). Renew your subscription to
              continue using HIS.
            </span>
          </p>
          {hasRole('ADMIN', 'CLINIC_ADMIN') && (
            <Link to="/subscription" className="font-medium underline underline-offset-2">
              Renew / manage billing
            </Link>
          )}
        </div>
      </div>
    );
  }

  if (!isGrace) return null;

  return (
    <div className="print:hidden border-b border-orange-300 bg-orange-50 px-4 py-2.5 text-sm text-orange-950">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2">
        <p className="flex items-start gap-2">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            Payment issue — you are in a grace period. Update billing soon to avoid losing access.
            {access?.currentPeriodEnd
              ? ` Current period ends ${new Date(access.currentPeriodEnd).toLocaleDateString()}.`
              : ''}
          </span>
        </p>
        {hasRole('ADMIN', 'CLINIC_ADMIN') && (
          <Link to="/subscription" className="font-medium underline underline-offset-2">
            Fix billing
          </Link>
        )}
      </div>
    </div>
  );
}
