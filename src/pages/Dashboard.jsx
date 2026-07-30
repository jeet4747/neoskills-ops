import { useState, useEffect } from 'react';
import { DollarSign, Users, Clock, TrendingUp, CheckCircle, AlertCircle } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from 'recharts';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import StatsCard from '../components/ui/StatsCard';
import { Card, CardHeader, CardBody } from '../components/ui/Card';
import Badge from '../components/ui/Badge';

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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold">Welcome, {user?.name}</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          {isManager ? 'Team Performance Overview' : 'Your Performance Overview'}
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard
          icon={DollarSign}
          label="Total Revenue"
          value={`₹${(summary?.total_revenue || 0).toLocaleString()}`}
          color="primary"
        />
        <StatsCard
          icon={Clock}
          label="Pending Collection"
          value={`₹${(summary?.total_pending || 0).toLocaleString()}`}
          color="amber"
        />
        <StatsCard
          icon={Users}
          label="Active Enrollments"
          value={summary?.active_enrollments || 0}
          color="emerald"
        />
        {isManager && (
          <StatsCard
            icon={AlertCircle}
            label="Pending Approvals"
            value={summary?.pending_approvals || 0}
            color="red"
          />
        )}
        {!isManager && (
          <StatsCard
            icon={TrendingUp}
            label="Total Enrollments"
            value={summary?.total_enrollments || 0}
            color="blue"
          />
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <h3 className="font-semibold">Monthly Revenue Trend</h3>
          </CardHeader>
          <CardBody>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trends}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis
                    dataKey="month"
                    tickFormatter={(v) => {
                      if (!v) return '';
                      const d = new Date(v);
                      return d.toLocaleString('default', { month: 'short', year: '2-digit' });
                    }}
                    fontSize={12}
                  />
                  <YAxis fontSize={12} tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
                  <Tooltip
                    formatter={(v) => [`₹${Number(v).toLocaleString()}`, undefined]}
                    labelFormatter={(l) => {
                      if (!l) return '';
                      return new Date(l).toLocaleString('default', { month: 'long', year: 'numeric' });
                    }}
                  />
                  <Line type="monotone" dataKey="revenue" stroke="#003B7A" strokeWidth={2} dot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardBody>
        </Card>

        {isManager && (
          <Card>
            <CardHeader>
              <h3 className="font-semibold">Salesperson Leaderboard</h3>
            </CardHeader>
            <CardBody>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={team} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis type="number" fontSize={12} tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
                    <YAxis type="category" dataKey="name" fontSize={12} width={100} />
                    <Tooltip formatter={(v) => [`₹${Number(v).toLocaleString()}`, 'Revenue']} />
                    <Bar dataKey="revenue" fill="#003B7A" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardBody>
          </Card>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {isManager && sources.length > 0 && (
          <Card>
            <CardHeader>
              <h3 className="font-semibold">Lead Sources</h3>
            </CardHeader>
            <CardBody>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={sources}
                      dataKey="enrollments"
                      nameKey="source"
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      label={({ source, percent }) => `${source} ${(percent * 100).toFixed(0)}%`}
                    >
                      {sources.map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
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
              <h3 className="font-semibold">Team Performance</h3>
            </CardHeader>
            <CardBody className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="px-4 py-3 text-left font-medium text-gray-500">Salesperson</th>
                      <th className="px-4 py-3 text-left font-medium text-gray-500">Revenue</th>
                      <th className="px-4 py-3 text-left font-medium text-gray-500">Deals</th>
                      <th className="px-4 py-3 text-left font-medium text-gray-500">Pending</th>
                    </tr>
                  </thead>
                  <tbody>
                    {team.map((person) => (
                      <tr key={person.id} className="border-b border-gray-50 hover:bg-gray-50">
                        <td className="px-4 py-3 font-medium">{person.name}</td>
                        <td className="px-4 py-3">₹{Number(person.revenue).toLocaleString()}</td>
                        <td className="px-4 py-3">{person.deals_closed}</td>
                        <td className="px-4 py-3 text-amber-600">₹{Number(person.pending).toLocaleString()}</td>
                      </tr>
                    ))}
                    {!team.length && (
                      <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-400">No team data</td></tr>
                    )}
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
