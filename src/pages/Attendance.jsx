import { useState, useEffect, useMemo } from 'react';
import { CalendarDays, Clock, Coffee, Hourglass, ChevronLeft, ChevronRight, Plane, UserX, Users } from 'lucide-react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { Card, CardHeader, CardBody } from '../components/ui/Card';
import PunchButton from '../components/Attendance/PunchButton';

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const STATUS_META = {
  punch_in: { label: 'Working', color: 'bg-emerald-50 text-emerald-600' },
  on_break: { label: 'On Break', color: 'bg-amber-50 text-amber-600' },
  on_leave: { label: 'On Leave', color: 'bg-purple-50 text-purple-600' },
  early_logout: { label: 'Early Logout', color: 'bg-orange-50 text-orange-600' },
  punch_out: { label: 'Worked', color: 'bg-gray-100 text-gray-600' },
};

function fmt(t) {
  if (!t) return '—';
  const dt = new Date(t);
  let h = dt.getHours();
  const m = dt.getMinutes().toString().padStart(2, '0');
  const ap = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${h}:${m} ${ap}`;
}

function durationLabel(min) {
  if (!min || min <= 0) return '—';
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

function workedMinutes(punchIn, punchOut, totalBreak) {
  if (!punchIn || !punchOut) return null;
  const ms = new Date(punchOut) - new Date(punchIn);
  return Math.max(0, Math.round(ms / 60000) - (totalBreak || 0));
}

function dateLabel(d) {
  const dt = new Date(d + 'T00:00:00');
  return `${DAY_NAMES[dt.getDay()]}, ${dt.getDate()} ${MONTH_NAMES[dt.getMonth()]} ${dt.getFullYear()}`;
}

function shiftDay(d, delta) {
  const dt = new Date(d + 'T00:00:00');
  dt.setDate(dt.getDate() + delta);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
}

export default function Attendance() {
  const { user } = useAuth();
  const isGridAllowed = user?.id === 4 || user?.id === 13;
  const today = new Date().toISOString().slice(0, 10);
  const [punch, setPunch] = useState(null);
  const [date, setDate] = useState(today);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);

  async function loadOwn() {
    try { setPunch(await api.attendance.status()); }
    catch (e) {}
  }

  async function loadDaily() {
    setLoading(true);
    try { setRows(await api.attendance.daily(date)); }
    catch (e) { setRows([]); }
    finally { setLoading(false); }
  }

  useEffect(() => { loadOwn(); }, []);
  useEffect(() => { loadDaily(); }, [date]);

  const nowMs = Date.now();
  const ownWorked = punch?.punch_in
    ? durationLabel(workedMinutes(punch.punch_in, punch.punch_out || new Date(nowMs).toISOString(), punch.total_break_minutes) || 0)
    : null;
  const ownBreak = liveBreak(punch);

  const summary = useMemo(() => {
    let present = 0, leave = 0, absent = 0;
    for (const r of rows) {
      if (r.status === 'on_leave') leave += 1;
      else if (r.punch_in) present += 1;
      else absent += 1;
    }
    return { present, leave, absent, total: rows.length };
  }, [rows]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Attendance</h1>
          <p className="text-sm text-gray-400 mt-0.5">Punch in/out, track breaks and working hours</p>
        </div>
        <PunchButton user={user} onChange={loadOwn} />
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Clock size={16} className="text-emerald-600" />
            <h3 className="font-semibold text-gray-900">My Day</h3>
          </div>
        </CardHeader>
        <CardBody className="p-5">
          {!punch?.punch_in ? (
            <div className="flex items-center justify-between flex-wrap gap-3">
              <p className="text-sm text-gray-400">You haven't punched in yet today.</p>
              <PunchButton user={user} onChange={loadOwn} />
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                <p className="text-[11px] text-gray-400">Punch In</p>
                <p className="text-lg font-bold text-gray-900">{fmt(punch.punch_in)}</p>
              </div>
              <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                <p className="text-[11px] text-gray-400">Punch Out</p>
                <p className="text-lg font-bold text-gray-900">{punch.punch_out ? fmt(punch.punch_out) : '—'}</p>
              </div>
              <div className="bg-amber-50 rounded-xl p-4 border border-amber-100">
                <p className="text-[11px] text-amber-500 flex items-center gap-1"><Coffee size={12} /> Break</p>
                <p className="text-lg font-bold text-amber-700">{ownBreak || '—'}</p>
              </div>
              <div className="bg-emerald-50 rounded-xl p-4 border border-emerald-100">
                <p className="text-[11px] text-emerald-500 flex items-center gap-1"><Hourglass size={12} /> Worked</p>
                <p className="text-lg font-bold text-emerald-700">{ownWorked || '—'}</p>
              </div>
            </div>
          )}
        </CardBody>
      </Card>

      {!isGridAllowed && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Users size={16} className="text-primary-600" />
              <h3 className="font-semibold text-gray-900">Working Today</h3>
              <span className="text-xs text-gray-400 font-normal">· {dateLabel(today)}</span>
            </div>
          </CardHeader>
          <CardBody className="p-5">
            {loading ? (
              <p className="text-sm text-gray-400 text-center py-8">Loading...</p>
            ) : (
              <ul className="divide-y divide-gray-100">
                {rows.map((r) => {
                  let label = 'Absent', dot = 'bg-gray-300', time = '';
                  if (r.status === 'on_leave') { label = 'On Leave'; dot = 'bg-purple-500'; time = ''; }
                  else if (r.punch_in) {
                    label = 'Working';
                    dot = 'bg-emerald-500';
                    time = `${fmt(r.punch_in)}${r.punch_out ? ' – ' + fmt(r.punch_out) : ''}`;
                    if (r.status === 'on_break') { label = 'On Break'; dot = 'bg-amber-500'; }
                    if (r.status === 'early_logout') { label = 'Early Logout'; dot = 'bg-orange-500'; }
                    if (r.status === 'punch_out') { label = 'Worked'; dot = 'bg-gray-500'; }
                  }
                  return (
                    <li key={r.user_id} className="flex items-center justify-between gap-3 py-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="w-9 h-9 rounded-xl flex items-center justify-center text-xs font-bold shrink-0 bg-gray-100 text-gray-600">
                          {r.name?.charAt(0).toUpperCase()}
                        </span>
                        <div className="min-w-0">
                          <p className="text-[13px] font-semibold text-gray-900 truncate">{r.name}</p>
                          <p className="text-[10px] text-gray-400 capitalize">{r.role === 'sales' ? 'Sales Rep' : r.role}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {time && <span className="text-xs text-gray-500">{time}</span>}
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold text-gray-600`}>
                          <span className={`w-2 h-2 rounded-full ${dot}`} />
                          {label}
                        </span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardBody>
        </Card>
      )}

      {isGridAllowed && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between w-full flex-wrap gap-3">
              <div className="flex items-center gap-2">
                <CalendarDays size={16} className="text-primary-600" />
                <h3 className="font-semibold text-gray-900">Daily Attendance</h3>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1">
                  <button onClick={() => setDate((d) => shiftDay(d, -1))} className="p-2 rounded-xl border border-gray-200 text-gray-500 hover:bg-gray-50" aria-label="Previous day">
                    <ChevronLeft size={16} />
                  </button>
                  <input type="date" className="input-field text-sm w-40" value={date} max={today} onChange={(e) => setDate(e.target.value)} />
                  <button onClick={() => setDate((d) => shiftDay(d, 1))} disabled={date >= today} className="p-2 rounded-xl border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-40" aria-label="Next day">
                    <ChevronRight size={16} />
                  </button>
                </div>
                {date !== today && (
                  <button onClick={() => setDate(today)} className="text-xs font-medium text-primary-600 hover:text-primary-700 px-3 py-2 rounded-xl hover:bg-primary-50">
                    Today
                  </button>
                )}
              </div>
            </div>
          </CardHeader>
          <CardBody className="p-5">
            <div className="mb-4">
              <p className="text-sm font-semibold text-gray-900">{dateLabel(date)}</p>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-5">
              <div className="bg-emerald-50 rounded-xl p-4 border border-emerald-100">
                <p className="text-[11px] text-emerald-500">Present</p>
                <p className="text-xl font-bold text-emerald-700">{summary.present}</p>
              </div>
              <div className="bg-purple-50 rounded-xl p-4 border border-purple-100">
                <p className="text-[11px] text-purple-500">On Leave</p>
                <p className="text-xl font-bold text-purple-700">{summary.leave}</p>
              </div>
              <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                <p className="text-[11px] text-gray-400">Absent</p>
                <p className="text-xl font-bold text-gray-700">{summary.absent}</p>
              </div>
              <div className="bg-blue-50 rounded-xl p-4 border border-blue-100">
                <p className="text-[11px] text-blue-500">Total Staff</p>
                <p className="text-xl font-bold text-blue-700">{summary.total}</p>
              </div>
            </div>

            {loading ? (
              <p className="text-sm text-gray-400 text-center py-8">Loading...</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {rows.map((r) => {
                  const isAbsent = !r.punch_in && r.status !== 'on_leave';
                  const meta = r.status === 'on_leave'
                    ? STATUS_META.on_leave
                    : isAbsent
                      ? { label: 'Absent', color: 'bg-gray-100 text-gray-500' }
                      : STATUS_META[r.status] || STATUS_META.punch_in;
                  return (
                    <div key={r.user_id} className={`rounded-2xl p-4 border ${isAbsent || r.status === 'on_leave' ? 'bg-gray-50/70 border-gray-100' : 'bg-white border-gray-100'} shadow-sm`}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-3 min-w-0">
                          <span className={`w-9 h-9 rounded-xl flex items-center justify-center text-xs font-bold shrink-0 ${r.punch_in ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-200 text-gray-500'}`}>
                            {r.name?.charAt(0).toUpperCase()}
                          </span>
                          <div className="min-w-0">
                            <p className="text-[13px] font-semibold text-gray-900 truncate">{r.name}</p>
                            <p className="text-[10px] text-gray-400 capitalize">{r.role}</p>
                          </div>
                        </div>
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold shrink-0 ${meta.color}`}>
                          {r.status === 'on_leave' ? <Plane size={10} /> : isAbsent ? <UserX size={10} /> : null}
                          {meta.label}
                        </span>
                      </div>
                      {r.punch_in ? (
                        <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                          <div>
                            <p className="text-[10px] text-gray-400">In</p>
                            <p className="text-xs font-semibold text-gray-700">{fmt(r.punch_in)}</p>
                          </div>
                          <div>
                            <p className="text-[10px] text-gray-400">Out</p>
                            <p className="text-xs font-semibold text-gray-700">{r.punch_out ? fmt(r.punch_out) : '—'}</p>
                          </div>
                          <div>
                            <p className="text-[10px] text-gray-400">Worked</p>
                            <p className="text-xs font-semibold text-emerald-700">
                              {r.punch_out ? durationLabel(workedMinutes(r.punch_in, r.punch_out, r.total_break_minutes)) : '—'}
                            </p>
                          </div>
                        </div>
                      ) : (
                        <p className="mt-3 text-xs text-gray-400">
                          {r.status === 'on_leave' ? 'Marked as leave for this day.' : 'No punch-in recorded.'}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </CardBody>
        </Card>
      )}
    </div>
  );
}

function liveBreak(p) {
  if (!p) return '—';
  const total = p.total_break_minutes || 0;
  if (p.break_start && p.status !== 'punch_in') {
    const live = Math.round((Date.now() - new Date(p.break_start)) / 60000);
    return durationLabel(total + Math.max(live, 0));
  }
  return durationLabel(total);
}
