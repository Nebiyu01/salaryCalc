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

  const register = async (email, password) => {
    const { user } = await api.register(email, password);
    setUser(user);
  };

  const logout = async () => {
    await api.logout().catch(() => {});
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
