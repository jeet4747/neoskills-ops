import { useState, useEffect, useMemo } from 'react';
import { CalendarDays, Clock, Coffee, Hourglass } from 'lucide-react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { Card, CardHeader, CardBody } from '../components/ui/Card';
import PunchButton from '../components/Attendance/PunchButton';

const MONTH_OPTIONS = [];
const now = new Date();
for (let i = 0; i < 12; i++) {
  const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
  MONTH_OPTIONS.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
}

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const STATUS_META = {
  punch_in: { label: 'Punched In', color: 'bg-emerald-50 text-emerald-600' },
  on_break: { label: 'On Break', color: 'bg-amber-50 text-amber-600' },
  on_leave: { label: 'On Leave', color: 'bg-purple-50 text-purple-600' },
  early_logout: { label: 'Early Logout', color: 'bg-orange-50 text-orange-600' },
  punch_out: { label: 'Punched Out', color: 'bg-gray-100 text-gray-600' },
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

function fmtDate(d) {
  if (!d) return '—';
  const dt = new Date(String(d).slice(0, 10) + 'T00:00:00');
  return `${MONTH_NAMES[dt.getMonth()]} ${dt.getDate()}`;
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

export default function Attendance() {
  const { user } = useAuth();
  const isMonthlyAllowed = user?.id === 4 || user?.id === 13;
  const [punch, setPunch] = useState(null);
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);

  async function loadOwn() {
    try { setPunch(await api.attendance.status()); }
    catch (e) {}
  }

  async function loadMonthly() {
    if (!isMonthlyAllowed) return;
    setLoading(true);
    try { setData(await api.attendance.monthly(month)); }
    catch (e) { setData([]); }
    finally { setLoading(false); }
  }

  useEffect(() => { loadOwn(); }, []);
  useEffect(() => { loadMonthly(); }, [month, isMonthlyAllowed]);

  const nowMs = Date.now();
  const ownWorked = punch?.punch_in
    ? durationLabel(workedMinutes(punch.punch_in, punch.punch_out || new Date(nowMs).toISOString(), punch.total_break_minutes) || 0)
    : null;
  const ownBreak = nullishTotalBreak(punch);

  const summary = useMemo(() => {
    let days = 0, totalWork = 0, totalBreak = 0, totalCalls = 0, totalNoms = 0;
    const employees = new Set();
    for (const r of data) {
      days += 1;
      employees.add(r.user_id);
      totalBreak += r.total_break_minutes || 0;
      totalCalls += r.connected_calls || 0;
      totalNoms += r.nominations || 0;
      const w = workedMinutes(r.punch_in, r.punch_out, r.total_break_minutes);
      if (w) totalWork += w;
    }
    return {
      employees: employees.size,
      days,
      totalWork: durationLabel(totalWork),
      totalBreak: durationLabel(totalBreak),
      totalCalls,
      totalNoms,
    };
  }, [data]);

  const monthLabel = month
    ? `${MONTH_NAMES[parseInt(month.slice(5), 10) - 1]} ${month.slice(0, 4)}`
    : '';

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
            <h3 className="font-semibold text-gray-900">Today</h3>
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

      {isMonthlyAllowed && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center gap-2">
                <CalendarDays size={16} className="text-primary-600" />
                <h3 className="font-semibold text-gray-900">Monthly Attendance Report</h3>
              </div>
              <select className="input-field text-sm w-44" value={month} onChange={(e) => setMonth(e.target.value)}>
                {MONTH_OPTIONS.map((m) => (
                  <option key={m} value={m}>
                    {MONTH_NAMES[parseInt(m.slice(5), 10) - 1]} {m.slice(0, 4)}
                  </option>
                ))}
              </select>
            </div>
          </CardHeader>
          <CardBody className="p-5">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 mb-5">
              <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                <p className="text-[11px] text-gray-400">Employees Marked</p>
                <p className="text-xl font-bold text-gray-900">{summary.employees}</p>
              </div>
              <div className="bg-emerald-50 rounded-xl p-4 border border-emerald-100">
                <p className="text-[11px] text-emerald-500">Attendance Days</p>
                <p className="text-xl font-bold text-emerald-700">{summary.days}</p>
              </div>
              <div className="bg-blue-50 rounded-xl p-4 border border-blue-100">
                <p className="text-[11px] text-blue-500">Total Break</p>
                <p className="text-xl font-bold text-blue-700">{summary.totalBreak}</p>
              </div>
              <div className="bg-indigo-50 rounded-xl p-4 border border-indigo-100">
                <p className="text-[11px] text-indigo-500">Total Worked</p>
                <p className="text-xl font-bold text-indigo-700">{summary.totalWork}</p>
              </div>
              <div className="bg-teal-50 rounded-xl p-4 border border-teal-100">
                <p className="text-[11px] text-teal-500">Connected Calls</p>
                <p className="text-xl font-bold text-teal-700">{summary.totalCalls}</p>
              </div>
              <div className="bg-rose-50 rounded-xl p-4 border border-rose-100">
                <p className="text-[11px] text-rose-500">Nominations</p>
                <p className="text-xl font-bold text-rose-700">{summary.totalNoms}</p>
              </div>
            </div>

            {loading ? (
              <p className="text-sm text-gray-400 text-center py-6">Loading...</p>
            ) : data.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-6">No attendance records for {monthLabel}</p>
            ) : (
              <div className="max-h-[30rem] overflow-auto rounded-xl border border-gray-100">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-gray-50">
                    <tr className="text-left text-gray-500 border-b border-gray-100">
                      <th className="py-2.5 px-3 font-semibold whitespace-nowrap">Date</th>
                      <th className="py-2.5 px-3 font-semibold">Employee</th>
                      <th className="py-2.5 px-3 font-semibold">Status</th>
                      <th className="py-2.5 px-3 font-semibold">In</th>
                      <th className="py-2.5 px-3 font-semibold">Out</th>
                      <th className="py-2.5 px-3 font-semibold text-right">Break</th>
                      <th className="py-2.5 px-3 font-semibold text-right">Worked</th>
                      <th className="py-2.5 px-3 font-semibold text-right">Calls</th>
                      <th className="py-2.5 px-3 font-semibold text-right">Nom</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.map((r) => {
                      const meta = STATUS_META[r.status] || STATUS_META.punch_in;
                      return (
                        <tr key={r.id} className="border-b border-gray-50 text-gray-700 hover:bg-gray-50/60">
                          <td className="py-2.5 px-3 whitespace-nowrap font-medium">{fmtDate(r.date)}</td>
                          <td className="py-2.5 px-3 whitespace-nowrap">{r.name}</td>
                          <td className="py-2.5 px-3">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold ${meta.color}`}>
                              {meta.label}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 whitespace-nowrap">{fmt(r.punch_in)}</td>
                          <td className="py-2.5 px-3 whitespace-nowrap">{r.punch_out ? fmt(r.punch_out) : '—'}</td>
                          <td className="py-2.5 px-3 text-right whitespace-nowrap">
                            {(r.total_break_minutes || 0) > 0 ? durationLabel(r.total_break_minutes) : '—'}
                          </td>
                          <td className="py-2.5 px-3 text-right whitespace-nowrap font-semibold">
                            {r.punch_in && r.punch_out ? durationLabel(workedMinutes(r.punch_in, r.punch_out, r.total_break_minutes)) : '—'}
                          </td>
                          <td className="py-2.5 px-3 text-right">{r.connected_calls || 0}</td>
                          <td className="py-2.5 px-3 text-right">{r.nominations || 0}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardBody>
        </Card>
      )}
    </div>
  );
}

function nullishTotalBreak(p) {
  if (!p) return '—';
  const total = p.total_break_minutes || 0;
  if (p.break_start && p.status !== 'punch_in') {
    const live = Math.round((Date.now() - new Date(p.break_start)) / 60000);
    return durationLabel(total + Math.max(live, 0));
  }
  return durationLabel(total);
}
