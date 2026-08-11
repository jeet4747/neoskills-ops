import { useState, useEffect } from 'react';
import { Plus, Search, Download, GraduationCap, Upload, FileText, Check, Pencil, Banknote, FileDown, X, Trash2 } from 'lucide-react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { Card, CardBody } from '../components/ui/Card';
import Table from '../components/ui/Table';
import Badge from '../components/ui/Badge';
import Modal from '../components/ui/Modal';
import { PAYMENT_MODES, CATEGORIES } from '../config/constants';
import { compressImage } from '../utils/imageCompress';

const CATEGORY_DEAL_MAP = {
  'Training': 'training',
  'Training and Certification': 'bundle',
  'Exam with Booking': 'exam',
  'Exam Consulting': 'exam',
};

export default function Enrollments() {
  const { user } = useAuth();
  const toast = useToast();
  const isOps = user && (user.role === 'admin' || user.role === 'manager' || user.role === 'ops');
  const [enrollments, setEnrollments] = useState([]);
  const [bankAccounts, setBankAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [errors, setErrors] = useState({});

  const [form, setForm] = useState({
    candidate_name: '', email: '', phone: '', telecrm_link: '',
    category: 'Training',
    course_name: '',
    training_fee: '', exam_fee: '',
    support_included: false,
    payment_account: '', payment_mode: 'upi',
    payment_received: '', transaction_id: '',
    payment_date: new Date().toISOString().slice(0, 10),
  });
  const [receiptFiles, setReceiptFiles] = useState([]);

  const [editing, setEditing] = useState(null);
  const [editForm, setEditForm] = useState(null);
  const [editSubmitting, setEditSubmitting] = useState(false);

  const [paying, setPaying] = useState(null);
  const [payForm, setPayForm] = useState({ amount_paid: '', payment_mode: 'upi', bank_account_id: '', transaction_id: '' });
  const [payReceiptFiles, setPayReceiptFiles] = useState([]);
  const [paySubmitting, setPaySubmitting] = useState(false);
  const [payErrors, setPayErrors] = useState({});

  const [deleting, setDeleting] = useState(null);
  const [deleteReason, setDeleteReason] = useState('');
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);

  const isManager = user?.role === 'manager' || user?.role === 'admin' || user?.role === 'ops';
  const canDelete = user?.role === 'admin' || user?.role === 'manager';

  useEffect(() => { load(); }, []);

  async function load() {
    try {
      const [enrollData, accounts] = await Promise.all([
        api.enrollments.list(filterStatus ? { status: filterStatus } : {}),
        api.bankAccounts.list(),
      ]);
      setEnrollments(enrollData);
      setBankAccounts(accounts);
    } catch (e) { toast.error('Failed to load enrollments'); }
    finally { setLoading(false); }
  }

  function isImage(file) {
    return file && file.type.startsWith('image/');
  }

  function isCashAccount(id) {
    return bankAccounts.some((b) => b.id === parseInt(id) && b.account_name?.toLowerCase() === 'cash');
  }

  function accountLabel(b) {
    return b.bank_name === b.account_name ? b.account_name : `${b.account_name} — ${b.bank_name}`;
  }

  const trainingFee = parseFloat(form.training_fee) || 0;
  const examFee = parseFloat(form.exam_fee) || 0;
  const total = trainingFee + examFee;
  const received = parseFloat(form.payment_received) || 0;
  const pending = Math.max(total - received, 0);

  const isCash = isCashAccount(form.payment_account);
  const payIsCash = isCashAccount(payForm.bank_account_id);

  const isTrainingOnly = form.category === 'Training';
  const isExamConsulting = form.category === 'Exam Consulting';
  const isExamOnly = form.category === 'Exam with Booking' || isExamConsulting;
  const isBundle = form.category === 'Training and Certification';

  function handleCategoryChange(cat) {
    setForm((f) => ({
      ...f,
      category: cat,
      support_included: cat === 'Exam Consulting',
      training_fee: (cat === 'Exam with Booking' || cat === 'Exam Consulting') ? '' : f.training_fee,
      exam_fee: cat === 'Training' ? '' : f.exam_fee,
    }));
  }

  function validate() {
    const errs = {};
    if (!form.candidate_name.trim()) errs.candidate_name = 'Candidate name is required';
    if (!form.email.trim()) errs.email = 'Email is required';
    if (!form.telecrm_link.trim()) errs.telecrm_link = 'TeleCRM link is required';
    if (!form.course_name.trim()) errs.course_name = 'Module / course is required';
    if (total <= 0) errs.fees = 'Fee must be greater than 0';
    if (!form.payment_account) errs.payment_account = 'Select where payment was received';
    if (received <= 0) errs.payment_received = 'Enter payment received amount';
    if (received > total) errs.payment_received = 'Received amount cannot exceed total fee';
    if (!isCash && !receiptFiles.length) errs.receipt = 'At least one payment screenshot/receipt is required (not needed for cash)';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!validate()) return;
    setSubmitting(true);
    try {
      const result = await api.enrollments.createCombined({
        student_name: form.candidate_name.trim(),
        student_email: form.email.trim(),
        student_phone: form.phone.trim(),
        course_name: form.course_name,
        category: form.category,
        deal_type: CATEGORY_DEAL_MAP[form.category] || 'bundle',
        training_fee: trainingFee,
        exam_fee: examFee,
        total_amount: total,
        support_included: form.support_included,
        telecrm_link: form.telecrm_link.trim(),
        amount_paid: received,
        payment_mode: isCash ? 'cash' : form.payment_mode,
        payment_date: form.payment_date || null,
        bank_account_id: parseInt(form.payment_account) || null,
        transaction_id: form.transaction_id,
      });

      if (receiptFiles.length && result.payment?.id) {
        const compressed = [];
        for (const f of receiptFiles) compressed.push(await compressImage(f));
        await api.payments.uploadReceipt(result.payment.id, compressed);
      }

      toast.success(`Enrollment + payment of ₹${received.toLocaleString()} recorded. Awaiting manager approval.`);
      setShowAdd(false);
      resetForm();
      load();
    } catch (e) { toast.error(e.message); }
    finally { setSubmitting(false); }
  }

  function resetForm() {
    setForm({
      candidate_name: '', email: '', phone: '', telecrm_link: '',
      category: 'Training', course_name: '',
      training_fee: '', exam_fee: '', support_included: false,
      payment_account: '', payment_mode: 'upi',
      payment_received: '', transaction_id: '',
      payment_date: new Date().toISOString().slice(0, 10),
    });
    setReceiptFiles([]);
    setErrors({});
  }

  function openEdit(enrollment) {
    setEditing(enrollment);
    setEditForm({
      student_id: enrollment.student_id,
      student_name: enrollment.student_name || '',
      student_email: enrollment.student_email || '',
      student_phone: enrollment.student_phone || '',
      telecrm_link: enrollment.telecrm_link || '',
      category: enrollment.category || 'Training',
      course_name: enrollment.course_name,
      training_fee: enrollment.training_fee || '',
      exam_fee: enrollment.exam_fee || '',
      support_included: !!enrollment.support_included,
      source: enrollment.source || 'Website',
      batch_name: enrollment.batch_name || '',
      deal_type: enrollment.deal_type || 'bundle',
    });
  }

  async function handleEditSubmit(e) {
    e.preventDefault();
    if (!editForm.student_name.trim()) { toast.error('Candidate name is required'); return; }
    setEditSubmitting(true);
    try {
      await api.enrollments.update(editing.id, {
        ...editForm,
        training_fee: parseFloat(editForm.training_fee) || 0,
        exam_fee: parseFloat(editForm.exam_fee) || 0,
        total_amount: (parseFloat(editForm.training_fee) || 0) + (parseFloat(editForm.exam_fee) || 0),
      });
      toast.success('Enrollment updated successfully');
      setEditing(null);
      setEditForm(null);
      load();
    } catch (e) { toast.error(e.message); }
    finally { setEditSubmitting(false); }
  }

  const editTotal = editForm ? (parseFloat(editForm.training_fee) || 0) + (parseFloat(editForm.exam_fee) || 0) : 0;

  function openPay(enrollment) {
    setPaying(enrollment);
    setPayForm({ amount_paid: '', payment_mode: 'upi', bank_account_id: '', transaction_id: '', payment_date: new Date().toISOString().slice(0, 10) });
    setPayReceiptFiles([]);
    setPayErrors({});
  }

  async function handlePaySubmit(e) {
    e.preventDefault();
    const errs = {};
    const amount = parseFloat(payForm.amount_paid) || 0;
    if (amount <= 0) errs.amount = 'Enter a valid amount';
    else if (amount > Number(paying.pending_amount)) errs.amount = `Cannot exceed pending amount of ₹${Number(paying.pending_amount).toLocaleString()}`;
    if (!payIsCash && !payReceiptFiles.length) errs.receipt = 'At least one payment screenshot/receipt is required (not needed for cash)';
    setPayErrors(errs);
    if (Object.keys(errs).length) return;

    setPaySubmitting(true);
    try {
      const isCash = payIsCash;
      const payment = await api.payments.create({
        enrollment_id: paying.id,
        student_id: paying.student_id,
        amount_paid: amount,
        payment_mode: isCash ? 'cash' : payForm.payment_mode,
        payment_date: payForm.payment_date || null,
        bank_account_id: parseInt(payForm.bank_account_id) || null,
        transaction_id: payForm.transaction_id,
      });
      if (payReceiptFiles.length && payment.id) {
        const compressed = [];
        for (const f of payReceiptFiles) compressed.push(await compressImage(f));
        await api.payments.uploadReceipt(payment.id, compressed);
      }
      toast.success(`Payment of ₹${amount.toLocaleString()} recorded and sent for ops approval`);
      setPaying(null);
      setPayForm({ amount_paid: '', payment_mode: 'upi', bank_account_id: '', transaction_id: '', payment_date: new Date().toISOString().slice(0, 10) });
      setPayReceiptFiles([]);
      load();
    } catch (e) { toast.error(e.message); }
    finally { setPaySubmitting(false); }
  }

  const columns = [
    { key: 'student_name', label: 'Candidate', render: (r) => (
      <div>
        <p className="font-medium text-gray-900">{r.student_name}</p>
        <p className="text-xs text-gray-400">{r.student_phone || r.student_email || ''}</p>
        <div className="flex items-center gap-1.5 mt-2">
          <button onClick={(ev) => { ev.stopPropagation(); openEdit(r); }}
            className="p-1.5 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
            title="Edit enrollment">
            <Pencil size={14} />
          </button>
          {Number(r.pending_amount) > 0 && (
            <button onClick={(ev) => { ev.stopPropagation(); openPay(r); }}
              className="p-1.5 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
              title="Record payment for pending">
              <Banknote size={14} />
            </button>
          )}
          {isOps && (
            <button onClick={(ev) => { ev.stopPropagation(); handleDownloadReceipt(r); }}
              className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
              title="Download receipt (PDF)">
              <FileDown size={14} />
            </button>
          )}
          {canDelete && (
            <button onClick={(ev) => { ev.stopPropagation(); setDeleting(r); setDeleteReason(''); }}
              className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              title="Delete enrollment">
              <Trash2 size={14} />
            </button>
          )}
        </div>
      </div>
    )},
    { key: 'category', label: 'Category', render: (r) => r.category || <span className="capitalize">{r.deal_type}</span> },
    { key: 'course_name', label: 'Module' },
    { key: 'training_fee', label: 'Training Fee', render: (r) => `₹${Number(r.training_fee || 0).toLocaleString()}` },
    { key: 'exam_fee', label: 'Exam Fee', render: (r) => `₹${Number(r.exam_fee || 0).toLocaleString()}` },
    { key: 'total_amount', label: 'Total', render: (r) => `₹${Number(r.total_amount).toLocaleString()}` },
    { key: 'paid_amount', label: 'Received', render: (r) => (
      <span className="font-medium text-emerald-600">₹{Number(r.paid_amount || 0).toLocaleString()}</span>
    )},
    { key: 'pending_amount', label: 'Pending', render: (r) => (
      <span className={`font-medium ${Number(r.pending_amount) > 0 ? 'text-amber-600' : 'text-gray-400'}`}>
        ₹{Number(r.pending_amount || 0).toLocaleString()}
      </span>
    )},
    { key: 'support_included', label: 'Support', render: (r) => r.support_included ? 'Yes' : 'No' },
    { key: 'status', label: 'Status', render: (r) => (
      <Badge status={r.status === 'waiting_approval' ? 'waiting' : r.status === 'active' ? 'pending' : r.status}>
        {r.status === 'waiting_approval' ? 'Approval Pending' : r.status === 'active' ? 'Payment Pending' : 'Completed'}
      </Badge>
    ) },
    { key: 'created_at', label: 'Date', render: (r) => new Date(r.created_at).toLocaleDateString() },
  ];

  async function handleDownloadReceipt(r) {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/enrollments/${r.id}/receipt`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to generate receipt');
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `NeoSkills-Receipt-${r.id}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success('Receipt downloaded');
    } catch (e) {
      toast.error(e.message);
    }
  }

  async function handleDeleteSubmit(e) {
    e.preventDefault();
    if (!deleteReason.trim()) { toast.error('Please enter a reason for deletion'); return; }
    setDeleteSubmitting(true);
    try {
      await api.enrollments.remove(deleting.id, deleteReason.trim());
      toast.success('Enrollment deleted. The salesperson will be notified.');
      setDeleting(null);
      setDeleteReason('');
      load();
    } catch (e) { toast.error(e.message); }
    finally { setDeleteSubmitting(false); }
  }

  function exportCSV() {
    if (!enrollments.length) { toast.info('No data to export'); return; }
    const headers = 'Candidate,Category,Module,Training Fee,Exam Fee,Total,Received,Pending,Support,Status,Date\n';
    const rows = enrollments.map((r) =>
      `"${r.student_name}","${r.category || r.deal_type}","${r.course_name}",${r.training_fee || 0},${r.exam_fee || 0},${r.total_amount},${r.paid_amount || 0},${r.pending_amount || 0},${r.support_included ? 'Yes' : 'No'},${r.status},${new Date(r.created_at).toLocaleDateString()}`
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
          <input className="input-field pl-9" placeholder="Search by candidate, phone or module..."
            value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <select className="input-field w-44" value={filterStatus} onChange={(e) => { setFilterStatus(e.target.value); }}>
          <option value="">All Status</option>
          <option value="active">Payment Pending</option>
          <option value="waiting_approval">Approval Pending</option>
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

      <Modal open={showAdd} onClose={() => { setShowAdd(false); resetForm(); }} title="Add Enrollment & Record Payment" size="xl">
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Candidate Details */}
          <section>
            <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <span className="w-6 h-6 bg-primary-100 rounded-lg flex items-center justify-center text-xs font-bold text-primary-700">1</span>
              Candidate Details
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Candidate Name *</label>
                <input className={`input-field ${errors.candidate_name ? 'border-red-300' : ''}`}
                  value={form.candidate_name}
                  onChange={(e) => { setForm({ ...form, candidate_name: e.target.value }); setErrors({}); }}
                  placeholder="Full name" />
                {errors.candidate_name && <p className="text-xs text-red-500 mt-1">{errors.candidate_name}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Email ID *</label>
                <input type="email" className={`input-field ${errors.email ? 'border-red-300' : ''}`} value={form.email}
                  onChange={(e) => { setForm({ ...form, email: e.target.value }); setErrors({}); }}
                  placeholder="candidate@email.com" />
                {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Number</label>
                <input className="input-field" value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  placeholder="10-digit mobile number" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">TeleCRM Link of the Candidate *</label>
                <input className={`input-field ${errors.telecrm_link ? 'border-red-300' : ''}`}
                  value={form.telecrm_link}
                  onChange={(e) => { setForm({ ...form, telecrm_link: e.target.value }); setErrors({}); }}
                  placeholder="https://neoskills.telecrm.in/..." />
                {errors.telecrm_link && <p className="text-xs text-red-500 mt-1">{errors.telecrm_link}</p>}
              </div>
            </div>
          </section>

          {/* Enrollment Details */}
          <section>
            <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <span className="w-6 h-6 bg-primary-100 rounded-lg flex items-center justify-center text-xs font-bold text-primary-700">2</span>
              Enrollment Details
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Category *</label>
                <select className="input-field" value={form.category}
                  onChange={(e) => handleCategoryChange(e.target.value)}>
                  {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Module *</label>
                <input type="text" className={`input-field ${errors.course_name ? 'border-red-300' : ''}`}
                  value={form.course_name} placeholder="Type the module / course name"
                  onChange={(e) => { setForm({ ...form, course_name: e.target.value }); setErrors({}); }} />
                {errors.course_name && <p className="text-xs text-red-500 mt-1">{errors.course_name}</p>}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mt-4">
              {(isTrainingOnly || isBundle) && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Training Fees (₹)</label>
                  <input type="number" className={`input-field ${errors.fees ? 'border-red-300' : ''}`}
                    value={form.training_fee}
                    onChange={(e) => { setForm({ ...form, training_fee: e.target.value }); setErrors({}); }}
                    placeholder="0" min="0" />
                </div>
              )}
              {(isExamOnly || isBundle) && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">{isExamConsulting ? 'Exam Consulting Fee (₹)' : 'Exam Fees (₹)'}</label>
                  <input type="number" className={`input-field ${errors.fees ? 'border-red-300' : ''}`}
                    value={form.exam_fee}
                    onChange={(e) => { setForm({ ...form, exam_fee: e.target.value }); setErrors({}); }}
                    placeholder="0" min="0" />
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Total (auto)</label>
                <input type="number" className="input-field bg-gray-50 font-semibold text-primary-700" value={total} readOnly />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Support</label>
                <button type="button" onClick={() => setForm({ ...form, support_included: !form.support_included })}
                  className={`w-full h-10 rounded-xl border flex items-center justify-center gap-2 text-sm font-medium transition-colors ${form.support_included ? 'bg-primary-50 border-primary-200 text-primary-700' : 'border-gray-200 text-gray-500 hover:bg-gray-50'}`}>
                  <span className={`w-5 h-5 rounded-md border flex items-center justify-center transition-colors ${form.support_included ? 'bg-primary-600 border-primary-600' : 'border-gray-300'}`}>
                    {form.support_included && <Check size={12} className="text-white" />}
                  </span>
                  {form.support_included ? 'Included' : 'Not Included'}
                </button>
              </div>
            </div>
            {errors.fees && <p className="text-xs text-red-500 mt-2">{errors.fees}</p>}
          </section>

          {/* Payment Details */}
          <section>
            <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <span className="w-6 h-6 bg-primary-100 rounded-lg flex items-center justify-center text-xs font-bold text-primary-700">3</span>
              Payment Details
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Payment Taking In / Account *</label>
                <select className={`input-field ${errors.payment_account ? 'border-red-300' : ''}`}
                  value={form.payment_account}
                  onChange={(e) => { setForm({ ...form, payment_account: e.target.value }); setErrors({}); }}>
                  <option value="">Select account...</option>
                  {bankAccounts.map((b) => (
                    <option key={b.id} value={b.id}>{accountLabel(b)}</option>
                  ))}
                </select>
                {errors.payment_account && <p className="text-xs text-red-500 mt-1">{errors.payment_account}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Payment Mode *</label>
                <select className="input-field" value={isCash ? 'cash' : form.payment_mode}
                  onChange={(e) => setForm({ ...form, payment_mode: e.target.value })} disabled={isCash}>
                  {PAYMENT_MODES.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Transaction ID</label>
                <input className="input-field" value={form.transaction_id}
                  onChange={(e) => setForm({ ...form, transaction_id: e.target.value })}
                  placeholder="e.g. UTR/ref number" />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Payment Received Date</label>
                <input type="date" className="input-field" value={form.payment_date}
                  onChange={(e) => setForm({ ...form, payment_date: e.target.value })} />
              </div>
              <div className="rounded-xl border-2 border-amber-300 bg-amber-50/70 p-3">
                <label className="block text-sm font-bold text-amber-800 mb-1.5">Payment Received (₹) *</label>
                <input type="number" className={`w-full h-11 rounded-lg border border-amber-300 bg-white text-lg font-bold text-gray-900 px-3 focus:outline-none focus:ring-2 focus:ring-amber-400 ${errors.payment_received ? 'border-red-400' : ''}`}
                  value={form.payment_received}
                  onChange={(e) => { setForm({ ...form, payment_received: e.target.value }); setErrors({}); }}
                  placeholder="0" min="1" />
                {errors.payment_received && <p className="text-xs text-red-500 mt-1">{errors.payment_received}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Pending (auto)</label>
                <input type="number" className="input-field bg-amber-50 font-semibold text-amber-700" value={pending} readOnly />
              </div>
              <div className="flex items-end">
                <div className={`w-full rounded-xl px-4 py-2.5 text-sm ${pending === 0 ? 'bg-emerald-50 text-emerald-700 font-medium' : 'bg-amber-50 text-amber-700 font-medium'}`}>
                  {pending === 0 ? '✓ Fully paid' : `₹${pending.toLocaleString()} pending collection`}
                </div>
              </div>
            </div>

            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Payment Screenshot / Receipt {isCash ? '(optional for cash)' : '*'}</label>
              <div className={`border-2 border-dashed rounded-xl p-4 transition-colors ${receiptFiles.length ? 'border-emerald-300 bg-emerald-50/30' : 'border-gray-200 hover:border-primary-300'} ${errors.receipt ? 'border-red-300' : ''}`}>
                {receiptFiles.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-3">
                    {receiptFiles.map((f, i) => (
                      <div key={i} className="relative w-20 h-20 rounded-lg overflow-hidden border border-gray-200 bg-white group">
                        {isImage(f) ? (
                          <img src={URL.createObjectURL(f)} alt={`Receipt ${i + 1}`} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <FileText size={20} className="text-primary-600" />
                          </div>
                        )}
                        <button type="button" onClick={() => setReceiptFiles(receiptFiles.filter((_, j) => j !== i))}
                          className="absolute top-0.5 right-0.5 bg-black/60 text-white rounded-full p-0.5 hover:bg-red-600" title="Remove">
                          <X size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <label className="cursor-pointer flex flex-col items-center gap-1.5">
                  <Upload size={24} className="text-gray-400" />
                  <span className="text-sm font-medium text-gray-600">Click to upload payment screenshots</span>
                  <span className="text-xs text-gray-400">You can upload multiple images (Manager verifies before approving)</span>
                  <input type="file" className="hidden" accept="image/*,application/pdf" multiple
                    onChange={(e) => { setReceiptFiles([...receiptFiles, ...Array.from(e.target.files || [])]); setErrors({}); e.target.value = ''; }} />
                </label>
              </div>
              {errors.receipt && <p className="text-xs text-red-500 mt-1">{errors.receipt}</p>}
            </div>
          </section>

          <div className="flex items-center justify-between pt-4 border-t">
            <p className="text-xs text-gray-400">Enrollment + payment will be sent to <strong>manager</strong> for approval</p>
            <div className="flex gap-3">
              <button type="button" onClick={() => { setShowAdd(false); resetForm(); }} className="btn-secondary">Cancel</button>
              <button type="submit" className="btn-primary px-6" disabled={submitting}>
                {submitting ? (
                  <span className="flex items-center gap-2"><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Saving...</span>
                ) : 'Save Enrollment & Payment'}
              </button>
            </div>
          </div>
        </form>
      </Modal>

      {/* Edit Enrollment Modal */}
      <Modal open={!!editing} onClose={() => { setEditing(null); setEditForm(null); }}
        title="Edit Enrollment" size="xl">
        {editForm && (
          <form onSubmit={handleEditSubmit} className="space-y-5">
            <section>
              <h3 className="text-sm font-semibold text-gray-900 mb-3">Candidate Details</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Candidate Name *</label>
                  <input className="input-field" value={editForm.student_name}
                    onChange={(e) => setEditForm({ ...editForm, student_name: e.target.value })} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Email ID</label>
                  <input type="email" className="input-field" value={editForm.student_email}
                    onChange={(e) => setEditForm({ ...editForm, student_email: e.target.value })} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Number</label>
                  <input className="input-field" value={editForm.student_phone}
                    onChange={(e) => setEditForm({ ...editForm, student_phone: e.target.value })} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">TeleCRM Link of the Candidate</label>
                  <input className="input-field" value={editForm.telecrm_link}
                    onChange={(e) => setEditForm({ ...editForm, telecrm_link: e.target.value })}
                    placeholder="https://neoskills.telecrm.in/..." />
                </div>
              </div>
            </section>

            <section>
              <h3 className="text-sm font-semibold text-gray-900 mb-3">Enrollment Details</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Category</label>
                  <select className="input-field" value={editForm.category}
                    onChange={(e) => setEditForm({ ...editForm, category: e.target.value })}>
                    {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Module</label>
                  <input type="text" className="input-field" value={editForm.course_name}
                    onChange={(e) => setEditForm({ ...editForm, course_name: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mt-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Training Fees (₹)</label>
                  <input type="number" className="input-field" value={editForm.training_fee}
                    onChange={(e) => setEditForm({ ...editForm, training_fee: e.target.value })} min="0" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Exam Fees (₹)</label>
                  <input type="number" className="input-field" value={editForm.exam_fee}
                    onChange={(e) => setEditForm({ ...editForm, exam_fee: e.target.value })} min="0" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Total (auto)</label>
                  <input type="number" className="input-field bg-gray-50 font-semibold text-primary-700" value={editTotal} readOnly />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Support</label>
                  <button type="button" onClick={() => setEditForm({ ...editForm, support_included: !editForm.support_included })}
                    className={`w-full h-10 rounded-xl border flex items-center justify-center gap-2 text-sm font-medium transition-colors ${editForm.support_included ? 'bg-primary-50 border-primary-200 text-primary-700' : 'border-gray-200 text-gray-500 hover:bg-gray-50'}`}>
                    <span className={`w-5 h-5 rounded-md border flex items-center justify-center transition-colors ${editForm.support_included ? 'bg-primary-600 border-primary-600' : 'border-gray-300'}`}>
                      {editForm.support_included && <Check size={12} className="text-white" />}
                    </span>
                    {editForm.support_included ? 'Included' : 'Not Included'}
                  </button>
                </div>
              </div>
            </section>

            <div className="flex items-center justify-between pt-4 border-t">
              <p className="text-xs text-gray-400">Changes to candidate details and fees</p>
              <div className="flex gap-3">
                <button type="button" onClick={() => { setEditing(null); setEditForm(null); }} className="btn-secondary">Cancel</button>
                <button type="submit" className="btn-primary px-6" disabled={editSubmitting}>
                  {editSubmitting ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </div>
          </form>
        )}
      </Modal>

      {/* Record Payment Modal */}
      <Modal open={!!paying} onClose={() => { setPaying(null); setPayForm({ amount_paid: '', payment_mode: 'upi', bank_account_id: '', transaction_id: '' }); setPayReceiptFile(null); }}
        title="Record Payment" size="md">
        {paying && (
          <form onSubmit={handlePaySubmit} className="space-y-4">
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
              <p className="font-semibold text-gray-900">{paying.student_name}</p>
              <p className="text-sm text-gray-500">{paying.course_name}</p>
              <div className="flex gap-6 mt-2 text-sm">
                <div>
                  <span className="text-gray-400 text-xs block">Total</span>
                  <span className="font-semibold">₹{Number(paying.total_amount).toLocaleString()}</span>
                </div>
                <div>
                  <span className="text-gray-400 text-xs block">Received</span>
                  <span className="font-semibold text-emerald-600">₹{Number(paying.paid_amount || 0).toLocaleString()}</span>
                </div>
                <div>
                  <span className="text-gray-400 text-xs block">Pending</span>
                  <span className="font-semibold text-amber-600">₹{Number(paying.pending_amount).toLocaleString()}</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Payment Received Date</label>
                <input type="date" className="input-field" value={payForm.payment_date}
                  onChange={(e) => setPayForm({ ...payForm, payment_date: e.target.value })} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Amount Paid (₹) *</label>
                <input type="number" className={`input-field ${payErrors.amount ? 'border-red-300' : ''}`}
                  value={payForm.amount_paid}
                  onChange={(e) => { setPayForm({ ...payForm, amount_paid: e.target.value }); setPayErrors({}); }}
                  placeholder={`Max ₹${Number(paying.pending_amount).toLocaleString()}`} min="1" />
                {payErrors.amount && <p className="text-xs text-red-500 mt-1">{payErrors.amount}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Payment Mode</label>
                <select className="input-field" value={payForm.payment_mode}
                  onChange={(e) => setPayForm({ ...payForm, payment_mode: e.target.value })} disabled={payIsCash}>
                  {PAYMENT_MODES.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Account / Payment Taking In</label>
                <select className="input-field" value={payForm.bank_account_id}
                  onChange={(e) => setPayForm({ ...payForm, bank_account_id: e.target.value })}>
                  <option value="">Select account...</option>
                  {bankAccounts.map((b) => (
                    <option key={b.id} value={b.id}>{accountLabel(b)}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Transaction ID</label>
                <input className="input-field" value={payForm.transaction_id}
                  onChange={(e) => setPayForm({ ...payForm, transaction_id: e.target.value })}
                  placeholder="e.g. UTR/ref" />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Payment Screenshot / Receipt {payIsCash ? '(optional for cash)' : '*'}</label>
              <div className={`border-2 border-dashed rounded-xl p-4 transition-colors ${payReceiptFiles.length ? 'border-emerald-300 bg-emerald-50/30' : 'border-gray-200 hover:border-primary-300'} ${payErrors.receipt ? 'border-red-300' : ''}`}>
                {payReceiptFiles.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-3">
                    {payReceiptFiles.map((f, i) => (
                      <div key={i} className="relative w-16 h-16 rounded-lg overflow-hidden border border-gray-200 bg-white group">
                        {f.type.startsWith('image/') ? (
                          <img src={URL.createObjectURL(f)} alt={`Receipt ${i + 1}`} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <FileText size={16} className="text-primary-600" />
                          </div>
                        )}
                        <button type="button" onClick={() => setPayReceiptFiles(payReceiptFiles.filter((_, j) => j !== i))}
                          className="absolute top-0.5 right-0.5 bg-black/60 text-white rounded-full p-0.5 hover:bg-red-600" title="Remove">
                          <X size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <label className="cursor-pointer flex flex-col items-center gap-1.5">
                  <Upload size={24} className="text-gray-400" />
                  <span className="text-sm font-medium text-gray-600">Click to upload payment screenshots</span>
                  <input type="file" className="hidden" accept="image/*,application/pdf" multiple
                    onChange={(e) => { setPayReceiptFiles([...payReceiptFiles, ...Array.from(e.target.files || [])]); setPayErrors({}); e.target.value = ''; }} />
                </label>
              </div>
              {payErrors.receipt && <p className="text-xs text-red-500 mt-1">{payErrors.receipt}</p>}
            </div>

            <div className="flex items-center justify-between pt-3 border-t">
              <p className="text-xs text-gray-400">Payment will be sent for <strong>ops approval</strong></p>
              <div className="flex gap-3">
                <button type="button" onClick={() => setPaying(null)} className="btn-secondary">Cancel</button>
                <button type="submit" className="btn-primary px-6" disabled={paySubmitting}>
                  {paySubmitting ? 'Saving...' : 'Record Payment'}
                </button>
              </div>
            </div>
          </form>
        )}
      </Modal>

      {/* Delete Enrollment Modal */}
      <Modal open={!!deleting} onClose={() => { setDeleting(null); setDeleteReason(''); }} title="Delete Enrollment" size="md">
        {deleting && (
          <form onSubmit={handleDeleteSubmit} className="space-y-4">
            <div className="bg-red-50 border border-red-100 rounded-xl p-4">
              <p className="font-semibold text-gray-900">{deleting.student_name}</p>
              <p className="text-sm text-gray-500">{deleting.course_name} · ₹{Number(deleting.total_amount).toLocaleString()}</p>
              <p className="text-xs text-red-600 mt-2">This will permanently remove the enrollment and its payments. The salesperson who added it will be notified.</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Reason for deletion *</label>
              <textarea className="input-field min-h-[100px]" placeholder="e.g. Added twice by mistake, duplicate entry..."
                value={deleteReason}
                onChange={(e) => setDeleteReason(e.target.value)}
                required />
            </div>
            <div className="flex justify-end gap-3 pt-2 border-t">
              <button type="button" onClick={() => { setDeleting(null); setDeleteReason(''); }} className="btn-secondary">Cancel</button>
              <button type="submit" className="px-6 py-2.5 rounded-xl bg-red-600 text-white text-sm font-semibold hover:bg-red-700 transition-colors" disabled={deleteSubmitting}>
                {deleteSubmitting ? 'Deleting...' : 'Delete Enrollment'}
              </button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
