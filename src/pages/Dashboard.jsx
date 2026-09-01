import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { DollarSign, Users, Clock, TrendingUp, AlertCircle, Medal, Filter, CheckCircle, ChevronRight, Target, Edit3, X, Check, UsersRound, ListChecks, FileText } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from 'recharts';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import StatsCard, { GradientStatsCard } from '../components/ui/StatsCard';
import { Card, CardHeader, CardBody } from '../components/ui/Card';
import Modal from '../components/ui/Modal';
import Badge from '../components/ui/Badge';

const COLORS = ['#003B7A', '#FFC300', '#10B981', '#F59E0B', '#6366F1', '#EC4899', '#84CC16'];
const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'Just now';
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  return `${Math.floor(hr / 24)}d ago`;
}

function fmtINR(n) {
  const num = Number(n || 0);
  const abs = Math.abs(num);
  const sign = num < 0 ? '-' : '';
  if (abs >= 10000000) return `${sign}₹${(abs / 10000000).toFixed(2)}Cr`;
  if (abs >= 100000) return `${sign}₹${(abs / 100000).toFixed(2)}L`;
  return `${sign}₹${abs.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
}

const STATUS_COLORS = {
  backlog: 'bg-red-50 text-red-600',
  todo: 'bg-blue-50 text-blue-600',
  in_progress: 'bg-amber-50 text-amber-600',
  in_review: 'bg-purple-50 text-purple-600',
  done: 'bg-emerald-50 text-emerald-600',
};

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const isHR = user?.role === 'hr';
  const canSell = user?.can_sell;
  const isManager = user?.role === 'manager' || user?.role === 'admin' || user?.role === 'ops';
  const isAdmin = user?.role === 'admin';
  const isSales = user?.role === 'sales' || (isHR && canSell);
  const showHRPanel = isHR && !canSell;

  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
  const [monthOptions, setMonthOptions] = useState([]);
  const [summary, setSummary] = useState(null);
  const [team, setTeam] = useState([]);
  const [trends, setTrends] = useState([]);
  const [sources, setSources] = useState([]);
  const [recent, setRecent] = useState([]);
  const [pendingList, setPendingList] = useState([]);
  const [pendingLoading, setPendingLoading] = useState(false);
  const [showPending, setShowPending] = useState(false);

  const [targets, setTargets] = useState([]);
  const [myTarget, setMyTarget] = useState(null);
  const [editingTarget, setEditingTarget] = useState(false);
  const [targetInput, setTargetInput] = useState('');

  const [hrData, setHrData] = useState(null);

  useEffect(() => {
    setSelectedMonth(new Date().toISOString().slice(0, 7));
    const months = [];
    for (let i = 0; i < 12; i++) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      months.push(d.toISOString().slice(0, 7));
    }
    setMonthOptions(months);
  }, []);

  useEffect(() => {
    const onFocus = () => {
      const cm = new Date().toISOString().slice(0, 7);
      setSelectedMonth((m) => (m !== cm ? cm : m));
    };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onFocus);
    return () => {
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onFocus);
    };
  }, []);

  useEffect(() => { load(); }, [selectedMonth]);

  async function load() {
    setLoading(true);
    try {
      if (showHRPanel) {
        const ov = await api.dashboard.hrOverview();
        setHrData(ov);
        setLoading(false);
        return;
      }

      const now = new Date(selectedMonth + '-01');
      const m = now.getMonth() + 1;
      const y = now.getFullYear();

      const promises = [
        api.dashboard.summary({ month: selectedMonth }),
        isManager ? api.dashboard.team({ month: selectedMonth }) : Promise.resolve([]),
        api.dashboard.trends(),
        isManager ? api.dashboard.sourceAnalytics() : Promise.resolve([]),
        isSales ? api.enrollments.list({}) : Promise.resolve([]),
        api.targets.list({ month: m, year: y }),
      ];
      if (isHR && canSell) promises.push(api.dashboard.hrOverview());
      const [s, t, tr, src, rec, tgt, hrOv] = await Promise.all(promises);
      setSummary(s);
      setTeam(t);
      setTrends(tr.reverse());
      setSources(src);
      setRecent(rec);
      setTargets(tgt);
      if (hrOv) setHrData(hrOv);
      if (isSales) {
        const mine = tgt.find((t) => t.user_id === user.id);
        setMyTarget(mine || null);
      }
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }

  async function saveTarget() {
    const amount = parseFloat(targetInput);
    if (!amount || amount <= 0) return;
    try {
      const now = new Date(selectedMonth + '-01');
      await api.targets.set({ month: now.getMonth() + 1, year: now.getFullYear(), target_amount: amount });
      setEditingTarget(false);
      load();
    } catch (e) { alert(e.message); }
  }

  const rankEmojis = ['🥇', '🥈', '🥉'];
  const now = new Date(selectedMonth + '-01');
  const currentMonthLabel = MONTH_LABELS[now.getMonth()] + ' ' + now.getFullYear();

  async function openPendingCollections() {
    setShowPending(true);
    setPendingLoading(true);
    try { setPendingList(await api.dashboard.pendingCollections({ month: selectedMonth })); }
    catch (e) { setPendingList([]); }
    finally { setPendingLoading(false); }
  }

  const SkeletonCard = () => <div className="h-28 skeleton w-full" />;

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-64 skeleton" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
          {[1,2,3,4].map(i => <SkeletonCard key={i} />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="h-80 skeleton" />
          <div className="h-80 skeleton" />
        </div>
      </div>
    );
  }

  if (showHRPanel && hrData) return <HRDashboard hrData={hrData} user={user} />;

  const totalNominations = isSales
    ? (summary?.total_enrollments || 0)
    : (summary?.month_total_enrollments || 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            {isManager ? 'Team performance at a glance' : 'Your performance overview'} · {currentMonthLabel}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Filter size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <select className="input-field pl-8 text-sm w-44" value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}>
              {monthOptions.map((m) => {
                const d = new Date(m + '-01');
                return <option key={m} value={m}>{MONTH_LABELS[d.getMonth()]} {d.getFullYear()}</option>;
              })}
            </select>
          </div>
          <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-2xl border border-gray-100 shadow-sm">
            <div className="w-8 h-8 bg-primary-500 rounded-xl flex items-center justify-center text-white text-sm font-bold">
              {user?.name?.charAt(0).toUpperCase()}
            </div>
            <span className="text-sm font-medium text-gray-700">{user?.name}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
        <GradientStatsCard icon={DollarSign} label="Payment Received" value={fmtINR(summary?.total_revenue || 0)} color="primary" />
        <GradientStatsCard icon={Clock} label="Pending Collection" value={fmtINR(summary?.total_pending || 0)} color="amber" onClick={openPendingCollections} />
        <GradientStatsCard icon={Users} label="Payment Pending Candidates" value={summary?.active_enrollments || 0} color="emerald" onClick={openPendingCollections} />
        {isManager ? (
          isAdmin ? (
            <GradientStatsCard icon={TrendingUp} label="Total Nominations (This Month)" value={summary?.month_total_enrollments || 0} color="blue" />
          ) : (
            <GradientStatsCard icon={AlertCircle} label="Approval Needed" value={summary?.pending_approvals || 0} color="red" />
          )
        ) : (
          <GradientStatsCard icon={TrendingUp} label="Total Nominations" value={summary?.total_enrollments || 0} color="blue" />
        )}
      </div>

      {isSales && (
        <Card>
          <CardBody className="p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Target size={18} className="text-primary-600" />
                <h3 className="font-semibold text-gray-900">Monthly Target</h3>
              </div>
              <button onClick={() => { setEditingTarget(true); setTargetInput(myTarget?.target_amount || ''); }}
                className="flex items-center gap-1.5 text-xs font-medium text-primary-600 hover:text-primary-700 px-3 py-1.5 rounded-lg hover:bg-primary-50 transition-colors">
                <Edit3 size={13} /> {myTarget ? 'Edit' : 'Set Target'}
              </button>
            </div>
            {myTarget ? (
              <div>
                <div className="flex items-end justify-between mb-2">
                  <div>
                    <p className="text-sm text-gray-500">Nominations</p>
                    <p className="text-2xl font-bold text-gray-900">{totalNominations} <span className="text-sm font-normal text-gray-400">/ {myTarget.target_amount}</span></p>
                  </div>
                  <p className="text-lg font-bold text-primary-600">{Math.min(100, Math.round((totalNominations / myTarget.target_amount) * 100))}%</p>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-3">
                  <div className="h-3 rounded-full transition-all duration-500"
                    style={{
                      width: `${Math.min(100, (totalNominations / myTarget.target_amount) * 100)}%`,
                      backgroundColor: totalNominations >= myTarget.target_amount ? '#10B981' : '#003B7A',
                    }} />
                </div>
                <p className="text-xs text-gray-400 mt-2">
                  {totalNominations >= myTarget.target_amount ? '🎉 Target achieved!' : `${myTarget.target_amount - totalNominations} more to go`}
                </p>
              </div>
            ) : (
              <p className="text-sm text-gray-400 text-center py-4">No target set for this month. Click "Set Target" to add one.</p>
            )}
          </CardBody>
        </Card>
      )}

      {isManager && targets.length > 0 && (
        <Card>
          <CardHeader>
            <h3 className="font-semibold text-gray-900">Team Targets — {currentMonthLabel}</h3>
          </CardHeader>
          <CardBody className="p-0">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-5">
              {targets.map((t) => {
                const teamMember = team.find((p) => p.id === t.user_id);
                const achieved = teamMember ? teamMember.deals_closed : 0;
                const pct = Math.min(100, Math.round((achieved / t.target_amount) * 100));
                return (
                  <div key={t.id} className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-8 h-8 bg-primary-100 rounded-lg flex items-center justify-center text-primary-700 text-xs font-bold shrink-0">
                        {t.user_name?.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-gray-900 truncate">{t.user_name}</p>
                      </div>
                      {pct >= 100 && <span className="text-xs ml-auto">🎉</span>}
                    </div>
                    <div className="flex items-end justify-between mb-1.5">
                      <p className="text-lg font-bold text-gray-900">{achieved} <span className="text-xs font-normal text-gray-400">/ {t.target_amount}</span></p>
                      <p className={`text-xs font-bold ${pct >= 100 ? 'text-emerald-600' : 'text-primary-600'}`}>{pct}%</p>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div className="h-2 rounded-full transition-all duration-500"
                        style={{
                          width: `${pct}%`,
                          backgroundColor: pct >= 100 ? '#10B981' : '#003B7A',
                        }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </CardBody>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <h3 className="font-semibold text-gray-900">Revenue Trend (Monthly)</h3>
          </CardHeader>
          <CardBody>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trends}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="month" tickFormatter={(v) => { if (!v) return ''; const d = new Date(v); return MONTH_LABELS[d.getMonth()]; }} fontSize={12} />
                  <YAxis fontSize={12} tickFormatter={(v) => fmtINR(v)} />
                  <Tooltip formatter={(v) => [fmtINR(v), 'Revenue']} labelFormatter={(l) => { if (!l) return ''; const d = new Date(l); return MONTH_LABELS[d.getMonth()] + ' ' + d.getFullYear(); }} />
                  <Line type="monotone" dataKey="revenue" stroke="#003B7A" strokeWidth={2.5} dot={{ r: 4, fill: '#003B7A' }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardBody>
        </Card>

        {isManager && (
          <Card>
            <CardHeader>
              <h3 className="font-semibold text-gray-900">Sales Leaderboard</h3>
            </CardHeader>
            <CardBody>
              <div className="space-y-2">
                {team.map((person, i) => (
                  <div key={person.id}
                    onClick={() => navigate(`/salesperson/${person.id}`)}
                    className="flex items-center gap-4 p-3 rounded-xl hover:bg-gray-50 transition-colors cursor-pointer group">
                    <div className="w-8 h-8 flex items-center justify-center text-lg shrink-0">
                      {rankEmojis[i] || `#${i + 1}`}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate group-hover:text-primary-600 transition-colors">{person.name}</p>
                      <p className="text-xs text-gray-400">{person.deals_closed} {person.deals_closed === 1 ? 'nomination' : 'nominations'}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-bold text-gray-900">{person.deals_closed}</p>
                      <p className="text-xs text-gray-400">{person.deals_closed === 1 ? 'deal' : 'deals'}</p>
                    </div>
                    <ChevronRight size={16} className="text-gray-300 group-hover:text-primary-500 transition-colors shrink-0" />
                  </div>
                ))}
                {!team.length && <p className="text-center text-gray-400 py-8 text-sm">No team data for this period</p>}
              </div>
            </CardBody>
          </Card>
        )}

        {isSales && (
          <Card>
            <CardHeader>
              <h3 className="font-semibold text-gray-900">My Recent Enrollments</h3>
            </CardHeader>
            <CardBody>
              {recent.length ? (
                <div className="space-y-2">
                  {recent.slice(0, 5).map((en) => (
                    <div key={en.id} className="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 transition-colors">
                      <div className="w-9 h-9 bg-primary-100 rounded-xl flex items-center justify-center text-primary-700 font-bold text-sm shrink-0">
                        {en.student_name?.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{en.student_name}</p>
                        <p className="text-xs text-gray-400 truncate">{en.course_name}{en.batch_name ? ` · ${en.batch_name}` : ''}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-semibold text-emerald-600">{fmtINR(en.paid_amount || 0)}</p>
                        <p className="text-xs text-amber-500">{fmtINR(en.pending_amount || 0)} pending</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-gray-400 py-8 text-sm">No enrollments yet.</p>
              )}
            </CardBody>
          </Card>
        )}
      </div>

      {isManager && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {sources.length > 0 && (
            <Card>
              <CardHeader><h3 className="font-semibold text-gray-900">Enrollment Sources</h3></CardHeader>
              <CardBody>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={sources} dataKey="enrollments" nameKey="source" cx="50%" cy="50%" outerRadius={80}
                        label={({ source, percent }) => `${source} ${(percent * 100).toFixed(0)}%`}>
                        {sources.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardBody>
            </Card>
          )}
          <Card>
            <CardHeader><h3 className="font-semibold text-gray-900">Team Performance</h3></CardHeader>
            <CardBody className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-50">
                      <th className="px-5 py-3.5 text-left font-medium text-gray-400 text-xs uppercase tracking-wider">Salesperson</th>
                      <th className="px-5 py-3.5 text-left font-medium text-gray-400 text-xs uppercase tracking-wider">Nominations</th>
                      <th className="px-5 py-3.5 text-left font-medium text-gray-400 text-xs uppercase tracking-wider">Revenue</th>
                      <th className="px-5 py-3.5 text-left font-medium text-gray-400 text-xs uppercase tracking-wider">Pending</th>
                    </tr>
                  </thead>
                  <tbody>
                    {team.map((person) => (
                      <tr key={person.id} onClick={() => navigate(`/salesperson/${person.id}`)} className="border-b border-gray-50 hover:bg-gray-50 transition-colors cursor-pointer">
                        <td className="px-5 py-3.5 font-medium text-gray-900 hover:text-primary-600 transition-colors">{person.name}</td>
                        <td className="px-5 py-3.5 text-gray-600">{person.deals_closed}</td>
                        <td className="px-5 py-3.5">{fmtINR(person.revenue)}</td>
                        <td className="px-5 py-3.5 text-amber-600 font-medium">{fmtINR(person.pending)}</td>
                      </tr>
                    ))}
                    {!team.length && <tr><td colSpan={4} className="px-5 py-8 text-center text-gray-400 text-sm">No data for this period</td></tr>}
                  </tbody>
                </table>
              </div>
            </CardBody>
          </Card>
        </div>
      )}

      <Modal open={showPending} onClose={() => setShowPending(false)} title={`Pending Collections · ${currentMonthLabel}`} size="xl">
        {pendingLoading ? (
          <div className="space-y-3">{[1,2,3].map((i) => <div key={i} className="h-14 skeleton w-full" />)}</div>
        ) : pendingList.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-14 h-14 bg-emerald-50 rounded-2xl flex items-center justify-center mx-auto mb-3">
              <CheckCircle size={28} className="text-emerald-400" />
            </div>
            <h3 className="text-sm font-medium text-gray-500 mb-1">No pending collections</h3>
            <p className="text-xs text-gray-400">All enrollments are fully paid up.</p>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-gray-500">
              {pendingList.length} enrollment{pendingList.length !== 1 ? 's' : ''} with pending balance of{' '}
              <strong className="text-amber-600">{fmtINR(pendingList.reduce((s, r) => s + Number(r.pending_amount || 0), 0))}</strong>
            </p>
            <div className="overflow-x-auto -mx-1 px-1">
              <table className="w-full text-sm min-w-[560px]">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left px-3 py-2.5 text-[11px] font-semibold text-gray-400 uppercase tracking-wider whitespace-nowrap">Candidate</th>
                    <th className="text-left px-3 py-2.5 text-[11px] font-semibold text-gray-400 uppercase tracking-wider whitespace-nowrap">Contact</th>
                    <th className="text-left px-3 py-2.5 text-[11px] font-semibold text-gray-400 uppercase tracking-wider whitespace-nowrap">Course</th>
                    <th className="text-left px-3 py-2.5 text-[11px] font-semibold text-gray-400 uppercase tracking-wider whitespace-nowrap">Salesperson</th>
                    <th className="text-right px-3 py-2.5 text-[11px] font-semibold text-gray-400 uppercase tracking-wider whitespace-nowrap">Total</th>
                    <th className="text-right px-3 py-2.5 text-[11px] font-semibold text-gray-400 uppercase tracking-wider whitespace-nowrap">Paid</th>
                    <th className="text-right px-3 py-2.5 text-[11px] font-semibold text-gray-400 uppercase tracking-wider whitespace-nowrap">Pending</th>
                  </tr>
                </thead>
                <tbody>
                  {pendingList.map((r) => (
                    <tr key={r.enrollment_id} className="border-b border-gray-50 hover:bg-gray-50/60 transition-colors">
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 bg-primary-100 rounded-lg flex items-center justify-center text-primary-700 font-bold text-xs shrink-0">
                            {(r.student_name || '?').charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium text-gray-900 truncate">{r.student_name}</p>
                            {r.student_city && <p className="text-xs text-gray-400 truncate">{r.student_city}</p>}
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <p className="text-gray-700">{r.student_phone || '-'}</p>
                        {r.student_email && <p className="text-xs text-gray-400 truncate max-w-[160px]">{r.student_email}</p>}
                      </td>
                      <td className="px-3 py-3 text-gray-700">
                        <p className="truncate max-w-[180px]">{r.course_name}</p>
                        {r.batch_name && <p className="text-xs text-gray-400 truncate">Batch: {r.batch_name}</p>}
                      </td>
                      <td className="px-3 py-3 text-gray-700 whitespace-nowrap">{r.salesperson_name || '-'}</td>
                      <td className="px-3 py-3 text-right whitespace-nowrap">{fmtINR(r.total_amount)}</td>
                      <td className="px-3 py-3 text-right text-emerald-600 font-medium whitespace-nowrap">{fmtINR(r.paid_amount)}</td>
                      <td className="px-3 py-3 text-right text-amber-600 font-bold whitespace-nowrap">{fmtINR(r.pending_amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </Modal>

      <Modal open={editingTarget} onClose={() => setEditingTarget(false)} title="Set Monthly Target" size="sm">
        <div className="space-y-4">
          <p className="text-sm text-gray-500">Set your nomination target for {currentMonthLabel}</p>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Number of Nominations</label>
            <input type="number" min="1" className="input-field" placeholder="e.g. 20"
              value={targetInput} onChange={(e) => setTargetInput(e.target.value)} autoFocus />
          </div>
          <div className="flex justify-end gap-3 pt-2 border-t">
            <button onClick={() => setEditingTarget(false)} className="btn-secondary">Cancel</button>
            <button onClick={saveTarget} className="btn-primary px-6" disabled={!targetInput || parseFloat(targetInput) <= 0}>Save Target</button>
          </div>
        </div>
      </Modal>

      {isHR && canSell && hrData && (
        <div className="space-y-6">
          <div className="border-t pt-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4">Team Overview</h2>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
              <GradientStatsCard icon={Users} label="Total Team" value={hrData.team?.length || 0} color="primary" />
              <GradientStatsCard icon={ListChecks} label="Open Tasks" value={(hrData.tasks?.find(t => t.status === 'todo') ? parseInt(hrData.tasks.find(t => t.status === 'todo').count) : 0) + (hrData.tasks?.find(t => t.status === 'in_progress') ? parseInt(hrData.tasks.find(t => t.status === 'in_progress').count) : 0)} color="blue" />
              <GradientStatsCard icon={Target} label="Completed Tasks" value={hrData.tasks?.find(t => t.status === 'done') ? parseInt(hrData.tasks.find(t => t.status === 'done').count) : 0} color="emerald" />
              <GradientStatsCard icon={FileText} label="Total Enrollments" value={hrData.enrollments?.total || 0} color="amber" />
            </div>
          </div>
          <Card>
            <CardHeader><h3 className="font-semibold text-gray-900">Team Roster</h3></CardHeader>
            <CardBody className="p-0">
              <div className="max-h-64 overflow-y-auto">
                {hrData.team?.map((m) => (
                  <div key={m.id} className="flex items-center gap-3 px-5 py-3 border-b border-gray-50 last:border-0 hover:bg-gray-50 transition-colors">
                    <div className="w-8 h-8 bg-primary-100 rounded-lg flex items-center justify-center text-primary-700 text-xs font-bold shrink-0">
                      {m.name?.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{m.name}</p>
                      <p className="text-xs text-gray-400">{m.email}</p>
                    </div>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider ${
                      m.status === 'active' ? 'bg-emerald-50 text-emerald-600' : m.status === 'on_leave' ? 'bg-amber-50 text-amber-600' : 'bg-gray-100 text-gray-500'
                    }`}>{m.status}</span>
                    <span className="text-xs text-gray-400 capitalize">{m.role}</span>
                  </div>
                ))}
              </div>
            </CardBody>
          </Card>
        </div>
      )}
    </div>
  );
}

function HRDashboard({ hrData, user }) {
  const navigate = useNavigate();
  const { team, tasks, enrollments, recentActivity } = hrData;
  const taskMap = {};
  tasks.forEach((t) => { taskMap[t.status] = parseInt(t.count); });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">HR Dashboard</h1>
          <p className="text-sm text-gray-400 mt-0.5">Welcome back, {user?.name}</p>
        </div>
        <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-2xl border border-gray-100 shadow-sm">
          <div className="w-8 h-8 bg-primary-500 rounded-xl flex items-center justify-center text-white text-sm font-bold">
            {user?.name?.charAt(0).toUpperCase()}
          </div>
          <span className="text-sm font-medium text-gray-700">{user?.name}</span>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
        <GradientStatsCard icon={Users} label="Total Team Members" value={team.length} color="primary" />
        <GradientStatsCard icon={ListChecks} label="Open Tasks" value={(taskMap.todo || 0) + (taskMap.in_progress || 0)} color="blue" />
        <GradientStatsCard icon={Target} label="Tasks Completed" value={taskMap.done || 0} color="emerald" />
        <GradientStatsCard icon={FileText} label="Total Enrollments" value={enrollments?.total || 0} color="amber" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader><h3 className="font-semibold text-gray-900">Task Board Overview</h3></CardHeader>
          <CardBody>
            <div className="space-y-3">
              {['backlog', 'todo', 'in_progress', 'in_review', 'done'].map((s) => (
                <div key={s} className="flex items-center gap-3">
                  <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium min-w-[90px] ${STATUS_COLORS[s]}`}>
                    {s.replace('_', ' ')}
                  </span>
                  <div className="flex-1 bg-gray-100 rounded-full h-2">
                    <div className="h-2 rounded-full bg-primary-500 transition-all"
                      style={{ width: `${tasks.length ? Math.round(((taskMap[s] || 0) / Math.max(...tasks.map((t) => parseInt(t.count)), 1)) * 100) : 0}%` }} />
                  </div>
                  <span className="text-sm font-semibold text-gray-900 w-6 text-right">{taskMap[s] || 0}</span>
                </div>
              ))}
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader><h3 className="font-semibold text-gray-900">Team Roster</h3></CardHeader>
          <CardBody className="p-0">
            <div className="max-h-80 overflow-y-auto">
              {team.map((m) => (
                <div key={m.id} className="flex items-center gap-3 px-5 py-3 border-b border-gray-50 last:border-0 hover:bg-gray-50 transition-colors">
                  <div className="w-8 h-8 bg-primary-100 rounded-lg flex items-center justify-center text-primary-700 text-xs font-bold shrink-0">
                    {m.name?.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{m.name}</p>
                    <p className="text-xs text-gray-400 truncate">{m.email}</p>
                  </div>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider ${
                    m.status === 'active' ? 'bg-emerald-50 text-emerald-600' : m.status === 'on_leave' ? 'bg-amber-50 text-amber-600' : 'bg-gray-100 text-gray-500'
                  }`}>
                    {m.status}
                  </span>
                  <span className="text-xs text-gray-400 capitalize">{m.role}</span>
                </div>
              ))}
            </div>
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader><h3 className="font-semibold text-gray-900">Recent Activity</h3></CardHeader>
        <CardBody className="p-0">
          <div className="max-h-72 overflow-y-auto">
            {recentActivity.length ? recentActivity.map((a) => (
              <div key={a.id} className="flex items-start gap-3 px-5 py-3 border-b border-gray-50 last:border-0">
                <div className="w-7 h-7 bg-gray-100 rounded-lg flex items-center justify-center text-gray-500 text-xs shrink-0 mt-0.5">
                  {a.user_name?.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-700">
                    <span className="font-medium text-gray-900">{a.user_name || 'System'}</span>{' '}
                    {a.details}
                  </p>
                  <p className="text-[10px] text-gray-400 mt-0.5">{timeAgo(a.created_at)}</p>
                </div>
              </div>
            )) : <p className="text-center text-gray-400 py-8 text-sm">No recent activity</p>}
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
