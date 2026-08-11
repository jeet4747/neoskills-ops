import { useState, useEffect } from 'react';
import { DollarSign, Users, Clock, TrendingUp, AlertCircle, Medal, Filter, CheckCircle } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from 'recharts';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import StatsCard, { GradientStatsCard } from '../components/ui/StatsCard';
import { Card, CardHeader, CardBody } from '../components/ui/Card';
import Modal from '../components/ui/Modal';

const COLORS = ['#003B7A', '#FFC300', '#10B981', '#F59E0B', '#6366F1', '#EC4899', '#84CC16'];

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export default function Dashboard() {
  const { user } = useAuth();
  const [summary, setSummary] = useState(null);
  const [team, setTeam] = useState([]);
  const [trends, setTrends] = useState([]);
  const [sources, setSources] = useState([]);
  const [recent, setRecent] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pendingList, setPendingList] = useState([]);
  const [pendingLoading, setPendingLoading] = useState(false);
  const [showPending, setShowPending] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
  const [monthOptions, setMonthOptions] = useState([]);
  const isManager = user?.role === 'manager' || user?.role === 'admin' || user?.role === 'ops';

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

  useEffect(() => { load(); }, [selectedMonth]);

  async function load() {
    setLoading(true);
    try {
      const [s, t, tr, src, rec] = await Promise.all([
        api.dashboard.summary({ month: selectedMonth }),
        isManager ? api.dashboard.team() : Promise.resolve([]),
        api.dashboard.trends(),
        isManager ? api.dashboard.sourceAnalytics() : Promise.resolve([]),
        isManager ? Promise.resolve([]) : api.enrollments.list({}),
      ]);
      setSummary(s);
      setTeam(t);
      setTrends(tr.reverse());
      setSources(src);
      setRecent(rec);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }

  const rankEmojis = ['🥇', '🥈', '🥉'];
  const now = new Date(selectedMonth + '-01');
  const currentMonthLabel = MONTH_LABELS[now.getMonth()] + ' ' + now.getFullYear();

  async function openPendingCollections() {
    setShowPending(true);
    setPendingLoading(true);
    try {
      const list = await api.dashboard.pendingCollections();
      setPendingList(list);
    } catch (e) {
      console.error(e);
      setPendingList([]);
    } finally {
      setPendingLoading(false);
    }
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
        <GradientStatsCard icon={DollarSign} label="Total Revenue" value={`₹${(summary?.total_revenue || 0).toLocaleString()}`} color="primary" />
        <GradientStatsCard icon={Clock} label="Pending Collection" value={`₹${(summary?.total_pending || 0).toLocaleString()}`} color="amber" onClick={openPendingCollections} />
        <GradientStatsCard icon={Users} label="Payment Pending Candidates" value={summary?.active_enrollments || 0} color="emerald" onClick={openPendingCollections} />
        {isManager ? (
          user?.role === 'admin' ? (
            <GradientStatsCard icon={TrendingUp} label="Total Nominations (This Month)" value={summary?.month_total_enrollments || 0} color="blue" />
          ) : (
            <GradientStatsCard icon={AlertCircle} label="Approval Needed" value={summary?.pending_approvals || 0} color="red" />
          )
        ) : (
          <GradientStatsCard icon={TrendingUp} label="Total Nominations" value={summary?.total_enrollments || 0} color="blue" />
        )}
      </div>

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
                  <YAxis fontSize={12} tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={(v) => [`₹${Number(v).toLocaleString()}`, 'Revenue']} labelFormatter={(l) => { if (!l) return ''; const d = new Date(l); return MONTH_LABELS[d.getMonth()] + ' ' + d.getFullYear(); }} />
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
                    className="flex items-center gap-4 p-3 rounded-xl hover:bg-gray-50 transition-colors cursor-pointer group">
                    <div className="w-8 h-8 flex items-center justify-center text-lg shrink-0">
                      {rankEmojis[i] || `#${i + 1}`}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate group-hover:text-primary-600 transition-colors">{person.name}</p>
                      <div className="flex items-center gap-3 text-xs text-gray-400">
                        <span>{person.deals_closed} deals</span>
                        <span>₹{Number(person.revenue).toLocaleString()}</span>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-bold text-gray-900">₹{Number(person.revenue).toLocaleString()}</p>
                      <p className="text-xs text-amber-500">₹{Number(person.pending).toLocaleString()} pending</p>
                    </div>
                  </div>
                ))}
                {!team.length && <p className="text-center text-gray-400 py-8 text-sm">No team data for this period</p>}
              </div>
            </CardBody>
          </Card>
        )}

        {!isManager && (
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
                        <p className="text-sm font-semibold text-emerald-600">₹{Number(en.paid_amount || 0).toLocaleString()}</p>
                        <p className="text-xs text-amber-500">₹{Number(en.pending_amount || 0).toLocaleString()} pending</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-gray-400 py-8 text-sm">No enrollments yet. Add your first enrollment from the Enrollments page.</p>
              )}
            </CardBody>
          </Card>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {isManager && sources.length > 0 && (
          <Card>
            <CardHeader>
              <h3 className="font-semibold text-gray-900">Enrollment Sources</h3>
            </CardHeader>
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

        {isManager && (
          <Card>
            <CardHeader>
              <h3 className="font-semibold text-gray-900">Team Performance</h3>
            </CardHeader>
            <CardBody className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-50">
                      <th className="px-5 py-3.5 text-left font-medium text-gray-400 text-xs uppercase tracking-wider">Salesperson</th>
                      <th className="px-5 py-3.5 text-left font-medium text-gray-400 text-xs uppercase tracking-wider">Revenue</th>
                      <th className="px-5 py-3.5 text-left font-medium text-gray-400 text-xs uppercase tracking-wider">Deals</th>
                      <th className="px-5 py-3.5 text-left font-medium text-gray-400 text-xs uppercase tracking-wider">Pending</th>
                    </tr>
                  </thead>
                  <tbody>
                    {team.map((person) => (
                      <tr key={person.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors cursor-pointer">
                        <td className="px-5 py-3.5 font-medium text-gray-900">{person.name}</td>
                        <td className="px-5 py-3.5">₹{Number(person.revenue).toLocaleString()}</td>
                        <td className="px-5 py-3.5 text-gray-600">{person.deals_closed}</td>
                        <td className="px-5 py-3.5 text-amber-600 font-medium">₹{Number(person.pending).toLocaleString()}</td>
                      </tr>
                    ))}
                    {!team.length && <tr><td colSpan={4} className="px-5 py-8 text-center text-gray-400 text-sm">No data for this period</td></tr>}
                  </tbody>
                </table>
              </div>
            </CardBody>
          </Card>
        )}
      </div>

      <Modal open={showPending} onClose={() => setShowPending(false)} title="Pending Collections" size="xl">
        {pendingLoading ? (
          <div className="space-y-3">
            {[1,2,3].map((i) => <div key={i} className="h-14 skeleton w-full" />)}
          </div>
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
              <strong className="text-amber-600">₹{pendingList.reduce((s, r) => s + Number(r.pending_amount || 0), 0).toLocaleString()}</strong>
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
                      <td className="px-3 py-3 text-right whitespace-nowrap">₹{Number(r.total_amount).toLocaleString()}</td>
                      <td className="px-3 py-3 text-right text-emerald-600 font-medium whitespace-nowrap">₹{Number(r.paid_amount).toLocaleString()}</td>
                      <td className="px-3 py-3 text-right text-amber-600 font-bold whitespace-nowrap">₹{Number(r.pending_amount).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
