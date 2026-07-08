import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import api from "../services/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const restoreSession = useCallback(async () => {
    try {
      const refreshRes = await api.post("/auth/refresh");
      const refreshedUser = refreshRes.data?.user;
      if (refreshedUser) {
        setUser(refreshedUser);
        return refreshedUser;
      }
      const { data } = await api.get("/auth/me");
      setUser(data.user);
      return data.user;
    } catch {
      setUser(null);
      return null;
    }
  }, []);

  const fetchUser = useCallback(async () => {
    try {
      const { data } = await api.get("/auth/me");
      setUser(data.user);
      return data.user;
    } catch (err) {
      if (err?.response?.status === 401) {
        return restoreSession();
      }
      setUser(null);
      return null;
    }
  }, [restoreSession]);

  useEffect(() => {
    let active = true;
    (async () => {
      await fetchUser();
      if (active) setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [fetchUser]);

  useEffect(() => {
    const onRefreshed = (e) => setUser(e.detail);
    const onExpired = () => setUser(null);
    window.addEventListener("auth:refreshed", onRefreshed);
    window.addEventListener("auth:session-expired", onExpired);
    return () => {
      window.removeEventListener("auth:refreshed", onRefreshed);
      window.removeEventListener("auth:session-expired", onExpired);
    };
  }, []);

  /** User profile only — tokens live in httpOnly cookies (accessToken, refreshToken). */
  const login = useCallback((userData) => {
    setUser(userData);
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.post("/auth/logout");
    } catch {
      /* ignore */
    } finally {
      setUser(null);
    }
  }, []);

  const hasRole = useCallback(
    (...roles) => Boolean(user?.role && roles.includes(user.role)),
    [user]
  );

  const value = useMemo(
    () => ({
      user,
      loading,
      isAuthenticated: Boolean(user),
      login,
      logout,
      fetchUser,
      restoreSession,
      hasRole,
    }),
    [user, loading, login, logout, fetchUser, restoreSession, hasRole]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
}
