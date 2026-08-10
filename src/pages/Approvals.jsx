import { useState, useEffect } from 'react';
import { CheckCircle, XCircle, Eye, Download, FileDown, Search, Filter, DollarSign } from 'lucide-react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { Card, CardBody } from '../components/ui/Card';
import Modal from '../components/ui/Modal';
import Badge from '../components/ui/Badge';
import { getReceiptUrls } from '../utils/receipts';

export default function Approvals() {
  const { user } = useAuth();
  const toast = useToast();
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [showDetail, setShowDetail] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [showReject, setShowReject] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [lightbox, setLightbox] = useState(null);
  const [receiptLoading, setReceiptLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [filterBank, setFilterBank] = useState('');

  useEffect(() => { load(); }, []);

  async function load() {
    try {
      setPayments(await api.approvals.pending());
    } catch (e) { toast.error('Failed to load pending approvals'); }
    finally { setLoading(false); }
  }

  async function handleApprove(payment) {
    setActionLoading(true);
    try {
      await api.approvals.approve(payment.id);
      setPayments((prev) => prev.filter((p) => p.id !== payment.id));
      setShowDetail(false);
      toast.success(`Payment of ₹${Number(payment.amount_paid).toLocaleString()} from ${payment.student_name} marked as received`);
    } catch (e) { toast.error(e.message); }
    finally { setActionLoading(false); }
  }

  async function handleReject() {
    if (!rejectReason.trim()) { toast.error('Please enter a reason'); return; }
    setActionLoading(true);
    try {
      await api.approvals.reject(selected.id, rejectReason);
      setPayments((prev) => prev.filter((p) => p.id !== selected.id));
      setShowReject(false);
      setShowDetail(false);
      setRejectReason('');
      toast.info(`Payment marked as not received: ${rejectReason}`);
    } catch (e) { toast.error(e.message); }
    finally { setActionLoading(false); }
  }

  async function handleDownloadReceipt(payment) {
    setReceiptLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/enrollments/${payment.enrollment_id}/receipt`, {
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
      a.download = `NeoSkills-Receipt-${payment.enrollment_id}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success('Receipt downloaded');
    } catch (e) { toast.error(e.message); }
    finally { setReceiptLoading(false); }
  }

  const filtered = payments.filter((p) => {
    const matchSearch = !search || p.student_name?.toLowerCase().includes(search.toLowerCase())
      || p.course_name?.toLowerCase().includes(search.toLowerCase())
      || p.salesperson_name?.toLowerCase().includes(search.toLowerCase());
    return matchSearch;
  });

  function isImageUrl(url) {
    return /^data:image\/(jpe?g|png|gif|webp);base64,/i.test(url || '')
      || /\.(jpe?g|png|gif|webp)(\?.*)?$/i.test(url || '');
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Payment Approvals</h1>
          <p className="text-sm text-gray-400 mt-0.5">{payments.length} pending payment{payments.length !== 1 ? 's' : ''} awaiting your review</p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input className="input-field pl-9" placeholder="Search by student, course or salesperson..."
            value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1,2,3].map((i) => <div key={i} className="h-28 skeleton w-full" />)}
        </div>
      ) : (
        <div className="grid gap-4">
          {filtered.map((p) => (
            <Card key={p.id}>
              <CardBody>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2 flex-wrap">
                      <h3 className="font-semibold text-gray-900">{p.student_name}</h3>
                      <span className="text-sm text-gray-500">{p.course_name}</span>
                      <Badge status="pending" />
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-1.5 text-sm">
                      <div>
                        <span className="text-gray-400 text-xs block">Amount</span>
                        <span className="font-semibold text-gray-800">₹{Number(p.amount_paid).toLocaleString()}</span>
                      </div>
                      <div>
                        <span className="text-gray-400 text-xs block">Pending</span>
                        <span className="font-semibold text-amber-600">₹{Number(p.pending_amount).toLocaleString()}</span>
                      </div>
                      <div>
                        <span className="text-gray-400 text-xs block">Mode</span>
                        <span className="capitalize">{p.payment_mode}</span>
                      </div>
                      <div>
                        <span className="text-gray-400 text-xs block">Salesperson</span>
                        <span>{p.salesperson_name}</span>
                      </div>
                      <div>
                        <span className="text-gray-400 text-xs block">Bank</span>
                        <span>{p.bank_account_name || '-'}</span>
                      </div>
                      <div>
                        <span className="text-gray-400 text-xs block">Date</span>
                        <span>{new Date(p.created_at).toLocaleDateString()}</span>
                      </div>
                      {p.transaction_id && (
                        <div>
                          <span className="text-gray-400 text-xs block">Txn ID</span>
                          <span className="text-xs">{p.transaction_id}</span>
                        </div>
                      )}
                    </div>
                    {getReceiptUrls(p).length > 0 && (
                      <div className="flex flex-wrap items-center gap-2 mt-2">
                        {getReceiptUrls(p).map((u, i) => isImageUrl(u) && (
                          <button key={i} onClick={() => setLightbox({ p, url: u })} className="shrink-0">
                            <img src={u} alt={`Screenshot ${i + 1}`}
                              className="w-10 h-10 rounded-lg object-cover border border-gray-100 cursor-zoom-in" />
                          </button>
                        ))}
                        <button onClick={() => setLightbox({ p, url: getReceiptUrls(p)[0] })}
                          className="inline-flex items-center gap-1 text-xs text-primary-600 hover:underline">
                          <Download size={12} /> View ({getReceiptUrls(p).length})
                        </button>
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col gap-2 shrink-0">
                    <button onClick={() => { setSelected(p); setShowDetail(true); }}
                      className="btn-ghost px-3 py-1.5 text-sm flex items-center gap-1.5">
                      <Eye size={14} /> Review
                    </button>
                  </div>
                </div>
              </CardBody>
            </Card>
          ))}
          {!filtered.length && (
            <Card>
              <CardBody>
                <div className="text-center py-12">
                  <div className="w-14 h-14 bg-emerald-50 rounded-2xl flex items-center justify-center mx-auto mb-3">
                    <CheckCircle size={28} className="text-emerald-400" />
                  </div>
                  <h3 className="text-sm font-medium text-gray-500 mb-1">All caught up!</h3>
                  <p className="text-xs text-gray-400">{search ? 'No results match your search' : 'No pending payments waiting for approval'}</p>
                </div>
              </CardBody>
            </Card>
          )}
        </div>
      )}

      <Modal open={showDetail} onClose={() => { setShowDetail(false); setSelected(null); }} title="Review Payment" size="md">
        {selected && (
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wider">Student</p>
                <p className="font-semibold text-gray-900">{selected.student_name}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wider">Course</p>
                <p className="font-semibold text-gray-900">{selected.course_name}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wider">Amount</p>
                <p className="font-lg font-bold text-primary-700">₹{Number(selected.amount_paid).toLocaleString()}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wider">Pending Total</p>
                <p className="font-bold text-amber-600">₹{Number(selected.pending_amount).toLocaleString()}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wider">Payment Mode</p>
                <p className="capitalize">{selected.payment_mode}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wider">Bank Account</p>
                <p>{selected.bank_account_name || '-'}</p>
              </div>
              {selected.transaction_id && (
                <div>
                  <p className="text-xs text-gray-400 uppercase tracking-wider">Transaction ID</p>
                  <p className="text-sm">{selected.transaction_id}</p>
                </div>
              )}
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wider">Salesperson</p>
                <p>{selected.salesperson_name}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wider">Date</p>
                <p>{new Date(selected.created_at).toLocaleDateString()}</p>
              </div>
            </div>
            {getReceiptUrls(selected).length > 0 && (
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wider mb-2">Payment Screenshots ({getReceiptUrls(selected).length})</p>
                <div className="grid grid-cols-3 gap-2">
                  {getReceiptUrls(selected).map((u, i) => isImageUrl(u) ? (
                    <button key={i} onClick={() => setLightbox({ p: selected, url: u })} className="block">
                      <img src={u} alt={`Payment screenshot ${i + 1}`}
                        className="w-full rounded-xl border border-gray-100 shadow-sm cursor-zoom-in object-cover h-28 bg-gray-50" />
                    </button>
                  ) : (
                    <button key={i} onClick={() => setLightbox({ p: selected, url: u })}
                      className="inline-flex items-center gap-2 text-sm text-primary-600 hover:underline">
                      <Download size={14} /> Receipt {i + 1}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div className="flex items-center gap-3 pt-4 border-t">
              <button onClick={() => handleDownloadReceipt(selected)}
                className="btn-primary flex-1 flex items-center justify-center gap-2"
                disabled={receiptLoading}>
                <FileDown size={16} /> {receiptLoading ? 'Generating…' : 'Download Receipt (PDF)'}
              </button>
              <button onClick={() => handleApprove(selected)}
                className="btn-success flex-1 flex items-center justify-center gap-2"
                disabled={actionLoading}>
                {actionLoading ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <CheckCircle size={16} />}
                Received
              </button>
              <button onClick={() => setShowReject(true)}
                className="btn-danger flex-1 flex items-center justify-center gap-2"
                disabled={actionLoading}>
                <XCircle size={16} /> Not Received
              </button>
            </div>
          </div>
        )}
      </Modal>

      <Modal open={!!lightbox} onClose={() => setLightbox(null)}
        title={lightbox ? `${lightbox.p.student_name} — Payment Screenshot` : ''} size="xl">
        {lightbox && (
          <div className="space-y-4">
            <img src={lightbox.url} alt="Payment screenshot"
              className="w-full rounded-xl object-contain max-h-[70vh] bg-gray-50" />
            <div className="flex justify-end gap-3">
              <button onClick={() => { setLightbox(null); setShowDetail(true); }}
                className="btn-secondary">Close</button>
              <button onClick={() => handleDownloadReceipt(lightbox.p)}
                className="btn-primary inline-flex items-center gap-2"
                disabled={receiptLoading}>
                <FileDown size={16} /> {receiptLoading ? 'Generating…' : 'Download Receipt (PDF)'}
              </button>
            </div>
          </div>
        )}
      </Modal>

      <Modal open={showReject} onClose={() => { setShowReject(false); setRejectReason(''); }} title="Not Received" size="sm">
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Mark payment of <strong>₹{selected ? Number(selected.amount_paid).toLocaleString() : ''}</strong> from <strong>{selected?.student_name}</strong> as not received?
          </p>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Reason *</label>
            <textarea className={`input-field ${!rejectReason.trim() && rejectReason ? 'border-red-300' : ''}`}
              rows={3} value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Enter reason for marking as not received..." autoFocus />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => { setShowReject(false); setRejectReason(''); }} className="btn-secondary">Cancel</button>
            <button onClick={handleReject} className="btn-danger" disabled={actionLoading || !rejectReason.trim()}>
              {actionLoading ? 'Saving...' : 'Confirm'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
