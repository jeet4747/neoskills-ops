import { useState, useEffect, useCallback } from 'react';
import { Plus, Calendar, Pencil, Trash2, X, Check, ChevronLeft, ChevronRight, Link as LinkIcon, Search, ChevronDown, ChevronUp, ExternalLink } from 'lucide-react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import Modal from '../components/ui/Modal';

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const STATUSES = [
  { value: 'in_future', label: 'In Future', color: 'bg-blue-100 text-blue-700' },
  { value: 'batch_started', label: 'Batch Started', color: 'bg-amber-100 text-amber-700' },
  { value: 'completed', label: 'Completed', color: 'bg-green-100 text-green-700' },
  { value: 'canceled', label: 'Canceled', color: 'bg-red-100 text-red-700' },
];

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

function getCandidateColor(cnf, tnt) {
  const total = cnf + tnt;
  if (total > 10) return { bg: 'bg-green-50', border: 'border-green-200', text: 'text-green-700', badge: 'bg-green-100 text-green-700' };
  if (total >= 5) return { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700', badge: 'bg-amber-100 text-amber-700' };
  if (total > 0) return { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-700', badge: 'bg-red-100 text-red-700' };
  return { bg: 'bg-white', border: 'border-gray-100', text: 'text-gray-400', badge: 'bg-gray-100 text-gray-500' };
}

function getStatusInfo(s) {
  return STATUSES.find((st) => st.value === s) || STATUSES[0];
}

export default function TrainingCalendar() {
  const { user } = useAuth();
  const toast = useToast();
  const [sessions, setSessions] = useState([]);
  const [users, setUsers] = useState([]);
  const [batches, setBatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [month, setMonth] = useState(currentMonth());
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ session_date: '', course_name: '', timing: '', batch_id: '', status: 'in_future' });
  const [saving, setSaving] = useState(false);
  const [editingCell, setEditingCell] = useState(null);
  const [cellValue, setCellValue] = useState('');
  const [nomType, setNomType] = useState('tnt');
  const [myEnrollments, setMyEnrollments] = useState([]);
  const [enrollSearch, setEnrollSearch] = useState('');
  const [sessionEnrollments, setSessionEnrollments] = useState([]);
  const [deleting, setDeleting] = useState(null);
  const [expandedCNF, setExpandedCNF] = useState(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const [sessionsData, usersData, batchesData] = await Promise.all([
        api.calendar.list(month),
        api.users.listSimple(),
        api.batches.list(),
      ]);
      setSessions(sessionsData);
      setUsers(usersData.filter((u) => u.role === 'sales' || u.can_sell));
      setBatches(batchesData);
    } catch (e) { toast.error('Failed to load calendar'); }
    finally { setLoading(false); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month]);

  useEffect(() => { load(); }, [load]);

  function openCreate() {
    setEditing(null);
    setForm({ session_date: new Date().toISOString().slice(0, 10), course_name: '', timing: '', batch_id: '', status: 'in_future' });
    setShowForm(true);
  }

  function openEdit(s) {
    setEditing(s);
    setForm({
      session_date: s.session_date ? s.session_date.slice(0, 10) : '',
      course_name: s.course_name || '',
      timing: s.timing || '',
      batch_id: s.batch_id || '',
      status: s.status || 'in_future',
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

  async function handleStatusChange(s, newStatus) {
    try {
      await api.calendar.update(s.id, { status: newStatus });
      load();
    } catch (e) { toast.error(e.message); }
  }

  async function startEditCell(sessionId, userId) {
    setEditingCell({ sessionId, userId });
    setCellValue('');
    setNomType('tnt');
    setEnrollSearch('');
    setSessionEnrollments([]);
    try {
      const [myEnrolls, currentSession] = await Promise.all([
        api.calendar.myEnrollments(),
        api.calendar.list(month),
      ]);
      setMyEnrollments(myEnrolls);
      const sess = currentSession.find((s) => s.id === sessionId);
      setSessionEnrollments(sess?.confirmed_enrollments || []);
    } catch (e) { /* ignore */ }
  }

  async function saveTNT() {
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

  async function addCNFEnrollment(enrollmentId) {
    try {
      await api.calendar.addEnrollment(editingCell.sessionId, enrollmentId);
      const sess = await api.calendar.list(month);
      const s = sess.find((x) => x.id === editingCell.sessionId);
      setSessionEnrollments(s?.confirmed_enrollments || []);
      load();
    } catch (e) { toast.error(e.message); }
  }

  async function removeCNFEnrollment(enrollmentId) {
    try {
      await api.calendar.removeEnrollment(editingCell.sessionId, enrollmentId);
      const sess = await api.calendar.list(month);
      const s = sess.find((x) => x.id === editingCell.sessionId);
      setSessionEnrollments(s?.confirmed_enrollments || []);
      load();
    } catch (e) { toast.error(e.message); }
  }

  function getNom(session, userId) {
    const n = (session.nominations || []).find((x) => x.user_id === userId);
    return n ? n.tentative_count : 0;
  }

  const totalBySession = (s) => (s.nominations || []).reduce((sum, n) => sum + n.tentative_count, 0);

  const filteredEnrollments = myEnrollments.filter((e) => {
    const addedIds = sessionEnrollments.map((se) => se.enrollment_id);
    if (addedIds.includes(e.id)) return false;
    if (!enrollSearch) return true;
    const q = enrollSearch.toLowerCase();
    return e.course_name?.toLowerCase().includes(q) || e.student_name?.toLowerCase().includes(q);
  });

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Training Calendar</h1>
          <p className="text-sm text-gray-500">Plan sessions, manage batches, track TNT/CNF</p>
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

      {/* Status Legend */}
      <div className="flex flex-wrap items-center gap-2 text-[10px]">
        <span className="text-gray-400 font-semibold uppercase">Candidates:</span>
        <span className="px-2 py-0.5 rounded bg-red-100 text-red-700 font-medium">&lt; 5</span>
        <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-700 font-medium">5-10</span>
        <span className="px-2 py-0.5 rounded bg-green-100 text-green-700 font-medium">&gt; 10</span>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1,2,3].map((i) => <div key={i} className="h-16 skeleton w-full rounded-2xl" />)}
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
                      <th className="text-left px-4 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Module</th>
                      <th className="text-left px-3 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Timing</th>
                      {users.map((u) => (
                        <th key={u.id} className="text-center px-2 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider max-w-[72px]">
                          <div className="flex flex-col items-center">
                            <span className="w-6 h-6 bg-primary-100 text-primary-700 rounded-lg flex items-center justify-center text-[9px] font-bold mb-0.5">{u.name?.charAt(0).toUpperCase()}</span>
                            <span className="truncate w-full text-center text-[10px]">{u.name?.split(' ')[0]}</span>
                          </div>
                        </th>
                      ))}
                      <th className="text-center px-3 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">CNF</th>
                      <th className="text-center px-3 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">TNT</th>
                      <th className="text-center px-3 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                      <th className="px-3 py-3 w-16"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {sessions.map((s) => {
                      const cnf = s.confirmed_count || 0;
                      const tnt = totalBySession(s);
                      const colors = getCandidateColor(cnf, tnt);
                      const st = getStatusInfo(s.status);
                      return (
                        <tr key={s.id} className={`border-b border-gray-50 transition-colors ${colors.bg} hover:opacity-90`}>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <Calendar size={14} className="text-gray-400 shrink-0" />
                              <span className="text-sm font-medium text-gray-900 whitespace-nowrap">{fmtDate(s.session_date)}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <p className="text-sm font-medium text-gray-900">{s.course_name}</p>
                            {s.batch_name && (
                              <span className="inline-flex items-center gap-1 text-[10px] text-primary-600 mt-0.5">
                                <LinkIcon size={9} /> {s.batch_name}
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-3 text-xs text-gray-500 whitespace-nowrap">{s.timing || '—'}</td>
                          {users.map((u) => {
                            const val = getNom(s, u.id);
                            const isEditing = editingCell?.sessionId === s.id && editingCell?.userId === u.id;
                            return (
                              <td key={u.id} className="px-2 py-3 text-center">
                                {isEditing ? (
                                  <div className="flex items-center justify-center gap-0.5">
                                    <input type="number" min="0" value={cellValue}
                                      onChange={(e) => setCellValue(e.target.value)}
                                      onKeyDown={(e) => { if (e.key === 'Enter') saveTNT(); if (e.key === 'Escape') setEditingCell(null); }}
                                      className="w-10 h-6 text-center text-xs border border-primary-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                                      autoFocus />
                                    <button onClick={saveTNT} className="p-0.5 text-emerald-600 hover:bg-emerald-50 rounded"><Check size={12} /></button>
                                  </div>
                                ) : (
                                  <button onClick={() => startEditCell(s.id, u.id)}
                                    className={`h-6 px-1.5 rounded-md text-[11px] font-medium transition-colors ${val > 0 ? 'bg-primary-50 text-primary-700 hover:bg-primary-100' : 'text-gray-300 hover:bg-gray-100'}`}>
                                    {val > 0 ? val : '—'}
                                  </button>
                                )}
                              </td>
                            );
                          })}
                          <td className="px-3 py-3 text-center">
                            <button onClick={() => setExpandedCNF(expandedCNF === s.id ? null : s.id)}
                              className="text-sm font-bold text-blue-600 hover:underline">
                              {cnf}
                            </button>
                          </td>
                          <td className="px-3 py-3 text-center">
                            <span className="text-sm font-bold text-amber-600">{tnt}</span>
                          </td>
                          <td className="px-3 py-3 text-center">
                            <select value={s.status || 'in_future'} onChange={(e) => handleStatusChange(s, e.target.value)}
                              className={`text-[10px] font-semibold px-2 py-1 rounded-lg border-0 cursor-pointer focus:ring-2 focus:ring-primary-500 ${st.color}`}>
                              {STATUSES.map((st) => (
                                <option key={st.value} value={st.value}>{st.label}</option>
                              ))}
                            </select>
                          </td>
                          <td className="px-3 py-3">
                            <div className="flex items-center gap-0.5">
                              <button onClick={() => openEdit(s)} className="p-1 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg"><Pencil size={13} /></button>
                              <button onClick={() => setDeleting(s)} className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"><Trash2 size={13} /></button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Mobile Cards */}
          <div className="lg:hidden space-y-3">
            {sessions.map((s) => {
              const cnf = s.confirmed_count || 0;
              const tnt = totalBySession(s);
              const total = cnf + tnt;
              const st = getStatusInfo(s.status);
              return (
                <div key={s.id} className={`rounded-2xl border shadow-sm overflow-hidden ${getCandidateColor(cnf, tnt).bg} ${getCandidateColor(cnf, tnt).border}`}>
                  <div className="px-4 pt-4 pb-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 text-xs text-gray-400 mb-1">
                          <Calendar size={12} />
                          <span className="font-medium">{fmtDate(s.session_date)}</span>
                          {s.timing && <span className="text-gray-300">·</span>}
                          {s.timing && <span>{s.timing}</span>}
                        </div>
                        <h3 className="text-sm font-bold text-gray-900">{s.course_name}</h3>
                        {s.batch_name && (
                          <span className="inline-flex items-center gap-1 text-[10px] text-primary-600 mt-0.5">
                            <LinkIcon size={9} /> {s.batch_name}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button onClick={() => openEdit(s)} className="p-1.5 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg"><Pencil size={14} /></button>
                        <button onClick={() => setDeleting(s)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"><Trash2 size={14} /></button>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 mt-3">
                      <button onClick={() => setExpandedCNF(expandedCNF === `mob-${s.id}` ? null : `mob-${s.id}`)}
                        className="flex items-center gap-1.5">
                        <span className="text-[10px] text-gray-400 uppercase font-semibold">CNF</span>
                        <span className="text-sm font-bold text-blue-600">{cnf}</span>
                        {(s.confirmed_enrollments || []).length > 0 && (
                          expandedCNF === `mob-${s.id}` ? <ChevronUp size={10} className="text-blue-400" /> : <ChevronDown size={10} className="text-blue-400" />
                        )}
                      </button>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] text-gray-400 uppercase font-semibold">TNT</span>
                        <span className="text-sm font-bold text-amber-600">{tnt}</span>
                      </div>
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-lg ${st.color}`}>{st.label}</span>
                    </div>
                    {expandedCNF === `mob-${s.id}` && (s.confirmed_enrollments || []).length > 0 && (
                      <div className="mt-2 space-y-1">
                        {(s.confirmed_enrollments || []).map((ce, idx) => (
                          <div key={idx} className="flex items-center gap-2 p-1.5 bg-white/60 rounded-lg">
                            <span className="w-5 h-5 bg-blue-100 text-blue-700 rounded-md flex items-center justify-center text-[8px] font-bold shrink-0">
                              {ce.user_name?.charAt(0).toUpperCase()}
                            </span>
                            <span className="text-xs font-medium text-gray-900 truncate">{ce.student_name || ce.enrollment_name}</span>
                            <span className="text-[10px] text-blue-600 shrink-0">by {ce.user_name}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="border-t border-gray-100/50 px-4 py-3">
                    <div className="grid grid-cols-3 gap-2">
                      {users.map((u) => {
                        const val = getNom(s, u.id);
                        const cnfUser = (s.confirmed_enrollments || []).filter((ce) => ce.user_id === u.id).length;
                        return (
                          <button key={u.id} onClick={() => startEditCell(s.id, u.id)}
                            className="flex items-center gap-1.5 p-2 rounded-xl bg-white/60 hover:bg-white transition-colors text-left">
                            <span className="w-6 h-6 bg-primary-100 text-primary-700 rounded-md flex items-center justify-center text-[9px] font-bold shrink-0">{u.name?.charAt(0).toUpperCase()}</span>
                            <div className="min-w-0 flex-1">
                              <p className="text-[10px] text-gray-500 truncate">{u.name?.split(' ')[0]}</p>
                              <div className="flex items-center gap-1">
                                {val > 0 && <span className="text-[9px] font-semibold px-1 py-0.5 rounded bg-amber-100 text-amber-700">T{val}</span>}
                                {cnfUser > 0 && <span className="text-[9px] font-semibold px-1 py-0.5 rounded bg-blue-100 text-blue-700">C{cnfUser}</span>}
                                {val === 0 && cnfUser === 0 && <span className="text-xs text-gray-300">—</span>}
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Mobile/Edit Modal with TNT/CNF toggle */}
      <Modal open={!!editingCell} onClose={() => setEditingCell(null)} title="Update Nomination" size="sm">
        {editingCell && (() => {
          const session = sessions.find((s) => s.id === editingCell.sessionId);
          const userObj = users.find((u) => u.id === editingCell.userId);
          return (
            <div className="space-y-4">
              <div className="text-center">
                <p className="text-sm text-gray-500">{session?.course_name}</p>
                <p className="text-xs text-gray-400 mt-1">{fmtDate(session?.session_date)}</p>
              </div>
              <div className="text-center">
                <div className="w-12 h-12 bg-primary-100 text-primary-700 rounded-2xl flex items-center justify-center text-lg font-bold mx-auto mb-2">
                  {userObj?.name?.charAt(0).toUpperCase()}
                </div>
                <p className="text-sm font-semibold text-gray-900">{userObj?.name}</p>
              </div>

              <div className="flex bg-gray-100 rounded-xl p-1">
                <button onClick={() => setNomType('tnt')}
                  className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all ${nomType === 'tnt' ? 'bg-white text-amber-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                  TNT (Tentative)
                </button>
                <button onClick={() => setNomType('cnf')}
                  className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all ${nomType === 'cnf' ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                  CNF (Confirmed)
                </button>
              </div>

              {nomType === 'tnt' ? (
                <>
                  <div className="flex items-center justify-center gap-3">
                    <button onClick={() => setCellValue(String(Math.max(0, parseInt(cellValue) - 1)))}
                      className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center text-lg font-bold text-gray-600 hover:bg-gray-200">−</button>
                    <input type="number" min="0" value={cellValue}
                      onChange={(e) => setCellValue(e.target.value)}
                      className="w-20 h-12 text-center text-2xl font-bold border-2 border-amber-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-400" />
                    <button onClick={() => setCellValue(String(parseInt(cellValue) + 1))}
                      className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center text-lg font-bold text-amber-700 hover:bg-amber-200">+</button>
                  </div>
                  <div className="flex gap-2 pt-2">
                    <button onClick={() => setEditingCell(null)} className="btn-secondary flex-1">Cancel</button>
                    <button onClick={saveTNT} className="btn-primary flex-1">Save</button>
                  </div>
                </>
              ) : (
                <div className="space-y-3">
                  <div className="relative">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input value={enrollSearch} onChange={(e) => setEnrollSearch(e.target.value)}
                      placeholder="Search student or course..."
                      className="input-field pl-8 text-sm" />
                  </div>

                  {sessionEnrollments.length > 0 && (
                    <div>
                      <p className="text-[10px] uppercase font-semibold text-blue-600 mb-1.5">Confirmed ({sessionEnrollments.length})</p>
                      <div className="space-y-1.5 max-h-40 overflow-y-auto">
                        {sessionEnrollments.filter((se) => se.user_id === editingCell.userId).map((se) => (
                          <div key={se.enrollment_id} className="flex items-center justify-between p-2 bg-blue-50 rounded-xl">
                            <div className="min-w-0">
                              <p className="text-xs font-medium text-gray-900 truncate">{se.student_name || se.enrollment_name}</p>
                              <p className="text-[10px] text-gray-400">{se.enrollment_name}</p>
                            </div>
                            <button onClick={() => removeCNFEnrollment(se.enrollment_id)}
                              className="p-1 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg shrink-0">
                              <X size={14} />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div>
                    <p className="text-[10px] uppercase font-semibold text-gray-400 mb-1.5">
                      {sessionEnrollments.length > 0 ? 'Add More' : 'Select Enrollments'}
                    </p>
                    <div className="space-y-1.5 max-h-40 overflow-y-auto">
                      {filteredEnrollments.length === 0 ? (
                        <p className="text-xs text-gray-400 py-2 text-center">
                          {myEnrollments.length === 0 ? 'No active enrollments assigned to you' : 'No matching enrollments'}
                        </p>
                      ) : (
                        filteredEnrollments.map((e) => (
                          <button key={e.id} onClick={() => addCNFEnrollment(e.id)}
                            className="w-full flex items-center justify-between p-2 bg-gray-50 hover:bg-blue-50 rounded-xl transition-colors text-left">
                            <div className="min-w-0">
                              <p className="text-xs font-medium text-gray-900 truncate">{e.student_name || 'Unknown'}</p>
                              <p className="text-[10px] text-gray-400 truncate">{e.course_name}</p>
                            </div>
                            <Plus size={14} className="text-blue-500 shrink-0" />
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                  <div className="pt-2">
                    <button onClick={() => setEditingCell(null)} className="btn-primary w-full">Done</button>
                  </div>
                </div>
              )}
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
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Link to Batch</label>
            <select value={form.batch_id} onChange={(e) => setForm({ ...form, batch_id: e.target.value })} className="input-field">
              <option value="">— No batch linked —</option>
              {batches.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Status</label>
            <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className="input-field">
              {STATUSES.map((st) => (
                <option key={st.value} value={st.value}>{st.label}</option>
              ))}
            </select>
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
