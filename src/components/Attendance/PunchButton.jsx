import { useState, useEffect, useRef } from 'react';
import { LogIn, LogOut, Coffee, Plane, DoorOpen, ChevronDown, Clock } from 'lucide-react';
import { api } from '../../services/api';
import Modal from '../ui/Modal';

const ACTIONS = [
  { key: 'punch_in', label: 'Punch In', icon: LogIn },
  { key: 'on_break', label: 'On Break', icon: Coffee },
  { key: 'on_leave', label: 'On Leave', icon: Plane },
  { key: 'early_logout', label: 'Early Logout', icon: DoorOpen },
  { key: 'punch_out', label: 'Punch Out', icon: LogOut },
];

const STATUS_LABELS = {
  punch_in: 'Punched In',
  on_break: 'On Break',
  on_leave: 'On Leave',
  early_logout: 'Early Logout',
  punch_out: 'Punched Out',
};

function fmtPunchTime(t) {
  if (!t) return '';
  const dt = new Date(t);
  let h = dt.getHours();
  const m = dt.getMinutes().toString().padStart(2, '0');
  const ap = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${h}:${m} ${ap}`;
}

export default function PunchButton({ user, onChange }) {
  if (!user || user.id === 13) {
    return null;
  }

  const [punch, setPunch] = useState(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [calls, setCalls] = useState('');
  const [noms, setNoms] = useState('');
  const [formBusy, setFormBusy] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    let active = true;
    api.attendance.status()
      .then((s) => { if (active) setPunch(s); })
      .catch(() => {});
    return () => { active = false; };
  }, []);

  useEffect(() => {
    function onDocClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  function refresh() { if (onChange) onChange(); }

  async function runAction(action) {
    setOpen(false);
    setBusy(true);
    try {
      const s = await api.attendance.action({ action });
      setPunch(s);
      refresh();
    } catch (e) { alert(e.message); }
    finally { setBusy(false); }
  }

  async function submitPunchOut(ev) {
    ev.preventDefault();
    setFormBusy(true);
    try {
      const s = await api.attendance.action({ action: 'punch_out', connected_calls: calls, nominations: noms });
      setPunch(s);
      setShowForm(false);
      setCalls('');
      setNoms('');
      refresh();
    } catch (e) { alert(e.message); }
    finally { setFormBusy(false); }
  }

  function onPick(action) {
    if (action === 'punch_out') { setShowForm(true); setOpen(false); return; }
    runAction(action);
  }

  const status = punch?.status || null;
  const buttonLabel = status ? STATUS_LABELS[status] : 'Punch In';
  const buttonIcon = status ? (status === 'on_break' ? Coffee : status === 'on_leave' ? Plane : status === 'early_logout' ? DoorOpen : LogOut) : LogIn;
  const buttonClass = status === 'on_break' || status === 'on_leave'
    ? 'bg-amber-500 hover:bg-amber-600'
    : status === 'punch_out' || status === 'early_logout'
      ? 'bg-gray-500 hover:bg-gray-600'
      : 'bg-emerald-500 hover:bg-emerald-600';
  const Icon = buttonIcon;

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        disabled={busy}
        className={`flex items-center justify-center gap-2 w-full sm:w-auto px-4 py-2.5 sm:py-2 text-white text-sm font-semibold rounded-2xl shadow-sm transition-colors disabled:opacity-60 ${buttonClass}`}
      >
        <Icon size={16} /> {buttonLabel}
        {punch?.punch_in && <span className="text-xs opacity-90">· {fmtPunchTime(punch.punch_in)}</span>}
        <ChevronDown size={14} />
      </button>

      {open && (
        <div className="absolute right-0 sm:left-0 z-30 mt-2 w-48 bg-white rounded-2xl shadow-xl border border-gray-100 p-1.5">
          {ACTIONS.map(({ key, label, icon: A }) => (
            <button
              key={key}
              onClick={() => onPick(key)}
              className={`flex items-center gap-2.5 w-full px-3 py-2 rounded-xl text-sm font-medium transition-colors ${
                status === key
                  ? 'bg-primary-50 text-primary-700'
                  : 'text-gray-700 hover:bg-gray-50'
              }`}
            >
              <A size={15} />
              {label}
              {status === key && <span className="ml-auto text-[10px] text-primary-600 font-bold">CURRENT</span>}
            </button>
          ))}
        </div>
      )}

      <Modal open={showForm} onClose={() => setShowForm(false)} title="Punch Out" size="sm">
        <form onSubmit={submitPunchOut} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">Connected Calls</label>
            <input type="number" min="0" required className="input-field" placeholder="Total calls connected today"
              value={calls} onChange={(e) => setCalls(e.target.value)} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">Today's Nominations</label>
            <input type="number" min="0" required className="input-field" placeholder="Total nominations today"
              value={noms} onChange={(e) => setNoms(e.target.value)} />
          </div>
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={() => setShowForm(false)} className="btn-secondary flex-1">Cancel</button>
            <button type="submit" disabled={formBusy} className="btn-primary flex-1">
              {formBusy ? 'Punching out...' : 'Punch Out'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
