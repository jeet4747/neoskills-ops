import { useState, useEffect, useCallback } from 'react';
import {
  Plus, Calendar, Pencil, Trash2, X, Check, ChevronLeft, ChevronRight,
  Link as LinkIcon, Search, ChevronDown, ChevronUp, Users, Zap, BookOpen,
} from 'lucide-react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { Card, CardBody } from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import Modal from '../components/ui/Modal';

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const STATUSES = [
  { value: 'in_future', label: 'In Future', variant: 'pending' },
  { value: 'batch_started', label: 'Batch Started', variant: 'active' },
  { value: 'completed', label: 'Completed', variant: 'completed' },
  { value: 'canceled', label: 'Canceled', variant: 'rejected' },
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
  return `${dt.getDate()} ${MONTHS[dt.getMonth()]} ${dt.getFullYear()}`;
}

function getSeatColor(cnf, tnt) {
  const total = cnf + tnt;
  if (total > 10) return 'border-l-emerald-500';
  if (total >= 5) return 'border-l-amber-400';
  if (total > 0) return 'border-l-red-400';
  return 'border-l-gray-200';
}

function getSeatBadge(cnf, tnt) {
  const total = cnf + tnt;
  if (total > 10) return { text: 'text-emerald-700', bg: 'bg-emerald-50' };
  if (total >= 5) return { text: 'text-amber-700', bg: 'bg-amber-50' };
  if (total > 0) return { text: 'text-red-600', bg: 'bg-red-50' };
  return { text: 'text-gray-400', bg: 'bg-gray-50' };
}

function getStatusVariant(s) {
  return STATUSES.find((st) => st.value === s)?.variant || 'pending';
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

  const totalCNF = sessions.reduce((s, x) => s + (x.confirmed_count || 0), 0);
  const totalTNT = sessions.reduce((s, x) => s + (x.nominations || []).reduce((a, n) => a + n.tentative_count, 0), 0);

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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Training Calendar</h1>
          <p className="text-sm text-gray-500 mt-0.5">Plan sessions, manage batches, track nominations</p>
        </div>
        <button onClick={openCreate} className="btn-primary flex items-center gap-2 shadow-sm">
          <Plus size={16} /> New Session
        </button>
      </div>

      {/* Stats + Month Nav */}
      <Card>
        <CardBody className="py-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary-50 rounded-xl">
                <Calendar size={20} className="text-primary-600" />
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => setMonth(prevMonth(month))} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
                  <ChevronLeft size={18} className="text-gray-500" />
                </button>
                <span className="text-lg font-bold text-gray-900 min-w-[120px] text-center">{getMonthLabel(month)}</span>
                <button onClick={() => setMonth(nextMonth(month))} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
                  <ChevronRight size={18} className="text-gray-500" />
                </button>
                {month !== currentMonth() && (
                  <button onClick={() => setMonth(currentMonth())} className="text-xs text-primary-600 font-medium hover:underline ml-1">
                    Today
                  </button>
                )}
              </div>
            </div>
            <div className="flex items-center gap-5">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-blue-500" />
                <span className="text-xs text-gray-500">Sessions</span>
                <span className="text-sm font-bold text-gray-900">{sessions.length}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-blue-400" />
                <span className="text-xs text-gray-500">CNF</span>
                <span className="text-sm font-bold text-blue-600">{totalCNF}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-amber-400" />
                <span className="text-xs text-gray-500">TNT</span>
                <span className="text-sm font-bold text-amber-600">{totalTNT}</span>
              </div>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Seat Legend */}
      <div className="flex items-center gap-4 text-xs text-gray-500">
        <span className="font-medium">Seats:</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded border-l-2 border-l-red-400 bg-red-50" /> Low (&lt;5)</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded border-l-2 border-l-amber-400 bg-amber-50" /> Medium (5-10)</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded border-l-2 border-l-emerald-500 bg-emerald-50" /> High (&gt;10)</span>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1,2,3,4].map((i) => <div key={i} className="h-16 skeleton w-full rounded-xl" />)}
        </div>
      ) : sessions.length === 0 ? (
        <Card>
          <CardBody className="py-16 text-center">
            <div className="w-14 h-14 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Calendar size={24} className="text-gray-300" />
            </div>
            <p className="text-gray-500 text-sm mb-1">No sessions planned for {getMonthLabel(month)}</p>
            <p className="text-gray-400 text-xs mb-4">Create a session to start tracking nominations</p>
            <button onClick={openCreate} className="btn-primary text-sm">Create Session</button>
          </CardBody>
        </Card>
      ) : (
        <>
          {/* Desktop Table */}
          <div className="hidden lg:block">
            <Card>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="text-left px-5 py-3.5 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Date</th>
                      <th className="text-left px-5 py-3.5 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Module / Batch</th>
                      <th className="text-left px-4 py-3.5 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Timing</th>
                      {users.map((u) => (
                        <th key={u.id} className="text-center px-2 py-3.5 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                          <div className="flex flex-col items-center">
                            <span className="w-7 h-7 bg-primary-50 text-primary-600 rounded-lg flex items-center justify-center text-[10px] font-bold mb-0.5">{u.name?.charAt(0).toUpperCase()}</span>
                            <span className="text-[10px] truncate w-full text-center">{u.name?.split(' ')[0]}</span>
                          </div>
                        </th>
                      ))}
                      <th className="text-center px-3 py-3.5 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">CNF</th>
                      <th className="text-center px-3 py-3.5 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">TNT</th>
                      <th className="text-center px-3 py-3.5 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Status</th>
                      <th className="px-4 py-3.5 w-16"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {sessions.map((s) => {
                      const cnf = s.confirmed_count || 0;
                      const tnt = totalBySession(s);
                      const borderC = getSeatColor(cnf, tnt);
                      const st = getStatusVariant(s.status);
                      return (
                        <tr key={s.id} className={`border-l-3 ${borderC} hover:bg-gray-50/50 transition-colors`}>
                          <td className="px-5 py-3.5">
                            <div className="flex items-center gap-2">
                              <Calendar size={14} className="text-gray-300 shrink-0" />
                              <span className="text-sm font-medium text-gray-900 whitespace-nowrap">{fmtDate(s.session_date)}</span>
                            </div>
                          </td>
                          <td className="px-5 py-3.5">
                            <p className="text-sm font-semibold text-gray-900">{s.course_name}</p>
                            {s.batch_name && (
                              <span className="inline-flex items-center gap-1 text-[11px] text-gray-400 mt-0.5">
                                <LinkIcon size={9} /> {s.batch_name}
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3.5 text-xs text-gray-500">{s.timing || '—'}</td>
                          {users.map((u) => {
                            const val = getNom(s, u.id);
                            const isEditing = editingCell?.sessionId === s.id && editingCell?.userId === u.id;
                            return (
                              <td key={u.id} className="px-2 py-3.5 text-center">
                                {isEditing ? (
                                  <div className="flex items-center justify-center gap-0.5">
                                    <input type="number" min="0" value={cellValue}
                                      onChange={(e) => setCellValue(e.target.value)}
                                      onKeyDown={(e) => { if (e.key === 'Enter') saveTNT(); if (e.key === 'Escape') setEditingCell(null); }}
                                      className="w-10 h-7 text-center text-xs border border-primary-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                                      autoFocus />
                                    <button onClick={saveTNT} className="p-0.5 text-emerald-600 hover:bg-emerald-50 rounded-md"><Check size={12} /></button>
                                  </div>
                                ) : (
                                  <button onClick={() => startEditCell(s.id, u.id)}
                                    className={`inline-flex items-center justify-center h-7 min-w-[28px] px-1.5 rounded-lg text-[11px] font-medium transition-all ${val > 0 ? 'bg-primary-50 text-primary-700 hover:bg-primary-100 cursor-pointer' : 'text-gray-200 hover:bg-gray-100 hover:text-gray-400 cursor-pointer'}`}>
                                    {val > 0 ? val : '—'}
                                  </button>
                                )}
                              </td>
                            );
                          })}
                          <td className="px-3 py-3.5 text-center">
                            <button onClick={() => setExpandedCNF(expandedCNF === s.id ? null : s.id)}
                              className="inline-flex items-center gap-0.5 text-sm font-bold text-blue-600 hover:text-blue-700 transition-colors">
                              {cnf}
                              {cnf > 0 && (expandedCNF === s.id ? <ChevronUp size={10} /> : <ChevronDown size={10} />)}
                            </button>
                          </td>
                          <td className="px-3 py-3.5 text-center">
                            <span className="text-sm font-bold text-amber-600">{tnt}</span>
                          </td>
                          <td className="px-3 py-3.5 text-center">
                            <Badge status={st}>{STATUSES.find((x) => x.value === s.status)?.label}</Badge>
                          </td>
                          <td className="px-4 py-3.5">
                            <div className="flex items-center gap-0.5 justify-end">
                              <button onClick={() => openEdit(s)} className="p-1.5 text-gray-300 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"><Pencil size={13} /></button>
                              <button onClick={() => setDeleting(s)} className="p-1.5 text-gray-300 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"><Trash2 size={13} /></button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>

          {/* Mobile Cards */}
          <div className="lg:hidden space-y-3">
            {sessions.map((s) => {
              const cnf = s.confirmed_count || 0;
              const tnt = totalBySession(s);
              const total = cnf + tnt;
              const st = getStatusVariant(s.status);
              const sc = getSeatBadge(cnf, tnt);
              return (
                <Card key={s.id}>
                  <div className={`border-l-3 ${getSeatColor(cnf, tnt)}`}>
                    <CardBody className="py-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-[11px] text-gray-400 font-medium">{fmtDate(s.session_date)}</span>
                            {s.timing && (
                              <>
                                <span className="text-gray-200">·</span>
                                <span className="text-[11px] text-gray-400">{s.timing}</span>
                              </>
                            )}
                          </div>
                          <h3 className="text-sm font-bold text-gray-900 leading-tight">{s.course_name}</h3>
                          {s.batch_name && (
                            <span className="inline-flex items-center gap-1 text-[11px] text-gray-400 mt-1">
                              <LinkIcon size={9} /> {s.batch_name}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button onClick={() => openEdit(s)} className="p-1.5 text-gray-300 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"><Pencil size={14} /></button>
                          <button onClick={() => setDeleting(s)} className="p-1.5 text-gray-300 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"><Trash2 size={14} /></button>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 mt-3">
                        <button onClick={() => setExpandedCNF(expandedCNF === `mob-${s.id}` ? null : `mob-${s.id}`)}
                          className="flex items-center gap-1.5 hover:opacity-80 transition-opacity">
                          <span className="text-[10px] text-gray-400 uppercase font-semibold tracking-wider">CNF</span>
                          <span className={`text-sm font-bold ${cnf > 0 ? 'text-blue-600' : 'text-gray-300'}`}>{cnf}</span>
                          {cnf > 0 && (
                            expandedCNF === `mob-${s.id}` ? <ChevronUp size={10} className="text-gray-300" /> : <ChevronDown size={10} className="text-gray-300" />
                          )}
                        </button>
                        <div className="w-px h-3 bg-gray-200" />
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] text-gray-400 uppercase font-semibold tracking-wider">TNT</span>
                          <span className={`text-sm font-bold ${tnt > 0 ? 'text-amber-600' : 'text-gray-300'}`}>{tnt}</span>
                        </div>
                        <div className="w-px h-3 bg-gray-200" />
                        <Badge status={st} className="text-[10px]">{STATUSES.find((x) => x.value === s.status)?.label}</Badge>
                      </div>

                      {expandedCNF === `mob-${s.id}` && (s.confirmed_enrollments || []).length > 0 && (
                        <div className="mt-3 pt-3 border-t border-gray-100 space-y-1.5">
                          {(s.confirmed_enrollments || []).map((ce, idx) => (
                            <div key={idx} className="flex items-center gap-2 py-1">
                              <span className="w-6 h-6 bg-blue-50 text-blue-600 rounded-md flex items-center justify-center text-[9px] font-bold shrink-0">
                                {ce.user_name?.charAt(0).toUpperCase()}
                              </span>
                              <span className="text-xs font-medium text-gray-900 truncate">{ce.student_name || ce.enrollment_name}</span>
                              <span className="text-[10px] text-gray-400 shrink-0 ml-auto">by {ce.user_name}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardBody>

                    <div className="border-t border-gray-100 px-4 py-3">
                      <div className="grid grid-cols-3 gap-2">
                        {users.map((u) => {
                          const val = getNom(s, u.id);
                          const cnfUser = (s.confirmed_enrollments || []).filter((ce) => ce.user_id === u.id).length;
                          return (
                            <button key={u.id} onClick={() => startEditCell(s.id, u.id)}
                              className="flex items-center gap-1.5 p-2 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors text-left">
                              <span className="w-6 h-6 bg-primary-50 text-primary-600 rounded-lg flex items-center justify-center text-[9px] font-bold shrink-0">
                                {u.name?.charAt(0).toUpperCase()}
                              </span>
                              <div className="min-w-0 flex-1">
                                <p className="text-[10px] text-gray-400 truncate">{u.name?.split(' ')[0]}</p>
                                <div className="flex items-center gap-0.5">
                                  {val > 0 && <span className="text-[9px] font-semibold px-1 py-0.5 rounded-md bg-amber-50 text-amber-700">T{val}</span>}
                                  {cnfUser > 0 && <span className="text-[9px] font-semibold px-1 py-0.5 rounded-md bg-blue-50 text-blue-600">C{cnfUser}</span>}
                                  {val === 0 && cnfUser === 0 && <span className="text-[10px] text-gray-300">—</span>}
                                </div>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        </>
      )}

      {/* Nomination Modal */}
      <Modal open={!!editingCell} onClose={() => setEditingCell(null)} title="Update Nomination" size="sm">
        {editingCell && (() => {
          const session = sessions.find((s) => s.id === editingCell.sessionId);
          const userObj = users.find((u) => u.id === editingCell.userId);
          return (
            <div className="space-y-5">
              <div className="text-center">
                <p className="text-sm font-medium text-gray-900">{session?.course_name}</p>
                <p className="text-xs text-gray-400 mt-0.5">{fmtDate(session?.session_date)}</p>
              </div>
              <div className="flex items-center justify-center">
                <div className="w-11 h-11 bg-primary-50 text-primary-600 rounded-xl flex items-center justify-center text-lg font-bold">
                  {userObj?.name?.charAt(0).toUpperCase()}
                </div>
                <div className="ml-3">
                  <p className="text-sm font-semibold text-gray-900">{userObj?.name}</p>
                </div>
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
                  <div className="flex items-center justify-center gap-4">
                    <button onClick={() => setCellValue(String(Math.max(0, parseInt(cellValue) - 1)))}
                      className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center text-lg font-bold text-gray-500 hover:bg-gray-200 transition-colors">−</button>
                    <input type="number" min="0" value={cellValue}
                      onChange={(e) => setCellValue(e.target.value)}
                      className="w-20 h-12 text-center text-2xl font-bold border-2 border-amber-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-400/20 focus:border-amber-400" />
                    <button onClick={() => setCellValue(String(parseInt(cellValue) + 1))}
                      className="w-10 h-10 bg-amber-50 rounded-xl flex items-center justify-center text-lg font-bold text-amber-600 hover:bg-amber-100 transition-colors">+</button>
                  </div>
                  <div className="flex gap-2">
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
                      <p className="text-[10px] uppercase font-semibold text-blue-600 mb-2 tracking-wider">Confirmed ({sessionEnrollments.length})</p>
                      <div className="space-y-1.5 max-h-40 overflow-y-auto">
                        {sessionEnrollments.filter((se) => se.user_id === editingCell.userId).map((se) => (
                          <div key={se.enrollment_id} className="flex items-center justify-between p-2.5 bg-blue-50 rounded-xl">
                            <div className="min-w-0">
                              <p className="text-xs font-medium text-gray-900 truncate">{se.student_name || se.enrollment_name}</p>
                              <p className="text-[10px] text-gray-400">{se.enrollment_name}</p>
                            </div>
                            <button onClick={() => removeCNFEnrollment(se.enrollment_id)}
                              className="p-1 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg shrink-0 transition-colors">
                              <X size={14} />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div>
                    <p className="text-[10px] uppercase font-semibold text-gray-400 mb-2 tracking-wider">
                      {sessionEnrollments.length > 0 ? 'Add More' : 'Select Enrollments'}
                    </p>
                    <div className="space-y-1.5 max-h-40 overflow-y-auto">
                      {filteredEnrollments.length === 0 ? (
                        <p className="text-xs text-gray-400 py-3 text-center">
                          {myEnrollments.length === 0 ? 'No active enrollments assigned to you' : 'No matching enrollments'}
                        </p>
                      ) : (
                        filteredEnrollments.map((e) => (
                          <button key={e.id} onClick={() => addCNFEnrollment(e.id)}
                            className="w-full flex items-center justify-between p-2.5 bg-gray-50 hover:bg-blue-50 rounded-xl transition-colors text-left">
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
                  <button onClick={() => setEditingCell(null)} className="btn-primary w-full">Done</button>
                </div>
              )}
            </div>
          );
        })()}
      </Modal>

      {/* Create/Edit Session */}
      <Modal open={showForm} onClose={() => setShowForm(false)} title={editing ? 'Edit Session' : 'New Session'} size="sm">
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Date *</label>
            <input type="date" value={form.session_date} onChange={(e) => setForm({ ...form, session_date: e.target.value })} className="input-field" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Course / Module *</label>
            <input value={form.course_name} onChange={(e) => setForm({ ...form, course_name: e.target.value })}
              placeholder="e.g. AWS EVENING BATCH" className="input-field" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Timing</label>
            <input value={form.timing} onChange={(e) => setForm({ ...form, timing: e.target.value })}
              placeholder="e.g. 4PM TO 7.30PM" className="input-field" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Link to Batch</label>
            <select value={form.batch_id} onChange={(e) => setForm({ ...form, batch_id: e.target.value })} className="input-field">
              <option value="">No batch linked</option>
              {batches.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Status</label>
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
            <button onClick={() => handleDelete(deleting)} className="btn-danger flex-1">Delete</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
