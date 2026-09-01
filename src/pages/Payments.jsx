import { useState, useEffect } from 'react';
import { Plus, Download, Search, Upload, FileText, X } from 'lucide-react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { Card, CardBody } from '../components/ui/Card';
import Table from '../components/ui/Table';
import Badge from '../components/ui/Badge';
import Modal from '../components/ui/Modal';
import { PAYMENT_MODES } from '../config/constants';
import { compressImage } from '../utils/imageCompress';
import { getReceiptUrls } from '../utils/receipts';

export default function Payments() {
  const { user } = useAuth();
  const toast = useToast();
  const [payments, setPayments] = useState([]);
  const [enrollments, setEnrollments] = useState([]);
  const [bankAccounts, setBankAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterMonth, setFilterMonth] = useState('');
  const [monthOptions, setMonthOptions] = useState(() => {
    const months = [];
    for (let i = 0; i < 12; i++) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      months.push({ value: d.toISOString().slice(0, 7), label: d.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }) });
    }
    return months;
  });
  const [enrollSearch, setEnrollSearch] = useState('');
  const [form, setForm] = useState({
    enrollment_id: '', student_id: '', amount_paid: '',
    payment_mode: 'upi', bank_account_id: '', transaction_id: '',
    collection_month: new Date().toISOString().slice(0, 7),
  });
  const [receiptFiles, setReceiptFiles] = useState([]);
  const [selectedEnrollment, setSelectedEnrollment] = useState(null);
  const [viewPayment, setViewPayment] = useState(null);
  const [errors, setErrors] = useState({});
  const isManager = user?.role === 'manager' || user?.role === 'admin' || user?.role === 'ops';

  function isImage(file) {
    return file && file.type.startsWith('image/');
  }

  function isCashAccount(id) {
    return bankAccounts.some((b) => b.id === parseInt(id) && b.account_name?.toLowerCase() === 'cash');
  }

  function accountLabel(b) {
    return b.bank_name === b.account_name ? b.account_name : `${b.account_name} — ${b.bank_name}`;
  }

  const filteredEnrollments = enrollments.filter((e) => {
    if (!enrollSearch) return true;
    const q = enrollSearch.toLowerCase();
    return e.student_name?.toLowerCase().includes(q)
      || e.student_phone?.toLowerCase().includes(q)
      || e.student_email?.toLowerCase().includes(q)
      || e.course_name?.toLowerCase().includes(q);
  });

  const columns = [
    { key: 'student_name', label: 'Student' },
    { key: 'course_name', label: 'Course' },
    { key: 'amount_paid', label: 'Paid', render: (r) => `₹${Number(r.amount_paid).toLocaleString()}` },
    { key: 'pending_amount', label: 'Pending', render: (r) => (
      <span className={Number(r.pending_amount) > 0 ? 'text-amber-600 font-medium' : 'text-gray-400'}>
        ₹{Number(r.pending_amount).toLocaleString()}
      </span>
    )},
    { key: 'payment_mode', label: 'Mode', render: (r) => <span className="capitalize">{r.payment_mode}</span> },
    { key: 'bank_account_name', label: 'Account', render: (r) => r.bank_account_name || '-' },
    { key: 'collection_month', label: 'Month', render: (r) => r.collection_month ? (
      <span>
        {new Date(r.collection_month + '-01').toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}
      </span>
    ) : '-' },
    { key: 'status', label: 'Status', render: (r) => <Badge status={r.status} /> },
    { key: 'receipt_url', label: 'Receipt', render: (r) => {
      const urls = getReceiptUrls(r);
      return urls.length ? (
        <button onClick={() => setViewPayment(r)} className="text-primary-600 hover:underline inline-flex items-center gap-1 text-xs">
          <Download size={12} /> View ({urls.length})
        </button>
      ) : '-';
    } },
  ];

  useEffect(() => { load(); }, [filterMonth]);

  async function load() {
    try {
      const params = {};
      if (filterMonth) params.month = filterMonth;
      const [p, e, b] = await Promise.all([
        api.payments.list(params),
        api.enrollments.list({ status: 'active' }),
        api.bankAccounts.list(),
      ]);
      setPayments(p);
      setEnrollments(e);
      setBankAccounts(b);
    } catch (e) { toast.error('Failed to load payments'); }
    finally { setLoading(false); }
  }

  function validate() {
    const errs = {};
    if (!form.enrollment_id) errs.enrollment = 'Select an enrollment';
    if (!form.amount_paid || parseFloat(form.amount_paid) <= 0) errs.amount = 'Enter a valid amount';
    if (!receiptFiles.length) errs.receipt = 'Payment screenshot/receipt is required for approval';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!validate()) return;
    setSubmitting(true);
    try {
      const enrollment = enrollments.find((en) => en.id === parseInt(form.enrollment_id));
      const isCash = isCashAccount(form.bank_account_id);
      const payment = await api.payments.create({
        enrollment_id: parseInt(form.enrollment_id),
        student_id: enrollment.student_id,
        amount_paid: parseFloat(form.amount_paid),
        payment_mode: isCash ? 'cash' : form.payment_mode,
        bank_account_id: parseInt(form.bank_account_id) || null,
        transaction_id: form.transaction_id,
        collection_month: form.collection_month,
      });

      if (receiptFiles.length && payment.id) {
        const compressed = [];
        for (const f of receiptFiles) compressed.push(await compressImage(f));
        await api.payments.uploadReceipt(payment.id, compressed);
      }

      toast.success(`Payment of ₹${Number(form.amount_paid).toLocaleString()} recorded and sent for approval`);
      setShowAdd(false);
      setForm({ enrollment_id: '', student_id: '', amount_paid: '', payment_mode: 'upi', bank_account_id: '', transaction_id: '', collection_month: new Date().toISOString().slice(0, 7) });
      setSelectedEnrollment(null);
      setReceiptFiles([]);
      setEnrollSearch('');
      setErrors({});
      load();
    } catch (e) { toast.error(e.message); }
    finally { setSubmitting(false); }
  }

  function handleEnrollmentChange(enrollmentId) {
    const enrollment = enrollments.find((en) => en.id === parseInt(enrollmentId));
    setSelectedEnrollment(enrollment);
    setForm({ ...form, enrollment_id: enrollmentId, student_id: enrollment?.student_id || '', collection_month: (enrollment?.created_at ? new Date(enrollment.created_at).toISOString().slice(0, 7) : '') || new Date().toISOString().slice(0, 7) });
    setEnrollSearch('');
  }

  const filtered = payments.filter((p) => {
    const matchSearch = !search || p.student_name?.toLowerCase().includes(search.toLowerCase())
      || p.course_name?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = !filterStatus || p.status === filterStatus;
    return matchSearch && matchStatus;
  });

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Payments</h1>
          <p className="text-sm text-gray-400 mt-0.5">{payments.length} total payments</p>
        </div>
        <button onClick={() => setShowAdd(true)} className="btn-primary flex items-center gap-2 shadow-sm">
          <Plus size={16} /> Record Payment
        </button>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input className="input-field pl-9" placeholder="Search by student or course..."
            value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <select className="input-field w-44" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
          <option value="">All Status</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
        </select>
        <select className="input-field w-48" value={filterMonth} onChange={(e) => setFilterMonth(e.target.value)}>
          <option value="">All Months</option>
          {monthOptions.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
        </select>
      </div>

      <Card>
        <CardBody className="p-0">
          {loading ? (
            <div className="space-y-3 p-5">
              {[1,2,3,4].map((i) => <div key={i} className="h-12 skeleton w-full" />)}
            </div>
          ) : (
            <Table columns={columns} data={filtered} />
          )}
          {!loading && !filtered.length && (
            <div className="text-center py-12">
              <div className="w-14 h-14 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
                <Upload size={28} className="text-gray-300" />
              </div>
              <h3 className="text-sm font-medium text-gray-500 mb-1">{search || filterStatus ? 'No matching payments' : 'No payments recorded yet'}</h3>
              <p className="text-xs text-gray-400 mb-4">Record a payment for an active enrollment</p>
              <button onClick={() => setShowAdd(true)} className="btn-primary text-sm">Record Payment</button>
            </div>
          )}
        </CardBody>
      </Card>

      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="Record Payment" size="lg">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Enrollment *</label>
            {selectedEnrollment ? (
              <div className="border border-primary-200 bg-primary-50/50 rounded-xl p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-900">{selectedEnrollment.student_name}</p>
                    <div className="text-xs text-gray-500 mt-0.5 space-y-0.5">
                      {selectedEnrollment.student_phone && <p>📱 {selectedEnrollment.student_phone}</p>}
                      {selectedEnrollment.student_email && <p>✉️ {selectedEnrollment.student_email}</p>}
                      <p className="text-gray-400">{selectedEnrollment.course_name}{selectedEnrollment.batch_name ? ` · ${selectedEnrollment.batch_name}` : ''}</p>
                    </div>
                  </div>
                  <button type="button" onClick={() => setSelectedEnrollment(null)} className="text-sm text-red-500 hover:underline font-medium shrink-0">
                    Change
                  </button>
                </div>
                <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-primary-100">
                  <div>
                    <p className="text-[10px] text-gray-400 uppercase tracking-wider">Total Fee</p>
                    <p className="text-sm font-semibold text-gray-900">₹{Number(selectedEnrollment.total_amount).toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-400 uppercase tracking-wider">Paid So Far</p>
                    <p className="text-sm font-semibold text-emerald-600">₹{Number(selectedEnrollment.paid_amount || 0).toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-400 uppercase tracking-wider">Pending</p>
                    <p className="text-sm font-semibold text-amber-600">₹{Number(selectedEnrollment.pending_amount || 0).toLocaleString()}</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="relative">
                  <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input className="input-field pl-9" placeholder="Search candidate by name, phone or email..."
                    value={enrollSearch} onChange={(e) => setEnrollSearch(e.target.value)} />
                </div>
                <div className="border rounded-xl max-h-52 overflow-y-auto shadow-sm divide-y divide-gray-50">
                  {filteredEnrollments.length > 0 ? filteredEnrollments.map((e) => (
                    <button key={e.id} type="button"
                      className="w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors"
                      onClick={() => handleEnrollmentChange(e.id)}>
                      <div className="flex items-center justify-between">
                        <p className="font-medium text-gray-900 text-sm">{e.student_name}</p>
                        <span className={`text-xs font-medium ${Number(e.pending_amount) > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
                          Pending ₹{Number(e.pending_amount).toLocaleString()}
                        </span>
                      </div>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {e.course_name}
                        {e.student_phone && <span> · 📱 {e.student_phone}</span>}
                      </p>
                      {e.student_email && <p className="text-xs text-gray-400">✉️ {e.student_email}</p>}
                    </button>
                  )) : (
                    <p className="text-center text-gray-400 text-sm py-8">No active enrollments found</p>
                  )}
                </div>
                {errors.enrollment && <p className="text-xs text-red-500">{errors.enrollment}</p>}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Amount Paid (₹) *</label>
              <input type="number" className={`input-field ${errors.amount ? 'border-red-300' : ''}`}
                value={form.amount_paid}
                onChange={(e) => { setForm({ ...form, amount_paid: e.target.value }); setErrors({}); }}
                min="1" required placeholder="e.g. 5000" />
              {errors.amount && <p className="text-xs text-red-500 mt-1">{errors.amount}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Payment Mode *</label>
              <select className="input-field" value={isCashAccount(form.bank_account_id) ? 'cash' : form.payment_mode}
                onChange={(e) => setForm({ ...form, payment_mode: e.target.value })}
                disabled={isCashAccount(form.bank_account_id)}>
                {PAYMENT_MODES.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Bank Account</label>
              <select className="input-field" value={form.bank_account_id}
                onChange={(e) => setForm({ ...form, bank_account_id: e.target.value })}>
                <option value="">Select account...</option>
                {bankAccounts.map((b) => (
                  <option key={b.id} value={b.id}>{accountLabel(b)}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Transaction ID</label>
              <input className="input-field" value={form.transaction_id}
                onChange={(e) => setForm({ ...form, transaction_id: e.target.value })}
                placeholder="e.g. UTR/ref number" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Payment Month</label>
              <input type="month" className="input-field" value={form.collection_month}
                onChange={(e) => setForm({ ...form, collection_month: e.target.value })} />
              <p className="text-xs text-gray-400 mt-1">
                {selectedEnrollment?.created_at ? `Defaults to recorded month (${new Date(selectedEnrollment.created_at).toISOString().slice(0, 7)})` : 'Defaults to the recorded month of the selected enrollment'}
              </p>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Payment Screenshot / Receipt *</label>
            <div className={`border-2 border-dashed rounded-xl p-4 transition-colors ${receiptFiles.length ? 'border-emerald-300 bg-emerald-50/30' : 'border-gray-200 hover:border-primary-300'} ${errors.receipt ? 'border-red-300' : ''}`}>
              {receiptFiles.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-3">
                  {receiptFiles.map((f, i) => (
                    <div key={i} className="relative w-16 h-16 rounded-lg overflow-hidden border border-gray-200 bg-white group">
                      {isImage(f) ? (
                        <img src={URL.createObjectURL(f)} alt={`Receipt ${i + 1}`} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <FileText size={16} className="text-primary-600" />
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
                <span className="text-xs text-gray-400">You can upload multiple images — manager will verify & approve</span>
                <input type="file" className="hidden" accept="image/*,application/pdf" multiple
                  onChange={(e) => { setReceiptFiles([...receiptFiles, ...Array.from(e.target.files || [])]); setErrors({}); e.target.value = ''; }} />
              </label>
            </div>
            {errors.receipt && <p className="text-xs text-red-500 mt-1">{errors.receipt}</p>}
          </div>

          <div className="flex items-center justify-between pt-3 border-t">
            <p className="text-xs text-gray-400">
              Payment + screenshot will be sent to <strong>manager</strong> for approval
            </p>
            <div className="flex gap-3">
              <button type="button" onClick={() => setShowAdd(false)} className="btn-secondary">Cancel</button>
              <button type="submit" className="btn-primary px-6" disabled={submitting}>
                {submitting ? (
                  <span className="flex items-center gap-2"><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Saving...</span>
                ) : 'Record Payment'}
              </button>
            </div>
          </div>
        </form>
      </Modal>

      <Modal open={!!viewPayment} onClose={() => setViewPayment(null)}
        title={viewPayment ? `Payment Receipt — ₹${Number(viewPayment.amount_paid).toLocaleString()}` : ''} size="xl">
        {viewPayment && (
          <div className="grid grid-cols-2 gap-3">
            {getReceiptUrls(viewPayment).map((u, i) => (
              <img key={i} src={u} alt={`Payment receipt ${i + 1}`}
                className="w-full rounded-xl object-contain max-h-[70vh] bg-gray-50 border border-gray-100" />
            ))}
          </div>
        )}
      </Modal>
    </div>
  );
}
