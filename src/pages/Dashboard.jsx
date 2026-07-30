import { useState, useEffect } from 'react';
import { DollarSign, Users, Clock, TrendingUp, AlertCircle, Medal } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from 'recharts';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import StatsCard, { GradientStatsCard } from '../components/ui/StatsCard';
import { Card, CardHeader, CardBody } from '../components/ui/Card';

const COLORS = ['#003B7A', '#FFC300', '#10B981', '#F59E0B', '#6366F1', '#EC4899', '#84CC16'];

export default function Dashboard() {
  const { user } = useAuth();
  const [summary, setSummary] = useState(null);
  const [team, setTeam] = useState([]);
  const [trends, setTrends] = useState([]);
  const [sources, setSources] = useState([]);
  const [loading, setLoading] = useState(true);
  const isManager = user?.role === 'manager' || user?.role === 'admin';

  useEffect(() => {
    Promise.all([
      api.dashboard.summary(),
      isManager ? api.dashboard.team() : Promise.resolve([]),
      api.dashboard.trends(),
      isManager ? api.dashboard.sourceAnalytics() : Promise.resolve([]),
    ])
      .then(([s, t, tr, src]) => {
        setSummary(s);
        setTeam(t);
        setTrends(tr.reverse());
        setSources(src);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
      </div>
    );
  }

  const rankEmojis = ['🥇', '🥈', '🥉'];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            {isManager ? 'Team performance at a glance' : 'Your performance overview'}
          </p>
        </div>
        <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-2xl border border-gray-100 shadow-sm">
          <div className="w-8 h-8 bg-primary-500 rounded-xl flex items-center justify-center text-white text-sm font-bold">
            {user?.name?.charAt(0).toUpperCase()}
          </div>
          <span className="text-sm font-medium text-gray-700">{user?.name}</span>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
        <GradientStatsCard icon={DollarSign} label="Total Revenue" value={`₹${(summary?.total_revenue || 0).toLocaleString()}`} color="primary" />
        <GradientStatsCard icon={Clock} label="Pending Collection" value={`₹${(summary?.total_pending || 0).toLocaleString()}`} color="amber" />
        <GradientStatsCard icon={Users} label="Active Enrollments" value={summary?.active_enrollments || 0} color="emerald" />
        {isManager ? (
          <GradientStatsCard icon={AlertCircle} label="Pending Approvals" value={summary?.pending_approvals || 0} color="red" />
        ) : (
          <GradientStatsCard icon={TrendingUp} label="Total Enrollments" value={summary?.total_enrollments || 0} color="blue" />
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <h3 className="font-semibold text-gray-900">Revenue Trend</h3>
          </CardHeader>
          <CardBody>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trends}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="month" tickFormatter={(v) => { if (!v) return ''; return new Date(v).toLocaleString('default', { month: 'short' }); }} fontSize={12} />
                  <YAxis fontSize={12} tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={(v) => [`₹${Number(v).toLocaleString()}`, 'Revenue']} labelFormatter={(l) => l ? new Date(l).toLocaleString('default', { month: 'long', year: 'numeric' }) : ''} />
                  <Line type="monotone" dataKey="revenue" stroke="#003B7A" strokeWidth={2.5} dot={{ r: 4, fill: '#003B7A' }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardBody>
        </Card>

        {isManager && (
          <Card>
            <CardHeader>
              <h3 className="font-semibold text-gray-900">Leaderboard</h3>
            </CardHeader>
            <CardBody>
              <div className="space-y-3">
                {team.map((person, i) => (
                  <div key={person.id} className="flex items-center gap-4 p-3 rounded-xl hover:bg-gray-50 transition-colors">
                    <div className="w-8 h-8 flex items-center justify-center text-lg">
                      {rankEmojis[i] || `#${i + 1}`}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{person.name}</p>
                      <div className="flex items-center gap-3 text-xs text-gray-400">
                        <span>{person.deals_closed} deals</span>
                        <span>₹{Number(person.revenue).toLocaleString()}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-gray-900">₹{Number(person.revenue).toLocaleString()}</p>
                      <p className="text-xs text-amber-500">₹{Number(person.pending).toLocaleString()} pending</p>
                    </div>
                  </div>
                ))}
                {!team.length && <p className="text-center text-gray-400 py-8">No team data yet</p>}
              </div>
            </CardBody>
          </Card>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {isManager && sources.length > 0 && (
          <Card>
            <CardHeader>
              <h3 className="font-semibold text-gray-900">Lead Sources</h3>
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
              <h3 className="font-semibold text-gray-900">Team Snapshot</h3>
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
                      <tr key={person.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                        <td className="px-5 py-3.5 font-medium text-gray-900">{person.name}</td>
                        <td className="px-5 py-3.5">₹{Number(person.revenue).toLocaleString()}</td>
                        <td className="px-5 py-3.5 text-gray-600">{person.deals_closed}</td>
                        <td className="px-5 py-3.5 text-amber-600 font-medium">₹{Number(person.pending).toLocaleString()}</td>
                      </tr>
                    ))}
                    {!team.length && <tr><td colSpan={4} className="px-5 py-8 text-center text-gray-400">No data</td></tr>}
                  </tbody>
                </table>
              </div>
            </CardBody>
          </Card>
        )}
      </div>
    </div>
  );
}
