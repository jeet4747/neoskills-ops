import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Plus, Search, Layers, Users, Pencil, Trash2, Eye,
  UserPlus, X, Phone, Calendar, GraduationCap, Banknote, Download, TrendingUp,
  Mail, Copy, Send, ChevronRight,
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
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

function ProgressRing({ pct, size = 48, stroke = 4 }) {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (pct / 100) * circ;
  return (
    <svg width={size} height={size} className="shrink-0 -rotate-90">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#e5e7eb" strokeWidth={stroke} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none"
        stroke={pct >= 100 ? '#10B981' : pct > 50 ? '#003B7A' : '#F59E0B'}
        strokeWidth={stroke} strokeLinecap="round"
        strokeDasharray={circ} strokeDashoffset={offset}
        className="transition-all duration-500" />
      <text x={size / 2} y={size / 2} textAnchor="middle" dominantBaseline="central"
        className="text-[10px] font-bold fill-gray-900 rotate-90" style={{ transformOrigin: 'center' }}>
        {pct}%
      </text>
    </svg>
  );
}

export default function Batches() {
  const { user } = useAuth();
  const toast = useToast();
  const canManage = user && (user.role === 'admin' || user.role === 'manager' || user.role === 'ops');
  const canCreateBatches = true;

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
      setBatches(await api.batches.list());
    } catch (e) { toast.error('Failed to load batches'); }
    finally { setLoading(false); }
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  const filteredBatches = useMemo(() => {
    const q = search.toLowerCase();
    return batches.filter((b) => {
      if (statusFilter && b.status !== statusFilter) return false;
      if (!q) return true;
      return (b.name || '').toLowerCase().includes(q) || (b.course_name || '').toLowerCase().includes(q) || (b.trainer_name || '').toLowerCase().includes(q);
    });
  }, [batches, search, statusFilter]);

  const chartData = useMemo(() => batches.map((b) => ({
    name: b.name.length > 12 ? b.name.slice(0, 12) + '…' : b.name,
    fullName: b.name,
    received: Math.round(Number(b.received || 0)),
    pending: Math.round(Number(b.total_fee || 0) - Number(b.received || 0)),
  })), [batches]);

  const totalStudents = batches.reduce((s, b) => s + Number(b.student_count || 0), 0);
  const totalBusiness = batches.reduce((s, b) => s + Number(b.total_fee || 0), 0);
  const totalReceived = batches.reduce((s, b) => s + Number(b.received || 0), 0);
  const collectionRate = totalBusiness ? Math.round((totalReceived / totalBusiness) * 100) : 0;

  function openCreate() { setEditing(null); setForm(emptyForm()); setShowForm(true); }
  function openEdit(b) {
    setEditing(b);
    setForm({ name: b.name || '', course_name: b.course_name || '', trainer_name: b.trainer_name || '', start_date: b.start_date ? b.start_date.slice(0, 10) : '', status: b.status || 'active', zoom_link: b.zoom_link || '' });
    setShowForm(true);
  }

  async function handleSave() {
    if (!form.name.trim()) { toast.error('Batch name is required'); return; }
    try {
      setSaving(true);
      if (editing) { await api.batches.update(editing.id, form); toast.success('Batch updated'); }
      else { await api.batches.create(form); toast.success('Batch created'); }
      setShowForm(false); load();
    } catch (e) { toast.error(e.message); }
    finally { setSaving(false); }
  }

  async function handleDelete(b) {
    if (!window.confirm(`Delete batch "${b.name}"?`)) return;
    try { await api.batches.remove(b.id); toast.success('Batch deleted'); if (detail?.id === b.id) setDetail(null); load(); }
    catch (e) { toast.error(e.message); }
  }

  async function openDetail(b) {
    try { setDetailLoading(true); setDetail(b); const data = await api.batches.get(b.id); setDetail(data); }
    catch (e) { toast.error(e.message); setDetail(null); }
    finally { setDetailLoading(false); }
  }

  async function openAddStudents() {
    setSelected([]); setEnrollSearch(''); setShowAdd(true);
    try {
      const data = await api.enrollments.list({});
      const inBatch = new Set((detail?.members || []).map((m) => m.enrollment_id));
      setEnrollments(data.filter((e) => !inBatch.has(e.id)));
    } catch (e) { toast.error('Failed to load enrollments'); }
  }

  async function handleAddStudents() {
    if (!selected.length) { toast.error('Select at least one student'); return; }
    try { setAdding(true); await api.batches.addMembers(detail.id, selected); toast.success(`${selected.length} student(s) added`); setShowAdd(false); openDetail(detail); load(); }
    catch (e) { toast.error(e.message); }
    finally { setAdding(false); }
  }

  async function handleRemoveMember(m) {
    if (!window.confirm(`Remove ${m.student_name} from this batch?`)) return;
    try { await api.batches.removeMember(detail.id, m.enrollment_id); toast.success('Removed'); openDetail(detail); load(); }
    catch (e) { toast.error(e.message); }
  }

  const [showInvite, setShowInvite] = useState(false);
  const [inviteLink, setInviteLink] = useState('');
  const [savingLink, setSavingLink] = useState(false);

  function openInvite() { setInviteLink(detail?.zoom_link || ''); setShowInvite(true); }
  async function saveZoomLink() {
    try { setSavingLink(true); await api.batches.update(detail.id, { zoom_link: inviteLink }); setDetail((d) => ({ ...d, zoom_link: inviteLink })); toast.success('Zoom link saved'); load(); }
    catch (e) { toast.error(e.message); }
    finally { setSavingLink(false); }
  }

  function inviteMessage() {
    const start = detail?.start_date ? new Date(detail.start_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' }) : '';
    const link = inviteLink || detail?.zoom_link || '';
    return ['Hello,', '', `You are invited to join the training batch "${detail?.name || ''}".`, start ? `Batch starts on ${start}.` : '', '', 'Join the Zoom session using the link below:', link, '', `Trainer: ${detail?.trainer_name || 'TBD'}`, detail?.course_name ? `Course: ${detail.course_name}` : '', '', 'Regards,', 'Team'].filter(Boolean).join('\n');
  }

  function copyInviteMessage() { if (!(inviteLink || detail?.zoom_link)) { toast.error('Save the Zoom link first'); return; } navigator.clipboard.writeText(inviteMessage()).then(() => toast.success('Invite message copied')).catch(() => toast.error('Could not copy')); }
  function copyEmails() { const emails = (detail?.members || []).map((m) => m.student_email).filter(Boolean); if (!emails.length) { toast.error('No emails found'); return; } navigator.clipboard.writeText(emails.join(',')).then(() => toast.success('Emails copied')).catch(() => toast.error('Could not copy')); }
  function openEmailApp() {
    const emails = (detail?.members || []).map((m) => m.student_email).filter(Boolean);
    if (!emails.length) { toast.error('No emails found'); return; }
    window.location.href = `mailto:?bcc=${encodeURIComponent(emails.join(','))}&subject=${encodeURIComponent(`Invitation: ${detail?.name || 'Training Batch'}`)}&body=${encodeURIComponent(inviteMessage())}`;
  }

  function exportBatches() {
    if (!filteredBatches.length) { toast.info('No data to export'); return; }
    const headers = 'Batch,Course,Trainer,Start Date,Status,Students,Total Fee,Received,Pending';
    const rows = filteredBatches.map((b) => `"${b.name}","${b.course_name || ''}","${b.trainer_name || ''}",${b.start_date ? b.start_date.slice(0, 10) : ''},${b.status === 'completed' ? 'Completed' : 'Active'},${b.student_count || 0},${Number(b.total_fee || 0)},${Number(b.received || 0)},${Number(b.total_fee || 0) - Number(b.received || 0)}`);
    downloadCsv('batches.csv', headers, rows); toast.success('Batches exported');
  }

  function exportRoster() {
    const members = detail?.members || [];
    if (!members.length) { toast.info('No students to export'); return; }
    downloadCsv(`${detail.name.replace(/[^\w]+/g, '-').toLowerCase()}-students.csv`, 'Student,Phone,Email,Course,Salesperson,Total,Received,Pending',
      members.map((m) => `"${m.student_name}","${m.student_phone || ''}","${m.student_email || ''}","${m.course_name || ''}","${m.salesperson_name || ''}",${Number(m.total_amount || 0)},${Number(m.received || 0)},${Number(m.total_amount || 0) - Number(m.received || 0)}`));
    toast.success('Student list exported');
  }

  const filteredEnrollments = enrollments.filter((e) => {
    const q = enrollSearch.toLowerCase();
    if (!q) return true;
    return (e.student_name || '').toLowerCase().includes(q) || (e.student_phone || '').includes(q) || (e.course_name || '').toLowerCase().includes(q);
  });

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Batches</h1>
          <p className="text-sm text-gray-500">Group candidates into training batches</p>
        </div>
        <div className="flex items-center gap-2">
          {canManage && <button onClick={exportBatches} className="flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-200 text-gray-700 text-sm font-medium rounded-xl hover:bg-gray-50 transition-colors"><Download size={16} /> Export</button>}
          {canCreateBatches && <button onClick={openCreate} className="flex items-center gap-2 px-4 py-2.5 bg-primary-600 text-white text-sm font-medium rounded-xl hover:bg-primary-700 transition-colors"><Plus size={18} /> New Batch</button>}
        </div>
      </div>

      {canManage && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center"><Layers size={18} /></div>
              <div><p className="text-[11px] text-gray-500">Batches</p><p className="text-lg font-bold text-gray-900">{batches.length}</p></div>
            </div>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center"><Users size={18} /></div>
              <div><p className="text-[11px] text-gray-500">Students</p><p className="text-lg font-bold text-gray-900">{totalStudents}</p></div>
            </div>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center"><TrendingUp size={18} /></div>
              <div><p className="text-[11px] text-gray-500">Business</p><p className="text-lg font-bold text-gray-900">{fmt(totalBusiness)}</p></div>
            </div>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center"><Banknote size={18} /></div>
              <div><p className="text-[11px] text-gray-500">Collected</p><p className="text-lg font-bold text-emerald-600">{collectionRate}%</p></div>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search batches..."
            className="w-full pl-10 pr-3.5 py-2.5 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary-500" />
        </div>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary-500 sm:w-40">
          <option value="">All Status</option>
          <option value="active">Active</option>
          <option value="completed">Completed</option>
        </select>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" /></div>
      ) : filteredBatches.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-gray-100">
          <Layers size={40} className="mx-auto text-gray-300 mb-3" />
          <p className="text-gray-500 text-sm">{batches.length === 0 ? 'No batches yet. Create your first batch.' : 'No batches match your search.'}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredBatches.map((b) => {
            const pending = Number(b.total_fee || 0) - Number(b.received || 0);
            const pct = Number(b.total_fee || 0) ? Math.round((Number(b.received || 0) / Number(b.total_fee || 0)) * 100) : 0;
            return (
              <div key={b.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all overflow-hidden">
                <div className="p-4 sm:p-5">
                  <div className="flex items-start gap-3">
                    <ProgressRing pct={pct} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <h3 className="text-base font-bold text-gray-900 truncate">{b.name}</h3>
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1">
                            {b.course_name && <span className="flex items-center gap-1 text-xs text-gray-500"><GraduationCap size={12} /> {b.course_name}</span>}
                            {b.trainer_name && <span className="text-xs text-gray-500">by {b.trainer_name}</span>}
                            {b.start_date && <span className="flex items-center gap-1 text-xs text-gray-400"><Calendar size={11} /> {new Date(b.start_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</span>}
                          </div>
                        </div>
                        <Badge status={b.status}>{b.status === 'completed' ? 'Completed' : 'Active'}</Badge>
                      </div>

                      <div className="grid grid-cols-3 gap-3 mt-3 pt-3 border-t border-gray-50">
                        <div>
                          <p className="text-[10px] text-gray-400 uppercase">Students</p>
                          <p className="text-sm font-bold text-gray-900 flex items-center gap-1"><Users size={13} className="text-gray-400" /> {b.student_count || 0}</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-gray-400 uppercase">Received</p>
                          <p className="text-sm font-bold text-emerald-600">{fmt(b.received)}</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-gray-400 uppercase">Pending</p>
                          <p className="text-sm font-bold text-amber-600">{fmt(pending)}</p>
                        </div>
                      </div>

                      <div className="w-full bg-gray-100 rounded-full h-1.5 mt-3">
                        <div className={`h-1.5 rounded-full transition-all duration-500 ${pct >= 100 ? 'bg-emerald-500' : pct > 0 ? 'bg-primary-500' : 'bg-gray-200'}`} style={{ width: `${Math.min(100, pct)}%` }} />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex items-center border-t border-gray-50 bg-gray-50/50">
                  <button onClick={() => openDetail(b)} className="flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium text-primary-700 hover:bg-primary-50 transition-colors border-r border-gray-100">
                    <Eye size={15} /> View
                  </button>
                  <button onClick={() => openEdit(b)} className="flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium text-gray-600 hover:bg-gray-100 transition-colors border-r border-gray-100">
                    <Pencil size={15} /> Edit
                  </button>
                  <button onClick={() => handleDelete(b)} className="flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium text-red-500 hover:bg-red-50 transition-colors">
                    <Trash2 size={15} /> Delete
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {canManage && chartData.length > 0 && (
        <Card>
          <CardBody>
            <h3 className="font-semibold text-gray-900 mb-3">Business by Batch</h3>
            <div className="flex items-center gap-4 text-xs text-gray-500 mb-2">
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Received</span>
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-amber-400" /> Pending</span>
            </div>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                  <XAxis dataKey="name" fontSize={11} />
                  <YAxis fontSize={11} tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={(v) => [`₹${Number(v).toLocaleString()}`, undefined]} labelFormatter={(l) => chartData.find((d) => d.name === l)?.fullName || l} />
                  <Bar dataKey="received" stackId="b" fill="#10B981" name="Received" />
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
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. DevOps Aug (Rahul)" className="input-field" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Course</label>
            <input value={form.course_name} onChange={(e) => setForm({ ...form, course_name: e.target.value })} placeholder="e.g. DevOps" className="input-field" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Trainer Name</label>
            <input value={form.trainer_name} onChange={(e) => setForm({ ...form, trainer_name: e.target.value })} placeholder="Trainer name" className="input-field" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Start Date</label>
              <input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} className="input-field" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Status</label>
              <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className="input-field">
                <option value="active">Active</option>
                <option value="completed">Completed</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Zoom Meeting Link</label>
            <input value={form.zoom_link} onChange={(e) => setForm({ ...form, zoom_link: e.target.value })} placeholder="https://zoom.us/j/..." className="input-field" />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => setShowForm(false)} className="btn-secondary">Cancel</button>
            <button onClick={handleSave} disabled={saving} className="btn-primary">{saving ? 'Saving...' : editing ? 'Save Changes' : 'Create Batch'}</button>
          </div>
        </div>
      </Modal>

      <Modal open={!!detail} onClose={() => setDetail(null)} title={detail?.name || 'Batch'} size="xl">
        {detail && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2 text-sm text-gray-500">
              {detail.course_name && <span className="flex items-center gap-1"><GraduationCap size={14} /> {detail.course_name}</span>}
              {detail.trainer_name && <span>Trainer: {detail.trainer_name}</span>}
              {detail.start_date && <span className="flex items-center gap-1"><Calendar size={14} /> {new Date(detail.start_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</span>}
            </div>
            <div className="flex flex-wrap gap-2">
              {canManage && <button onClick={exportRoster} className="flex items-center gap-1.5 px-3 py-2 bg-white border border-gray-200 text-gray-700 text-xs font-medium rounded-xl hover:bg-gray-50"><Download size={14} /> Export</button>}
              {canManage && <button onClick={openInvite} className="flex items-center gap-1.5 px-3 py-2 bg-white border border-indigo-200 text-indigo-700 text-xs font-medium rounded-xl hover:bg-indigo-50"><Mail size={14} /> Zoom Invite</button>}
              <button onClick={openAddStudents} className="flex items-center gap-1.5 px-3 py-2 bg-primary-600 text-white text-xs font-medium rounded-xl hover:bg-primary-700"><UserPlus size={14} /> Add Students</button>
            </div>

            {detailLoading ? (
              <div className="flex justify-center py-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" /></div>
            ) : (detail.members || []).length === 0 ? (
              <div className="text-center py-10 border-2 border-dashed border-gray-200 rounded-xl">
                <Users size={32} className="mx-auto text-gray-300 mb-2" />
                <p className="text-sm text-gray-500">No students yet.</p>
                <button onClick={openAddStudents} className="mt-2 text-sm font-medium text-primary-600 hover:underline">Add students</button>
              </div>
            ) : (
              <div className="space-y-2">
                {detail.members.map((m) => {
                  const pct = Number(m.total_amount) ? Math.round((Number(m.received) / Number(m.total_amount)) * 100) : 0;
                  return (
                    <div key={m.enrollment_id} className="bg-gray-50 rounded-xl p-3 flex items-center gap-3">
                      <div className="w-9 h-9 bg-primary-100 rounded-lg flex items-center justify-center text-primary-700 text-xs font-bold shrink-0">
                        {m.student_name?.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{m.student_name}</p>
                        <p className="text-xs text-gray-500 truncate">{m.course_name || ''}{m.salesperson_name ? ` · ${m.salesperson_name}` : ''}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-xs text-gray-400">{fmt(m.received)} / {fmt(m.total_amount)}</p>
                        <div className="w-16 h-1.5 bg-gray-200 rounded-full mt-1">
                          <div className={`h-1.5 rounded-full ${pct >= 100 ? 'bg-emerald-500' : 'bg-primary-500'}`} style={{ width: `${Math.min(100, pct)}%` }} />
                        </div>
                      </div>
                      <button onClick={() => handleRemoveMember(m)} title="Remove candidate" className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"><X size={14} /></button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </Modal>

      <Modal open={showAdd} onClose={() => setShowAdd(false)} title={`Add to ${detail?.name || ''}`} size="xl">
        <div className="space-y-3">
          <div className="relative">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input value={enrollSearch} onChange={(e) => setEnrollSearch(e.target.value)} placeholder="Search students..." className="input-field pl-10" />
          </div>
          {selected.length > 0 && <p className="text-xs text-primary-600 font-medium">{selected.length} selected</p>}
          <div className="max-h-80 overflow-y-auto border border-gray-100 rounded-xl">
            {filteredEnrollments.length === 0 ? <p className="text-sm text-gray-500 text-center py-8">No enrollments found</p> : filteredEnrollments.map((e) => {
              const checked = selected.includes(e.id);
              return (
                <label key={e.id} className="flex items-center gap-3 px-4 py-3 border-b border-gray-50 hover:bg-gray-50/60 cursor-pointer">
                  <input type="checkbox" checked={checked} onChange={() => setSelected((prev) => checked ? prev.filter((x) => x !== e.id) : [...prev, e.id])} className="w-4 h-4 accent-primary-600" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{e.student_name}</p>
                    <p className="text-xs text-gray-500 truncate">{e.course_name} · {e.salesperson_name}</p>
                  </div>
                  <span className="text-sm font-medium text-gray-900 shrink-0">{fmt(e.total_amount)}</span>
                </label>
              );
            })}
          </div>
          <div className="flex justify-end gap-3">
            <button onClick={() => setShowAdd(false)} className="btn-secondary">Cancel</button>
            <button onClick={handleAddStudents} disabled={adding || !selected.length} className="btn-primary">
              {adding ? 'Adding...' : `Add ${selected.length || ''} Student${selected.length === 1 ? '' : 's'}`}
            </button>
          </div>
        </div>
      </Modal>

      <Modal open={showInvite} onClose={() => setShowInvite(false)} title="Zoom Invite" size="lg">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Zoom Link</label>
            <div className="flex gap-2">
              <input value={inviteLink} onChange={(e) => setInviteLink(e.target.value)} placeholder="https://zoom.us/j/..." className="input-field flex-1" />
              <button onClick={saveZoomLink} disabled={savingLink} className="btn-primary whitespace-nowrap">{savingLink ? 'Saving...' : 'Save'}</button>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <button onClick={copyEmails} className="flex items-center justify-center gap-2 px-3 py-2.5 bg-white border border-gray-200 text-gray-700 text-sm font-medium rounded-xl hover:bg-gray-50"><Copy size={14} /> Copy Emails</button>
            <button onClick={copyInviteMessage} className="flex items-center justify-center gap-2 px-3 py-2.5 bg-white border border-gray-200 text-gray-700 text-sm font-medium rounded-xl hover:bg-gray-50"><Copy size={14} /> Copy Invite</button>
            <button onClick={openEmailApp} className="flex items-center justify-center gap-2 px-3 py-2.5 bg-indigo-600 text-white text-sm font-medium rounded-xl hover:bg-indigo-700"><Send size={14} /> Open Email</button>
          </div>
          <div className="max-h-64 overflow-y-auto border border-gray-100 rounded-xl">
            {(detail?.members || []).map((m) => (
              <div key={m.enrollment_id} className="flex items-center gap-3 px-4 py-2.5 border-b border-gray-50 last:border-0">
                <div className="w-7 h-7 bg-primary-100 rounded-lg flex items-center justify-center text-primary-700 text-[10px] font-bold shrink-0">{m.student_name?.charAt(0).toUpperCase()}</div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{m.student_name}</p>
                </div>
                <p className="text-xs text-gray-500 truncate max-w-[160px]">{m.student_email || <span className="text-red-400">No email</span>}</p>
              </div>
            ))}
          </div>
        </div>
      </Modal>
    </div>
  );
}
