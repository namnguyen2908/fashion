import { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { isAdminRole } from "../constants/roles";

export default function ProtectedRoute({ children }) {
  const { user, loading, restoreSession } = useAuth();
  const location = useLocation();
  const [sessionChecked, setSessionChecked] = useState(false);

  useEffect(() => {
    if (loading) return undefined;

    if (user) {
      setSessionChecked(true);
      return undefined;
    }

    let active = true;
    restoreSession().finally(() => {
      if (active) setSessionChecked(true);
    });
    return () => {
      active = false;
    };
  }, [loading, user, restoreSession]);

  if (loading || (!user && !sessionChecked)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-50 text-neutral-500 text-sm tracking-wide">
        Đang tải...
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (!isAdminRole(user.role)) {
    return <Navigate to="/" replace />;
  }

  return children;
}
