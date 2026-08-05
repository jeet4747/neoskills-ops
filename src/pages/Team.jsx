import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Users as UsersIcon, Shield, DollarSign, Clock, UserPlus, TrendingUp, Medal, AlertCircle } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { api } from '../services/api';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import { Card, CardHeader, CardBody } from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import Modal from '../components/ui/Modal';

const ROLE_META = {
  admin: { label: 'Admin', icon: Shield },
  manager: { label: 'Manager' },
  sales: { label: 'Sales Rep' },
  ops: { label: 'Operations' },
};

const STATUS_OPTIONS = [
  { value: 'active', label: 'Active' },
  { value: 'on_leave', label: 'On Leave' },
  { value: 'inactive', label: 'Inactive' },
  { value: 'pending', label: 'Pending' },
  { value: 'rejected', label: 'Rejected' },
];

const COLORS = ['#003B7A', '#FFC300', '#10B981', '#F59E0B', '#6366F1', '#EC4899', '#84CC16', '#14B8A6'];

export default function Team() {
  const navigate = useNavigate();
  const toast = useToast();
  const { user: me } = useAuth();
  const [users, setUsers] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterRole, setFilterRole] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [savingId, setSavingId] = useState(null);
  const [showAdd, setShowAdd] = useState(false);
  const [adding, setAdding] = useState(false);
  const [newMember, setNewMember] = useState({ name: '', email: '', role: 'sales', status: 'active', password: 'neoskills@123' });

  const isAdmin = me?.role === 'admin';
  const isManager = isAdmin || me?.role === 'manager' || me?.role === 'ops';

  useEffect(() => { load(); }, []);

  async function load() {
    try {
      setUsers(await api.users.list());
      if (isManager) api.users.teamAnalytics().then(setAnalytics).catch(() => {});
    } catch (e) { toast.error('Failed to load team'); }
    finally { setLoading(false); }
  }

  async function handleUpdate(u, patch) {
    setSavingId(u.id);
    try {
      await api.users.update(u.id, patch);
      toast.success(`${u.name} updated`);
      await load();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setSavingId(null);
    }
  }

  async function handleAdd() {
    if (!newMember.name.trim() || !newMember.email.trim()) return toast.error('Name and email are required');
    setAdding(true);
    try {
      const created = await api.users.create(newMember);
      toast.success(`${created.name} added (${created.email})`);
      setShowAdd(false);
      setNewMember({ name: '', email: '', role: 'sales', status: 'active', password: 'neoskills@123' });
      await load();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setAdding(false);
    }
  }

  const filtered = users.filter((u) => {
    const matchSearch = !search
      || u.name?.toLowerCase().includes(search.toLowerCase())
      || u.email?.toLowerCase().includes(search.toLowerCase());
    const matchRole = !filterRole || u.role === filterRole;
    const matchStatus = !filterStatus || u.status === filterStatus;
    return matchSearch && matchRole && matchStatus;
  });

  const stats = {
    total: users.length,
    sales: users.filter((u) => u.role === 'sales' || u.can_sell).length,
    managers: users.filter((u) => u.role === 'manager').length,
    admins: users.filter((u) => u.role === 'admin').length,
    ops: users.filter((u) => u.role === 'ops').length,
    active: users.filter((u) => u.status === 'active').length,
    onLeave: users.filter((u) => u.status === 'on_leave').length,
  };

  const t = analytics?.totals || {};
  const chartData = (analytics?.users || []).map((u) => ({ name: u.name.split(' ')[0], collected: u.collected, pending: u.pending }));

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Team</h1>
        <p className="text-sm text-gray-400 mt-0.5">{users.length} members · {stats.active} active{stats.onLeave ? ` · ${stats.onLeave} on leave` : ''}</p>
      </div>

      {isAdmin && (
        <div className="flex justify-end -mt-2">
          <button onClick={() => setShowAdd(true)} className="btn-primary flex items-center gap-2">
            <UserPlus size={16} /> Add Member
          </button>
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
        <Card>
          <CardBody>
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-blue-100 rounded-xl shrink-0"><UsersIcon size={20} className="text-blue-600" /></div>
              <div className="min-w-0 flex-1">
                <p className="text-xs text-gray-400 uppercase tracking-wider">Total Members</p>
                <p className="text-base sm:text-xl font-bold text-gray-900 break-words">{stats.total}</p>
              </div>
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-teal-100 rounded-xl shrink-0"><UsersIcon size={20} className="text-teal-600" /></div>
              <div className="min-w-0 flex-1">
                <p className="text-xs text-gray-400 uppercase tracking-wider">Sales Reps</p>
                <p className="text-base sm:text-xl font-bold text-gray-900 break-words">{stats.sales}</p>
              </div>
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-purple-100 rounded-xl shrink-0"><Shield size={20} className="text-purple-600" /></div>
              <div className="min-w-0 flex-1">
                <p className="text-xs text-gray-400 uppercase tracking-wider">Managers & Admins</p>
                <p className="text-base sm:text-xl font-bold text-gray-900 break-words">{stats.managers + stats.admins}</p>
              </div>
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-emerald-100 rounded-xl shrink-0"><Clock size={20} className="text-emerald-600" /></div>
              <div className="min-w-0 flex-1">
                <p className="text-xs text-gray-400 uppercase tracking-wider">Active</p>
                <p className="text-base sm:text-xl font-bold text-emerald-600 break-words">{stats.active}</p>
              </div>
            </div>
          </CardBody>
        </Card>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input className="input-field pl-9" placeholder="Search by name or email..."
            value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <select className="input-field w-44" value={filterRole} onChange={(e) => setFilterRole(e.target.value)}>
          <option value="">All Roles</option>
          <option value="sales">Sales Reps</option>
          <option value="manager">Managers</option>
          <option value="ops">Operations</option>
          <option value="admin">Admins</option>
        </select>
        <select className="input-field w-44" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
          <option value="">All Status</option>
          {STATUS_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
      </div>

      {isManager && (
        <div className="space-y-5">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
            <Card><CardBody>
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-emerald-100 rounded-xl shrink-0"><DollarSign size={20} className="text-emerald-600" /></div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-gray-400 uppercase tracking-wider">Total Collected</p>
                  <p className="text-base sm:text-xl font-bold text-gray-900 break-words">₹{(t.collected || 0).toLocaleString()}</p>
                </div>
              </div>
            </CardBody></Card>
            <Card><CardBody>
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-amber-100 rounded-xl shrink-0"><Clock size={20} className="text-amber-600" /></div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-gray-400 uppercase tracking-wider">Total Pending</p>
                  <p className="text-base sm:text-xl font-bold text-amber-600 break-words">₹{(t.pending || 0).toLocaleString()}</p>
                </div>
              </div>
            </CardBody></Card>
            <Card><CardBody>
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-blue-100 rounded-xl shrink-0"><UsersIcon size={20} className="text-blue-600" /></div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-gray-400 uppercase tracking-wider">This Month</p>
                  <p className="text-base sm:text-xl font-bold text-gray-900 break-words">₹{(t.month_collected || 0).toLocaleString()}</p>
                </div>
              </div>
            </CardBody></Card>
            <Card><CardBody>
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-red-100 rounded-xl shrink-0"><AlertCircle size={20} className="text-red-600" /></div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-gray-400 uppercase tracking-wider">Pending Approvals</p>
                  <p className="text-base sm:text-xl font-bold text-gray-900 break-words">{t.pending_approvals || 0}</p>
                </div>
              </div>
            </CardBody></Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <Card>
              <CardHeader>
                <h3 className="font-semibold text-gray-900 flex items-center gap-2"><TrendingUp size={16} /> Collected by Member</h3>
              </CardHeader>
              <CardBody>
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} layout="vertical" margin={{ left: 30 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis type="number" tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} fontSize={11} />
                      <YAxis type="category" dataKey="name" width={70} fontSize={11} />
                      <Tooltip formatter={(v) => `₹${Number(v).toLocaleString()}`} />
                      <Bar dataKey="collected" fill="#003B7A" radius={[0, 4, 4, 0]} barSize={16}>
                        {chartData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardBody>
            </Card>

            <Card>
              <CardHeader>
                <h3 className="font-semibold text-gray-900 flex items-center gap-2"><Medal size={16} /> Team Leaderboard</h3>
              </CardHeader>
              <CardBody className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-50">
                        <th className="px-5 py-3 text-left font-medium text-gray-400 text-xs uppercase tracking-wider">Member</th>
                        <th className="px-5 py-3 text-left font-medium text-gray-400 text-xs uppercase tracking-wider">Deals</th>
                        <th className="px-5 py-3 text-left font-medium text-gray-400 text-xs uppercase tracking-wider">Collected</th>
                        <th className="px-5 py-3 text-left font-medium text-gray-400 text-xs uppercase tracking-wider">Avg Deal</th>
                        <th className="px-5 py-3 text-left font-medium text-gray-400 text-xs uppercase tracking-wider">This Month</th>
                        <th className="px-5 py-3 text-left font-medium text-gray-400 text-xs uppercase tracking-wider">Pending</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(analytics?.users || []).map((p) => (
                        <tr key={p.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                          <td className="px-5 py-3">
                            <div className="flex items-center gap-2">
                              <p className="font-medium text-gray-900 truncate">{p.name}</p>
                              <Badge status={p.status === 'active' ? 'active' : p.status === 'on_leave' ? 'on_leave' : 'inactive'}>{p.status === 'active' ? 'Active' : p.status === 'on_leave' ? 'On Leave' : 'Inactive'}</Badge>
                            </div>
                          </td>
                          <td className="px-5 py-3 text-gray-600">{p.enrollments}</td>
                          <td className="px-5 py-3 font-medium text-gray-900">₹{p.collected.toLocaleString()}</td>
                          <td className="px-5 py-3 text-gray-600">₹{p.avg_deal_size.toLocaleString()}</td>
                          <td className="px-5 py-3 text-emerald-600 font-medium">₹{p.month_collected.toLocaleString()}</td>
                          <td className="px-5 py-3 text-amber-600 font-medium">₹{p.pending.toLocaleString()}</td>
                        </tr>
                      ))}
                      {!analytics?.users?.length && <tr><td colSpan={6} className="px-5 py-8 text-center text-gray-400 text-sm">No team data yet</td></tr>}
                    </tbody>
                  </table>
                </div>
              </CardBody>
            </Card>
          </div>
        </div>
      )}

      <Card>
        <CardHeader>
          <h3 className="font-semibold text-gray-900">All Team Members</h3>
        </CardHeader>
        <CardBody className="p-0">
          {loading ? (
            <div className="space-y-3 p-5">
              {[1,2,3,4,5].map((i) => <div key={i} className="h-14 skeleton w-full" />)}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-50">
                    <th className="px-5 py-3.5 text-left font-medium text-gray-400 text-xs uppercase tracking-wider">Member</th>
                    <th className="px-5 py-3.5 text-left font-medium text-gray-400 text-xs uppercase tracking-wider">Role</th>
                    <th className="px-5 py-3.5 text-left font-medium text-gray-400 text-xs uppercase tracking-wider">Status</th>
                    <th className="px-5 py-3.5 text-left font-medium text-gray-400 text-xs uppercase tracking-wider">Enrollments</th>
                    <th className="px-5 py-3.5 text-left font-medium text-gray-400 text-xs uppercase tracking-wider">Collected</th>
                    <th className="px-5 py-3.5 text-left font-medium text-gray-400 text-xs uppercase tracking-wider">Pending</th>
                    <th className="px-5 py-3.5 text-left font-medium text-gray-400 text-xs uppercase tracking-wider">Joined</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((u) => (
                    <tr
                      key={u.id}
                      onClick={() => !savingId && (u.role === 'sales' || u.can_sell) && navigate(`/salesperson/${u.id}`)}
                      className={`border-b border-gray-50 hover:bg-gray-50/60 transition-colors ${(u.role === 'sales' || u.can_sell) && !savingId ? 'cursor-pointer' : ''}`}
                    >
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 bg-primary-100 rounded-xl flex items-center justify-center text-primary-700 font-bold text-sm shrink-0">
                            {u.name?.charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium text-gray-900 truncate">{u.name}</p>
                            <p className="text-xs text-gray-400 truncate">{u.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3.5" onClick={(e) => e.stopPropagation()}>
                        {isAdmin && String(u.id) !== String(me?.id) ? (
                          <select
                            className="text-xs border border-gray-200 rounded-lg px-2 py-1 bg-white text-gray-700 focus:outline-none focus:border-primary-400"
                            value={u.role}
                            disabled={savingId === u.id}
                            onChange={(e) => handleUpdate(u, { role: e.target.value })}
                          >
                            <option value="sales">Sales Rep</option>
                            <option value="manager">Manager</option>
                            <option value="ops">Operations</option>
                            <option value="admin">Admin</option>
                          </select>
                        ) : (
                          <Badge status={u.role} />
                        )}
                      </td>
                      <td className="px-5 py-3.5" onClick={(e) => e.stopPropagation()}>
                        {isAdmin && String(u.id) !== String(me?.id) ? (
                          <select
                            className="text-xs border border-gray-200 rounded-lg px-2 py-1 bg-white text-gray-700 focus:outline-none focus:border-primary-400"
                            value={u.status}
                            disabled={savingId === u.id}
                            onChange={(e) => handleUpdate(u, { status: e.target.value })}
                          >
                            <option value="active">Active</option>
                            <option value="pending">Pending</option>
                            <option value="rejected">Rejected</option>
                          </select>
                        ) : (
                          <Badge status={u.status === 'active' ? 'active' : 'inactive'} />
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-gray-600">{u.enrollments || 0}</td>
                      <td className="px-5 py-3.5 font-medium text-gray-900">₹{Number(u.collected || 0).toLocaleString()}</td>
                      <td className="px-5 py-3.5 text-amber-600 font-medium">₹{Number(u.pending || 0).toLocaleString()}</td>
                      <td className="px-5 py-3.5 text-gray-500">{new Date(u.created_at).toLocaleDateString()}</td>
                    </tr>
                  ))}
                  {!filtered.length && (
                    <tr>
                      <td colSpan={7} className="px-5 py-12 text-center text-gray-400 text-sm">
                        No team members found
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </CardBody>
      </Card>

      {/* Add Member modal */}
      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="Add Team Member" size="sm">
        <div className="space-y-3">
          <div>
            <label className="text-xs text-gray-500 font-medium mb-1 block">Full name *</label>
            <input className="input-field" value={newMember.name} onChange={(e) => setNewMember({ ...newMember, name: e.target.value })} placeholder="e.g. Rahul Sharma" autoFocus />
          </div>
          <div>
            <label className="text-xs text-gray-500 font-medium mb-1 block">Email *</label>
            <input className="input-field" value={newMember.email} onChange={(e) => setNewMember({ ...newMember, email: e.target.value })} placeholder="name@neoskills.co.in" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500 font-medium mb-1 block">Role</label>
              <select className="input-field" value={newMember.role} onChange={(e) => setNewMember({ ...newMember, role: e.target.value })}>
                <option value="sales">Sales Rep</option>
                <option value="manager">Manager</option>
                <option value="ops">Operations</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 font-medium mb-1 block">Status</label>
              <select className="input-field" value={newMember.status} onChange={(e) => setNewMember({ ...newMember, status: e.target.value })}>
                {STATUS_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-500 font-medium mb-1 block">Password</label>
            <input className="input-field" value={newMember.password} onChange={(e) => setNewMember({ ...newMember, password: e.target.value })} />
            <p className="text-[11px] text-gray-400 mt-1">Default: neoskills@123 — share with the member.</p>
          </div>
          <button onClick={handleAdd} disabled={adding} className="btn-primary w-full flex items-center justify-center gap-2">
            <UserPlus size={16} /> {adding ? 'Adding…' : 'Add Member'}
          </button>
        </div>
      </Modal>
    </div>
  );
}
