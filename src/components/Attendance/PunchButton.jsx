import { useState, useEffect, useRef } from 'react';
import { LogIn, LogOut, Coffee, Plane, DoorOpen, ChevronDown, PlayCircle, Clock, AlertTriangle } from 'lucide-react';
import { api } from '../../services/api';
import Modal from '../ui/Modal';

const ACTION_SET = {
  punch_in: { key: 'punch_in', label: 'Punch In', icon: LogIn },
  late_login: { key: 'late_login', label: 'Late Login', icon: AlertTriangle },
  on_break: { key: 'on_break', label: 'On Break', icon: Coffee },
  on_leave: { key: 'on_leave', label: 'On Leave', icon: Plane },
  resume: { key: 'resume', label: 'Back to Work', icon: PlayCircle },
  early_logout: { key: 'early_logout', label: 'Early Logout', icon: DoorOpen },
  punch_out: { key: 'punch_out', label: 'Punch Out', icon: LogOut },
};

const AVAILABLE = {
  null: ['punch_in', 'late_login'],
  punch_in: ['on_break', 'on_leave', 'early_logout', 'punch_out'],
  on_break: ['resume', 'early_logout', 'punch_out'],
  on_leave: ['resume', 'early_logout', 'punch_out'],
  early_logout: ['punch_in'],
  punch_out: ['punch_in'],
};

const STATUS_LABELS = {
  late_login: 'Late Login',
  punch_in: 'Punched In',
  on_break: 'On Break',
  on_leave: 'On Leave',
  early_logout: 'Early Logout',
  punch_out: 'Punched Out',
};

const STATUS_STYLES = {
  late_login: 'bg-orange-500 hover:bg-orange-600',
  punch_in: 'bg-emerald-500 hover:bg-emerald-600',
  on_break: 'bg-amber-500 hover:bg-amber-600',
  on_leave: 'bg-amber-500 hover:bg-amber-600',
  early_logout: 'bg-gray-500 hover:bg-gray-600',
  punch_out: 'bg-gray-500 hover:bg-gray-600',
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
  const [outAction, setOutAction] = useState('punch_out');
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
      const s = await api.attendance.action({
        action: action === 'late_login' ? 'punch_in' : action,
        late_login: action === 'late_login',
      });
      setPunch(s);
      refresh();
    } catch (e) { alert(e.message); }
    finally { setBusy(false); }
  }

  async function submitOut(ev) {
    ev.preventDefault();
    setFormBusy(true);
    try {
      const s = await api.attendance.action({ action: outAction, connected_calls: calls, nominations: noms });
      setPunch(s);
      setShowForm(false);
      setCalls('');
      setNoms('');
      refresh();
    } catch (e) { alert(e.message); }
    finally { setFormBusy(false); }
  }

  function onPick(action) {
    if ((action === 'punch_out' || action === 'early_logout') && user.id !== 19) { setOutAction(action); setShowForm(true); setOpen(false); return; }
    runAction(action);
  }

  const status = punch?.status || null;
  const isLate = !!(punch?.late_login);
  const displayStatus = status === 'punch_in' && isLate ? 'late_login' : status;
  const isOnAbsence = status === 'on_break' || status === 'on_leave';
  const buttonLabel = displayStatus
    ? (isOnAbsence && punch.break_start ? `${STATUS_LABELS[displayStatus]} since ${fmtPunchTime(punch.break_start)}` : STATUS_LABELS[displayStatus])
    : 'Punch In';
  const buttonIcon = displayStatus
    ? (displayStatus === 'late_login' ? AlertTriangle : displayStatus === 'on_break' ? Coffee : displayStatus === 'on_leave' ? Plane : displayStatus === 'early_logout' ? DoorOpen : LogOut)
    : LogIn;
  const Icon = buttonIcon;
  const actions = (AVAILABLE[status] || []).map((k) => ACTION_SET[k]);
  const hasCalls = (punch?.connected_calls || 0) > 0 || (punch?.nominations || 0) > 0;

  return (
    <div className="relative inline-block" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        disabled={busy}
        className={`flex items-center justify-center gap-2 px-4 py-2.5 sm:py-2 text-white text-sm font-semibold rounded-2xl shadow-sm transition-colors disabled:opacity-60 ${STATUS_STYLES[displayStatus] || 'bg-emerald-500 hover:bg-emerald-600'}`}
      >
        <Icon size={16} /> {buttonLabel}
        {hasCalls && <span className="text-[10px] opacity-90 font-normal">({punch.connected_calls || 0}c · {punch.nominations || 0}n)</span>}
        <ChevronDown size={14} />
      </button>

      {open && (
        <div className="absolute right-0 sm:left-0 z-30 mt-2 w-52 bg-white rounded-2xl shadow-xl border border-gray-100 p-1.5">
          {actions.map(({ key, label, icon: A }) => (
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

      <Modal open={showForm} onClose={() => setShowForm(false)} title={outAction === 'early_logout' ? 'Early Logout' : 'Punch Out'} size="sm">
        <form onSubmit={submitOut} className="space-y-4">
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
              {formBusy ? 'Saving...' : (outAction === 'early_logout' ? 'Early Logout' : 'Punch Out')}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
