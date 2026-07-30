import { useState, useEffect } from 'react';
import { CheckCircle, XCircle, Eye, Download } from 'lucide-react';
import { api } from '../services/api';
import { Card, CardBody } from '../components/ui/Card';
import Modal from '../components/ui/Modal';

export default function Approvals() {
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const [showReject, setShowReject] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => { loadPending(); }, []);

  async function loadPending() {
    try {
      const data = await api.approvals.pending();
      setPayments(data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }

  async function handleApprove(id) {
    setActionLoading(true);
    try {
      await api.approvals.approve(id);
      setPayments(payments.filter((p) => p.id !== id));
      setSelected(null);
    } catch (e) { alert(e.message); }
    finally { setActionLoading(false); }
  }

  async function handleReject(id) {
    setActionLoading(true);
    try {
      await api.approvals.reject(id, rejectReason);
      setPayments(payments.filter((p) => p.id !== id));
      setShowReject(false);
      setSelected(null);
      setRejectReason('');
    } catch (e) { alert(e.message); }
    finally { setActionLoading(false); }
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold">Payment Approvals</h1>
        <p className="text-sm text-gray-500 mt-0.5">{payments.length} pending {payments.length === 1 ? 'payment' : 'payments'} awaiting review</p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-32">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600" />
        </div>
      ) : (
        <div className="grid gap-4">
          {payments.map((p) => (
            <Card key={p.id}>
              <CardBody>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-semibold">{p.student_name}</h3>
                      <span className="text-sm text-gray-500">{p.course_name}</span>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                      <div>
                        <span className="text-gray-500">Amount:</span>
                        <span className="ml-1 font-medium">₹{Number(p.amount_paid).toLocaleString()}</span>
                      </div>
                      <div>
                        <span className="text-gray-500">Pending:</span>
                        <span className="ml-1 font-medium text-amber-600">₹{Number(p.pending_amount).toLocaleString()}</span>
                      </div>
                      <div>
                        <span className="text-gray-500">Mode:</span>
                        <span className="ml-1 capitalize">{p.payment_mode}</span>
                      </div>
                      <div>
                        <span className="text-gray-500">Bank:</span>
                        <span className="ml-1">{p.bank_account_name || '-'}</span>
                      </div>
                      <div>
                        <span className="text-gray-500">Salesperson:</span>
                        <span className="ml-1">{p.salesperson_name}</span>
                      </div>
                      <div>
                        <span className="text-gray-500">Date:</span>
                        <span className="ml-1">{new Date(p.created_at).toLocaleDateString()}</span>
                      </div>
                      {p.transaction_id && (
                        <div>
                          <span className="text-gray-500">Txn ID:</span>
                          <span className="ml-1 text-xs">{p.transaction_id}</span>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 ml-4">
                    <button
                      onClick={() => setSelected(p)}
                      className="btn-ghost p-2"
                      title="View Details"
                    >
                      <Eye size={18} />
                    </button>
                    <button
                      onClick={() => handleApprove(p.id)}
                      className="btn-success p-2"
                      title="Approve"
                      disabled={actionLoading}
                    >
                      <CheckCircle size={18} />
                    </button>
                    <button
                      onClick={() => { setSelected(p); setShowReject(true); }}
                      className="btn-danger p-2"
                      title="Reject"
                      disabled={actionLoading}
                    >
                      <XCircle size={18} />
                    </button>
                  </div>
                </div>
                {p.receipt_url && (
                  <a
                    href={p.receipt_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-sm text-primary-600 hover:underline mt-2"
                  >
                    <Download size={14} /> View Receipt
                  </a>
                )}
              </CardBody>
            </Card>
          ))}
          {!payments.length && (
            <Card>
              <CardBody>
                <p className="text-center text-gray-400 py-8">No pending approvals</p>
              </CardBody>
            </Card>
          )}
        </div>
      )}

      <Modal open={showReject} onClose={() => { setShowReject(false); setRejectReason(''); }} title="Reject Payment">
        <div className="space-y-3">
          <p className="text-sm text-gray-600">Reason for rejection:</p>
          <textarea
            className="input-field"
            rows={3}
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="Enter reason..."
          />
          <div className="flex justify-end gap-3">
            <button onClick={() => { setShowReject(false); setRejectReason(''); }} className="btn-secondary">Cancel</button>
            <button onClick={() => handleReject(selected?.id)} className="btn-danger" disabled={actionLoading || !rejectReason}>
              Reject Payment
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
