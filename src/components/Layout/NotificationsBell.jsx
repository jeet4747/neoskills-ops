import { useEffect, useRef, useState } from 'react';
import { Bell, CheckCheck, Trash2 } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'Just now';
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  return day === 1 ? 'Yesterday' : `${day} days ago`;
}

export default function NotificationsBell() {
  const { user } = useAuth();
  const toast = useToast();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [unread, setUnread] = useState(0);
  const ref = useRef(null);
  const welcomed = useRef(false);

  async function load() {
    if (!user?.id) return;
    try {
      const d = await api.notifications.list();
      setItems(d.items || []);
      setUnread(d.unread || 0);
      if (!welcomed.current && d.unread > 0) {
        welcomed.current = true;
        toast.info(`You have ${d.unread} new notification${d.unread > 1 ? 's' : ''}. Check the bell icon.`);
      }
    } catch (e) {}
  }

  useEffect(() => { load(); }, [location.pathname, user?.id]);

  useEffect(() => {
    function onClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  async function markAll() {
    try {
      await api.notifications.markAllRead();
      setUnread(0);
      setItems((prev) => prev.map((n) => ({ ...n, is_read: true })));
    } catch (e) {}
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className={`relative p-2 rounded-xl transition-colors ${open ? 'bg-gray-100 text-gray-800' : 'text-gray-500 hover:text-gray-800 hover:bg-gray-100'}`}
        title="Notifications"
      >
        <Bell size={19} />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center leading-tight">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-2xl shadow-2xl border border-gray-100 z-50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <p className="text-sm font-bold text-gray-900">Notifications</p>
            {unread > 0 && (
              <button onClick={markAll} className="flex items-center gap-1 text-xs font-medium text-primary-600 hover:text-primary-700">
                <CheckCheck size={14} /> Mark all read
              </button>
            )}
          </div>
          <div className="max-h-80 overflow-y-auto">
            {items.length === 0 ? (
              <div className="text-center py-10">
                <Bell size={24} className="text-gray-300 mx-auto mb-2" />
                <p className="text-xs text-gray-400">No notifications</p>
              </div>
            ) : items.map((n) => (
              <div key={n.id} className={`px-4 py-3 border-b border-gray-50 last:border-0 ${n.is_read ? '' : 'bg-red-50/60'}`}>
                <div className="flex items-start gap-2.5">
                  <div className={`mt-0.5 shrink-0 p-1.5 rounded-lg ${n.is_read ? 'bg-gray-100 text-gray-400' : 'bg-red-100 text-red-600'}`}>
                    <Trash2 size={14} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-gray-900">{n.title}</p>
                    <p className="text-xs text-gray-600 mt-0.5 leading-relaxed">{n.message}</p>
                    <p className="text-[10px] text-gray-400 mt-1">{timeAgo(n.created_at)}</p>
                  </div>
                  {!n.is_read && <span className="w-2 h-2 bg-red-500 rounded-full mt-1.5 shrink-0" />}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
