import { useState, useEffect } from 'react';
import { Plus, Building2, Trash2, Pencil } from 'lucide-react';
import { api } from '../services/api';
import { useToast } from '../context/ToastContext';
import { Card, CardBody } from '../components/ui/Card';
import Modal from '../components/ui/Modal';

const EMPTY_FORM = { account_name: '', account_number: '', bank_name: '', ifsc: '', branch: '' };

export default function BankAccounts() {
  const toast = useToast();
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState({});

  useEffect(() => { load(); }, []);

  async function load() {
    try { setAccounts(await api.bankAccounts.list()); }
    catch (e) { toast.error('Failed to load bank accounts'); }
    finally { setLoading(false); }
  }

  function validate() {
    const errs = {};
    if (!form.account_name.trim()) errs.account_name = 'Account name is required';
    if (!form.account_number.trim()) errs.account_number = 'Account number is required';
    if (!form.bank_name.trim()) errs.bank_name = 'Bank name is required';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  function openAdd() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setErrors({});
    setShowModal(true);
  }

  function openEdit(acc) {
    setEditing(acc);
    setForm({
      account_name: acc.account_name,
      account_number: acc.account_number,
      bank_name: acc.bank_name,
      ifsc: acc.ifsc || '',
      branch: acc.branch || '',
    });
    setErrors({});
    setShowModal(true);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!validate()) return;
    setSubmitting(true);
    try {
      if (editing) {
        await api.bankAccounts.update(editing.id, form);
        toast.success(`Bank account "${form.account_name}" updated`);
      } else {
        await api.bankAccounts.create(form);
        toast.success(`Bank account "${form.account_name}" added`);
      }
      setShowModal(false);
      setForm(EMPTY_FORM);
      setEditing(null);
      setErrors({});
      load();
    } catch (e) { toast.error(e.message); }
    finally { setSubmitting(false); }
  }

  async function handleDelete(id) {
    try {
      await api.bankAccounts.remove(id);
      toast.success('Bank account removed');
      load();
    } catch (e) { toast.error(e.message); }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Bank Accounts</h1>
          <p className="text-sm text-gray-400 mt-0.5">{accounts.length} account{accounts.length !== 1 ? 's' : ''}</p>
        </div>
        <button onClick={openAdd} className="btn-primary flex items-center gap-2 shadow-sm">
          <Plus size={16} /> Add Account
        </button>
      </div>

      {loading ? (
        <div className="grid gap-4 md:grid-cols-2">
          {[1,2].map(i => <div key={i} className="h-32 skeleton w-full" />)}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {accounts.map((acc) => (
            <Card key={acc.id} className="relative group">
              <CardBody>
                <div className="flex items-start gap-3">
                  <div className="p-2.5 bg-blue-50 rounded-xl shrink-0">
                    <Building2 size={20} className="text-blue-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-gray-900">{acc.account_name}</h3>
                    <p className="text-sm text-gray-500">{acc.bank_name}</p>
                    <p className="text-sm font-mono mt-1.5 text-gray-700 tracking-wider">{acc.account_number}</p>
                    <div className="flex gap-3 text-xs text-gray-400 mt-1">
                      {acc.ifsc && <span>IFSC: {acc.ifsc}</span>}
                      {acc.branch && <span>{acc.branch}</span>}
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => openEdit(acc)}
                      className="p-1.5 text-gray-300 hover:text-blue-600 hover:bg-blue-50 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                      title="Edit account">
                      <Pencil size={15} />
                    </button>
                    <button onClick={() => handleDelete(acc.id)}
                      className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                      title="Remove account">
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              </CardBody>
            </Card>
          ))}
          {!accounts.length && (
            <div className="col-span-full">
              <Card>
                <CardBody>
                  <div className="text-center py-12">
                    <div className="w-14 h-14 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
                      <Building2 size={28} className="text-gray-300" />
                    </div>
                    <h3 className="text-sm font-medium text-gray-500 mb-1">No bank accounts</h3>
                    <p className="text-xs text-gray-400 mb-4">Add your first bank account to track payments</p>
                    <button onClick={openAdd} className="btn-primary text-sm">Add Account</button>
                  </div>
                </CardBody>
              </Card>
            </div>
          )}
        </div>
      )}

      <Modal open={showModal} onClose={() => setShowModal(false)} title={editing ? 'Edit Bank Account' : 'Add Bank Account'} size="md">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Account Name *</label>
            <input className={`input-field ${errors.account_name ? 'border-red-300' : ''}`}
              value={form.account_name}
              onChange={(e) => { setForm({ ...form, account_name: e.target.value }); setErrors({}); }}
              placeholder="e.g. HDFC Current Account" />
            {errors.account_name && <p className="text-xs text-red-500 mt-1">{errors.account_name}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Account Number *</label>
            <input className={`input-field ${errors.account_number ? 'border-red-300' : ''}`}
              value={form.account_number}
              onChange={(e) => { setForm({ ...form, account_number: e.target.value }); setErrors({}); }} />
            {errors.account_number && <p className="text-xs text-red-500 mt-1">{errors.account_number}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Bank Name *</label>
            <input className={`input-field ${errors.bank_name ? 'border-red-300' : ''}`}
              value={form.bank_name}
              onChange={(e) => { setForm({ ...form, bank_name: e.target.value }); setErrors({}); }} />
            {errors.bank_name && <p className="text-xs text-red-500 mt-1">{errors.bank_name}</p>}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">IFSC Code</label>
              <input className="input-field" value={form.ifsc}
                onChange={(e) => setForm({ ...form, ifsc: e.target.value })} placeholder="e.g. HDFC0001234" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Branch</label>
              <input className="input-field" value={form.branch}
                onChange={(e) => setForm({ ...form, branch: e.target.value })} placeholder="e.g. Andheri East" />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-3 border-t">
            <button type="button" onClick={() => setShowModal(false)} className="btn-secondary">Cancel</button>
            <button type="submit" className="btn-primary px-6" disabled={submitting}>
              {submitting ? 'Saving...' : (editing ? 'Save Changes' : 'Add Account')}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
