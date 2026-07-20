import { createContext, useContext, useEffect, useState } from "react";
import { api } from "./api";

// App-wide auth state. On mount we ask the backend who we are (restoring a
// session from the cookie), then expose login/register/logout.

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .me()
      .then((r) => setUser(r.user))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  const login = async (email, password) => {
    const { user } = await api.login(email, password);
    setUser(user);
  };

  // Registration no longer creates a session — it emails a code. The caller
  // then verifies with verifyEmail, which is what actually logs the user in.
  const register = (email, password) => api.register(email, password);
  const resendCode = (email) => api.resendCode(email);
  const verifyEmail = async (email, code) => {
    const { user } = await api.verifyEmail(email, code);
    setUser(user);
  };

  const logout = async () => {
    await api.logout().catch(() => {});
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{ user, loading, login, register, verifyEmail, resendCode, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
