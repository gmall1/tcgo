import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import db, { updateCurrentUserName } from "@/lib/localDb";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);

  useEffect(() => {
    let mounted = true;

    db.auth
      .me()
      .then((currentUser) => {
        if (!mounted) return;
        setUser(currentUser);
      })
      .finally(() => {
        if (mounted) {
          setIsLoadingAuth(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, []);

  const value = useMemo(
    () => ({
      user,
      isAuthenticated: true,
      isLoadingAuth,
      isLoadingPublicSettings: false,
      authError: null,
      appPublicSettings: { local_mode: true },
      navigateToLogin: () => {},
      refreshUser: async () => {
        const currentUser = await db.auth.me();
        setUser(currentUser);
        return currentUser;
      },
      renameUser: async (name) => {
        const nextUser = updateCurrentUserName(name);
        setUser(nextUser);
        return nextUser;
      },
    }),
    [user, isLoadingAuth]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }

  return context;
}
