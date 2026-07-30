import { useState, useEffect } from 'react';
import { CheckCircle, XCircle, Users as UsersIcon } from 'lucide-react';
import { auth } from '../services/api';
import { useToast } from '../context/ToastContext';
import { Card, CardBody } from '../components/ui/Card';
import Modal from '../components/ui/Modal';

export default function UsersPage() {
  const toast = useToast();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [confirmAction, setConfirmAction] = useState(null);

  useEffect(() => { load(); }, []);

  async function load() {
    try { setUsers(await auth.pendingUsers()); }
    catch (e) { toast.error('Failed to load pending registrations'); }
    finally { setLoading(false); }
  }

  async function handleAction(id, action) {
    try {
      await auth.approveUser(id, action);
      const user = users.find((u) => u.id === id);
      setUsers(users.filter((u) => u.id !== id));
      setConfirmAction(null);
      if (action === 'approve') {
        toast.success(`${user?.name || 'User'} has been approved`);
      } else {
        toast.info(`${user?.name || 'User'} registration rejected`);
      }
    } catch (e) { toast.error(e.message); }
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">User Approvals</h1>
        <p className="text-sm text-gray-400 mt-0.5">{users.length} pending registration{users.length !== 1 ? 's' : ''}</p>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1,2,3].map(i => <div key={i} className="h-20 skeleton w-full" />)}
        </div>
      ) : (
        <div className="grid gap-3">
          {users.map((u) => (
            <Card key={u.id}>
              <CardBody>
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-primary-100 rounded-xl flex items-center justify-center text-primary-700 font-bold text-sm shrink-0">
                      {u.name?.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900">{u.name}</h3>
                      <p className="text-sm text-gray-500">{u.email}</p>
                      <p className="text-xs text-gray-400 mt-0.5">Registered {new Date(u.created_at).toLocaleDateString()}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button onClick={() => setConfirmAction({ id: u.id, action: 'approve', name: u.name })}
                      className="btn-success flex items-center gap-1.5 text-sm px-4">
                      <CheckCircle size={16} /> Approve
                    </button>
                    <button onClick={() => setConfirmAction({ id: u.id, action: 'reject', name: u.name })}
                      className="btn-danger flex items-center gap-1.5 text-sm px-4">
                      <XCircle size={16} /> Reject
                    </button>
                  </div>
                </div>
              </CardBody>
            </Card>
          ))}
          {!users.length && (
            <Card>
              <CardBody>
                <div className="text-center py-10">
                  <div className="w-14 h-14 bg-emerald-50 rounded-2xl flex items-center justify-center mx-auto mb-3">
                    <CheckCircle size={28} className="text-emerald-400" />
                  </div>
                  <h3 className="text-sm font-medium text-gray-500 mb-1">All registrations processed</h3>
                  <p className="text-xs text-gray-400">No pending user registrations</p>
                </div>
              </CardBody>
            </Card>
          )}
        </div>
      )}

      <Modal open={!!confirmAction} onClose={() => setConfirmAction(null)}
        title={confirmAction?.action === 'approve' ? 'Confirm Approval' : 'Confirm Rejection'} size="sm">
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            {confirmAction?.action === 'approve' ? (
              <>Approve <strong>{confirmAction?.name}</strong> to access the system?</>
            ) : (
              <>Reject <strong>{confirmAction?.name}</strong>'s registration request?</>
            )}
          </p>
          <div className="flex justify-end gap-3">
            <button onClick={() => setConfirmAction(null)} className="btn-secondary">Cancel</button>
            <button onClick={() => handleAction(confirmAction.id, confirmAction.action)}
              className={confirmAction?.action === 'approve' ? 'btn-success' : 'btn-danger'}>
              {confirmAction?.action === 'approve' ? 'Yes, Approve' : 'Yes, Reject'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
