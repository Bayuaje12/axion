import { useState, useEffect } from 'react';
import axonLogo from '@/assets/axon-logo.png';

interface SplashScreenProps {
  onFinished: () => void;
}

const SplashScreen = ({ onFinished }: SplashScreenProps) => {
  const [fadeOut, setFadeOut] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setFadeOut(true), 2500);
    const finishTimer = setTimeout(() => onFinished(), 3000);
    return () => {
      clearTimeout(timer);
      clearTimeout(finishTimer);
    };
  }, [onFinished]);

  return (
    <div
      className={`fixed inset-0 z-50 flex flex-col items-center justify-center bg-background transition-opacity duration-500 ${
        fadeOut ? 'opacity-0' : 'opacity-100'
      }`}
    >
      <div className="animate-axon-pulse">
        <img src={axonLogo} alt="Axon Logo" className="w-48 md:w-64 h-auto" />
      </div>
      <div className="mt-8 animate-axon-fade-in">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
          <p className="text-sm text-muted-foreground font-medium tracking-wide">
            Mengamankan Koneksi Axon Asset...
          </p>
        </div>
      </div>
      <div className="mt-4 w-48 h-1 rounded-full bg-secondary overflow-hidden">
        <div
          className="h-full rounded-full bg-accent transition-all duration-[2500ms] ease-out"
          style={{ width: fadeOut ? '100%' : '0%' }}
        />
      </div>
    </div>
  );
};

export default SplashScreen;
