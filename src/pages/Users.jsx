import { useState, useEffect } from 'react';
import { CheckCircle, XCircle } from 'lucide-react';
import { api } from '../services/api';
import { Card, CardBody } from '../components/ui/Card';

export default function Users() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { load(); }, []);

  async function load() {
    try { setUsers(await api.auth.pendingUsers()); }
    catch (e) { console.error(e); }
    finally { setLoading(false); }
  }

  async function handleAction(id, action) {
    try {
      await api.auth.approveUser(id, action);
      setUsers(users.filter((u) => u.id !== id));
    } catch (e) { alert(e.message); }
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold">Pending User Registrations</h1>
        <p className="text-sm text-gray-500 mt-0.5">{users.length} pending {users.length === 1 ? 'registration' : 'registrations'}</p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-32">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600" />
        </div>
      ) : (
        <div className="grid gap-3">
          {users.map((u) => (
            <Card key={u.id}>
              <CardBody>
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold">{u.name}</h3>
                    <p className="text-sm text-gray-500">{u.email}</p>
                    <p className="text-xs text-gray-400">Registered: {new Date(u.created_at).toLocaleDateString()}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleAction(u.id, 'approve')}
                      className="btn-success flex items-center gap-1 text-sm"
                    >
                      <CheckCircle size={16} /> Approve
                    </button>
                    <button
                      onClick={() => handleAction(u.id, 'reject')}
                      className="btn-danger flex items-center gap-1 text-sm"
                    >
                      <XCircle size={16} /> Reject
                    </button>
                  </div>
                </div>
              </CardBody>
            </Card>
          ))}
          {!users.length && (
            <Card>
              <CardBody><p className="text-center text-gray-400 py-4">No pending registrations</p></CardBody>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
