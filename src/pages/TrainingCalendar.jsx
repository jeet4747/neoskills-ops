import { useState, useEffect, useCallback } from 'react';
import {
  Plus, Calendar, Pencil, Trash2, X, Check, ChevronLeft, ChevronRight,
  Link as LinkIcon, Search, ChevronDown, ChevronUp, Users, Zap, Video, User,
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
  const [expandedRow, setExpandedRow] = useState(null);

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

      {/* Month Nav + Stats */}
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
                  <button onClick={() => setMonth(currentMonth())} className="text-xs text-primary-600 font-medium hover:underline ml-1">Today</button>
                )}
              </div>
            </div>
            <div className="flex items-center gap-5">
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-400">Sessions</span>
                <span className="text-sm font-bold text-gray-900">{sessions.length}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-400">CNF</span>
                <span className="text-sm font-bold text-blue-600">{totalCNF}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-400">TNT</span>
                <span className="text-sm font-bold text-amber-600">{totalTNT}</span>
              </div>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Legend */}
      <div className="flex items-center gap-4 text-xs text-gray-400">
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm border-l-2 border-l-red-400 bg-red-50/50" /> Low (&lt;5)</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm border-l-2 border-l-amber-400 bg-amber-50/50" /> Medium (5-10)</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm border-l-2 border-l-emerald-500 bg-emerald-50/50" /> High (&gt;10)</span>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1,2,3,4].map((i) => <div key={i} className="h-14 skeleton w-full rounded-xl" />)}
        </div>
      ) : sessions.length === 0 ? (
        <Card>
          <CardBody className="py-16 text-center">
            <div className="w-14 h-14 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Calendar size={24} className="text-gray-300" />
            </div>
            <p className="text-gray-500 text-sm mb-1">No sessions planned for {getMonthLabel(month)}</p>
            <p className="text-gray-400 text-xs mb-4">Create a session to start tracking</p>
            <button onClick={openCreate} className="btn-primary text-sm">Create Session</button>
          </CardBody>
        </Card>
      ) : (
        <div className="space-y-2">
          {sessions.map((s) => {
            const cnf = s.confirmed_count || 0;
            const tnt = totalBySession(s);
            const borderC = getSeatColor(cnf, tnt);
            const st = getStatusVariant(s.status);
            const isExpanded = expandedRow === s.id;
            const hasNominations = (s.nominations || []).length > 0 || (s.confirmed_enrollments || []).length > 0;

            return (
              <Card key={s.id}>
                <div className={`border-l-3 ${borderC} rounded-2xl`}>
                  {/* Main Row */}
                  <div className="px-5 py-4">
                    <div className="flex items-center gap-4">
                      {/* Date */}
                      <div className="shrink-0 w-20">
                        <p className="text-sm font-bold text-gray-900">{new Date(s.session_date).getDate()}</p>
                        <p className="text-[11px] text-gray-400">{MONTHS[new Date(s.session_date).getMonth()]}</p>
                      </div>

                      {/* Divider */}
                      <div className="w-px h-10 bg-gray-100 shrink-0" />

                      {/* Module + Batch */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-900 truncate">{s.course_name}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          {s.batch_name && (
                            <span className="inline-flex items-center gap-1 text-[11px] text-gray-400">
                              <LinkIcon size={9} /> {s.batch_name}
                            </span>
                          )}
                          {s.timing && (
                            <span className="text-[11px] text-gray-300">{s.timing}</span>
                          )}
                        </div>
                      </div>

                      {/* CNF + TNT */}
                      <div className="flex items-center gap-4 shrink-0">
                        <div className="text-center">
                          <p className="text-[10px] text-gray-400 uppercase font-semibold tracking-wider">CNF</p>
                          <p className="text-base font-bold text-blue-600">{cnf}</p>
                        </div>
                        <div className="text-center">
                          <p className="text-[10px] text-gray-400 uppercase font-semibold tracking-wider">TNT</p>
                          <p className="text-base font-bold text-amber-600">{tnt}</p>
                        </div>
                      </div>

                      {/* Status */}
                      <div className="shrink-0">
                        <Badge status={st} className="text-[10px]">{STATUSES.find((x) => x.value === s.status)?.label}</Badge>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-0.5 shrink-0">
                        {hasNominations && (
                          <button onClick={() => setExpandedRow(isExpanded ? null : s.id)}
                            className="p-1.5 text-gray-300 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors">
                            {isExpanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                          </button>
                        )}
                        <button onClick={() => openEdit(s)} className="p-1.5 text-gray-300 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors">
                          <Pencil size={14} />
                        </button>
                        <button onClick={() => setDeleting(s)} className="p-1.5 text-gray-300 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Expanded: Salesperson Nomination Grid */}
                  {isExpanded && (
                    <div className="border-t border-gray-100 px-5 py-4 bg-gray-50/30">
                      <p className="text-[10px] uppercase font-semibold text-gray-400 tracking-wider mb-3">Nominations</p>
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2">
                        {users.map((u) => {
                          const val = getNom(s, u.id);
                          const cnfUser = (s.confirmed_enrollments || []).filter((ce) => ce.user_id === u.id).length;
                          return (
                            <button key={u.id} onClick={() => startEditCell(s.id, u.id)}
                              className="flex items-center gap-2 p-2.5 bg-white rounded-xl border border-gray-100 hover:border-primary-200 hover:shadow-sm transition-all text-left">
                              <span className="w-8 h-8 bg-primary-50 text-primary-600 rounded-lg flex items-center justify-center text-[10px] font-bold shrink-0">
                                {u.name?.charAt(0).toUpperCase()}
                              </span>
                              <div className="min-w-0 flex-1">
                                <p className="text-[11px] text-gray-500 truncate font-medium">{u.name?.split(' ')[0]}</p>
                                <div className="flex items-center gap-1 mt-0.5">
                                  {val > 0 && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-amber-50 text-amber-700">T{val}</span>}
                                  {cnfUser > 0 && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-blue-50 text-blue-600">C{cnfUser}</span>}
                                  {val === 0 && cnfUser === 0 && <span className="text-[10px] text-gray-300">—</span>}
                                </div>
                              </div>
                            </button>
                          );
                        })}
                      </div>

                      {/* CNF Details */}
                      {(s.confirmed_enrollments || []).length > 0 && (
                        <div className="mt-3 pt-3 border-t border-gray-100">
                          <p className="text-[10px] uppercase font-semibold text-blue-500 tracking-wider mb-2">Confirmed Enrollments</p>
                          <div className="flex flex-wrap gap-1.5">
                            {(s.confirmed_enrollments || []).map((ce, idx) => (
                              <span key={idx} className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-blue-50 rounded-lg text-[11px]">
                                <span className="w-5 h-5 bg-blue-100 text-blue-600 rounded-md flex items-center justify-center text-[8px] font-bold">{ce.user_name?.charAt(0).toUpperCase()}</span>
                                <span className="font-medium text-gray-900">{ce.student_name || ce.enrollment_name}</span>
                                <span className="text-gray-300">·</span>
                                <span className="text-blue-500">{ce.user_name}</span>
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
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
              <div className="flex items-center justify-center gap-3">
                <div className="w-11 h-11 bg-primary-50 text-primary-600 rounded-xl flex items-center justify-center text-lg font-bold">
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
