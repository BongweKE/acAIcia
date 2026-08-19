import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { UserRole } from '../types';

export interface User {
  email: string;
  role: UserRole;
  name?: string;
  token?: string;
}

interface AuthContextType {
  user: User | null;
  role: UserRole;
  isAuthenticated: boolean;
  roleDisplayName: string;
  guestQueryLimit: number;
  guestQueryCount: number; // remaining queries
  decrementGuestQueryCount: () => void;
  resetGuestQueryCount: () => void;
  isLoginOpen: boolean;
  openLoginModal: () => void;
  closeLoginModal: () => void;
  login: (email: string, password?: string) => Promise<boolean>;
  logout: () => void;
}

const GUEST_MAX_QUERIES = 20;

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<UserRole>('guest');
  const [guestQueryCount, setGuestQueryCount] = useState<number>(() => {
    const saved = localStorage.getItem('acaicia_guest_query_count');
    if (saved !== null) {
      const parsed = parseInt(saved, 10);
      return isNaN(parsed) ? GUEST_MAX_QUERIES : parsed;
    }
    return GUEST_MAX_QUERIES;
  });

  const [isLoginOpen, setIsLoginOpen] = useState<boolean>(false);

  // Restore session on mount
  useEffect(() => {
    try {
      const savedUserStr = localStorage.getItem('acaicia_user');
      if (savedUserStr) {
        const savedUser = JSON.parse(savedUserStr) as User;
        if (savedUser && savedUser.email) {
          setUser(savedUser);
          setRole(savedUser.role || 'researcher');
        }
      }
    } catch {
      localStorage.removeItem('acaicia_user');
      localStorage.removeItem('acaicia_token');
    }
  }, []);

  // Save guest query count
  useEffect(() => {
    localStorage.setItem('acaicia_guest_query_count', guestQueryCount.toString());
  }, [guestQueryCount]);

  const decrementGuestQueryCount = useCallback(() => {
    setGuestQueryCount((prev) => Math.max(0, prev - 1));
  }, []);

  const resetGuestQueryCount = useCallback(() => {
    setGuestQueryCount(GUEST_MAX_QUERIES);
  }, []);

  const openLoginModal = useCallback(() => {
    setIsLoginOpen(true);
  }, []);

  const closeLoginModal = useCallback(() => {
    setIsLoginOpen(false);
  }, []);

  const login = useCallback(async (email: string, password?: string): Promise<boolean> => {
    const normalizedEmail = email.trim().toLowerCase();
    
    // Role assignment rules:
    // b.obaga@landscapealliance.org or admin@acaicia.org -> admin role
    // others -> researcher role
    let assignedRole: UserRole = 'researcher';
    if (normalizedEmail === 'b.obaga@landscapealliance.org' || normalizedEmail === 'admin@acaicia.org') {
      assignedRole = 'admin';
    }

    const nameFromEmail = normalizedEmail.split('@')[0];
    const formattedName = nameFromEmail.charAt(0).toUpperCase() + nameFromEmail.slice(1);

    const newUser: User = {
      email: normalizedEmail,
      role: assignedRole,
      name: formattedName,
      token: `token_${Math.random().toString(36).substring(2)}`,
    };

    setUser(newUser);
    setRole(assignedRole);
    localStorage.setItem('acaicia_user', JSON.stringify(newUser));
    localStorage.setItem('acaicia_token', newUser.token || '');
    setIsLoginOpen(false);
    return true;
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    setRole('guest');
    localStorage.removeItem('acaicia_user');
    localStorage.removeItem('acaicia_token');
  }, []);

  const roleDisplayName = role === 'admin' ? 'Admin' : role === 'researcher' ? 'Researcher' : 'Guest';

  return (
    <AuthContext.Provider
      value={{
        user,
        role,
        isAuthenticated: role !== 'guest',
        roleDisplayName,
        guestQueryLimit: GUEST_MAX_QUERIES,
        guestQueryCount,
        decrementGuestQueryCount,
        resetGuestQueryCount,
        isLoginOpen,
        openLoginModal,
        closeLoginModal,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
