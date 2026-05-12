'use client';

import { useEffect, useState } from 'react';
import { useOnlineStatus } from '@/lib/offline';
import { Wifi, WifiOff } from 'lucide-react';

export function ConnectionStatus() {
  const isOnline = useOnlineStatus();
  const [isVisible, setIsVisible] = useState(false);
  const [lastStatus, setLastStatus] = useState(true);

  useEffect(() => {
    if (isOnline !== lastStatus) {
      setIsVisible(true);
      setLastStatus(isOnline);
      
      // Auto-hide if back online after a few seconds
      if (isOnline) {
        const timer = setTimeout(() => setIsVisible(false), 5000);
        return () => clearTimeout(timer);
      }
    }
  }, [isOnline, lastStatus]);

  if (!isVisible && isOnline) return null;

  return (
    <div 
      className={`fixed bottom-4 right-4 z-50 flex items-center gap-3 px-4 py-3 rounded-xl shadow-2xl transition-all duration-500 transform ${
        isVisible ? 'translate-y-0 opacity-100' : 'translate-y-20 opacity-0'
      } ${
        isOnline 
          ? 'bg-emerald-500 text-white' 
          : 'bg-rose-500 text-white'
      }`}
    >
      {isOnline ? (
        <>
          <Wifi className="w-5 h-5 animate-pulse" />
          <div className="flex flex-col">
            <span className="font-bold text-sm">Connexion rétablie</span>
            <span className="text-xs opacity-90">L'application est de nouveau en ligne</span>
          </div>
        </>
      ) : (
        <>
          <WifiOff className="w-5 h-5 animate-bounce" />
          <div className="flex flex-col">
            <span className="font-bold text-sm">Mode hors ligne</span>
            <span className="text-xs opacity-90">Vérifiez votre connexion internet</span>
          </div>
        </>
      )}
    </div>
  );
}
