import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Users as UsersIcon, Shield, DollarSign, Clock } from 'lucide-react';
import { api } from '../services/api';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import { Card, CardHeader, CardBody } from '../components/ui/Card';
import Badge from '../components/ui/Badge';

const ROLE_META = {
  admin: { label: 'Admin', icon: Shield },
  manager: { label: 'Manager' },
  sales: { label: 'Sales Rep' },
  ops: { label: 'Operations' },
};

export default function Team() {
  const navigate = useNavigate();
  const toast = useToast();
  const { user: me } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterRole, setFilterRole] = useState('');
  const [savingId, setSavingId] = useState(null);

  const isAdmin = me?.role === 'admin';

  useEffect(() => { load(); }, []);

  async function load() {
    try {
      setUsers(await api.users.list());
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

  const filtered = users.filter((u) => {
    const matchSearch = !search
      || u.name?.toLowerCase().includes(search.toLowerCase())
      || u.email?.toLowerCase().includes(search.toLowerCase());
    const matchRole = !filterRole || u.role === filterRole;
    return matchSearch && matchRole;
  });

  const stats = {
    total: users.length,
    sales: users.filter((u) => u.role === 'sales' || u.can_sell).length,
    managers: users.filter((u) => u.role === 'manager').length,
    admins: users.filter((u) => u.role === 'admin').length,
    ops: users.filter((u) => u.role === 'ops').length,
    active: users.filter((u) => u.status === 'active').length,
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Team</h1>
        <p className="text-sm text-gray-400 mt-0.5">{users.length} members · {stats.active} active</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
        <Card>
          <CardBody>
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-blue-100 rounded-xl"><UsersIcon size={20} className="text-blue-600" /></div>
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wider">Total Members</p>
                <p className="text-xl font-bold text-gray-900">{stats.total}</p>
              </div>
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-teal-100 rounded-xl"><UsersIcon size={20} className="text-teal-600" /></div>
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wider">Sales Reps</p>
                <p className="text-xl font-bold text-gray-900">{stats.sales}</p>
              </div>
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-purple-100 rounded-xl"><Shield size={20} className="text-purple-600" /></div>
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wider">Managers & Admins</p>
                <p className="text-xl font-bold text-gray-900">{stats.managers + stats.admins}</p>
              </div>
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-emerald-100 rounded-xl"><Clock size={20} className="text-emerald-600" /></div>
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wider">Active</p>
                <p className="text-xl font-bold text-emerald-600">{stats.active}</p>
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
      </div>

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
    </div>
  );
}
