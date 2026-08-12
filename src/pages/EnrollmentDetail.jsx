import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, DollarSign, Calendar, User, BookOpen, Download, FileDown, ExternalLink, Pencil, Save } from 'lucide-react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { Card, CardHeader, CardBody } from '../components/ui/Card';
import Table from '../components/ui/Table';
import Badge from '../components/ui/Badge';
import Modal from '../components/ui/Modal';
import { getReceiptUrls } from '../utils/receipts';

export default function EnrollmentDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { user } = useAuth();
  const [enrollment, setEnrollment] = useState(null);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [viewPayment, setViewPayment] = useState(null);
  const [showEditTelecrm, setShowEditTelecrm] = useState(false);
  const [telecrmInput, setTelecrmInput] = useState('');
  const [savingTelecrm, setSavingTelecrm] = useState(false);

  const isOps = user && (user.role === 'admin' || user.role === 'manager' || user.role === 'ops');
  const isOwner = user && user.id === enrollment?.sales_user_id;
  const canEditTelecrm = isOps || isOwner;

  useEffect(() => { load(); }, [id]);

  async function handleDownloadReceipt() {
    setDownloading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/enrollments/${id}/receipt`, {
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
      a.download = `NeoSkills-Receipt-${id}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success('Receipt downloaded');
    } catch (e) {
      toast.error(e.message);
    } finally {
      setDownloading(false);
    }
  }

  async function load() {
    try {
      const [enrollData, paymentsData] = await Promise.all([
        api.enrollments.get(id),
        api.payments.list({ enrollment_id: id }),
      ]);
      setEnrollment(enrollData);
      setPayments(paymentsData);
    } catch (e) {
      toast.error('Failed to load enrollment');
      navigate('/enrollments');
    } finally {
      setLoading(false);
    }
  }

  function openEditTelecrm() {
    setTelecrmInput(enrollment?.telecrm_link || '');
    setShowEditTelecrm(true);
  }

  async function saveTelecrm() {
    if (!telecrmInput.trim()) { toast.error('TeleCRM link is required'); return; }
    try {
      setSavingTelecrm(true);
      await api.enrollments.update(id, { telecrm_link: telecrmInput.trim() });
      setEnrollment((e) => ({ ...e, telecrm_link: telecrmInput.trim() }));
      setShowEditTelecrm(false);
      toast.success('TeleCRM link updated');
    } catch (e) {
      toast.error(e.message);
    } finally {
      setSavingTelecrm(false);
    }
  }

  const paymentColumns = [
    { key: 'amount_paid', label: 'Amount', render: (r) => `₹${Number(r.amount_paid).toLocaleString()}` },
    { key: 'pending_amount', label: 'Pending', render: (r) => (
      <span className={Number(r.pending_amount) > 0 ? 'text-amber-600 font-medium' : 'text-gray-400'}>
        ₹{Number(r.pending_amount).toLocaleString()}
      </span>
    )},
    { key: 'payment_mode', label: 'Mode', render: (r) => <span className="capitalize">{r.payment_mode}</span> },
    { key: 'bank_account_name', label: 'Account', render: (r) => r.bank_account_name || '-' },
    { key: 'status', label: 'Status', render: (r) => <Badge status={r.status} /> },
    { key: 'salesperson_name', label: 'Recorded by' },
    { key: 'created_at', label: 'Date', render: (r) => new Date(r.created_at).toLocaleDateString() },
    { key: 'receipt_url', label: 'Receipt', render: (r) => {
      const urls = getReceiptUrls(r);
      return urls.length ? (
        <button onClick={() => setViewPayment(r)} className="text-primary-600 hover:underline inline-flex items-center gap-1 text-xs">
          <Download size={12} /> View ({urls.length})
        </button>
      ) : '-';
    } },
  ];

  if (loading) {
    return (
      <div className="space-y-5">
        <div className="h-8 w-48 skeleton" />
        <div className="grid grid-cols-2 gap-5">{[1,2,3,4].map(i => <div key={i} className="h-20 skeleton" />)}</div>
        <div className="h-64 skeleton" />
      </div>
    );
  }

  if (!enrollment) return null;

  const totalPaid = payments
    .filter((p) => p.status === 'approved')
    .reduce((sum, p) => sum + Number(p.amount_paid), 0);
  const totalPending = Number(enrollment.total_amount) - totalPaid;

  return (
    <div className="space-y-6">
      <button onClick={() => navigate('/enrollments')} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors">
        <ArrowLeft size={15} /> Back to Enrollments
      </button>

      <Card>
        <CardBody>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-primary-100 rounded-2xl flex items-center justify-center">
                <BookOpen size={24} className="text-primary-600" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">{enrollment.student_name}</h1>
                <p className="text-sm text-gray-500">{enrollment.course_name}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {isOps && (
                <button
                  onClick={handleDownloadReceipt}
                  disabled={downloading}
                  className="btn-primary inline-flex items-center gap-2"
                >
                  <FileDown size={16} />
                  {downloading ? 'Generating…' : 'Download Receipt'}
                </button>
              )}
              <Badge status={Number(totalPending) > 0 ? 'active' : 'completed'} />
            </div>
          </div>
          <div className="mt-4 pt-4 border-t border-gray-50 flex flex-col sm:flex-row sm:items-center gap-2">
            <span className="text-xs text-gray-400 uppercase tracking-wider">TeleCRM Link</span>
            {enrollment.telecrm_link ? (
              <a href={enrollment.telecrm_link} target="_blank" rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-sm font-medium text-primary-600 hover:underline truncate max-w-full">
                {enrollment.telecrm_link}
                <ExternalLink size={13} className="shrink-0" />
              </a>
            ) : (
              <span className="text-sm text-gray-400">Not added</span>
            )}
            {canEditTelecrm && (
              <button onClick={openEditTelecrm}
                className="ml-auto inline-flex items-center gap-1.5 text-xs font-medium text-gray-500 hover:text-primary-600 hover:bg-primary-50 px-2.5 py-1.5 rounded-lg transition-colors">
                <Pencil size={13} /> Edit
              </button>
            )}
          </div>
        </CardBody>
      </Card>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
        <Card>
          <CardBody>
            <p className="text-[10px] sm:text-xs text-gray-400 uppercase tracking-wider">Total Fee</p>
            <p className="text-base sm:text-xl font-bold text-gray-900 mt-0.5 break-words">₹{Number(enrollment.total_amount).toLocaleString()}</p>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <p className="text-[10px] sm:text-xs text-gray-400 uppercase tracking-wider">Paid</p>
            <p className="text-base sm:text-xl font-bold text-emerald-600 mt-0.5 break-words">₹{totalPaid.toLocaleString()}</p>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <p className="text-[10px] sm:text-xs text-gray-400 uppercase tracking-wider">Pending</p>
            <p className="text-base sm:text-xl font-bold text-amber-600 mt-0.5 break-words">₹{totalPending.toLocaleString()}</p>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <p className="text-[10px] sm:text-xs text-gray-400 uppercase tracking-wider">Deal Type</p>
            <p className="text-base sm:text-xl font-bold text-gray-900 mt-0.5 capitalize break-words">{enrollment.deal_type}</p>
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <h3 className="font-semibold text-gray-900">Payment History ({payments.length})</h3>
        </CardHeader>
        <CardBody className="p-0">
          <Table columns={paymentColumns} data={payments} />
          {!payments.length && (
            <div className="text-center py-12 text-sm text-gray-400">No payments recorded yet</div>
          )}
        </CardBody>
      </Card>

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
      <Modal open={showEditTelecrm} onClose={() => setShowEditTelecrm(false)} title="Edit TeleCRM Link">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">TeleCRM Link *</label>
            <input
              value={telecrmInput}
              onChange={(e) => setTelecrmInput(e.target.value)}
              placeholder="https://neoskills.telecrm.in/..."
              className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
            <p className="text-xs text-gray-400 mt-1">Link to this candidate's deal in TeleCRM.</p>
          </div>
          <div className="flex justify-end gap-3">
            <button onClick={() => setShowEditTelecrm(false)} className="px-4 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-xl transition-colors">Cancel</button>
            <button onClick={saveTelecrm} disabled={savingTelecrm}
              className="flex items-center gap-2 px-4 py-2.5 bg-primary-600 text-white text-sm font-medium rounded-xl hover:bg-primary-700 disabled:opacity-50 transition-colors">
              <Save size={15} /> {savingTelecrm ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
