import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface AuthUser {
  id: string;
  username: string;
  role: 'owner' | 'user';
}

interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<{ error?: string }>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem('axon_user');
    if (stored) {
      try {
        setUser(JSON.parse(stored));
      } catch {
        localStorage.removeItem('axon_user');
      }
    }
    setLoading(false);
  }, []);

  const login = async (username: string, password: string) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, username, role, is_active')
      .eq('username', username)
      .eq('password', password)
      .single();

    if (error || !data) return { error: 'Username atau password salah.' };
    if (!data.is_active) return { error: 'Akun telah dinonaktifkan.' };

    const authUser: AuthUser = {
      id: data.id,
      username: data.username,
      role: data.role as 'owner' | 'user',
    };
    setUser(authUser);
    localStorage.setItem('axon_user', JSON.stringify(authUser));
    return {};
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('axon_user');
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};
