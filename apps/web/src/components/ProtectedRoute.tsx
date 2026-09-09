import { Navigate, useLocation } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { canAccessPath } from '../auth/rbac';
import { useSubscriptionAccess, isSubscriptionOpenPath, needsClinicSetup } from '../auth/SubscriptionAccess';

export function ProtectedRoute({
  children,
  pathOverride,
}: {
  children: React.ReactNode;
  /** When route is outside Layout, pass the path to enforce RBAC */
  pathOverride?: string;
}) {
  const location = useLocation();
  const { user, ready } = useAuth();
  const { isRestricted } = useSubscriptionAccess();
  const path = pathOverride || location.pathname;

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (!canAccessPath(path, user.roles, user.staffType)) {
    return <Navigate to="/dashboard" replace />;
  }

  if (isRestricted && !isSubscriptionOpenPath(path) && !path.startsWith('/platform')) {
    return <Navigate to="/subscription" replace />;
  }

  if (needsClinicSetup(user) && path !== '/setup' && !path.startsWith('/subscription')) {
    return <Navigate to="/setup" replace />;
  }

  return <>{children}</>;
}
