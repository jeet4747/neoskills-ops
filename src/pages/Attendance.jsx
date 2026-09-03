import { useState, useEffect, useMemo } from 'react';
import { CalendarDays, Clock, Coffee, DoorOpen, Plane, LogIn, LogOut } from 'lucide-react';
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

const STATUS_META = {
  punch_in: { label: 'Punched In', color: 'bg-emerald-50 text-emerald-600', icon: LogIn },
  on_break: { label: 'On Break', color: 'bg-amber-50 text-amber-600', icon: Coffee },
  on_leave: { label: 'On Leave', color: 'bg-purple-50 text-purple-600', icon: Plane },
  early_logout: { label: 'Early Logout', color: 'bg-orange-50 text-orange-600', icon: DoorOpen },
  punch_out: { label: 'Punched Out', color: 'bg-gray-100 text-gray-600', icon: LogOut },
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

export default function Attendance() {
  const { user } = useAuth();
  const isMonthlyAllowed = user?.id === 4 || user?.id === 13;
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);

  async function loadMonthly() {
    if (!isMonthlyAllowed) return;
    setLoading(true);
    try { setData(await api.attendance.monthly(month)); }
    catch (e) { setData([]); }
    finally { setLoading(false); }
  }

  useEffect(() => { loadMonthly(); }, [month, isMonthlyAllowed]);

  const byEmployee = useMemo(() => {
    const map = {};
    for (const r of data) {
      if (!map[r.user_id]) map[r.user_id] = { name: r.name, days: 0, breakDays: 0, leaveDays: 0, calls: 0, noms: 0 };
      map[r.user_id].days += 1;
      if (r.status === 'on_break') map[r.user_id].breakDays += 1;
      if (r.status === 'on_leave') map[r.user_id].leaveDays += 1;
      map[r.user_id].calls += r.connected_calls || 0;
      map[r.user_id].noms += r.nominations || 0;
    }
    return Object.values(map);
  }, [data]);

  const monthLabel = month
    ? `${String(['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][parseInt(month.slice(5), 10) - 1])} ${month.slice(0, 4)}`
    : '';

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Attendance</h1>
          <p className="text-sm text-gray-400 mt-0.5">Punch in/out and mark status</p>
        </div>
        <PunchButton user={user} />
      </div>

      {isMonthlyAllowed && (
        <>
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
                      {String(['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][parseInt(m.slice(5), 10) - 1])} {m.slice(0, 4)}
                    </option>
                  ))}
                </select>
              </div>
            </CardHeader>
            <CardBody className="p-5">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-5">
                <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                  <p className="text-[11px] text-gray-400">Employees Marked</p>
                  <p className="text-2xl font-bold text-gray-900">{byEmployee.length}</p>
                </div>
                <div className="bg-emerald-50 rounded-xl p-4 border border-emerald-100">
                  <p className="text-[11px] text-emerald-500">Attendance Days</p>
                  <p className="text-2xl font-bold text-emerald-700">{data.length}</p>
                </div>
                <div className="bg-amber-50 rounded-xl p-4 border border-amber-100">
                  <p className="text-[11px] text-amber-500">Break Days</p>
                  <p className="text-2xl font-bold text-amber-700">{byEmployee.reduce((s, e) => s + e.breakDays, 0)}</p>
                </div>
                <div className="bg-purple-50 rounded-xl p-4 border border-purple-100">
                  <p className="text-[11px] text-purple-500">Leave Days</p>
                  <p className="text-2xl font-bold text-purple-700">{byEmployee.reduce((s, e) => s + e.leaveDays, 0)}</p>
                </div>
              </div>

              {loading ? (
                <p className="text-sm text-gray-400 text-center py-6">Loading...</p>
              ) : data.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-6">No attendance records for {monthLabel}</p>
              ) : (
                <div className="max-h-[28rem] overflow-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-left text-gray-400 border-b border-gray-100">
                        <th className="py-2 pr-2 font-medium">Date</th>
                        <th className="py-2 pr-2 font-medium">Employee</th>
                        <th className="py-2 pr-2 font-medium">Status</th>
                        <th className="py-2 pr-2 font-medium">In</th>
                        <th className="py-2 pr-2 font-medium">Out</th>
                        <th className="py-2 pr-2 font-medium">Calls</th>
                        <th className="py-2 font-medium">Nom</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.map((r) => {
                        const meta = STATUS_META[r.status] || STATUS_META.punch_in;
                        return (
                          <tr key={r.id} className="border-b border-gray-50 text-gray-700">
                            <td className="py-2 pr-2 whitespace-nowrap">{String(r.date).slice(0, 10)}</td>
                            <td className="py-2 pr-2 font-medium">{r.name}</td>
                            <td className="py-2 pr-2">
                              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold ${meta.color}`}>
                                {meta.label}
                              </span>
                            </td>
                            <td className="py-2 pr-2">{fmt(r.punch_in)}</td>
                            <td className="py-2 pr-2">{r.punch_out ? fmt(r.punch_out) : '—'}</td>
                            <td className="py-2 pr-2">{r.connected_calls || 0}</td>
                            <td className="py-2">{r.nominations || 0}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardBody>
          </Card>
        </>
      )}
    </div>
  );
}
