import { createContext, useCallback, useContext, useMemo, useState } from "react";
import {
  authenticate,
  setAccessToken,
} from "../services/api.js";

const AuthContext = createContext(null);
const USER_KEY = "cpm-management.user.v1";

function getStoredUser() {
  if (typeof window === "undefined") return null;
  if (!window.localStorage.getItem("cpm-management.access-token.v1")) {
    window.localStorage.removeItem(USER_KEY);
    return null;
  }
  const stored = window.localStorage.getItem(USER_KEY);
  return stored ? JSON.parse(stored) : null;
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(getStoredUser);

  const login = useCallback(async ({ username, password }) => {
    const session = await authenticate({
      username: username.trim(),
      password,
    });
    setAccessToken(session.access_token);
    const authenticatedUser = {
      ...session.user,
      email: session.user.username,
    };
    window.localStorage.setItem(USER_KEY, JSON.stringify(authenticatedUser));
    setUser(authenticatedUser);
    return authenticatedUser;
  }, []);

  const logout = useCallback(() => {
    setAccessToken(null);
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(USER_KEY);
    }
    setUser(null);
  }, []);

  const value = useMemo(() => ({ user, login, logout }), [user, login, logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) {
    throw new Error("useAuth must be used within AuthProvider.");
  }
  return value;
}
