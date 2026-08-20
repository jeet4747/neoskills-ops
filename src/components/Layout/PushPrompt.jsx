import { useState, useEffect } from 'react';
import { Bell, X } from 'lucide-react';
import { usePushSubscription } from '../../hooks/usePushSubscription';
import { useAuth } from '../../context/AuthContext';

export default function PushPrompt() {
  const { user } = useAuth();
  const { supported, permission, subscribed, subscribe } = usePushSubscription(user);
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!user || !supported) return;
    const dismissed = localStorage.getItem('push_prompt_dismissed');
    if (permission === 'default' && !subscribed && !dismissed) {
      setShow(true);
    }
  }, [user, supported, permission, subscribed]);

  async function handleEnable() {
    const ok = await subscribe();
    if (ok) setShow(false);
  }

  function handleDismiss() {
    setShow(false);
    localStorage.setItem('push_prompt_dismissed', '1');
  }

  if (!show) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 p-4 sm:p-6 pointer-events-none">
      <div className="max-w-lg mx-auto pointer-events-auto bg-white rounded-2xl shadow-2xl border border-gray-100 p-4 flex items-center gap-4 animate-slide-up">
        <div className="shrink-0 w-12 h-12 bg-primary-50 rounded-xl flex items-center justify-center">
          <Bell size={22} className="text-primary-600" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-gray-900">Turn on notifications</p>
          <p className="text-xs text-gray-500 mt-0.5">Get instant alerts for tasks, approvals & updates</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button onClick={handleEnable}
            className="px-4 py-2 bg-primary-600 text-white text-xs font-semibold rounded-xl hover:bg-primary-700 transition-colors">
            Enable
          </button>
          <button onClick={handleDismiss}
            className="p-2 text-gray-400 hover:text-gray-600 rounded-xl hover:bg-gray-100 transition-colors">
            <X size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
