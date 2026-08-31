import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Banknote, Users, Clock, TrendingUp, AlertCircle, Phone, Mail, ExternalLink, BookOpen, LayoutGrid, BadgePercent, CalendarDays } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, PieChart, Pie, Legend } from 'recharts';
import { api } from '../services/api';
import { useToast } from '../context/ToastContext';
import { Card, CardHeader, CardBody } from '../components/ui/Card';
import Table from '../components/ui/Table';
import Badge from '../components/ui/Badge';

const ENROLL_STATUS = {
  waiting_approval: 'Approval Pending',
  active: 'Payment Pending',
  completed: 'Completed',
};

const CATEGORY_COLORS = ['#003B7A', '#FFC300', '#10B981', '#EC4899', '#F59E0B', '#6366F1'];

export default function SalespersonDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const [profile, setProfile] = useState(null);
  const [enrollments, setEnrollments] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
  const [monthOptions, setMonthOptions] = useState(() => {
    const months = [];
    for (let i = 0; i < 14; i++) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      months.push({ value: d.toISOString().slice(0, 7), label: d.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }) });
    }
    return months;
  });

  useEffect(() => { load(); }, [id, selectedMonth]);

  async function load() {
    try {
      const [profileData, enrollmentsData, analyticsData] = await Promise.all([
        api.users.getProfile(id),
        api.enrollments.list({ sales_user_id: id, month: selectedMonth }),
        api.users.analytics(id, { month: selectedMonth }),
      ]);
      setProfile(profileData);
      setEnrollments(enrollmentsData);
      setAnalytics(analyticsData);
    } catch (e) {
      toast.error('Failed to load salesperson data');
      navigate('/reports');
    } finally {
      setLoading(false);
    }
  }

  const an = analytics || {};
  const collected = Number(an.month_collected ?? profile?.collected ?? 0);
  const totalBusiness = Number(an.month_business ?? profile?.total_business ?? 0);
  const pending = Number(profile?.pending ?? 0);

  const pieData = (an.byCategory || []).map((c) => ({ name: c.category, value: Number(c.enrollments) }));
  const collectedPie = (an.collectedByCategory || []).map((c) => ({ name: c.category, value: Number(c.collected) }));
  const monthlyTrend = (an.monthly || []).map((m) => ({
    name: new Date(m.month + '-01').toLocaleDateString('en-IN', { month: 'short' }),
    amount: Number(m.total_amount),
  })).reverse();

  const enrollColumns = [
    {
      key: 'student_name', label: 'Student',
      render: (r) => (
        <div>
          <p className="font-medium text-gray-900">{r.student_name}</p>
          <p className="text-xs text-gray-400">{r.course_name}</p>
        </div>
      ),
    },
    {
      key: 'student_phone', label: 'Contact',
      render: (r) => (
        <div>
          <p className="flex items-center gap-1 text-gray-700"><Phone size={12} className="text-gray-400" /> {r.student_phone || '-'}</p>
          <p className="flex items-center gap-1 text-xs text-gray-400"><Mail size={12} className="text-gray-400" /> {r.student_email || ''}</p>
        </div>
      ),
    },
    { key: 'category', label: 'Category', render: (r) => r.category || '-' },
    { key: 'total_amount', label: 'Total', render: (r) => `₹${Number(r.total_amount).toLocaleString()}` },
    { key: 'paid_amount', label: 'Received', render: (r) => <span className="text-emerald-600 font-medium">₹{Number(r.paid_amount || 0).toLocaleString()}</span> },
    { key: 'pending_amount', label: 'Pending', render: (r) => <span className="text-amber-600 font-medium">₹{Number(r.pending_amount || 0).toLocaleString()}</span> },
    {
      key: 'telecrm_link', label: 'TeleCRM',
      render: (r) => r.telecrm_link ? (
        <a href={r.telecrm_link} target="_blank" rel="noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="inline-flex items-center gap-1 text-primary-600 hover:underline text-xs">
          <BookOpen size={13} /> Open
        </a>
      ) : '-',
    },
    { key: 'status', label: 'Status', render: (r) => <Badge status={r.status}>{ENROLL_STATUS[r.status] || r.status}</Badge> },
    {
      key: 'created_at', label: 'Date',
      render: (r) => new Date(r.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
    },
  ];

  if (loading) {
    return (
      <div className="space-y-5">
        <div className="h-8 w-48 skeleton" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">{[1,2,3,4].map(i => <div key={i} className="h-24 skeleton" />)}</div>
        <div className="h-64 skeleton" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button onClick={() => navigate(-1)} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors">
          <ArrowLeft size={15} /> Back
        </button>
        <select className="input-field w-52" value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)}>
          {monthOptions.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
        </select>
      </div>

      <div className="flex items-center gap-4">
        <div className="w-14 h-14 bg-primary-500 rounded-2xl flex items-center justify-center text-white text-xl font-bold">
          {profile?.name?.charAt(0).toUpperCase()}
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{profile?.name}</h1>
          <p className="text-sm text-gray-500">{profile?.email}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
        <Card><CardBody>
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-100 rounded-xl shrink-0"><TrendingUp size={20} className="text-indigo-600" /></div>
            <div className="min-w-0 flex-1">
              <p className="text-xs text-gray-400 uppercase tracking-wider">Month Business</p>
              <p className="text-base sm:text-xl font-bold text-gray-900 break-words">₹{(totalBusiness || 0).toLocaleString()}</p>
            </div>
          </div>
        </CardBody></Card>
        <Card><CardBody>
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-100 rounded-xl shrink-0"><Banknote size={20} className="text-emerald-600" /></div>
            <div className="min-w-0 flex-1">
              <p className="text-xs text-gray-400 uppercase tracking-wider">Month Received</p>
              <p className="text-base sm:text-xl font-bold text-emerald-600 break-words">₹{(collected || 0).toLocaleString()}</p>
            </div>
          </div>
        </CardBody></Card>
        <Card><CardBody>
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-100 rounded-xl shrink-0"><Users size={20} className="text-blue-600" /></div>
            <div className="min-w-0 flex-1">
              <p className="text-xs text-gray-400 uppercase tracking-wider">Month Nominations</p>
              <p className="text-base sm:text-xl font-bold text-gray-900 break-words">{an.month_enrollments ?? enrollments.length}</p>
            </div>
          </div>
        </CardBody></Card>
        <Card><CardBody>
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-amber-100 rounded-xl shrink-0"><Clock size={20} className="text-amber-600" /></div>
            <div className="min-w-0 flex-1">
              <p className="text-xs text-gray-400 uppercase tracking-wider">Approval Needed</p>
              <p className="text-base sm:text-xl font-bold text-gray-900 break-words">{an.month_pending_approvals ?? 0}</p>
            </div>
          </div>
        </CardBody></Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Card>
          <CardHeader>
            <h3 className="font-semibold text-gray-900 flex items-center gap-2"><LayoutGrid size={15} /> Nominations by Category</h3>
          </CardHeader>
          <CardBody>
            {pieData.length ? (
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={85} label>
                    {pieData.map((_, i) => <Cell key={i} fill={CATEGORY_COLORS[i % CATEGORY_COLORS.length]} />)}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : <p className="text-sm text-gray-400 text-center py-12">No nominations this month</p>}
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <h3 className="font-semibold text-gray-900 flex items-center gap-2"><BadgePercent size={15} /> Collections by Category</h3>
          </CardHeader>
          <CardBody>
            {collectedPie.length ? (
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie data={collectedPie} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={85} labelFormatter={(_, e) => `₹${Number(collectedPie[e.index]?.value || 0).toLocaleString()}`}>
                    {collectedPie.map((_, i) => <Cell key={i} fill={CATEGORY_COLORS[i % CATEGORY_COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v) => [`₹${Number(v).toLocaleString()}`, 'Collected']} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : <p className="text-sm text-gray-400 text-center py-12">No collections this month</p>}
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <h3 className="font-semibold text-gray-900 flex items-center gap-2"><CalendarDays size={15} /> Monthly Business Trend</h3>
        </CardHeader>
        <CardBody>
          {monthlyTrend.length ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={monthlyTrend}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" fontSize={12} />
                <YAxis fontSize={12} tickFormatter={(v) => `₹${(v/1000).toFixed(0)}k`} />
                <Tooltip formatter={(v) => [`₹${Number(v).toLocaleString()}`, 'Business']} />
                <Bar dataKey="amount" fill="#003B7A" radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : <p className="text-sm text-gray-400 text-center py-12">No data yet</p>}
        </CardBody>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Card>
          <CardHeader>
            <h3 className="font-semibold text-gray-900">Nominations by Source</h3>
          </CardHeader>
          <CardBody className="p-0">
            {(an.bySource || []).length ? (
              <div className="divide-y divide-gray-50">
                {(an.bySource || []).map((s, i) => (
                  <div key={s.source} className="flex items-center justify-between px-5 py-3 text-sm">
                    <span className="text-gray-700">{s.source}</span>
                    <span className="font-semibold text-gray-900">{s.enrollments} <span className="text-gray-400 font-normal">· ₹{Number(s.total_amount).toLocaleString()}</span></span>
                  </div>
                ))}
              </div>
            ) : <p className="text-sm text-gray-400 text-center py-8">No sources this month</p>}
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <h3 className="font-semibold text-gray-900">Category Breakdown</h3>
          </CardHeader>
          <CardBody className="p-0">
            {(an.byCategory || []).length ? (
              <div className="divide-y divide-gray-50">
                {(an.byCategory || []).map((c) => (
                  <div key={c.category} className="px-5 py-3 text-sm">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium text-gray-900">{c.category}</span>
                      <span className="font-semibold text-gray-900">{c.enrollments} enrollments</span>
                    </div>
                    <div className="flex justify-between text-xs text-gray-400">
                      <span>Fee: <b className="text-gray-700">₹{Number(c.total_amount).toLocaleString()}</b></span>
                      <span className="text-amber-600">Pending: ₹{Number(c.pending_amount).toLocaleString()}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : <p className="text-sm text-gray-400 text-center py-8">No category data this month</p>}
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <h3 className="font-semibold text-gray-900">All Nominations ({enrollments.length})</h3>
        </CardHeader>
        <CardBody className="p-0">
          <Table columns={enrollColumns} data={enrollments} onRowClick={(r) => navigate(`/enrollments/${r.id}`)} />
          {!enrollments.length && (
            <div className="text-center py-12 text-sm text-gray-400">No nominations yet</div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
