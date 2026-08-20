import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Plus, Search, Layers, Users, Pencil, Trash2, Eye,
  UserPlus, X, Phone, Calendar, GraduationCap, Banknote, Download, TrendingUp,
  Mail, Copy, Send,
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { Card, CardBody } from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import Modal from '../components/ui/Modal';

function fmt(n) {
  return `₹${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
}

function emptyForm() {
  return { name: '', course_name: '', trainer_name: '', start_date: '', status: 'active', zoom_link: '' };
}

function downloadCsv(filename, headers, rows) {
  const csv = headers + '\n' + rows.join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

export default function Batches() {
  const { user } = useAuth();
  const toast = useToast();
  const canManage = user && (user.role === 'admin' || user.role === 'manager' || user.role === 'ops');
  const canCreateBatches = canManage || (user && user.can_create_batches);

  const [batches, setBatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);

  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const [showAdd, setShowAdd] = useState(false);
  const [enrollments, setEnrollments] = useState([]);
  const [enrollSearch, setEnrollSearch] = useState('');
  const [selected, setSelected] = useState([]);
  const [adding, setAdding] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const data = await api.batches.list();
      setBatches(data);
    } catch (e) {
      toast.error('Failed to load batches');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  const filteredBatches = useMemo(() => {
    const q = search.toLowerCase();
    return batches.filter((b) => {
      if (statusFilter && b.status !== statusFilter) return false;
      if (!q) return true;
      return (
        (b.name || '').toLowerCase().includes(q) ||
        (b.course_name || '').toLowerCase().includes(q) ||
        (b.trainer_name || '').toLowerCase().includes(q)
      );
    });
  }, [batches, search, statusFilter]);

  const chartData = useMemo(() => batches.map((b) => ({
    name: b.name.length > 14 ? b.name.slice(0, 14) + '…' : b.name,
    fullName: b.name,
    received: Math.round(Number(b.received || 0)),
    pending: Math.round(Number(b.total_fee || 0) - Number(b.received || 0)),
  })), [batches]);

  const activeBatches = batches.filter((b) => b.status === 'active').length;
  const completedBatches = batches.filter((b) => b.status === 'completed').length;
  const totalStudents = batches.reduce((s, b) => s + Number(b.student_count || 0), 0);
  const totalBusiness = batches.reduce((s, b) => s + Number(b.total_fee || 0), 0);
  const totalReceived = batches.reduce((s, b) => s + Number(b.received || 0), 0);
  const collectionRate = totalBusiness ? Math.round((totalReceived / totalBusiness) * 100) : 0;

  function openCreate() {
    setEditing(null);
    setForm(emptyForm());
    setShowForm(true);
  }

  function openEdit(b) {
    setEditing(b);
    setForm({
      name: b.name || '',
      course_name: b.course_name || '',
      trainer_name: b.trainer_name || '',
      start_date: b.start_date ? b.start_date.slice(0, 10) : '',
      status: b.status || 'active',
      zoom_link: b.zoom_link || '',
    });
    setShowForm(true);
  }

  async function handleSave() {
    if (!form.name.trim()) { toast.error('Batch name is required'); return; }
    try {
      setSaving(true);
      if (editing) {
        await api.batches.update(editing.id, form);
        toast.success('Batch updated');
      } else {
        await api.batches.create(form);
        toast.success('Batch created');
      }
      setShowForm(false);
      load();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(b) {
    if (!window.confirm(`Delete batch "${b.name}"? Students will not be deleted, only removed from this batch.`)) return;
    try {
      await api.batches.remove(b.id);
      toast.success('Batch deleted');
      if (detail?.id === b.id) setDetail(null);
      load();
    } catch (e) {
      toast.error(e.message);
    }
  }

  async function openDetail(b) {
    try {
      setDetailLoading(true);
      setDetail(b);
      const data = await api.batches.get(b.id);
      setDetail(data);
    } catch (e) {
      toast.error(e.message);
      setDetail(null);
    } finally {
      setDetailLoading(false);
    }
  }

  async function openAddStudents() {
    setSelected([]);
    setEnrollSearch('');
    setShowAdd(true);
    try {
      const data = await api.enrollments.list({});
      const inBatch = new Set((detail?.members || []).map((m) => m.enrollment_id));
      setEnrollments(data.filter((e) => !inBatch.has(e.id)));
    } catch (e) {
      toast.error('Failed to load enrollments');
    }
  }

  async function handleAddStudents() {
    if (!selected.length) { toast.error('Select at least one student'); return; }
    try {
      setAdding(true);
      await api.batches.addMembers(detail.id, selected);
      toast.success(`${selected.length} student(s) added to batch`);
      setShowAdd(false);
      openDetail(detail);
      load();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setAdding(false);
    }
  }

  async function handleRemoveMember(m) {
    if (!window.confirm(`Remove ${m.student_name} from this batch?`)) return;
    try {
      await api.batches.removeMember(detail.id, m.enrollment_id);
      toast.success('Student removed from batch');
      openDetail(detail);
      load();
    } catch (e) {
      toast.error(e.message);
    }
  }

  const [showInvite, setShowInvite] = useState(false);
  const [inviteLink, setInviteLink] = useState('');
  const [savingLink, setSavingLink] = useState(false);

  function openInvite() {
    setInviteLink(detail?.zoom_link || '');
    setShowInvite(true);
  }

  async function saveZoomLink() {
    try {
      setSavingLink(true);
      await api.batches.update(detail.id, { zoom_link: inviteLink });
      setDetail((d) => ({ ...d, zoom_link: inviteLink }));
      toast.success('Zoom link saved');
      load();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setSavingLink(false);
    }
  }

  function inviteMessage() {
    const start = detail?.start_date ? new Date(detail.start_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' }) : '';
    const link = inviteLink || detail?.zoom_link || '';
    const lines = [
      'Hello,',
      '',
      `You are invited to join the training batch "${detail?.name || ''}".`,
      start ? `Batch starts on ${start}.` : '',
      '',
      'Join the Zoom session using the link below:',
      link,
      '',
      `Trainer: ${detail?.trainer_name || 'TBD'}`,
      detail?.course_name ? `Course: ${detail.course_name}` : '',
      '',
      'Regards,',
      'Team',
    ];
    return lines.filter(Boolean).join('\n');
  }

  function copyInviteMessage() {
    if (!(inviteLink || detail?.zoom_link)) { toast.error('Save the Zoom link first'); return; }
    navigator.clipboard.writeText(inviteMessage()).then(() => toast.success('Invite message copied')).catch(() => toast.error('Could not copy'));
  }

  function copyEmails() {
    const emails = (detail?.members || []).map((m) => m.student_email).filter(Boolean);
    if (!emails.length) { toast.error('No emails found for candidates'); return; }
    navigator.clipboard.writeText(emails.join(',')).then(() => toast.success('Emails copied')).catch(() => toast.error('Could not copy'));
  }

  function openEmailApp() {
    const emails = (detail?.members || []).map((m) => m.student_email).filter(Boolean);
    if (!emails.length) { toast.error('No emails found for candidates'); return; }
    const link = inviteLink || detail?.zoom_link || '';
    const subject = encodeURIComponent(`Invitation: ${detail?.name || 'Training Batch'}`);
    const body = encodeURIComponent(inviteMessage());
    window.location.href = `mailto:?bcc=${encodeURIComponent(emails.join(','))}&subject=${subject}&body=${body}`;
  }

  function exportBatches() {
    if (!filteredBatches.length) { toast.info('No data to export'); return; }
    const headers = 'Batch,Course,Trainer,Start Date,Status,Students,Total Fee,Received,Pending';
    const rows = filteredBatches.map((b) => {
      const pending = Number(b.total_fee || 0) - Number(b.received || 0);
      return `"${b.name}","${b.course_name || ''}","${b.trainer_name || ''}",${b.start_date ? b.start_date.slice(0, 10) : ''},${b.status === 'completed' ? 'Completed' : 'Active'},${b.student_count || 0},${Number(b.total_fee || 0)},${Number(b.received || 0)},${pending}`;
    });
    downloadCsv('batches.csv', headers, rows);
    toast.success('Batches exported');
  }

  function exportRoster() {
    const members = detail?.members || [];
    if (!members.length) { toast.info('No students to export'); return; }
    const headers = 'Student,Phone,Email,Course,Salesperson,Total,Received,Pending';
    const rows = members.map((m) =>
      `"${m.student_name}","${m.student_phone || ''}","${m.student_email || ''}","${m.course_name || ''}","${m.salesperson_name || ''}",${Number(m.total_amount || 0)},${Number(m.received || 0)},${Number(m.total_amount || 0) - Number(m.received || 0)}`
    );
    downloadCsv(`${detail.name.replace(/[^\w]+/g, '-').toLowerCase()}-students.csv`, headers, rows);
    toast.success('Student list exported');
  }

  const filteredEnrollments = enrollments.filter((e) => {
    const q = enrollSearch.toLowerCase();
    if (!q) return true;
    return (
      (e.student_name || '').toLowerCase().includes(q) ||
      (e.student_phone || '').includes(q) ||
      (e.course_name || '').toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Batches</h1>
          <p className="text-sm text-gray-500">Group candidates into training batches and track batch-wise business</p>
        </div>
        <div className="flex items-center gap-2">
          {canManage && (
            <button onClick={exportBatches} className="flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-200 text-gray-700 text-sm font-medium rounded-xl hover:bg-gray-50 transition-colors">
              <Download size={16} /> Export
            </button>
          )}
          {canCreateBatches && (
            <button onClick={openCreate} className="flex items-center gap-2 px-4 py-2.5 bg-primary-600 text-white text-sm font-medium rounded-xl hover:bg-primary-700 transition-colors">
              <Plus size={18} /> New Batch
            </button>
          )}
        </div>
      </div>

      {canManage && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card><CardBody>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center"><Layers size={18} /></div>
              <div>
                <p className="text-xs text-gray-500">Total Batches</p>
                <p className="text-lg font-bold text-gray-900">{batches.length}</p>
              </div>
            </div>
          </CardBody></Card>
          <Card><CardBody>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center"><Users size={18} /></div>
              <div>
                <p className="text-xs text-gray-500">Students in Batches</p>
                <p className="text-lg font-bold text-gray-900">{totalStudents}</p>
              </div>
            </div>
          </CardBody></Card>
          <Card><CardBody>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center"><TrendingUp size={18} /></div>
              <div>
                <p className="text-xs text-gray-500">Active / Completed</p>
                <p className="text-lg font-bold text-gray-900">{activeBatches} / {completedBatches}</p>
              </div>
            </div>
          </CardBody></Card>
          <Card><CardBody>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-primary-50 text-primary-600 rounded-xl flex items-center justify-center"><Banknote size={18} /></div>
              <div>
                <p className="text-xs text-gray-500">Collection Rate</p>
                <p className="text-lg font-bold text-emerald-600">{collectionRate}%</p>
                <p className="text-xs text-gray-400">₹{totalReceived.toLocaleString('en-IN')} of ₹{totalBusiness.toLocaleString('en-IN')}</p>
              </div>
            </div>
          </CardBody></Card>
        </div>
      )}

      {!canManage && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card><CardBody>
            <div className="flex items-center gap-4">
              <div className="w-11 h-11 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center"><Layers size={20} /></div>
              <div>
                <p className="text-xs text-gray-500">Total Batches</p>
                <p className="text-xl font-bold text-gray-900">{batches.length}</p>
              </div>
            </div>
          </CardBody></Card>
          <Card><CardBody>
            <div className="flex items-center gap-4">
              <div className="w-11 h-11 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center"><Users size={20} /></div>
              <div>
                <p className="text-xs text-gray-500">Students in Batches</p>
                <p className="text-xl font-bold text-gray-900">{totalStudents}</p>
              </div>
            </div>
          </CardBody></Card>
          <Card><CardBody>
            <div className="flex items-center gap-4">
              <div className="w-11 h-11 bg-primary-50 text-primary-600 rounded-xl flex items-center justify-center"><Banknote size={20} /></div>
              <div>
                <p className="text-xs text-gray-500">Received from Batches</p>
                <p className="text-xl font-bold text-emerald-600">{fmt(totalReceived)}</p>
                <p className="text-xs text-gray-400">of {fmt(totalBusiness)} business</p>
              </div>
            </div>
          </CardBody></Card>
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by batch name, course or trainer..."
            className="w-full pl-10 pr-3.5 py-2.5 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary-500 sm:w-44"
        >
          <option value="">All Status</option>
          <option value="active">Active</option>
          <option value="completed">Completed</option>
        </select>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
        </div>
      ) : filteredBatches.length === 0 ? (
        <Card>
          <CardBody>
            <div className="text-center py-12">
              <Layers size={40} className="mx-auto text-gray-300 mb-3" />
              <p className="text-gray-500">{batches.length === 0 ? 'No batches yet. Create your first batch to start adding students.' : 'No batches match your search.'}</p>
            </div>
          </CardBody>
        </Card>
      ) : (
        <Card>
          <CardBody className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 text-left text-xs text-gray-500 uppercase tracking-wide">
                    <th className="px-5 py-3.5">Batch</th>
                    <th className="px-5 py-3.5">Trainer</th>
                    <th className="px-5 py-3.5">Start Date</th>
                    <th className="px-5 py-3.5">Status</th>
                    <th className="px-5 py-3.5 text-center">Students</th>
                    <th className="px-5 py-3.5 text-right">Total Fee</th>
                    <th className="px-5 py-3.5 text-right">Received</th>
                    <th className="px-5 py-3.5 text-right">Pending</th>
                    <th className="px-5 py-3.5">Collection</th>
                    <th className="px-5 py-3.5" />
                  </tr>
                </thead>
                <tbody>
                  {filteredBatches.map((b) => {
                    const pending = Number(b.total_fee || 0) - Number(b.received || 0);
                    const pct = Number(b.total_fee || 0) ? Math.round((Number(b.received || 0) / Number(b.total_fee || 0)) * 100) : 0;
                    return (
                      <tr key={b.id} className="border-b border-gray-50 hover:bg-gray-50/60 transition-colors">
                        <td className="px-5 py-3.5">
                          <p className="font-medium text-gray-900">{b.name}</p>
                          {b.course_name && <p className="text-xs text-gray-500">{b.course_name}</p>}
                        </td>
                        <td className="px-5 py-3.5 text-gray-600">{b.trainer_name || '—'}</td>
                        <td className="px-5 py-3.5 text-gray-600">{b.start_date ? new Date(b.start_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : '—'}</td>
                        <td className="px-5 py-3.5"><Badge status={b.status}>{b.status === 'completed' ? 'Completed' : 'Active'}</Badge></td>
                        <td className="px-5 py-3.5 text-center font-medium text-gray-900">{b.student_count}</td>
                        <td className="px-5 py-3.5 text-right text-gray-900">{fmt(b.total_fee)}</td>
                        <td className="px-5 py-3.5 text-right text-emerald-600 font-medium">{fmt(b.received)}</td>
                        <td className="px-5 py-3.5 text-right text-amber-600 font-medium">{fmt(pending)}</td>
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-2 min-w-[110px]">
                            <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                              <div className={`h-full rounded-full ${pct >= 100 ? 'bg-emerald-500' : pct > 0 ? 'bg-amber-400' : 'bg-gray-200'}`}
                                style={{ width: `${pct}%` }} />
                            </div>
                            <span className="text-xs text-gray-500 w-9 text-right">{pct}%</span>
                          </div>
                        </td>
                        <td className="px-5 py-3.5">
                          <div className="flex items-center justify-end gap-2">
                            <button onClick={() => openDetail(b)} className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-primary-700 bg-primary-50 hover:bg-primary-100 rounded-xl transition-colors">
                              <Eye size={17} /> View Candidates
                            </button>
                            {canManage && (
                              <>
                                <button onClick={() => openEdit(b)} title="Edit" className="p-2 text-gray-500 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors">
                                  <Pencil size={16} />
                                </button>
                                <button onClick={() => handleDelete(b)} title="Delete" className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                                  <Trash2 size={16} />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardBody>
        </Card>
      )}

      {canManage && chartData.length > 0 && (
        <Card>
          <CardBody>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-gray-900">Business by Batch</h3>
              <div className="flex items-center gap-4 text-xs text-gray-500">
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Received</span>
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-amber-400" /> Pending</span>
              </div>
            </div>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                  <XAxis dataKey="name" fontSize={11} tickFormatter={(v) => v} />
                  <YAxis fontSize={11} tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
                  <Tooltip
                    formatter={(v) => [`₹${Number(v).toLocaleString()}`, undefined]}
                    labelFormatter={(l) => chartData.find((d) => d.name === l)?.fullName || l}
                  />
                  <Bar dataKey="received" stackId="b" fill="#10B981" radius={[0, 0, 0, 0]} name="Received" />
                  <Bar dataKey="pending" stackId="b" fill="#FBBF24" radius={[4, 4, 0, 0]} name="Pending" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardBody>
        </Card>
      )}

      <Modal open={showForm} onClose={() => setShowForm(false)} title={editing ? 'Edit Batch' : 'New Batch'}>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Batch Name *</label>
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder='Example: DevOps Aug (Rahul Sharma)'
              className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Course</label>
            <input
              value={form.course_name}
              onChange={(e) => setForm({ ...form, course_name: e.target.value })}
              placeholder="Example: DevOps"
              className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Trainer Name</label>
            <input
              value={form.trainer_name}
              onChange={(e) => setForm({ ...form, trainer_name: e.target.value })}
              placeholder="Trainer name"
              className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Start Date</label>
              <input
                type="date"
                value={form.start_date}
                onChange={(e) => setForm({ ...form, start_date: e.target.value })}
                className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Status</label>
              <select
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value })}
                className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="active">Active</option>
                <option value="completed">Completed</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Zoom Meeting Link</label>
            <input
              value={form.zoom_link}
              onChange={(e) => setForm({ ...form, zoom_link: e.target.value })}
              placeholder="https://us05web.zoom.us/j/1234567890"
              className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
            <p className="text-xs text-gray-400 mt-1">Used to email the Zoom invite to candidates in this batch.</p>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => setShowForm(false)} className="px-4 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-xl transition-colors">Cancel</button>
            <button onClick={handleSave} disabled={saving} className="flex items-center gap-2 px-4 py-2.5 bg-primary-600 text-white text-sm font-medium rounded-xl hover:bg-primary-700 disabled:opacity-50 transition-colors">
              {saving ? 'Saving...' : editing ? 'Save Changes' : 'Create Batch'}
            </button>
          </div>
        </div>
      </Modal>

      <Modal open={!!detail} onClose={() => setDetail(null)} title="Batch Students" size="xl">
        {detail && (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-lg font-bold text-gray-900">{detail.name}</h3>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-500 mt-1">
                  {detail.course_name && <span className="flex items-center gap-1"><GraduationCap size={14} /> {detail.course_name}</span>}
                  {detail.trainer_name && <span>Trainer: {detail.trainer_name}</span>}
                  {detail.start_date && <span className="flex items-center gap-1"><Calendar size={14} /> {new Date(detail.start_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</span>}
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <p className="text-xs text-gray-500">Received</p>
                  <p className="text-sm font-bold text-emerald-600">{fmt(detail.received)}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-gray-500">Pending</p>
                  <p className="text-sm font-bold text-amber-600">{fmt(Number(detail.total_fee || 0) - Number(detail.received || 0))}</p>
                </div>
                {canManage && (
                  <button onClick={exportRoster} className="flex items-center gap-2 px-3.5 py-2 bg-white border border-gray-200 text-gray-700 text-xs font-medium rounded-xl hover:bg-gray-50 transition-colors">
                    <Download size={15} /> Export List
                  </button>
                )}
                {canManage && (
                  <button onClick={openInvite} className="flex items-center gap-2 px-3.5 py-2 bg-white border border-indigo-200 text-indigo-700 text-xs font-medium rounded-xl hover:bg-indigo-50 transition-colors">
                    <Mail size={15} /> Email Zoom Invite
                  </button>
                )}
                <button onClick={openAddStudents} className="flex items-center gap-2 px-3.5 py-2 bg-primary-600 text-white text-xs font-medium rounded-xl hover:bg-primary-700 transition-colors">
                  <UserPlus size={15} /> Add Students
                </button>
              </div>
            </div>

            {detailLoading ? (
              <div className="flex items-center justify-center h-32">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
              </div>
            ) : (detail.members || []).length === 0 ? (
              <div className="text-center py-10 border-2 border-dashed border-gray-200 rounded-xl">
                <Users size={32} className="mx-auto text-gray-300 mb-2" />
                <p className="text-sm text-gray-500">No students in this batch yet.</p>
                <button onClick={openAddStudents} className="mt-3 text-sm font-medium text-primary-600 hover:underline">Add students from enrollments</button>
              </div>
            ) : (
              <div className="overflow-x-auto border border-gray-100 rounded-xl">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 text-left text-xs text-gray-500 uppercase tracking-wide">
                      <th className="px-4 py-3">Student</th>
                      <th className="px-4 py-3">Phone</th>
                      <th className="px-4 py-3">Course</th>
                      <th className="px-4 py-3">Salesperson</th>
                      <th className="px-4 py-3 text-right">Total</th>
                      <th className="px-4 py-3 text-right">Received</th>
                      <th className="px-4 py-3 text-right">Pending</th>
                      <th className="px-4 py-3">Collection</th>
                      {canManage && <th className="px-4 py-3" />}
                    </tr>
                  </thead>
                  <tbody>
                    {(detail.members || []).map((m) => {
                      const pct = Number(m.total_amount) ? Math.round((Number(m.received) / Number(m.total_amount)) * 100) : 0;
                      return (
                        <tr key={m.enrollment_id} className="border-t border-gray-50 hover:bg-gray-50/60">
                          <td className="px-4 py-3 font-medium text-gray-900">{m.student_name}</td>
                          <td className="px-4 py-3 text-gray-600">{m.student_phone || '—'}</td>
                          <td className="px-4 py-3 text-gray-600">{m.course_name || '—'}</td>
                          <td className="px-4 py-3 text-gray-600">{m.salesperson_name || '—'}</td>
                          <td className="px-4 py-3 text-right text-gray-900">{fmt(m.total_amount)}</td>
                          <td className="px-4 py-3 text-right text-emerald-600 font-medium">{fmt(m.received)}</td>
                          <td className="px-4 py-3 text-right text-amber-600 font-medium">{fmt(Number(m.total_amount) - Number(m.received))}</td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2 min-w-[90px]">
                              <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                <div className={`h-full rounded-full ${pct >= 100 ? 'bg-emerald-500' : pct > 0 ? 'bg-amber-400' : 'bg-gray-200'}`}
                                  style={{ width: `${pct}%` }} />
                              </div>
                              <span className="text-xs text-gray-500 w-8 text-right">{pct}%</span>
                            </div>
                          </td>
                          {canManage && (
                            <td className="px-4 py-3 text-right">
                              <button onClick={() => handleRemoveMember(m)} title="Remove from batch" className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                                <X size={15} />
                              </button>
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </Modal>

      <Modal open={showAdd} onClose={() => setShowAdd(false)} title={`Add Students to ${detail?.name || 'Batch'}`} size="xl">
        <div className="space-y-4">
          <div className="relative">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={enrollSearch}
              onChange={(e) => setEnrollSearch(e.target.value)}
              placeholder="Search by student name, phone or course..."
              className="w-full pl-10 pr-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <p className="text-xs text-gray-500">
            {selected.length > 0 ? `${selected.length} selected. ` : ''}These are enrollments that are not yet in this batch.
          </p>
          <div className="max-h-80 overflow-y-auto border border-gray-100 rounded-xl">
            {filteredEnrollments.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-8">No enrollments found to add.</p>
            ) : (
              filteredEnrollments.map((e) => {
                const checked = selected.includes(e.id);
                const pending = Number(e.pending_amount || 0);
                return (
                  <label key={e.id} className="flex items-center gap-3 px-4 py-2.5 border-b border-gray-50 hover:bg-gray-50/60 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => setSelected((prev) => checked ? prev.filter((x) => x !== e.id) : [...prev, e.id])}
                      className="w-4 h-4 accent-primary-600"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{e.student_name}</p>
                      <p className="text-xs text-gray-500 truncate">{e.course_name} • {e.salesperson_name}</p>
                    </div>
                    <span className="flex items-center gap-1 text-xs text-gray-400 shrink-0"><Phone size={12} /> {e.student_phone || '—'}</span>
                    <span className="text-sm font-medium text-gray-900 shrink-0 w-24 text-right">{fmt(e.total_amount)}</span>
                    <span className={`text-xs font-medium shrink-0 w-20 text-right ${pending > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
                      {pending > 0 ? `${fmt(pending)} due` : 'Paid'}
                    </span>
                  </label>
                );
              })
            )}
          </div>
          <div className="flex justify-end gap-3">
            <button onClick={() => setShowAdd(false)} className="px-4 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-xl transition-colors">Cancel</button>
            <button onClick={handleAddStudents} disabled={adding || !selected.length} className="flex items-center gap-2 px-4 py-2.5 bg-primary-600 text-white text-sm font-medium rounded-xl hover:bg-primary-700 disabled:opacity-50 transition-colors">
              {adding ? 'Adding...' : `Add ${selected.length || ''} Student${selected.length === 1 ? '' : 's'}`}
            </button>
          </div>
        </div>
      </Modal>

      <Modal open={showInvite} onClose={() => setShowInvite(false)} title="Email Zoom Invite" size="lg">
        <div className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Zoom Meeting Link</label>
            <div className="flex gap-2">
              <input
                value={inviteLink}
                onChange={(e) => setInviteLink(e.target.value)}
                placeholder="https://us05web.zoom.us/j/1234567890"
                className="flex-1 px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
              <button onClick={saveZoomLink} disabled={savingLink}
                className="px-4 py-2.5 bg-primary-600 text-white text-sm font-medium rounded-xl hover:bg-primary-700 disabled:opacity-50 transition-colors whitespace-nowrap">
                {savingLink ? 'Saving...' : 'Save Link'}
              </button>
            </div>
            <p className="text-xs text-gray-400 mt-1">Save once — this link is remembered for this batch.</p>
          </div>

          <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4 text-sm text-gray-700">
            <p className="font-medium text-indigo-800 mb-1">How to send</p>
            <p>Paste the invite into your mail. Choose what to copy below — we pre-fill your email app too.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <button onClick={copyEmails} className="flex items-center justify-center gap-2 px-3 py-2.5 bg-white border border-gray-200 text-gray-700 text-sm font-medium rounded-xl hover:bg-gray-50 transition-colors">
              <Copy size={15} /> Copy Emails
            </button>
            <button onClick={copyInviteMessage} className="flex items-center justify-center gap-2 px-3 py-2.5 bg-white border border-gray-200 text-gray-700 text-sm font-medium rounded-xl hover:bg-gray-50 transition-colors">
              <Copy size={15} /> Copy Invite
            </button>
            <button onClick={openEmailApp} className="flex items-center justify-center gap-2 px-3 py-2.5 bg-indigo-600 text-white text-sm font-medium rounded-xl hover:bg-indigo-700 transition-colors">
              <Send size={15} /> Open Email App
            </button>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium text-gray-700">
                Candidates to invite ({detail?.members?.length || 0})
              </p>
              <span className="text-xs text-gray-400">
                {(detail?.members || []).filter((m) => m.student_email).length} with email
              </span>
            </div>
            <div className="max-h-64 overflow-y-auto border border-gray-100 rounded-xl">
              {(detail?.members || []).map((m) => (
                <div key={m.enrollment_id} className="flex items-center gap-3 px-4 py-2.5 border-b border-gray-50">
                  <div className="w-8 h-8 bg-primary-100 rounded-lg flex items-center justify-center text-primary-700 font-bold text-xs shrink-0">
                    {m.student_name?.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{m.student_name}</p>
                    <p className="text-xs text-gray-500 truncate">{m.course_name || ''}</p>
                  </div>
                  <p className="text-xs text-gray-600 truncate max-w-[200px]">{m.student_email || <span className="text-red-400">No email</span>}</p>
                </div>
              ))}
              {(detail?.members || []).length === 0 && (
                <p className="text-sm text-gray-500 text-center py-6">No candidates in this batch yet.</p>
              )}
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}
