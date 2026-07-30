import { useState, useEffect } from 'react';
import { Plus, Search } from 'lucide-react';
import { api } from '../services/api';
import { Card, CardBody } from '../components/ui/Card';
import Table from '../components/ui/Table';
import Badge from '../components/ui/Badge';
import Modal from '../components/ui/Modal';
import { COURSES, SOURCES, DEAL_TYPES } from '../config/constants';

export default function Enrollments() {
  const { user } = useAuth();
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

  useEffect(() => { load(); }, []);

  async function load() {
    try { setEnrollments(await api.enrollments.list({})); }
    catch (e) { console.error(e); }
    finally { setLoading(false); }
  }

  async function doSearch(q) {
    setSearch(q);
    if (q.length < 2) { setSearchResults([]); return; }
    try { setSearchResults(await api.students.list(q)); }
    catch (e) { console.error(e); }
  }

  async function createStudent() {
    try {
      if (!newSt.name) { alert('Name is required'); return; }
      const s = await api.students.create(newSt);
      setStudent(s);
      setShowNewForm(false);
      setNewSt({ name: '', email: '', phone: '', city: '' });
    } catch (e) { alert(e.message); }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!student) { alert('Select or create a student first'); return; }
    setSubmitting(true);
    try {
      await api.enrollments.create({
        ...form,
        training_fee: parseFloat(form.training_fee) || 0,
        exam_fee: parseFloat(form.exam_fee) || 0,
        total_amount: (parseFloat(form.training_fee) || 0) + (parseFloat(form.exam_fee) || 0),
        student_id: student.id,
      });
      setShowAdd(false);
      resetForm();
      load();
    } catch (e) { alert(e.message); }
    finally { setSubmitting(false); }
  }

  function resetForm() {
    setForm({ course_name: 'PMP', deal_type: 'bundle', training_fee: '', exam_fee: '', source: 'Website', batch_name: '' });
    setStudent(null); setSearch(''); setSearchResults([]);
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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Enrollments</h1>
        <button onClick={() => setShowAdd(true)} className="btn-primary flex items-center gap-2">
          <Plus size={16} /> Add Enrollment
        </button>
      </div>

      <Card><CardBody className="p-0">
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600" />
          </div>
        ) : <Table columns={columns} data={enrollments} />}
      </CardBody></Card>

      <Modal open={showAdd} onClose={() => { setShowAdd(false); resetForm(); }} title="Add New Enrollment" size="lg">
        <form onSubmit={handleSubmit} className="space-y-4">

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Student *</label>
            {student ? (
              <div className="flex items-center justify-between bg-gray-50 p-3 rounded-lg">
                <div>
                  <p className="font-medium">{student.name}</p>
                  <p className="text-xs text-gray-500">{student.email} {student.phone && `| ${student.phone}`}</p>
                </div>
                <button type="button" onClick={() => { setStudent(null); setSearch(''); }} className="text-sm text-red-500 hover:underline">Change</button>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="relative">
                  <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input className="input-field pl-9" placeholder="Search existing student..." value={search}
                    onChange={(e) => doSearch(e.target.value)} />
                </div>
                {searchResults.length > 0 && (
                  <div className="border rounded-lg max-h-32 overflow-y-auto">
                    {searchResults.map((s) => (
                      <button key={s.id} type="button"
                        className="w-full text-left px-3 py-2 hover:bg-gray-50 text-sm border-b last:border-0"
                        onClick={() => { setStudent(s); setSearchResults([]); setShowNewForm(false); }}>
                        <span className="font-medium">{s.name}</span>
                        <span className="text-gray-500 ml-2">{s.email}</span>
                      </button>
                    ))}
                  </div>
                )}
                <button type="button" onClick={() => setShowNewForm(true)} className="text-sm text-primary-600 hover:underline">
                  + Add new student (if not found)
                </button>
              </div>
            )}
          </div>

          {showNewForm && !student && (
            <div className="border rounded-lg p-3 space-y-2 bg-gray-50">
              <h4 className="text-sm font-medium">New Student</h4>
              <div className="grid grid-cols-2 gap-2">
                <input className="input-field text-sm" placeholder="Name*" value={newSt.name}
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
              <label className="block text-sm font-medium text-gray-700 mb-1">Course</label>
              <select className="input-field" value={form.course_name} onChange={(e) => setForm({ ...form, course_name: e.target.value })}>
                {COURSES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Deal Type</label>
              <select className="input-field" value={form.deal_type} onChange={(e) => setForm({ ...form, deal_type: e.target.value })}>
                {DEAL_TYPES.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Training Fee (₹)</label>
              <input type="number" className="input-field" value={form.training_fee}
                onChange={(e) => setForm({ ...form, training_fee: e.target.value })} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Exam Fee (₹)</label>
              <input type="number" className="input-field" value={form.exam_fee}
                onChange={(e) => setForm({ ...form, exam_fee: e.target.value })} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Total (auto)</label>
              <input type="number" className="input-field bg-gray-50 font-semibold" value={total} readOnly />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Source</label>
              <select className="input-field" value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })}>
                {SOURCES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Batch (optional)</label>
              <input className="input-field" value={form.batch_name} onChange={(e) => setForm({ ...form, batch_name: e.target.value })} placeholder="e.g. PMP July 2026" />
            </div>
          </div>

          <div className="flex items-center justify-between pt-2">
            <p className="text-sm text-gray-400">
              {!student ? 'Select or add a student to enable save' : `Student: ${student.name}`}
            </p>
            <div className="flex gap-3">
              <button type="button" onClick={() => { setShowAdd(false); resetForm(); }} className="btn-secondary">Cancel</button>
              <button type="submit" className="btn-primary" disabled={!student || submitting}>
                {submitting ? 'Saving...' : 'Save Enrollment'}
              </button>
            </div>
          </div>
        </form>
      </Modal>
    </div>
  );
}
