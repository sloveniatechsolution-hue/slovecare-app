/**
 * Auth state — token + user ko AsyncStorage me rakhta hai aur app-wide
 * access deta hai. Saari auth API calls src/api/api.ts se hain.
 */

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api, { AuthResult, initAuthToken, setAuthToken, User } from '../api/api';
import { signOutFromGoogle } from '../api/googleAuth';

const USER_STORAGE_KEY = 'slovecare_user';

interface AuthContextValue {
  /** true = token restore ho raha hai (splash ko rokna chahiye) */
  initializing: boolean;
  token: string | null;
  user: User | null;
  isLoggedIn: boolean;
  needsHealthProfile: boolean;
  login: (identifier: string, password: string) => Promise<User>;
  /** Google ID token se sign in / sign up (backend /auth/user/google) */
  googleLogin: (credential: string) => Promise<User>;
  /** Phone + OTP login (naye number par account apne aap ban jaata hai) */
  phoneLogin: (phone: string, otp: string) => Promise<User>;
  register: (input: { name: string; email?: string; phone?: string; password?: string }) => Promise<User>;
  logout: () => Promise<void>;
  /** Local user object update (health profile save hone ke baad) */
  updateUser: (patch: Partial<User>) => void;
  /** Server se profile refresh */
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }): React.JSX.Element {
  const [initializing, setInitializing] = useState(true);
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);

  /* --------------------------- bootstrap --------------------------- */
  useEffect(() => {
    (async () => {
      try {
        const [storedToken, storedUser] = await Promise.all([
          initAuthToken(),
          AsyncStorage.getItem(USER_STORAGE_KEY),
        ]);
        if (storedToken) {
          setToken(storedToken);
          if (storedUser) {
            try {
              setUser(JSON.parse(storedUser) as User);
            } catch {
              setUser(null);
            }
          }
          // Server se latest profile lao (failure par cached user se kaam chalega)
          api.auth
            .me()
            .then(fresh => {
              setUser(fresh);
              AsyncStorage.setItem(USER_STORAGE_KEY, JSON.stringify(fresh)).catch(() => {});
            })
            .catch(() => {});
        }
      } finally {
        setInitializing(false);
      }
    })();
  }, []);

  /* ---------------------------- helpers ---------------------------- */
  const persistUser = useCallback((next: User | null) => {
    setUser(next);
    if (next) {
      AsyncStorage.setItem(USER_STORAGE_KEY, JSON.stringify(next)).catch(() => {});
    } else {
      AsyncStorage.removeItem(USER_STORAGE_KEY).catch(() => {});
    }
  }, []);

  /** Auth result ka session persist karo — saare login flows isi se guzarte hain */
  const completeSession = useCallback(
    async (result: AuthResult) => {
      await setAuthToken(result.token);
      setToken(result.token);
      persistUser(result.user);
      return result.user;
    },
    [persistUser],
  );

  const login = useCallback(
    async (identifier: string, password: string) => {
      const result = await api.auth.login({ identifier, password });
      return completeSession(result);
    },
    [completeSession],
  );

  const googleLogin = useCallback(
    async (credential: string) => {
      const result = await api.auth.google({ credential });
      return completeSession(result);
    },
    [completeSession],
  );

  const phoneLogin = useCallback(
    async (phone: string, otp: string) => {
      const result = await api.auth.phoneLogin({ phone, otp });
      return completeSession(result);
    },
    [completeSession],
  );

  const register = useCallback(
    async (input: { name: string; email?: string; phone?: string; password?: string }) => {
      const result = await api.auth.register(input);
      return completeSession(result);
    },
    [completeSession],
  );

  const logout = useCallback(async () => {
    await signOutFromGoogle();
    await setAuthToken(null);
    setToken(null);
    persistUser(null);
  }, [persistUser]);

  const updateUser = useCallback(
    (patch: Partial<User>) => {
      setUser(prev => {
        const next = { ...(prev as User), ...patch } as User;
        AsyncStorage.setItem(USER_STORAGE_KEY, JSON.stringify(next)).catch(() => {});
        return next;
      });
    },
    [],
  );

  const refreshUser = useCallback(async () => {
    const fresh = await api.auth.me();
    persistUser(fresh);
  }, [persistUser]);

  const value = useMemo<AuthContextValue>(
    () => ({
      initializing,
      token,
      user,
      isLoggedIn: Boolean(token),
      needsHealthProfile: Boolean(token) && user ? !user.isProfileComplete : false,
      login,
      googleLogin,
      phoneLogin,
      register,
      logout,
      updateUser,
      refreshUser,
    }),
    [initializing, token, user, login, googleLogin, phoneLogin, register, logout, updateUser, refreshUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used inside <AuthProvider>');
  }
  return ctx;
}

export default AuthContext;
