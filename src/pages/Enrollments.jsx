import { useState, useEffect } from 'react';
import { Plus, Search, Download, GraduationCap, Upload, FileText, Check, Pencil, Banknote, FileDown, X, Trash2, Clock } from 'lucide-react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { Card, CardBody } from '../components/ui/Card';
import Table from '../components/ui/Table';
import Badge from '../components/ui/Badge';
import Modal from '../components/ui/Modal';
import { PAYMENT_MODES, CATEGORIES } from '../config/constants';

function fmtINR(n) {
  const num = Number(n || 0);
  const abs = Math.abs(num);
  const sign = num < 0 ? '-' : '';
  if (abs >= 10000000) return `${sign}₹${(abs / 10000000).toFixed(2)}Cr`;
  if (abs >= 100000) return `${sign}₹${(abs / 100000).toFixed(2)}L`;
  return `${sign}₹${abs.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
}
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
  const [filterMonth, setFilterMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [monthOptions, setMonthOptions] = useState(() => {
    const months = [];
    for (let i = 0; i < 12; i++) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      months.push({ value: d.toISOString().slice(0, 7), label: d.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }) });
    }
    return months;
  });
  const [errors, setErrors] = useState({});

  const [form, setForm] = useState({
    candidate_name: '', email: '', phone: '', telecrm_link: '',
    category: 'Training',
    course_name: '',
    training_fee: '', exam_fee: '',
    training_month: new Date().toISOString().slice(0, 7),
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

  const [bankEdit, setBankEdit] = useState(null);
  const [savingBank, setSavingBank] = useState(false);

  const [requestingDeletion, setRequestingDeletion] = useState(null);
  const [requestReason, setRequestReason] = useState('');
  const [requestSubmitting, setRequestSubmitting] = useState(false);
  const [deletionRequests, setDeletionRequests] = useState([]);
  const [showDeletionRequests, setShowDeletionRequests] = useState(false);
  const [reviewNote, setReviewNote] = useState('');
  const [reviewingId, setReviewingId] = useState(null);

  const isManager = user?.role === 'manager' || user?.role === 'admin' || user?.role === 'ops';
  const canDelete = user?.role === 'admin' || user?.role === 'manager';

  useEffect(() => { load(); }, [filterStatus, filterMonth]);

  async function load() {
    try {
      const params = {};
      if (filterStatus) params.status = filterStatus;
      if (filterMonth) params.month = filterMonth;
      const [enrollData, accounts] = await Promise.all([
        api.enrollments.list(params),
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
        training_month: form.training_month || null,
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
      training_fee: '', exam_fee: '', training_month: new Date().toISOString().slice(0, 7),
      support_included: false,
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
      training_month: enrollment.training_month || '',
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
    setPayForm({
      amount_paid: '', payment_mode: 'upi', bank_account_id: '', transaction_id: '',
      payment_date: new Date().toISOString().slice(0, 10),
      collection_month: (enrollment.created_at ? new Date(enrollment.created_at).toISOString().slice(0, 7) : '') || new Date().toISOString().slice(0, 7),
    });
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
        collection_month: payForm.collection_month,
      });
      if (payReceiptFiles.length && payment.id) {
        const compressed = [];
        for (const f of payReceiptFiles) compressed.push(await compressImage(f));
        await api.payments.uploadReceipt(payment.id, compressed);
      }
      toast.success(`Payment of ₹${amount.toLocaleString()} recorded and sent for ops approval`);
      setPaying(null);
      setPayForm({ amount_paid: '', payment_mode: 'upi', bank_account_id: '', transaction_id: '', payment_date: new Date().toISOString().slice(0, 10), collection_month: '' });
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
          {!canDelete && r.sales_user_id === user?.id && (
            <button onClick={(ev) => { ev.stopPropagation(); setRequestingDeletion(r); setRequestReason(''); }}
              className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              title="Request deletion">
              <Trash2 size={14} />
            </button>
          )}
        </div>
      </div>
    )},
    { key: 'category', label: 'Category', render: (r) => r.category || <span className="capitalize">{r.deal_type}</span> },
    { key: 'salesperson_name', label: 'Sales POC', render: (r) => (
      <span className="inline-flex items-center gap-1.5">
        <span className="w-6 h-6 bg-primary-100 text-primary-700 rounded-md flex items-center justify-center text-[10px] font-bold shrink-0">{(r.salesperson_name || '?').charAt(0).toUpperCase()}</span>
        <span className="text-gray-700 font-medium text-xs">{r.salesperson_name || '-'}</span>
      </span>
    )},
    { key: 'course_name', label: 'Module' },
    { key: 'training_month', label: 'Training Month', render: (r) => {
      if (!r.training_month) return <span className="text-gray-300">—</span>;
      const [y, m] = r.training_month.split('-');
      const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
      return <span className="text-xs font-medium text-gray-700">{months[parseInt(m, 10) - 1]} {y}</span>;
    }},
    { key: 'training_fee', label: 'Training Fee', render: (r) => fmtINR(r.training_fee || 0) },
    { key: 'exam_fee', label: 'Exam Fee', render: (r) => fmtINR(r.exam_fee || 0) },
    { key: 'total_amount', label: 'Total', render: (r) => <span className="font-semibold text-gray-900">{fmtINR(r.total_amount)}</span> },
    { key: 'paid_amount', label: 'Received', render: (r) => (
      <span className="font-medium text-emerald-600">{fmtINR(r.paid_amount || 0)}</span>
    )},
    { key: 'pending_amount', label: 'Pending', render: (r) => (
      <span className={`font-medium ${Number(r.pending_amount) > 0 ? 'text-amber-600' : 'text-gray-400'}`}>
        {fmtINR(r.pending_amount || 0)}
      </span>
    )},
    { key: 'bank_account_name', label: 'Bank', render: (r) => (
      <span className="inline-flex items-center gap-1.5">
        <span className={r.bank_account_name ? 'text-gray-700' : 'text-gray-300'}>{r.bank_account_name || '—'}</span>
        {isOps && (
          <button onClick={(ev) => { ev.stopPropagation(); setBankEdit({ ...r, bank_account_id: r.bank_account_id ? String(r.bank_account_id) : '' }); }}
            className="p-1 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-md transition-colors"
            title="Edit bank account">
            <Pencil size={13} />
          </button>
        )}
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

  async function handleBankSave(e) {
    e.preventDefault();
    if (!bankEdit.last_payment_id) { toast.error('No payment recorded for this enrollment yet'); return; }
    setSavingBank(true);
    try {
      const account = bankAccounts.find((b) => b.id === parseInt(bankEdit.bank_account_id));
      const updated = await api.payments.update(bankEdit.last_payment_id, {
        bank_account_id: bankEdit.bank_account_id ? parseInt(bankEdit.bank_account_id) : null,
      });
      setEnrollments((prev) => prev.map((r) => r.id === bankEdit.id
        ? { ...r, bank_account_id: updated.bank_account_id, bank_account_name: account?.account_name || null }
        : r));
      setBankEdit(null);
      toast.success('Bank account updated');
    } catch (err) { toast.error(err.message); }
    finally { setSavingBank(false); }
  }

  async function handleSubmitDeletionRequest(e) {
    e.preventDefault();
    if (!requestReason.trim()) { toast.error('Please enter a reason'); return; }
    setRequestSubmitting(true);
    try {
      await api.enrollments.requestDeletion(requestingDeletion.id, requestReason.trim());
      toast.success('Deletion request submitted. Admin/manager will review it.');
      setRequestingDeletion(null);
      setRequestReason('');
    } catch (e) { toast.error(e.message); }
    finally { setRequestSubmitting(false); }
  }

  async function loadDeletionRequests() {
    try {
      const data = await api.deletionRequests.list('pending');
      setDeletionRequests(data);
    } catch (e) { toast.error('Failed to load deletion requests'); }
  }

  async function handleApproveRequest(dr) {
    try {
      await api.deletionRequests.approve(dr.id, reviewNote || null);
      toast.success('Enrollment deleted');
      setReviewingId(null);
      setReviewNote('');
      loadDeletionRequests();
      load();
    } catch (e) { toast.error(e.message); }
  }

  async function handleRejectRequest(dr) {
    try {
      await api.deletionRequests.reject(dr.id, reviewNote || null);
      toast.success('Request rejected');
      setReviewingId(null);
      setReviewNote('');
      loadDeletionRequests();
    } catch (e) { toast.error(e.message); }
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

  const filteredEnrollments = enrollments.filter((r) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (r.student_name || '').toLowerCase().includes(q)
      || (r.student_phone || '').toLowerCase().includes(q)
      || (r.student_email || '').toLowerCase().includes(q)
      || (r.course_name || '').toLowerCase().includes(q);
  });

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Enrollments</h1>
          <p className="text-sm text-gray-400 mt-0.5">{enrollments.length} total enrollments</p>
        </div>
        <div className="flex items-center gap-2">
          {isManager && (
            <button onClick={() => { setShowDeletionRequests(true); loadDeletionRequests(); }}
              className="btn-ghost flex items-center gap-2 text-sm relative">
              <Clock size={15} /> Deletion Requests
              {deletionRequests.length > 0 && (
                <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-[10px] font-bold rounded-full w-4.5 h-4.5 flex items-center justify-center min-w-[18px]">
                  {deletionRequests.length}
                </span>
              )}
            </button>
          )}
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
        <select className="input-field w-48" value={filterMonth} onChange={(e) => { setFilterMonth(e.target.value); }}>
          <option value="">All Months</option>
          {monthOptions.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1,2,3,4].map((i) => <div key={i} className="h-16 skeleton w-full" />)}
        </div>
      ) : (
        <Card><CardBody className="p-0">
          {!filteredEnrollments.length ? (
            <div className="text-center py-16">
              <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <GraduationCap size={28} className="text-gray-300" />
              </div>
              <h3 className="text-sm font-medium text-gray-500 mb-1">{search ? 'No enrollments match your search' : 'No enrollments yet'}</h3>
              <p className="text-xs text-gray-400 mb-4">{search ? 'Try a different name, phone or module' : 'Create your first enrollment to get started'}</p>
              {!search && <button onClick={() => setShowAdd(true)} className="btn-primary text-sm">Add Enrollment</button>}
            </div>
          ) : (
            <>
              {/* Desktop table */}
              <div className="hidden lg:block">
                <Table columns={columns} data={filteredEnrollments} />
              </div>

              {/* Mobile cards */}
              <div className="lg:hidden divide-y divide-gray-50">
                {filteredEnrollments.map((r) => (
                  <div key={r.id} className="p-4 space-y-2.5">
                    {/* Row 1: Name + Status */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-9 h-9 bg-primary-100 rounded-xl flex items-center justify-center text-primary-700 font-bold text-sm shrink-0">
                          {(r.student_name || '?').charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-gray-900 truncate">{r.student_name}</p>
                          <p className="text-[11px] text-gray-400">{r.student_phone || r.student_email || ''}</p>
                        </div>
                      </div>
                      <Badge status={r.status === 'waiting_approval' ? 'waiting' : r.status === 'active' ? 'pending' : r.status}>
                        {r.status === 'waiting_approval' ? 'Approval Pending' : r.status === 'active' ? 'Payment Pending' : 'Completed'}
                      </Badge>
                    </div>

                    {/* Row 2: Module + Category + Training Month */}
                    <div className="flex items-center gap-3 text-xs text-gray-500">
                      {r.category || <span className="capitalize">{r.deal_type}</span>}
                      <span className="text-gray-300">·</span>
                      <span>{r.course_name}</span>
                      {r.training_month && (
                        <>
                          <span className="text-gray-300">·</span>
                          <span className="text-primary-600 font-medium">{(() => { const [y, m] = r.training_month.split('-'); const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']; return `${months[parseInt(m, 10) - 1]} ${y}`; })()}</span>
                        </>
                      )}
                    </div>

                    {/* Row 3: Sales POC */}
                    <div className="flex items-center gap-1.5 text-xs">
                      <span className="text-gray-400">POC:</span>
                      <span className="inline-flex items-center gap-1.5">
                        <span className="w-5 h-5 bg-primary-100 text-primary-700 rounded flex items-center justify-center text-[9px] font-bold">{(r.salesperson_name || '?').charAt(0).toUpperCase()}</span>
                        <span className="font-medium text-gray-700">{r.salesperson_name || '-'}</span>
                      </span>
                    </div>

                    {/* Row 4: Amounts */}
                    <div className="flex items-center gap-3 text-xs">
                      <span className="text-gray-400">Total:</span>
                      <span className="font-semibold text-gray-900">{fmtINR(r.total_amount)}</span>
                      <span className="text-emerald-600 font-medium">{fmtINR(r.paid_amount || 0)} recv</span>
                      {Number(r.pending_amount) > 0 && <span className="text-amber-600 font-medium">{fmtINR(r.pending_amount)} pend</span>}
                    </div>

                    {/* Row 5: Actions */}
                    <div className="flex items-center gap-2 pt-1">
                      <button onClick={(ev) => { ev.stopPropagation(); openEdit(r); }}
                        className="p-1.5 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors" title="Edit">
                        <Pencil size={14} />
                      </button>
                      {Number(r.pending_amount) > 0 && (
                        <button onClick={(ev) => { ev.stopPropagation(); openPay(r); }}
                          className="p-1.5 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors" title="Record payment">
                          <Banknote size={14} />
                        </button>
                      )}
                      {isOps && (
                        <button onClick={(ev) => { ev.stopPropagation(); handleDownloadReceipt(r); }}
                          className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Download receipt">
                          <FileDown size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </>
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
                <label className="block text-sm font-medium text-gray-700 mb-1.5">TeleCRM Link of the Candidate *</label>
                <input className={`input-field ${errors.telecrm_link ? 'border-red-300' : ''}`}
                  value={form.telecrm_link}
                  onChange={(e) => { setForm({ ...form, telecrm_link: e.target.value }); setErrors({}); }}
                  placeholder="https://neoskills.telecrm.in/..." />
                {errors.telecrm_link && <p className="text-xs text-red-500 mt-1">{errors.telecrm_link}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Number</label>
                <input className="input-field" value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  placeholder="10-digit mobile number" />
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
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Training Month *</label>
                <input type="month" className={`input-field ${errors.training_month ? 'border-red-300' : ''}`}
                  value={form.training_month}
                  onChange={(e) => { setForm({ ...form, training_month: e.target.value }); setErrors({}); }} />
                {errors.training_month && <p className="text-xs text-red-500 mt-1">{errors.training_month}</p>}
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
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Training Month</label>
                  <input type="month" className="input-field" value={editForm.training_month || ''}
                    onChange={(e) => setEditForm({ ...editForm, training_month: e.target.value })} />
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
      <Modal open={!!paying} onClose={() => { setPaying(null); setPayForm({ amount_paid: '', payment_mode: 'upi', bank_account_id: '', transaction_id: '', collection_month: '' }); setPayReceiptFile(null); }}
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
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Payment Month</label>
                <input type="month" className="input-field" value={payForm.collection_month}
                  onChange={(e) => setPayForm({ ...payForm, collection_month: e.target.value })} />
                <p className="text-xs text-gray-400 mt-1">Defaults to the recorded month ({paying.created_at ? new Date(paying.created_at).toISOString().slice(0, 7) : 'this month'}). This is the month the collection counts towards.</p>
              </div>
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

      {/* Edit Bank Account Modal */}
      <Modal open={!!bankEdit} onClose={() => setBankEdit(null)} title="Edit Bank Account" size="sm">
        {bankEdit && (
          <form onSubmit={handleBankSave} className="space-y-4">
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
              <p className="font-semibold text-gray-900">{bankEdit.student_name}</p>
              <p className="text-sm text-gray-500">{bankEdit.course_name}</p>
              {!bankEdit.last_payment_id && (
                <p className="text-xs text-red-600 mt-2">No payment recorded for this enrollment yet, so no bank account to edit.</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Bank Account</label>
              <select className="input-field" value={bankEdit.bank_account_id || ''}
                onChange={(e) => setBankEdit({ ...bankEdit, bank_account_id: e.target.value })}
                disabled={!bankEdit.last_payment_id}>
                <option value="">No account selected</option>
                {bankAccounts.map((b) => (
                  <option key={b.id} value={b.id}>{accountLabel(b)}</option>
                ))}
              </select>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button type="button" onClick={() => setBankEdit(null)} className="px-4 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-xl transition-colors">Cancel</button>
              <button type="submit" disabled={savingBank || !bankEdit.last_payment_id}
                className="flex items-center gap-2 px-4 py-2.5 bg-primary-600 text-white text-sm font-medium rounded-xl hover:bg-primary-700 disabled:opacity-50 transition-colors">
                <Check size={15} /> {savingBank ? 'Saving...' : 'Save'}
              </button>
            </div>
          </form>
        )}
      </Modal>

      {/* Request Deletion Modal (Sales Users) */}
      <Modal open={!!requestingDeletion} onClose={() => { setRequestingDeletion(null); setRequestReason(''); }} title="Request Enrollment Deletion" size="md">
        {requestingDeletion && (
          <form onSubmit={handleSubmitDeletionRequest} className="space-y-4">
            <div className="bg-amber-50 border border-amber-100 rounded-xl p-4">
              <p className="font-semibold text-gray-900">{requestingDeletion.student_name}</p>
              <p className="text-sm text-gray-500">{requestingDeletion.course_name} · ₹{Number(requestingDeletion.total_amount).toLocaleString()}</p>
              <p className="text-xs text-amber-700 mt-2">Your request will be sent to admin/manager for review. The enrollment will be deleted only after approval.</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Reason for deletion *</label>
              <textarea className="input-field min-h-[100px]" placeholder="e.g. Added twice by mistake, duplicate entry..."
                value={requestReason}
                onChange={(e) => setRequestReason(e.target.value)}
                required />
            </div>
            <div className="flex justify-end gap-3 pt-2 border-t">
              <button type="button" onClick={() => { setRequestingDeletion(null); setRequestReason(''); }} className="btn-secondary">Cancel</button>
              <button type="submit" className="px-6 py-2.5 rounded-xl bg-amber-600 text-white text-sm font-semibold hover:bg-amber-700 transition-colors" disabled={requestSubmitting}>
                {requestSubmitting ? 'Submitting...' : 'Submit Request'}
              </button>
            </div>
          </form>
        )}
      </Modal>

      {/* Deletion Requests Panel (Admin/Manager) */}
      <Modal open={showDeletionRequests} onClose={() => setShowDeletionRequests(false)} title="Deletion Requests" size="lg">
        {deletionRequests.length === 0 ? (
          <div className="text-center py-10 text-gray-400">
            <Clock size={32} className="mx-auto mb-2 opacity-40" />
            <p>No pending deletion requests</p>
          </div>
        ) : (
          <div className="space-y-3">
            {deletionRequests.map((dr) => (
              <div key={dr.id} className="border border-gray-100 rounded-xl p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900">{dr.student_name}</p>
                    <p className="text-sm text-gray-500">{dr.course_name} · ₹{Number(dr.total_amount).toLocaleString()}</p>
                    <p className="text-xs text-gray-400 mt-1">Requested by {dr.requested_by_name} · {new Date(dr.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
                    <div className="mt-2 bg-gray-50 rounded-lg p-2.5">
                      <p className="text-xs font-medium text-gray-500 mb-0.5">Reason:</p>
                      <p className="text-sm text-gray-700">{dr.reason}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {reviewingId === dr.id ? (
                      <div className="flex items-center gap-2">
                        <input className="input-field text-sm w-48" placeholder="Note (optional)"
                          value={reviewNote} onChange={(e) => setReviewNote(e.target.value)} />
                        <button onClick={() => handleApproveRequest(dr)}
                          className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-medium hover:bg-emerald-700 transition-colors">
                          Approve
                        </button>
                        <button onClick={() => handleRejectRequest(dr)}
                          className="px-3 py-1.5 rounded-lg bg-red-600 text-white text-xs font-medium hover:bg-red-700 transition-colors">
                          Reject
                        </button>
                        <button onClick={() => { setReviewingId(null); setReviewNote(''); }}
                          className="p-1 text-gray-400 hover:text-gray-600 transition-colors">
                          <X size={14} />
                        </button>
                      </div>
                    ) : (
                      <button onClick={() => setReviewingId(dr.id)}
                        className="px-3 py-1.5 rounded-lg bg-primary-600 text-white text-xs font-medium hover:bg-primary-700 transition-colors">
                        Review
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Modal>
    </div>
  );
}
