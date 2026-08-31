import React, { createContext, useContext, useState, useEffect } from 'react';
import { UserRole } from '../types';

export interface User {
  email: string;
  role: UserRole;
  name?: string;
}

interface AuthContextType {
  machineId: string;
  guestSessionId: string;
  user: User | null;
  role: UserRole;
  roleDisplayName: string;
  // Kept for backward compatibility during testing
  guestQueryCount: number;
  decrementGuestQueryCount: () => void;
  resetGuestQueryCount: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function getOrCreateMachineId(): string {
  try {
    let id = localStorage.getItem('acaicia_machine_id');
    if (!id) {
      id = typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `m_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      localStorage.setItem('acaicia_machine_id', id);
    }
    return id;
  } catch {
    return `m_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [machineId] = useState<string>(getOrCreateMachineId);
  const [user] = useState<User | null>(null);
  const [role] = useState<UserRole>('researcher');

  const roleDisplayName = 'Researcher';

  return (
    <AuthContext.Provider
      value={{
        machineId,
        guestSessionId: machineId,
        user,
        role,
        roleDisplayName,
        guestQueryCount: 9999, // Unlimited for testing
        decrementGuestQueryCount: () => {},
        resetGuestQueryCount: () => {},
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
