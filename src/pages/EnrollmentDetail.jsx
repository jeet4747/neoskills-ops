import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, DollarSign, Calendar, User, BookOpen, Download, FileDown } from 'lucide-react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { Card, CardHeader, CardBody } from '../components/ui/Card';
import Table from '../components/ui/Table';
import Badge from '../components/ui/Badge';
import Modal from '../components/ui/Modal';

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

  const isOps = user && (user.role === 'admin' || user.role === 'manager' || user.role === 'ops');

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
    { key: 'receipt_url', label: 'Receipt', render: (r) =>
      r.receipt_url ? (
        <button onClick={() => setViewPayment(r)} className="text-primary-600 hover:underline inline-flex items-center gap-1 text-xs">
          <Download size={12} /> View
        </button>
      ) : '-' },
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
          <img src={viewPayment.receipt_url} alt="Payment receipt"
            className="w-full rounded-xl object-contain max-h-[75vh] bg-gray-50" />
        )}
      </Modal>
    </div>
  );
}
