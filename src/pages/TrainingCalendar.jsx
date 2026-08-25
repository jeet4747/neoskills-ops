import { useState, useEffect, useCallback } from 'react';
import { Plus, Calendar, Pencil, Trash2, X, Check, ChevronLeft, ChevronRight } from 'lucide-react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import Modal from '../components/ui/Modal';

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function getMonthLabel(m) {
  const [y, mo] = m.split('-');
  return `${MONTHS[parseInt(mo, 10) - 1]} ${y}`;
}

function currentMonth() {
  return new Date().toISOString().slice(0, 7);
}

function prevMonth(m) {
  const d = new Date(m + '-01');
  d.setMonth(d.getMonth() - 1);
  return d.toISOString().slice(0, 7);
}

function nextMonth(m) {
  const d = new Date(m + '-01');
  d.setMonth(d.getMonth() + 1);
  return d.toISOString().slice(0, 7);
}

function fmtDate(d) {
  if (!d) return '';
  const dt = new Date(d);
  return `${dt.getDate()}-${MONTHS[dt.getMonth()]}-${dt.getFullYear()}`;
}

export default function TrainingCalendar() {
  const { user } = useAuth();
  const toast = useToast();
  const [sessions, setSessions] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [month, setMonth] = useState(currentMonth());
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ session_date: '', course_name: '', timing: '', batch_id: '' });
  const [saving, setSaving] = useState(false);
  const [editingCell, setEditingCell] = useState(null);
  const [cellValue, setCellValue] = useState('');
  const [deleting, setDeleting] = useState(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const [sessionsData, usersData] = await Promise.all([
        api.calendar.list(month),
        api.users.listSimple(),
      ]);
      setSessions(sessionsData);
      setUsers(usersData.filter((u) => u.role === 'sales' || u.can_sell));
    } catch (e) { toast.error('Failed to load calendar'); }
    finally { setLoading(false); }
  }, [month, toast]);

  useEffect(() => { load(); }, [load]);

  function openCreate() {
    setEditing(null);
    setForm({ session_date: new Date().toISOString().slice(0, 10), course_name: '', timing: '', batch_id: '' });
    setShowForm(true);
  }

  function openEdit(s) {
    setEditing(s);
    setForm({
      session_date: s.session_date ? s.session_date.slice(0, 10) : '',
      course_name: s.course_name || '',
      timing: s.timing || '',
      batch_id: s.batch_id || '',
    });
    setShowForm(true);
  }

  async function handleSave() {
    if (!form.session_date || !form.course_name.trim()) { toast.error('Date and course name required'); return; }
    try {
      setSaving(true);
      const payload = { ...form, batch_id: form.batch_id ? parseInt(form.batch_id) : null };
      if (editing) await api.calendar.update(editing.id, payload);
      else await api.calendar.create(payload);
      toast.success(editing ? 'Session updated' : 'Session created');
      setShowForm(false);
      load();
    } catch (e) { toast.error(e.message); }
    finally { setSaving(false); }
  }

  async function handleDelete(s) {
    try {
      setDeleting(null);
      await api.calendar.remove(s.id);
      toast.success('Session deleted');
      load();
    } catch (e) { toast.error(e.message); }
  }

  function startEditCell(sessionId, userId, currentVal) {
    setEditingCell({ sessionId, userId });
    setCellValue(String(currentVal || ''));
  }

  async function saveCell() {
    if (!editingCell) return;
    const val = parseInt(cellValue) || 0;
    const session = sessions.find((s) => s.id === editingCell.sessionId);
    const noms = users.map((u) => {
      if (u.id === editingCell.userId) return { user_id: u.id, tentative_count: val };
      const existing = (session?.nominations || []).find((n) => n.user_id === u.id);
      return { user_id: u.id, tentative_count: existing ? existing.tentative_count : 0 };
    });
    try {
      await api.calendar.saveNominations(editingCell.sessionId, noms);
      setEditingCell(null);
      load();
    } catch (e) { toast.error(e.message); }
  }

  function getNom(session, userId) {
    const n = (session.nominations || []).find((x) => x.user_id === userId);
    return n ? n.tentative_count : 0;
  }

  const totalBySession = (s) => (s.nominations || []).reduce((sum, n) => sum + n.tentative_count, 0);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Training Calendar</h1>
          <p className="text-sm text-gray-500">Plan upcoming sessions and track nominations</p>
        </div>
        <button onClick={openCreate} className="btn-primary flex items-center gap-2 shadow-sm">
          <Plus size={16} /> New Session
        </button>
      </div>

      {/* Month Selector */}
      <div className="flex items-center justify-center gap-3">
        <button onClick={() => setMonth(prevMonth(month))} className="p-2 rounded-xl hover:bg-gray-100 transition-colors">
          <ChevronLeft size={20} className="text-gray-600" />
        </button>
        <span className="text-base font-bold text-gray-900 min-w-[140px] text-center">{getMonthLabel(month)}</span>
        <button onClick={() => setMonth(nextMonth(month))} className="p-2 rounded-xl hover:bg-gray-100 transition-colors">
          <ChevronRight size={20} className="text-gray-600" />
        </button>
        {month !== currentMonth() && (
          <button onClick={() => setMonth(currentMonth())} className="text-xs text-primary-600 font-medium hover:underline ml-1">
            Today
          </button>
        )}
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1,2,3].map((i) => <div key={i} className="h-20 skeleton w-full rounded-2xl" />)}
        </div>
      ) : sessions.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-gray-100">
          <Calendar size={40} className="mx-auto text-gray-300 mb-3" />
          <p className="text-gray-500 text-sm mb-3">No sessions planned for {getMonthLabel(month)}</p>
          <button onClick={openCreate} className="btn-primary text-sm">Add First Session</button>
        </div>
      ) : (
        <>
          {/* Desktop Table */}
          <div className="hidden lg:block">
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50/50">
                      <th className="text-left px-4 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Date</th>
                      <th className="text-left px-4 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Module / Timing</th>
                      <th className="text-center px-3 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">CNF</th>
                      <th className="text-center px-3 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">TNT</th>
                      {users.map((u) => (
                        <th key={u.id} className="text-center px-3 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider max-w-[80px]">
                          <div className="flex flex-col items-center">
                            <span className="w-7 h-7 bg-primary-100 text-primary-700 rounded-lg flex items-center justify-center text-[10px] font-bold mb-0.5">{u.name?.charAt(0).toUpperCase()}</span>
                            <span className="truncate w-full text-center">{u.name?.split(' ')[0]}</span>
                          </div>
                        </th>
                      ))}
                      <th className="px-4 py-3 w-20"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {sessions.map((s) => (
                      <tr key={s.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <Calendar size={14} className="text-gray-400 shrink-0" />
                            <span className="text-sm font-medium text-gray-900 whitespace-nowrap">{fmtDate(s.session_date)}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-sm font-medium text-gray-900">{s.course_name}</p>
                          {s.timing && <p className="text-xs text-gray-400">{s.timing}</p>}
                        </td>
                        <td className="px-3 py-3 text-center">
                          <span className="text-sm font-bold text-blue-600">{s.confirmed_count || 0}</span>
                        </td>
                        <td className="px-3 py-3 text-center">
                          <span className="text-sm font-bold text-amber-600">{totalBySession(s)}</span>
                        </td>
                        {users.map((u) => {
                          const isEditing = editingCell?.sessionId === s.id && editingCell?.userId === u.id;
                          const val = getNom(s, u.id);
                          return (
                            <td key={u.id} className="px-3 py-3 text-center">
                              {isEditing ? (
                                <div className="flex items-center justify-center gap-1">
                                  <input type="number" min="0" value={cellValue}
                                    onChange={(e) => setCellValue(e.target.value)}
                                    onKeyDown={(e) => { if (e.key === 'Enter') saveCell(); if (e.key === 'Escape') setEditingCell(null); }}
                                    className="w-12 h-7 text-center text-sm border border-primary-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                                    autoFocus />
                                  <button onClick={saveCell} className="p-0.5 text-emerald-600 hover:bg-emerald-50 rounded"><Check size={14} /></button>
                                </div>
                              ) : (
                                <button onClick={() => startEditCell(s.id, u.id, val)}
                                  className={`w-10 h-7 rounded-lg text-sm font-medium transition-colors ${val > 0 ? 'bg-primary-50 text-primary-700 hover:bg-primary-100' : 'text-gray-300 hover:bg-gray-100 hover:text-gray-500'}`}>
                                  {val || '—'}
                                </button>
                              )}
                            </td>
                          );
                        })}
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1">
                            <button onClick={() => openEdit(s)} className="p-1.5 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors" title="Edit"><Pencil size={14} /></button>
                            <button onClick={() => setDeleting(s)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Delete"><Trash2 size={14} /></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Mobile Cards */}
          <div className="lg:hidden space-y-3">
            {sessions.map((s) => (
              <div key={s.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                {/* Card Header */}
                <div className="px-4 pt-4 pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2 text-xs text-gray-400 mb-1">
                        <Calendar size={12} />
                        <span className="font-medium">{fmtDate(s.session_date)}</span>
                      </div>
                      <h3 className="text-sm font-bold text-gray-900">{s.course_name}</h3>
                      {s.timing && <p className="text-xs text-gray-500 mt-0.5">{s.timing}</p>}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button onClick={() => openEdit(s)} className="p-1.5 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg"><Pencil size={14} /></button>
                      <button onClick={() => setDeleting(s)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"><Trash2 size={14} /></button>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 mt-3">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] text-gray-400 uppercase font-semibold">CNF</span>
                      <span className="text-sm font-bold text-blue-600">{s.confirmed_count || 0}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] text-gray-400 uppercase font-semibold">TNT</span>
                      <span className="text-sm font-bold text-amber-600">{totalBySession(s)}</span>
                    </div>
                  </div>
                </div>

                {/* Salesperson Grid */}
                <div className="border-t border-gray-50 px-4 py-3">
                  <div className="grid grid-cols-3 gap-2">
                    {users.map((u) => {
                      const isEditing = editingCell?.sessionId === s.id && editingCell?.userId === u.id;
                      const val = getNom(s, u.id);
                      return (
                        <button key={u.id} onClick={() => startEditCell(s.id, u.id, val)}
                          className="flex items-center gap-1.5 p-2 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors text-left">
                          <span className="w-6 h-6 bg-primary-100 text-primary-700 rounded-md flex items-center justify-center text-[9px] font-bold shrink-0">{u.name?.charAt(0).toUpperCase()}</span>
                          <div className="min-w-0 flex-1">
                            <p className="text-[10px] text-gray-500 truncate">{u.name?.split(' ')[0]}</p>
                            <p className={`text-xs font-bold ${val > 0 ? 'text-primary-700' : 'text-gray-300'}`}>{val || '—'}</p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Mobile Edit Modal */}
      <Modal open={!!editingCell} onClose={() => setEditingCell(null)} title="Update Count" size="sm">
        {editingCell && (() => {
          const session = sessions.find((s) => s.id === editingCell.sessionId);
          const user = users.find((u) => u.id === editingCell.userId);
          return (
            <div className="space-y-4">
              <div className="text-center">
                <p className="text-sm text-gray-500">{session?.course_name}</p>
                <p className="text-xs text-gray-400 mt-1">{fmtDate(session?.session_date)}</p>
              </div>
              <div className="text-center">
                <div className="w-12 h-12 bg-primary-100 text-primary-700 rounded-2xl flex items-center justify-center text-lg font-bold mx-auto mb-2">
                  {user?.name?.charAt(0).toUpperCase()}
                </div>
                <p className="text-sm font-semibold text-gray-900">{user?.name}</p>
              </div>
              <div className="flex items-center justify-center gap-3">
                <button onClick={() => setCellValue(String(Math.max(0, parseInt(cellValue) - 1)))}
                  className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center text-lg font-bold text-gray-600 hover:bg-gray-200">−</button>
                <input type="number" min="0" value={cellValue}
                  onChange={(e) => setCellValue(e.target.value)}
                  className="w-20 h-12 text-center text-2xl font-bold border-2 border-primary-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500" />
                <button onClick={() => setCellValue(String(parseInt(cellValue) + 1))}
                  className="w-10 h-10 bg-primary-100 rounded-xl flex items-center justify-center text-lg font-bold text-primary-700 hover:bg-primary-200">+</button>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setEditingCell(null)} className="btn-secondary flex-1">Cancel</button>
                <button onClick={saveCell} className="btn-primary flex-1">Save</button>
              </div>
            </div>
          );
        })()}
      </Modal>

      {/* Create/Edit Session Modal */}
      <Modal open={showForm} onClose={() => setShowForm(false)} title={editing ? 'Edit Session' : 'New Session'} size="sm">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Date *</label>
            <input type="date" value={form.session_date} onChange={(e) => setForm({ ...form, session_date: e.target.value })} className="input-field" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Course / Module *</label>
            <input value={form.course_name} onChange={(e) => setForm({ ...form, course_name: e.target.value })}
              placeholder="e.g. AWS EVENING BATCH" className="input-field" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Timing</label>
            <input value={form.timing} onChange={(e) => setForm({ ...form, timing: e.target.value })}
              placeholder="e.g. 4PM TO 7.30PM" className="input-field" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Link to Batch (optional)</label>
            <input type="number" value={form.batch_id} onChange={(e) => setForm({ ...form, batch_id: e.target.value })}
              placeholder="Batch ID" className="input-field" />
          </div>
          <div className="flex gap-2 pt-2">
            <button onClick={() => setShowForm(false)} className="btn-secondary flex-1">Cancel</button>
            <button onClick={handleSave} disabled={saving} className="btn-primary flex-1">{saving ? 'Saving...' : editing ? 'Update' : 'Create'}</button>
          </div>
        </div>
      </Modal>

      {/* Delete Confirm */}
      <Modal open={!!deleting} onClose={() => setDeleting(null)} title="Delete Session" size="sm">
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Delete <strong>{deleting?.course_name}</strong> on {fmtDate(deleting?.session_date)}?
          </p>
          <div className="flex gap-2">
            <button onClick={() => setDeleting(null)} className="btn-secondary flex-1">Cancel</button>
            <button onClick={() => handleDelete(deleting)} className="flex-1 px-4 py-2.5 bg-red-600 text-white text-sm font-medium rounded-xl hover:bg-red-700 transition-colors">Delete</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
