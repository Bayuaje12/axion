import { useState, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import SplashScreen from '@/components/SplashScreen';
import LoginPage from '@/pages/LoginPage';
import UserDashboard from '@/pages/UserDashboard';

const Index = () => {
  const { user, loading } = useAuth();
  const [showSplash, setShowSplash] = useState(true);

  const handleSplashFinished = useCallback(() => {
    setShowSplash(false);
  }, []);

  if (showSplash) {
    return <SplashScreen onFinished={handleSplashFinished} />;
  }

  if (loading) return null;

  if (!user) return <LoginPage />;

  return <UserDashboard />;
};

export default Index;
