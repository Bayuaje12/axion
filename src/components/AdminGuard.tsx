import { ReactNode } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Navigate } from 'react-router-dom';

const AdminGuard = ({ children }: { children: ReactNode }) => {
  const { user, loading } = useAuth();

  if (loading) return null;
  if (!user || user.role !== 'owner') return <Navigate to="/" replace />;

  return <>{children}</>;
};

export default AdminGuard;
