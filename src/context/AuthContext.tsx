import React, { createContext, useContext, useState, useEffect } from 'react';
import { api, ApiError } from '../lib/api';
import type { ClinicRole, ClinicModule } from '../lib/role-config';
import { ROLE_CONFIG } from '../lib/role-config';

export interface SafeUser {
  id: string;
  username: string;
  name: string; // added for UI compatibility
  role: ClinicRole;
  staffId?: string;
  staff?: {
    id: string;
    name: string;
    phone?: string;
    permissions?: ClinicModule[] | null;
  };
  permissions?: ClinicModule[];
}

export function computeEffectivePermissions(role: ClinicRole, staffPermissions?: ClinicModule[] | null): ClinicModule[] {
  const roleDefault = ROLE_CONFIG[role]?.permissions || [];
  if (staffPermissions !== null && staffPermissions !== undefined && Array.isArray(staffPermissions)) {
    const set = new Set<ClinicModule>(staffPermissions);

    // Invariant: Reports is strictly Head Doctor only
    if (role !== 'Head Doctor') {
      set.delete('Reports');
    }

    if (role === 'Head Doctor') {
      set.add('Staff Management');
      set.add('Dashboard');
    }

    // Sub-modules linked to visible sidebar menu modules
    if (set.has('Queue')) {
      set.add('Doctor Workspace');
      set.add('Prescriptions');
    }
    if (set.has('Reception Desk')) {
      (['Appointments', 'Billing', 'Payments', 'Dispensing'] as ClinicModule[]).forEach(sub => {
        set.add(sub);
      });
    }

    return Array.from(set);
  }
  return roleDefault;
}

interface AuthContextType {
  currentUser: SafeUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (username: string, password?: string) => Promise<{ success: boolean; error?: string; user?: SafeUser }>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<void>;
  updateProfile: (data: { name: string; phone?: string }) => Promise<{ success: boolean; error?: string }>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUser] = useState<SafeUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refreshSession = async () => {
    try {
      const data = await api.get<{ user: SafeUser }>('/api/auth/me');
      const permissions = computeEffectivePermissions(data.user.role, data.user.staff?.permissions);
      const userWithUiName: SafeUser = {
        ...data.user,
        name: data.user.staff?.name || data.user.username,
        permissions
      };
      setCurrentUser(userWithUiName);
    } catch (err) {
      setCurrentUser(null);
    }
  };

  // Restore session on mount
  useEffect(() => {
    async function restoreSession() {
      try {
        await refreshSession();
      } finally {
        setIsLoading(false);
      }
    }
    restoreSession();
  }, []);

  // Make sure no localStorage auth remains
  useEffect(() => {
    localStorage.removeItem('dc_v2_user');
  }, []);

  const login = async (username: string, password?: string) => {
    try {
      const data = await api.post<{ message: string, user: SafeUser }>('/api/auth/login', { username, password });
      const permissions = computeEffectivePermissions(data.user.role, data.user.staff?.permissions);
      const userWithUiName: SafeUser = {
        ...data.user,
        name: data.user.staff?.name || data.user.username,
        permissions
      };
      setCurrentUser(userWithUiName);
      return { success: true, user: userWithUiName };
    } catch (err) {
      if (err instanceof ApiError) {
        return { success: false, error: err.message };
      }
      return { success: false, error: 'Network Error' };
    }
  };

  const logout = async () => {
    try {
      await api.post('/api/auth/logout');
    } catch (err) {
      console.error('Logout error', err);
    }
    setCurrentUser(null);
  };

  const updateProfile = async (data: { name: string; phone?: string }) => {
    try {
      await api.put('/api/auth/profile', data);
      await refreshSession();
      return { success: true };
    } catch (err: any) {
      if (err instanceof ApiError) {
        return { success: false, error: err.message };
      }
      return { success: false, error: err.message || 'Failed to update profile' };
    }
  };

  return (
    <AuthContext.Provider value={{
      currentUser,
      isAuthenticated: !!currentUser,
      isLoading,
      login,
      logout,
      refreshSession,
      updateProfile
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
