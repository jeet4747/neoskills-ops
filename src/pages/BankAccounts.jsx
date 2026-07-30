import { useState, useEffect } from 'react';
import { Plus, Building2 } from 'lucide-react';
import { api } from '../services/api';
import { Card, CardBody } from '../components/ui/Card';
import Modal from '../components/ui/Modal';

export default function BankAccounts() {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ account_name: '', account_number: '', bank_name: '', ifsc: '', branch: '' });

  useEffect(() => { load(); }, []);

  async function load() {
    try { setAccounts(await api.bankAccounts.list()); }
    catch (e) { console.error(e); }
    finally { setLoading(false); }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    try {
      await api.bankAccounts.create(form);
      setShowAdd(false);
      setForm({ account_name: '', account_number: '', bank_name: '', ifsc: '', branch: '' });
      load();
    } catch (e) { alert(e.message); }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Bank Accounts</h1>
        <button onClick={() => setShowAdd(true)} className="btn-primary flex items-center gap-2">
          <Plus size={16} /> Add Account
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-32">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600" />
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {accounts.map((acc) => (
            <Card key={acc.id}>
              <CardBody>
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-blue-50 rounded-lg">
                    <Building2 size={20} className="text-blue-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold">{acc.account_name}</h3>
                    <p className="text-sm text-gray-500">{acc.bank_name}</p>
                    <p className="text-sm font-mono mt-1">{acc.account_number}</p>
                    {acc.ifsc && <p className="text-xs text-gray-400 mt-0.5">IFSC: {acc.ifsc}</p>}
                    {acc.branch && <p className="text-xs text-gray-400">{acc.branch}</p>}
                  </div>
                </div>
              </CardBody>
            </Card>
          ))}
          {!accounts.length && (
            <Card>
              <CardBody><p className="text-center text-gray-400 py-4">No bank accounts added yet</p></CardBody>
            </Card>
          )}
        </div>
      )}

      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="Add Bank Account">
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Account Name</label>
            <input className="input-field" value={form.account_name} onChange={(e) => setForm({ ...form, account_name: e.target.value })} required placeholder="e.g. HDFC Current Account" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Account Number</label>
            <input className="input-field" value={form.account_number} onChange={(e) => setForm({ ...form, account_number: e.target.value })} required />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Bank Name</label>
            <input className="input-field" value={form.bank_name} onChange={(e) => setForm({ ...form, bank_name: e.target.value })} required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">IFSC</label>
              <input className="input-field" value={form.ifsc} onChange={(e) => setForm({ ...form, ifsc: e.target.value })} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Branch</label>
              <input className="input-field" value={form.branch} onChange={(e) => setForm({ ...form, branch: e.target.value })} />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setShowAdd(false)} className="btn-secondary">Cancel</button>
            <button type="submit" className="btn-primary">Add Account</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
