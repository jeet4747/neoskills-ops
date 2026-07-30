import { useState, useEffect } from 'react';
import { Plus, Download, Upload } from 'lucide-react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { Card, CardBody } from '../components/ui/Card';
import Table from '../components/ui/Table';
import Badge from '../components/ui/Badge';
import Modal from '../components/ui/Modal';
import { PAYMENT_MODES } from '../config/constants';

export default function Payments() {
  const { user } = useAuth();
  const [payments, setPayments] = useState([]);
  const [enrollments, setEnrollments] = useState([]);
  const [bankAccounts, setBankAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({
    enrollment_id: '', student_id: '', amount_paid: '',
    payment_mode: 'upi', bank_account_id: '', transaction_id: '',
  });
  const [receiptFile, setReceiptFile] = useState(null);
  const isManager = user?.role === 'manager' || user?.role === 'admin';

  const columns = [
    { key: 'student_name', label: 'Student' },
    { key: 'course_name', label: 'Course' },
    { key: 'amount_paid', label: 'Paid', render: (r) => `₹${Number(r.amount_paid).toLocaleString()}` },
    { key: 'pending_amount', label: 'Pending', render: (r) => (
      <span className={r.pending_amount > 0 ? 'text-amber-600' : 'text-gray-500'}>
        ₹{Number(r.pending_amount).toLocaleString()}
      </span>
    )},
    { key: 'payment_mode', label: 'Mode', render: (r) => <span className="capitalize">{r.payment_mode}</span> },
    { key: 'bank_account_name', label: 'Account', render: (r) => r.bank_account_name || '-' },
    { key: 'status', label: 'Status', render: (r) => <Badge status={r.status} /> },
    { key: 'receipt_url', label: 'Receipt', render: (r) =>
      r.receipt_url ? (
        <a href={r.receipt_url} target="_blank" rel="noopener noreferrer" className="text-primary-600 hover:underline inline-flex items-center gap-1">
          <Download size={14} /> View
        </a>
      ) : '-' },
  ];

  useEffect(() => {
    Promise.all([
      api.payments.list(isManager ? {} : {}),
      api.enrollments.list({ status: 'active' }),
      api.bankAccounts.list(),
    ])
      .then(([p, e, b]) => { setPayments(p); setEnrollments(e); setBankAccounts(b); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    try {
      const enrollment = enrollments.find((en) => en.id === parseInt(form.enrollment_id));
      if (!enrollment) { alert('Select an enrollment'); return; }

      const payment = await api.payments.create({
        enrollment_id: parseInt(form.enrollment_id),
        student_id: enrollment.student_id,
        amount_paid: parseFloat(form.amount_paid),
        payment_mode: form.payment_mode,
        bank_account_id: parseInt(form.bank_account_id) || null,
        transaction_id: form.transaction_id,
      });

      if (receiptFile && payment.id) {
        await api.payments.uploadReceipt(payment.id, receiptFile);
      }

      setShowAdd(false);
      setForm({ enrollment_id: '', student_id: '', amount_paid: '', payment_mode: 'upi', bank_account_id: '', transaction_id: '' });
      setReceiptFile(null);
      const updated = await api.payments.list(isManager ? {} : {});
      setPayments(updated);
    } catch (e) { alert(e.message); }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Payments</h1>
        <button onClick={() => setShowAdd(true)} className="btn-primary flex items-center gap-2">
          <Plus size={16} /> Record Payment
        </button>
      </div>

      <Card>
        <CardBody className="p-0">
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600" />
            </div>
          ) : (
            <Table columns={columns} data={payments} />
          )}
        </CardBody>
      </Card>

      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="Record Payment" size="lg">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Enrollment</label>
            <select className="input-field" value={form.enrollment_id} onChange={(e) => setForm({ ...form, enrollment_id: e.target.value })} required>
              <option value="">Select enrollment...</option>
              {enrollments.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.student_name} — {e.course_name} (₹{Number(e.total_amount).toLocaleString()})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Amount Paid (₹)</label>
              <input type="number" className="input-field" value={form.amount_paid} onChange={(e) => setForm({ ...form, amount_paid: e.target.value })} required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Payment Mode</label>
              <select className="input-field" value={form.payment_mode} onChange={(e) => setForm({ ...form, payment_mode: e.target.value })}>
                {PAYMENT_MODES.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Bank Account</label>
              <select className="input-field" value={form.bank_account_id} onChange={(e) => setForm({ ...form, bank_account_id: e.target.value })}>
                <option value="">Select account...</option>
                {bankAccounts.map((b) => (
                  <option key={b.id} value={b.id}>{b.account_name} — {b.bank_name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Transaction ID</label>
              <input className="input-field" value={form.transaction_id} onChange={(e) => setForm({ ...form, transaction_id: e.target.value })} />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Receipt (optional)</label>
            <input type="file" className="input-field" accept="image/*,application/pdf" onChange={(e) => setReceiptFile(e.target.files[0])} />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setShowAdd(false)} className="btn-secondary">Cancel</button>
            <button type="submit" className="btn-primary">Record Payment</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
