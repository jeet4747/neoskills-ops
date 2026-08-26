import { useState, useEffect, useCallback } from 'react';
import {
  Plus, Calendar, Pencil, Trash2, X, ChevronLeft, ChevronRight,
  Search, ChevronDown, ChevronUp, Zap, Clock, GraduationCap,
} from 'lucide-react';
import { api } from '../services/api';
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
const TIMING_SLOTS = [
  '6:00 AM - 8:00 AM', '7:00 AM - 9:00 AM', '8:00 AM - 10:00 AM',
  '9:00 AM - 11:00 AM', '10:00 AM - 12:00 PM', '11:00 AM - 1:00 PM',
  '12:00 PM - 2:00 PM', '1:00 PM - 3:00 PM', '2:00 PM - 4:00 PM',
  '3:00 PM - 5:00 PM', '4:00 PM - 6:00 PM', '5:00 PM - 7:00 PM',
  '6:00 PM - 8:00 PM', '7:00 PM - 9:00 PM', '8:00 PM - 10:00 PM',
  'Custom',
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
function parseTimingToMinutes(t) {
  if (!t) return 999;
  const match = t.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
  if (!match) return 999;
  let h = parseInt(match[1], 10);
  const m = parseInt(match[2], 10);
  const ampm = match[3].toUpperCase();
  if (ampm === 'PM' && h !== 12) h += 12;
  if (ampm === 'AM' && h === 12) h = 0;
  return h * 60 + m;
}
function getStatusVariant(s) {
  return STATUSES.find((st) => st.value === s)?.variant || 'pending';
}

export default function TrainingCalendar() {
  const toast = useToast();
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [month, setMonth] = useState(currentMonth());
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ session_date: '', course_name: '', timing: '', timingCustom: '', status: 'in_future' });
  const [saving, setSaving] = useState(false);
  const [viewSession, setViewSession] = useState(null);
  const [addSession, setAddSession] = useState(null);
  const [enrollSearch, setEnrollSearch] = useState('');
  const [allEnrollments, setAllEnrollments] = useState([]);
  const [sessionEnrollments, setSessionEnrollments] = useState([]);
  const [deleting, setDeleting] = useState(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const data = await api.calendar.list(month);
      setSessions(data);
    } catch (e) { toast.error('Failed to load calendar'); }
    finally { setLoading(false); }
  }, [month]);

  useEffect(() => { load(); }, [load]);

  const sortedSessions = [...sessions].sort((a, b) => {
    const dA = a.session_date || '';
    const dB = b.session_date || '';
    if (dA !== dB) return dA.localeCompare(dB);
    return parseTimingToMinutes(a.timing) - parseTimingToMinutes(b.timing);
  });

  const totalCandidates = sessions.reduce((s, x) => s + (x.confirmed_count || 0), 0);
  const totalReceived = sessions.reduce((s, x) => s + (x.confirmed_enrollments || []).reduce((a, e) => a + (parseFloat(e.paid_amount) || 0), 0), 0);
  const totalPending = sessions.reduce((s, x) => s + (x.confirmed_enrollments || []).reduce((a, e) => a + (parseFloat(e.pending_amount) || 0), 0), 0);

  function openCreate() {
    setEditing(null);
    setForm({ session_date: new Date().toISOString().slice(0, 10), course_name: '', timing: '', timingCustom: '', status: 'in_future' });
    setShowForm(true);
  }
  function openEdit(s) {
    setEditing(s);
    const isCustom = s.timing && !TIMING_SLOTS.includes(s.timing);
    setForm({
      session_date: s.session_date ? s.session_date.slice(0, 10) : '',
      course_name: s.course_name || '',
      timing: isCustom ? 'Custom' : (s.timing || ''),
      timingCustom: isCustom ? s.timing : '',
      status: s.status || 'in_future',
    });
    setShowForm(true);
  }
  async function handleSave() {
    if (!form.session_date || !form.course_name.trim()) { toast.error('Date and course name required'); return; }
    try {
      setSaving(true);
      const timingVal = form.timing === 'Custom' ? form.timingCustom : form.timing;
      const payload = { ...form, timing: timingVal, batch_id: null };
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
  async function openAddCandidate(session) {
    setAddSession(session);
    setEnrollSearch('');
    setSessionEnrollments(session.confirmed_enrollments || []);
    try {
      const enrollments = await api.calendar.myEnrollments();
      setAllEnrollments(enrollments);
    } catch (e) { /* ignore */ }
  }
  async function addEnrollment(enrollmentId) {
    try {
      await api.calendar.addEnrollment(addSession.id, enrollmentId);
      const sess = await api.calendar.list(month);
      const s = sess.find((x) => x.id === addSession.id);
      setSessionEnrollments(s?.confirmed_enrollments || []);
      load();
    } catch (e) { toast.error(e.message); }
  }
  async function removeEnrollment(enrollmentId) {
    try {
      await api.calendar.removeEnrollment(addSession.id, enrollmentId);
      const sess = await api.calendar.list(month);
      const s = sess.find((x) => x.id === addSession.id);
      setSessionEnrollments(s?.confirmed_enrollments || []);
      load();
    } catch (e) { toast.error(e.message); }
  }
  const filteredEnrollments = allEnrollments.filter((e) => {
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
          <p className="text-sm text-gray-500 mt-0.5">Plan sessions, manage batches, track candidates</p>
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
                <span className="text-xs text-gray-400">Candidates</span>
                <span className="text-sm font-bold text-blue-600">{totalCandidates}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-400">Received</span>
                <span className="text-sm font-bold text-emerald-600">₹{totalReceived.toLocaleString('en-IN')}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-400">Pending</span>
                <span className="text-sm font-bold text-amber-600">₹{totalPending.toLocaleString('en-IN')}</span>
              </div>
            </div>
          </div>
        </CardBody>
      </Card>

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
        <div className="space-y-3">
          {sortedSessions.map((s) => {
            const count = s.confirmed_count || 0;
            const st = getStatusVariant(s.status);
            const isOpen = viewSession === s.id;
            const received = (s.confirmed_enrollments || []).reduce((a, e) => a + (parseFloat(e.paid_amount) || 0), 0);
            const pending = (s.confirmed_enrollments || []).reduce((a, e) => a + (parseFloat(e.pending_amount) || 0), 0);

            return (
              <Card key={s.id}>
                {/* Main Row */}
                <div className="px-5 py-4">
                  <div className="flex items-center gap-4">
                    {/* Date */}
                    <div className="shrink-0 w-14 text-center">
                      <p className="text-xl font-bold text-gray-900 leading-tight">{new Date(s.session_date).getDate()}</p>
                      <p className="text-[10px] text-gray-400 font-medium uppercase">{MONTHS[new Date(s.session_date).getMonth()]}</p>
                    </div>

                    <div className="w-px h-12 bg-gray-100 shrink-0" />

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 flex-wrap">
                        <p className="text-sm font-semibold text-gray-900 truncate">{s.course_name}</p>
                        {received > 0 && (
                          <span className="text-sm font-bold text-emerald-600">₹{received.toLocaleString('en-IN')}</span>
                        )}
                        {pending > 0 && (
                          <span className="text-sm font-bold text-amber-600">₹{pending.toLocaleString('en-IN')}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        {s.batch_name && (
                          <span className="inline-flex items-center gap-1 text-[11px] text-gray-500">
                            <GraduationCap size={10} /> {s.batch_name}
                          </span>
                        )}
                        {s.timing && (
                          <span className="inline-flex items-center gap-1 text-[11px] text-gray-400">
                            <Clock size={10} /> {s.timing}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Status */}
                    <div className="shrink-0">
                      <Badge status={st} className="text-[10px]">{STATUSES.find((x) => x.value === s.status)?.label}</Badge>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button onClick={() => setViewSession(isOpen ? null : s.id)}
                        className="flex items-center gap-1 px-3 py-1.5 text-[11px] font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors">
                        View ({count})
                      </button>
                      <button onClick={() => openAddCandidate(s)}
                        className="flex items-center gap-1 px-3 py-1.5 text-[11px] font-semibold text-primary-600 bg-primary-50 hover:bg-primary-100 rounded-lg transition-colors">
                        <Plus size={12} /> Add
                      </button>
                      <button onClick={() => openEdit(s)} className="p-1.5 text-gray-300 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors">
                        <Pencil size={14} />
                      </button>
                      <button onClick={() => setDeleting(s)} className="p-1.5 text-gray-300 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Expanded: Candidate List */}
                {isOpen && (
                  <div className="border-t border-gray-100 px-5 py-4 bg-gray-50/50">
                    {(s.confirmed_enrollments || []).length > 0 ? (
                      <div className="space-y-2">
                        {(s.confirmed_enrollments || []).map((ce, idx) => (
                          <div key={idx} className="flex items-center gap-3 py-2 px-3 bg-white rounded-xl border border-gray-100">
                            <span className="w-6 h-6 bg-gray-100 text-gray-600 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0">
                              {idx + 1}
                            </span>
                            <div className="flex-1 min-w-0">
                              <p className="text-[13px] font-medium text-gray-900 truncate">{ce.student_name || ce.enrollment_name}</p>
                              <div className="flex items-center gap-2 text-[10px] text-gray-400 mt-0.5">
                                {ce.poc_name && <span>POC: {ce.poc_name}</span>}
                                {ce.student_phone && <span>{ce.student_phone}</span>}
                              </div>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              {ce.paid_amount > 0 && (
                                <span className="text-[10px] font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded">₹{parseFloat(ce.paid_amount).toLocaleString('en-IN')} paid</span>
                              )}
                              {ce.pending_amount > 0 && (
                                <span className="text-[10px] font-semibold text-amber-600 bg-amber-50 px-2 py-0.5 rounded">₹{parseFloat(ce.pending_amount).toLocaleString('en-IN')} due</span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-gray-400 py-4 text-center">No candidates added yet</p>
                    )}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* Add Candidate Modal */}
      <Modal open={!!addSession} onClose={() => setAddSession(null)}
        title={addSession ? `Add Candidate — ${addSession.course_name}` : 'Add Candidate'} size="sm">
        {addSession && (
          <div className="space-y-4">
            <p className="text-xs text-gray-400 text-center">{fmtDate(addSession.session_date)} {addSession.timing ? `· ${addSession.timing}` : ''}</p>

            {/* Currently Added */}
            {sessionEnrollments.length > 0 && (
              <div>
                <p className="text-[10px] uppercase font-semibold text-blue-600 mb-2 tracking-wider">In Batch ({sessionEnrollments.length})</p>
                <div className="space-y-1.5 max-h-48 overflow-y-auto">
                  {sessionEnrollments.map((se) => (
                    <div key={se.enrollment_id} className="flex items-center justify-between p-2.5 bg-blue-50 rounded-xl">
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-gray-900 truncate">{se.student_name || se.enrollment_name}</p>
                        <div className="flex items-center gap-2 text-[10px] text-gray-400">
                          {se.poc_name && <span>POC: {se.poc_name}</span>}
                          {se.student_phone && <span>{se.student_phone}</span>}
                        </div>
                      </div>
                      <button onClick={() => removeEnrollment(se.enrollment_id)}
                        className="p-1 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg shrink-0 transition-colors">
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Search + Available */}
            <div>
              <p className="text-[10px] uppercase font-semibold text-gray-400 mb-2 tracking-wider">
                {sessionEnrollments.length > 0 ? 'Add More' : 'Select Candidates'}
              </p>
              <div className="relative mb-2">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input value={enrollSearch} onChange={(e) => setEnrollSearch(e.target.value)}
                  placeholder="Search by student name or course..."
                  className="input-field pl-8 text-sm" />
              </div>
              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                {filteredEnrollments.length === 0 ? (
                  <p className="text-xs text-gray-400 py-4 text-center">
                    {allEnrollments.length === 0 ? 'No active enrollments found' : 'No matching enrollments'}
                  </p>
                ) : (
                  filteredEnrollments.map((e) => (
                    <button key={e.id} onClick={() => addEnrollment(e.id)}
                      className="w-full flex items-center justify-between p-2.5 bg-gray-50 hover:bg-blue-50 rounded-xl transition-colors text-left">
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-gray-900 truncate">{e.student_name || 'Unknown'}</p>
                        <div className="flex items-center gap-2 text-[10px] text-gray-400">
                          <span>{e.course_name}</span>
                          {e.poc_name && <span>· POC: {e.poc_name}</span>}
                        </div>
                      </div>
                      <Plus size={14} className="text-blue-500 shrink-0" />
                    </button>
                  ))
                )}
              </div>
            </div>

            <button onClick={() => setAddSession(null)} className="btn-primary w-full">Done</button>
          </div>
        )}
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
            <select value={form.timing} onChange={(e) => setForm({ ...form, timing: e.target.value })} className="input-field">
              <option value="">Select timing</option>
              {TIMING_SLOTS.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
            {form.timing === 'Custom' && (
              <input value={form.timingCustom} onChange={(e) => setForm({ ...form, timingCustom: e.target.value })}
                placeholder="e.g. 4PM TO 7.30PM" className="input-field mt-2" />
            )}
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
