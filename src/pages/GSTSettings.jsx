import { useState, useEffect } from 'react';
import { Save, Building2, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { useToast } from '../context/ToastContext';
import { Card, CardHeader, CardBody } from '../components/ui/Card';

const EMPTY = {
  entity_name: 'Neoskills', gstin: '', pan: '', sac: '999293',
  sac_description: 'Commercial Training & Coaching Services',
  address: '', website: '', city: 'Pune', state: 'Maharashtra', state_code: '27',
  phone: '', bank_account_name: 'NeoSkills', bank_account_number: '',
  bank_ifsc: '', bank_account_type: 'Current Account', jurisdiction: 'Pune, Maharashtra',
  tax_rate: 18, inclusive: true, prefix: 'NS', terms: [],
};

export default function GSTSettings() {
  const toast = useToast();
  const navigate = useNavigate();
  const [form, setForm] = useState(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [termsText, setTermsText] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const s = await api.gstSettings.get();
        const merged = { ...EMPTY, ...s };
        merged.terms = JSON.parse(s.terms || '[]');
        setForm(merged);
        setTermsText(merged.terms.join('\n'));
      } catch (e) { toast.error('Failed to load settings'); }
      finally { setLoading(false); }
    })();
  }, [toast]);

  function set(patch) {
    setForm((f) => ({ ...f, ...patch }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    const terms = termsText.split('\n').map((t) => t.trim()).filter(Boolean);
    try {
      await api.gstSettings.update({ ...form, terms });
      toast.success('GST settings saved');
    } catch (e) { toast.error(e.message); }
    finally { setSaving(false); }
  }

  if (loading) {
    return <div className="space-y-3">{[...Array(4)].map((_, i) => <div key={i} className="h-24 skeleton w-full" />)}</div>;
  }

  const field = (label, key, placeholder = '') => (
    <div>
      <label className="text-xs text-gray-500 font-medium mb-1 block">{label}</label>
      <input className="input-field" value={form[key] || ''}
        onChange={(e) => set({ [key]: e.target.value })}
        placeholder={placeholder} />
    </div>
  );

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/')} className="p-2 hover:bg-gray-100 rounded-lg text-gray-500">
          <ArrowLeft size={18} />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Building2 size={22} className="text-primary-600" /> GST Settings
          </h1>
          <p className="text-sm text-gray-400 mt-0.5">Your GST-registered entity used on all tax invoices</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <Card>
          <CardHeader><h3 className="font-semibold text-gray-900">Supplier / Entity</h3></CardHeader>
          <CardBody className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {field('Entity Name *', 'entity_name', 'Neoskills')}
            {field('GSTIN *', 'gstin', '27AAQFN8793B1ZP')}
            {field('PAN', 'pan', 'AAQFN8793B')}
            {field('State Code *', 'state_code', '27')}
            <div className="sm:col-span-2">
              <label className="text-xs text-gray-500 font-medium mb-1 block">Registered Address</label>
              <textarea className="input-field" rows={2} value={form.address || ''}
                onChange={(e) => set({ address: e.target.value })} placeholder="Full supplier address" />
            </div>
            {field('State', 'state', 'Maharashtra')}
            {field('Website', 'website', 'www.neoskills.co.in')}
            {field('Phone', 'phone', '+91-9767865254 / +91-8983690231')}
            {field('Jurisdiction', 'jurisdiction', 'Pune, Maharashtra')}
          </CardBody>
        </Card>

        <Card>
          <CardHeader><h3 className="font-semibold text-gray-900">Tax & SAC</h3></CardHeader>
          <CardBody className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="text-xs text-gray-500 font-medium mb-1 block">Default Tax Rate (%) *</label>
              <input className="input-field" type="number" value={form.tax_rate || 18}
                onChange={(e) => set({ tax_rate: e.target.value })} />
            </div>
            <div>
              <label className="text-xs text-gray-500 font-medium mb-1 block">SAC / HSN</label>
              <input className="input-field" value={form.sac || ''}
                onChange={(e) => set({ sac: e.target.value })} placeholder="999293" />
            </div>
            <div>
              <label className="text-xs text-gray-500 font-medium mb-1 block">Invoice Prefix</label>
              <input className="input-field" value={form.prefix || 'NS'} onChange={(e) => set({ prefix: e.target.value })} />
            </div>
            <div className="sm:col-span-2">
              <label className="text-xs text-gray-500 font-medium mb-1 block">SAC Description</label>
              <input className="input-field" value={form.sac_description || ''}
                onChange={(e) => set({ sac_description: e.target.value })} />
            </div>
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input type="checkbox" checked={form.inclusive}
                onChange={(e) => set({ inclusive: e.target.checked })} className="h-4 w-4" />
              Amounts are GST-inclusive
            </label>
          </CardBody>
        </Card>

        <Card>
          <CardHeader><h3 className="font-semibold text-gray-900">Bank Details</h3></CardHeader>
          <CardBody className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {field('Account Name', 'bank_account_name', 'NeoSkills')}
            {field('Account Number', 'bank_account_number')}
            {field('IFSC', 'bank_ifsc', 'UTIB0003284')}
            {field('Account Type', 'bank_account_type', 'Current Account')}
          </CardBody>
        </Card>

        <Card>
          <CardHeader><h3 className="font-semibold text-gray-900">Terms & Compliance (one per line)</h3></CardHeader>
          <CardBody>
            <textarea className="input-field" rows={6}
              value={termsText}
              onChange={(e) => setTermsText(e.target.value)}
              placeholder="One term per line..." />
          </CardBody>
        </Card>

        <div className="flex justify-end gap-3">
          <button type="button" onClick={() => navigate('/')} className="btn-secondary">Cancel</button>
          <button type="submit" className="btn-primary flex items-center gap-2 px-6" disabled={saving}>
            <Save size={16} /> {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </form>
    </div>
  );
}