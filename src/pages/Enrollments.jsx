import { useState, useEffect } from 'react';
import { Plus, Search, Filter, Download, GraduationCap } from 'lucide-react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { Card, CardBody } from '../components/ui/Card';
import Table from '../components/ui/Table';
import Badge from '../components/ui/Badge';
import Modal from '../components/ui/Modal';
import { COURSES, SOURCES, DEAL_TYPES } from '../config/constants';

export default function Enrollments() {
  const { user } = useAuth();
  const toast = useToast();
  const [enrollments, setEnrollments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [search, setSearch] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [student, setStudent] = useState(null);
  const [showNewForm, setShowNewForm] = useState(false);
  const [newSt, setNewSt] = useState({ name: '', email: '', phone: '', city: '' });
  const [form, setForm] = useState({
    course_name: 'PMP', deal_type: 'bundle',
    training_fee: '', exam_fee: '',
    source: 'Website', batch_name: '',
  });
  const [errors, setErrors] = useState({});
  const [filterStatus, setFilterStatus] = useState('');

  useEffect(() => { load(); }, []);

  async function load() {
    try {
      setEnrollments(await api.enrollments.list(filterStatus ? { status: filterStatus } : {}));
    } catch (e) { toast.error('Failed to load enrollments'); }
    finally { setLoading(false); }
  }

  async function doSearch(q) {
    setSearch(q);
    if (q.length < 2) { setSearchResults([]); return; }
    try { setSearchResults(await api.students.list(q)); }
    catch (e) { /* silent */ }
  }

  async function createStudent() {
    if (!newSt.name) { toast.error('Student name is required'); return; }
    try {
      const s = await api.students.create(newSt);
      setStudent(s);
      setShowNewForm(false);
      setNewSt({ name: '', email: '', phone: '', city: '' });
      toast.success(`Student "${s.name}" created & selected`);
    } catch (e) { toast.error(e.message); }
  }

  function validate() {
    const errs = {};
    if (!student) errs.student = 'Select or add a student';
    if (!form.training_fee && form.deal_type !== 'exam') errs.training_fee = 'Enter training fee';
    if (!form.exam_fee && form.deal_type !== 'training') errs.exam_fee = 'Enter exam fee';
    const total = (parseFloat(form.training_fee) || 0) + (parseFloat(form.exam_fee) || 0);
    if (total <= 0) errs.amount = 'Total amount must be greater than 0';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!validate()) return;
    setSubmitting(true);
    try {
      await api.enrollments.create({
        ...form,
        training_fee: parseFloat(form.training_fee) || 0,
        exam_fee: parseFloat(form.exam_fee) || 0,
        total_amount: (parseFloat(form.training_fee) || 0) + (parseFloat(form.exam_fee) || 0),
        student_id: student.id,
      });
      toast.success('Enrollment created successfully');
      setShowAdd(false);
      resetForm();
      load();
    } catch (e) { toast.error(e.message); }
    finally { setSubmitting(false); }
  }

  function resetForm() {
    setForm({ course_name: 'PMP', deal_type: 'bundle', training_fee: '', exam_fee: '', source: 'Website', batch_name: '' });
    setStudent(null); setSearch(''); setSearchResults([]); setErrors({});
  }

  const columns = [
    { key: 'student_name', label: 'Student' },
    { key: 'course_name', label: 'Course' },
    { key: 'deal_type', label: 'Type', render: (r) => (
      <span className="capitalize">{r.deal_type === 'bundle' ? 'T+E' : r.deal_type}</span>
    )},
    { key: 'total_amount', label: 'Amount', render: (r) => `₹${Number(r.total_amount).toLocaleString()}` },
    { key: 'salesperson_name', label: 'Salesperson' },
    { key: 'status', label: 'Status', render: (r) => <Badge status={r.status} /> },
    { key: 'created_at', label: 'Date', render: (r) => new Date(r.created_at).toLocaleDateString() },
  ];

  const total = (parseFloat(form.training_fee) || 0) + (parseFloat(form.exam_fee) || 0);

  function exportCSV() {
    if (!enrollments.length) { toast.info('No data to export'); return; }
    const headers = 'Student,Course,Type,Amount,Salesperson,Status,Date\n';
    const rows = enrollments.map((r) =>
      `"${r.student_name}","${r.course_name}",${r.deal_type},${r.total_amount},"${r.salesperson_name}",${r.status},${new Date(r.created_at).toLocaleDateString()}`
    ).join('\n');
    const blob = new Blob([headers + rows], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'enrollments.csv';
    a.click();
    toast.success('CSV exported');
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Enrollments</h1>
          <p className="text-sm text-gray-400 mt-0.5">{enrollments.length} total enrollments</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={exportCSV} className="btn-ghost flex items-center gap-2 text-sm">
            <Download size={15} /> Export
          </button>
          <button onClick={() => setShowAdd(true)} className="btn-primary flex items-center gap-2 shadow-sm">
            <Plus size={16} /> Add Enrollment
          </button>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input className="input-field pl-9" placeholder="Search by student or course..." />
        </div>
        <select className="input-field w-44" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
          <option value="">All Status</option>
          <option value="active">Active</option>
          <option value="completed">Completed</option>
        </select>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1,2,3,4].map((i) => <div key={i} className="h-16 skeleton w-full" />)}
        </div>
      ) : (
        <Card><CardBody className="p-0">
          <Table columns={columns} data={enrollments} />
          {!enrollments.length && (
            <div className="text-center py-16">
              <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <GraduationCap size={28} className="text-gray-300" />
              </div>
              <h3 className="text-sm font-medium text-gray-500 mb-1">No enrollments yet</h3>
              <p className="text-xs text-gray-400 mb-4">Create your first enrollment to get started</p>
              <button onClick={() => setShowAdd(true)} className="btn-primary text-sm">Add Enrollment</button>
            </div>
          )}
        </CardBody></Card>
      )}

      <Modal open={showAdd} onClose={() => { setShowAdd(false); resetForm(); }} title="New Enrollment" size="lg">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Student *</label>
            {student ? (
              <div className="flex items-center justify-between bg-primary-50/50 border border-primary-100 p-3 rounded-xl">
                <div>
                  <p className="font-medium text-primary-800">{student.name}</p>
                  <p className="text-xs text-gray-500">{student.email} {student.phone && `| ${student.phone}`}</p>
                </div>
                <button type="button" onClick={() => { setStudent(null); setSearch(''); }} className="text-sm text-red-500 hover:underline font-medium">Change</button>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="relative">
                  <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input className="input-field pl-9" placeholder="Type to search existing student..." value={search}
                    onChange={(e) => doSearch(e.target.value)} />
                </div>
                {searchResults.length > 0 && (
                  <div className="border rounded-xl max-h-36 overflow-y-auto shadow-sm">
                    {searchResults.map((s) => (
                      <button key={s.id} type="button"
                        className="w-full text-left px-4 py-2.5 hover:bg-gray-50 text-sm border-b last:border-0 transition-colors"
                        onClick={() => { setStudent(s); setSearchResults([]); setShowNewForm(false); setErrors({}); }}>
                        <span className="font-medium">{s.name}</span>
                        <span className="text-gray-400 ml-2">{s.email}</span>
                      </button>
                    ))}
                  </div>
                )}
                <button type="button" onClick={() => setShowNewForm(true)} className="text-sm text-primary-600 hover:text-primary-700 font-medium">
                  + Add new student (if not found)
                </button>
              </div>
            )}
          </div>

          {showNewForm && !student && (
            <div className="border rounded-xl p-4 space-y-3 bg-gray-50">
              <h4 className="text-sm font-medium text-gray-700">New Student Details</h4>
              <div className="grid grid-cols-2 gap-3">
                <input className="input-field text-sm" placeholder="Full Name *" value={newSt.name}
                  onChange={(e) => setNewSt({ ...newSt, name: e.target.value })} />
                <input className="input-field text-sm" placeholder="Email" value={newSt.email}
                  onChange={(e) => setNewSt({ ...newSt, email: e.target.value })} />
                <input className="input-field text-sm" placeholder="Phone" value={newSt.phone}
                  onChange={(e) => setNewSt({ ...newSt, phone: e.target.value })} />
                <input className="input-field text-sm" placeholder="City" value={newSt.city}
                  onChange={(e) => setNewSt({ ...newSt, city: e.target.value })} />
              </div>
              <button type="button" onClick={createStudent} className="btn-primary text-sm">Save & Select</button>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Course *</label>
              <select className="input-field" value={form.course_name} onChange={(e) => setForm({ ...form, course_name: e.target.value })}>
                {COURSES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Deal Type *</label>
              <select className="input-field" value={form.deal_type} onChange={(e) => setForm({ ...form, deal_type: e.target.value })}>
                {DEAL_TYPES.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Training Fee (₹)</label>
              <input type="number" className={`input-field ${errors.training_fee ? 'border-red-300 focus:ring-red-500' : ''}`}
                value={form.training_fee}
                onChange={(e) => { setForm({ ...form, training_fee: e.target.value }); setErrors({}); }} />
              {errors.training_fee && <p className="text-xs text-red-500 mt-1">{errors.training_fee}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Exam Fee (₹)</label>
              <input type="number" className={`input-field ${errors.exam_fee ? 'border-red-300 focus:ring-red-500' : ''}`}
                value={form.exam_fee}
                onChange={(e) => { setForm({ ...form, exam_fee: e.target.value }); setErrors({}); }} />
              {errors.exam_fee && <p className="text-xs text-red-500 mt-1">{errors.exam_fee}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Total (auto)</label>
              <input type="number" className="input-field bg-gray-50 font-semibold text-primary-700" value={total} readOnly />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Source</label>
              <select className="input-field" value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })}>
                {SOURCES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Batch (optional)</label>
              <input className="input-field" value={form.batch_name} onChange={(e) => setForm({ ...form, batch_name: e.target.value })} placeholder="e.g. PMP July 2026" />
            </div>
          </div>

          <div className="flex items-center justify-between pt-3 border-t">
            <p className="text-sm text-gray-400">{!student ? 'Select a student to proceed' : `✓ ${student.name} selected`}</p>
            <div className="flex gap-3">
              <button type="button" onClick={() => { setShowAdd(false); resetForm(); }} className="btn-secondary">Cancel</button>
              <button type="submit" className="btn-primary px-6" disabled={!student || submitting}>
                {submitting ? (
                  <span className="flex items-center gap-2"><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Saving...</span>
                ) : 'Save Enrollment'}
              </button>
            </div>
          </div>
        </form>
      </Modal>
    </div>
  );
}
