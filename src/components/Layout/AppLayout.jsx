import { useEffect, useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Menu, Trophy } from 'lucide-react';
import Sidebar from './Sidebar';
import NotificationsBell from './NotificationsBell';
import PushPrompt from './PushPrompt';
import MotivationPopup from './MotivationPopup';
import DiwaliWishes from '../festive/DiwaliWishes';
import DiwaliEntryCelebration from '../festive/DiwaliEntryCelebration';
import { useAuth } from '../../context/AuthContext';
import { isDiwaliPeriod, diwaliSeenKey, MOTIVATION_SESSION_KEY, DIWALI_CELEBRATED_KEY } from '../../utils/festive';

export default function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { user } = useAuth();
  const festive = isDiwaliPeriod();
  const [celebrate, setCelebrate] = useState(false);
  const [diwaliOpen, setDiwaliOpen] = useState(() => {
    if (typeof window === 'undefined' || !isDiwaliPeriod()) return false;
    try {
      return !localStorage.getItem(diwaliSeenKey(user?.id));
    } catch {
      return false;
    }
  });

  useEffect(() => {
    if (!festive || diwaliOpen || typeof window === 'undefined') return undefined;
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined;
    try {
      if (sessionStorage.getItem(DIWALI_CELEBRATED_KEY)) return undefined;
    } catch {
      /* storage can be blocked in private mode */
    }
    const timer = setTimeout(() => {
      try {
        sessionStorage.setItem(DIWALI_CELEBRATED_KEY, '1');
      } catch {
        /* storage can be blocked in private mode */
      }
      setCelebrate(true);
    }, 550);
    return () => clearTimeout(timer);
  }, [festive, diwaliOpen]);

  function closeDiwali() {
    try {
      localStorage.setItem(diwaliSeenKey(user?.id), '1');
      // Don't stack the motivation popup behind the wishes on the same visit.
      sessionStorage.setItem(MOTIVATION_SESSION_KEY, '1');
    } catch {
      /* storage can be blocked in private mode */
    }
    setDiwaliOpen(false);
  }

  return (
    <div className="flex h-screen overflow-hidden bg-gray-100">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="h-16 bg-white border-b border-gray-100 flex items-center px-5 gap-3 lg:px-8 shadow-sm">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 hover:bg-gray-100 rounded-xl lg:hidden transition-colors"
          >
            <Menu size={20} className="text-gray-600" />
          </button>
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 bg-primary-500 rounded-lg flex items-center justify-center lg:hidden">
              <Trophy size={14} className="text-white" />
            </div>
            <div className="hidden sm:flex items-center gap-2 text-sm">
              <span className="text-gray-400">NeoOps</span>
              <span className="text-gray-300">/</span>
              <span className="text-gray-700 font-medium">Sales Command Center</span>
            </div>
          </div>
          <div className="flex-1" />
          {festive && (
            <button
              type="button"
              onClick={() => setDiwaliOpen(true)}
              title="View Diwali wishes"
              className="hidden md:inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700 transition-colors hover:bg-amber-100"
            >
              🪔 Happy Diwali
            </button>
          )}
          <NotificationsBell />
        </header>
        <main className={`flex-1 overflow-y-auto p-5 lg:p-8 ${festive ? 'diwali-shell' : 'bg-gray-100'}`}>
          <div className="max-w-7xl mx-auto">
            <Outlet />
          </div>
        </main>
      </div>
      <PushPrompt />
      {!diwaliOpen && <MotivationPopup />}
      <DiwaliWishes open={diwaliOpen} onClose={closeDiwali} />
      <DiwaliEntryCelebration active={celebrate} />
    </div>
  );
}
