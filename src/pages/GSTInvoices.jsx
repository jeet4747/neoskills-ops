import { useState, useEffect, useCallback } from 'react';
import {
  Plus, Search, FileText, Download, Pencil, Trash2, Save, X, ArrowLeft, Settings2,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../context/ToastContext';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { Card, CardBody } from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import Modal from '../components/ui/Modal';
import { INDIAN_STATES } from '../constants/states';

const EMPTY_ITEM = { description: '', participants: 1, unit_price: '' };

function emptyForm() {
  return {
    id: null,
    invoice_date: new Date().toISOString().slice(0, 10),
    reference: '',
    student_name: '',
    company: '',
    location: '',
    state_name: '',
    state_code: '',
    city: '',
    customer_gstin: '',
    poc: '',
    status: 'paid',
    sac: '',
    items: [{ ...EMPTY_ITEM }],
    collected: '',
    collectedOn: false,
  };
}

function round2(n) { return Math.round((Number(n) + Number.EPSILON) * 100) / 100; }
const cNum = (n) => (n === '' || n == null ? '' : Number(n).toLocaleString('en-IN', { maximumFractionDigits: 2 }));

function computeGst(form, settings) {
  const rate = Number(settings.tax_rate) || 18;
  const exportBill = String(form.state_code || '') === '99';
  const sameState = !exportBill && (String(form.state_code || '') === String(settings.state_code || ''));
  const items = (form.items || []).map((it) => {
    const participants = Number(it.participants) || 1;
    const unit_price = Number(it.unit_price) || 0;
    return { ...it, participants, unit_price, amount: round2(participants * unit_price) };
  });
  const subtotal = round2(items.reduce((s, it) => s + it.amount, 0));

  let cgst = 0, sgst = 0, igst = 0;
  if (!exportBill) {
    const gst = round2(subtotal * (rate / 100));
    if (sameState) {
      cgst = round2(gst / 2);
      sgst = round2(gst - cgst);
    } else {
      igst = gst;
    }
  }
  const sum = round2(subtotal + cgst + sgst + igst);
  const total = Math.round(sum);
  const roundOff = round2(total - sum);
  return {
    items, subtotal, total, roundOff,
    exportBill, sameState,
    cgst, sgst, igst,
    cgstRate: sameState ? round2(rate / 2) : 0,
    sgstRate: sameState ? round2(rate / 2) : 0,
    igstRate: !sameState && !exportBill ? rate : 0,
    hasTax: !exportBill && subtotal > 0,
  };
}

export default function GSTInvoices() {
  const toast = useToast();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState('register');
  const [form, setForm] = useState(emptyForm());
  const [invoices, setInvoices] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [settings, setSettings] = useState({ tax_rate: 18, state_code: '27', prefix: 'NS', sac: '999293', inclusive: true });
  const [enrollments, setEnrollments] = useState([]);
  const [enrollSearch, setEnrollSearch] = useState('');
  const [showEnrollPicker, setShowEnrollPicker] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [downloading, setDownloading] = useState(null);

  const load = useCallback(async (p = 1, s = '') => {
    try {
      setLoading(true);
      const data = await api.gstInvoices.list({ page: p, limit: 20, search: s });
      setInvoices(data.invoices || []);
      setTotal(data.total || 0);
    } catch (e) { toast.error(e.message); }
    finally { setLoading(false); }
  }, [toast]);

  useEffect(() => {
    if (mode === 'register') load(page, search);
  }, [mode, page, search, load]);

  useEffect(() => {
    api.gstSettings.get().then(setSettings).catch(() => {});
  }, []);

  function set(patch) { setForm((f) => ({ ...f, ...patch })); }

  function updateItem(index, patch) {
    setForm((f) => {
      const items = f.items.map((it, i) => (i === index ? { ...it, ...patch } : it));
      return { ...f, items };
    });
  }
  function addItem() { setForm((f) => ({ ...f, items: [...f.items, { ...EMPTY_ITEM }] })); }
  function removeItem(index) {
    setForm((f) => ({ ...f, items: f.items.length > 1 ? f.items.filter((_, i) => i !== index) : f.items }));
  }

  function onCollectedChange(v) {
    set({ collected: v });
    if (v && Number(v) > 0) {
      const rate = Number(settings.tax_rate) || 18;
      updateItem(0, { unit_price: round2(Number(v) / (1 + rate / 100)) });
    }
  }

  function openEnrollPicker() {
    api.enrollments.list({}).then((en) => { setEnrollments(en); setShowEnrollPicker(true); }).catch(() => {});
  }

  function selectEnrollment(en) {
    setForm((f) => ({
      ...f,
      id: f.id,
      student_name: en.student_name || '',
      city: en.student_city || '',
      items: [{ description: en.course_name || 'Training Service', participants: 1, unit_price: en.total_amount || '' }],
      state_name: '', state_code: '',
    }));
    setShowEnrollPicker(false);
    setEnrollSearch('');
  }

  const filteredEnrollments = enrollments.filter((en) => {
    const q = enrollSearch.toLowerCase();
    return !q || en.student_name?.toLowerCase().includes(q)
      || en.student_phone?.toLowerCase().includes(q)
      || en.course_name?.toLowerCase().includes(q);
  }).slice(0, 30);

  function handleNew() {
    setForm(emptyForm());
    setMode('create');
  }

  async function handleSave() {
    if (!form.student_name.trim()) return toast.error('Enter customer / student name');
    if (!form.items.length || !form.items[0].description) return toast.error('Add a module description');
    setSaving(true);
    try {
      const payload = {
        ...form,
        invoice_date: form.invoice_date,
        sac: form.sac || settings.sac,
        prefix: settings.prefix,
        state: form.state_name,
      };
      delete payload.id;
      if (form.id) {
        await api.gstInvoices.update(form.id, payload);
        toast.success('Invoice updated');
      } else {
        const saved = await api.gstInvoices.create(payload);
        toast.success(`Invoice ${saved.invoice_number} created`);
        setForm(emptyForm());
      }
      await load(1, '');
      setMode('register');
    } catch (e) { toast.error(e.message); }
    finally { setSaving(false); }
  }

  async function handleEdit(r) {
    const items = Array.isArray(r.items) && r.items.length ? r.items : [{ ...EMPTY_ITEM }];
    setForm({ ...emptyForm(), ...r, id: r.id, state_name: r.state || '', state_code: r.state_code || '', items, collected: '', collectedOn: false });
    setMode('create');
  }

  async function handleDelete(r) {
    if (!window.confirm(`Delete invoice ${r.invoice_number}?`)) return;
    try {
      await api.gstInvoices.remove(r.id);
      toast.success('Invoice deleted');
      await load(page, search);
    } catch (e) { toast.error(e.message); }
  }

  async function handleDownload(r) {
    setDownloading(r.id);
    try {
      await api.gstInvoices.downloadPdf(r.id, `GST-${r.invoice_number}.pdf`);
    } catch (e) { toast.error(e.message); }
    finally { setDownloading(null); }
  }

  const c = computeGst(form, settings);

  const statusBadge = (s) => ({
    paid: <Badge status="approved">PAID</Badge>,
    unpaid: <Badge status="pending">UNPAID</Badge>,
    cancelled: <Badge status="rejected">CANCELLED</Badge>,
  }[s] || String(s || '').toUpperCase());

  const columns = [
    { key: 'invoice_number', label: 'Invoice No.', render: (r) => <span className="font-semibold text-gray-900">{r.invoice_number}</span> },
    { key: 'invoice_date', label: 'Date', render: (r) => new Date(r.invoice_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) },
    { key: 'student_name', label: 'Customer', render: (r) => <div><p className="font-medium">{r.student_name}</p>{r.company && <p className="text-xs text-gray-400">{r.company}</p>}</div> },
    { key: 'state', label: 'State', render: (r) => r.state || <span className="text-gray-400">—</span> },
    { key: 'subtotal', label: 'Taxable', render: (r) => `₹${Number(r.subtotal).toLocaleString()}` },
    { key: 'gst', label: 'GST', render: (r) => {
      const g = r.gst_type === 'igst' ? `IGST ₹${Number(r.igst).toLocaleString()}`
        : r.gst_type === 'cgst_sgst' ? `C+S ₹${(Number(r.cgst) + Number(r.sgst)).toLocaleString()}`
          : '0';
      return <span className="text-gray-600">{g}</span>;
    } },
    { key: 'total_amount', label: 'Total', render: (r) => <span className="text-primary-700 font-semibold">₹{Number(r.total_amount).toLocaleString()}</span> },
    { key: 'status', label: 'Status', render: (r) => statusBadge(r.status) },
    { key: 'actions', label: '', render: (r) => (
      <div className="flex items-center gap-1">
        <button onClick={() => handleDownload(r)} disabled={downloading === r.id} className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-500 hover:text-primary-600" title="Download PDF">
          <Download size={15} />
        </button>
        <button onClick={() => handleEdit(r)} className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-500 hover:text-blue-600" title="Edit">
          <Pencil size={15} />
        </button>
        <button onClick={() => handleDelete(r)} className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-500 hover:text-red-600" title="Delete">
          <Trash2 size={15} />
        </button>
      </div>
    ) },
  ];

  const showCollectedField = form.collectedOn || settings.inclusive;

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">GST Invoices</h1>
          <p className="text-sm text-gray-400 mt-0.5">{total} invoice{total !== 1 ? 's' : ''}</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => navigate('/gst-settings')} className="btn-secondary flex items-center gap-2">
            <Settings2 size={16} /> Settings
          </button>
          <button onClick={handleNew} className="btn-primary flex items-center gap-2 shadow-sm">
            <Plus size={16} /> New Invoice
          </button>
        </div>
      </div>

      {mode === 'create' ? (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
          <div className="space-y-5">
            <Card>
              <CardBody className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-gray-900">{form.id ? 'Edit Invoice' : 'New GST Invoice'}</h3>
                  <button onClick={() => setMode('register')} className="btn-secondary text-xs flex items-center gap-1.5"><ArrowLeft size={13} /> Back</button>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="text-xs text-gray-500 font-medium mb-1 block">Invoice Date</label>
                    <input type="date" className="input-field" value={form.invoice_date} onChange={(e) => set({ invoice_date: e.target.value })} />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 font-medium mb-1 block">Reference</label>
                    <input className="input-field" value={form.reference} onChange={(e) => set({ reference: e.target.value })} placeholder="Ref no" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 font-medium mb-1 block">Status</label>
                    <select className="input-field" value={form.status} onChange={(e) => set({ status: e.target.value })}>
                      <option value="paid">Paid</option><option value="unpaid">Unpaid</option><option value="cancelled">Cancelled</option>
                    </select>
                  </div>
                </div>

                <button onClick={openEnrollPicker} className="btn-secondary w-full text-xs py-2">Pick from Enrollments…</button>

                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <label className="text-xs text-gray-500 font-medium mb-1 block">Customer Name *</label>
                    <input className="input-field" value={form.student_name} onChange={(e) => set({ student_name: e.target.value })} placeholder="Bill to name" />
                  </div>
                  <div className="col-span-2">
                    <label className="text-xs text-gray-500 font-medium mb-1 block">Company (optional, B2B)</label>
                    <input className="input-field" value={form.company} onChange={(e) => set({ company: e.target.value })} />
                  </div>
                  <div className="col-span-2">
                    <label className="text-xs text-gray-500 font-medium mb-1 block">Location (address)</label>
                    <input className="input-field" value={form.location} onChange={(e) => set({ location: e.target.value })} />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 font-medium mb-1 block">State *</label>
                    <select className="input-field" value={form.state_name}
                      onChange={(e) => {
                        const st = INDIAN_STATES.find((x) => x.name === e.target.value);
                        set({ state_name: st?.name || '', state_code: st?.code || '' });
                      }}>
                      <option value="">Select state / export…</option>
                      {INDIAN_STATES.map((s) => <option key={s.code} value={s.name}>{s.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 font-medium mb-1 block">State Code</label>
                    <input className="input-field" value={form.state_code} onChange={(e) => set({ state_code: e.target.value })} placeholder="auto" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 font-medium mb-1 block">Customer GSTN (opt)</label>
                    <input className="input-field" value={form.customer_gstin} onChange={(e) => set({ customer_gstin: e.target.value })} placeholder="B2B only" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 font-medium mb-1 block">POC / Salesperson</label>
                    <input className="input-field" value={form.poc} onChange={(e) => set({ poc: e.target.value })} placeholder={user?.name} />
                  </div>
                </div>
              </CardBody>
            </Card>

            <Card>
              <CardBody className="space-y-2">
                <h3 className="font-semibold text-gray-900">Line Items</h3>
                {showCollectedField && (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm flex items-end gap-3">
                    <div className="flex-1">
                      <label className="text-xs text-amber-700 font-medium mb-1 block">Total collected (GST-inclusive ₹)</label>
                      <input className="input-field" type="number" value={form.collected} onChange={(e) => onCollectedChange(e.target.value)} placeholder="e.g. 100300" />
                    </div>
                    <p className="text-xs text-amber-600 pb-2">Auto-splits taxable + GST @{settings.tax_rate}%</p>
                  </div>
                )}
                {form.items.map((item, index) => (
                  <div key={index} className="grid grid-cols-1 gap-2 border border-gray-100 rounded-xl p-2 bg-gray-50/40">
                    <div className="flex items-center gap-2">
                      <input className="input-field flex-1" placeholder="Module / description" value={item.description}
                        onChange={(e) => updateItem(index, { description: e.target.value })} />
                      <button onClick={() => removeItem(index)} className="p-1.5 hover:bg-red-50 rounded-lg text-gray-400 hover:text-red-600 shrink-0"><X size={15} /></button>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <input className="input-field w-16 text-right" placeholder="No." type="number" value={item.participants}
                        onChange={(e) => updateItem(index, { participants: e.target.value })} />
                      <input className="input-field flex-1 min-w-[120px] text-right" placeholder="Unit price (taxable ₹)" type="number" value={item.unit_price}
                        onChange={(e) => updateItem(index, { unit_price: e.target.value })} />
                      <span className="w-24 text-right text-sm font-medium text-gray-700">₹{cNum((Number(item.participants) || 1) * (Number(item.unit_price) || 0))}</span>
                    </div>
                  </div>
                ))}
                <button onClick={addItem} className="text-sm text-primary-600 hover:text-primary-700 font-medium flex items-center gap-1.5"><Plus size={15} /> Add line item</button>
              </CardBody>
            </Card>

            <div className="flex items-center gap-3 justify-end">
              <button onClick={handleSave} disabled={saving} className="btn-primary flex items-center gap-2">
                <Save size={16} /> {saving ? 'Saving…' : form.id ? 'Update Invoice' : 'Save Invoice'}
              </button>
            </div>
          </div>

          <div className="xl:sticky xl:top-6">
            <Card>
              <CardBody className="p-3">
                <h3 className="font-semibold text-gray-900 mb-2">Live Preview</h3>
                <div className="border border-gray-200 rounded-xl bg-white overflow-hidden text-xs">
                  <div className="bg-gray-50 px-4 py-3 border-b border-gray-100">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-bold text-gray-900">{settings.entity_name || 'NeoSkills'}</p>
                        <p className="text-gray-500 mt-0.5 max-w-[220px]">{settings.address}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold text-gray-900">TAX INVOICE</p>
                        <p className="text-gray-500 mt-0.5">{form.id ? form.invoice_number : 'New invoice'}</p>
                        <p className="text-gray-500">{form.invoice_date ? new Date(form.invoice_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }) : ''}</p>
                      </div>
                    </div>
                  </div>
                  <div className="px-4 py-3">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <p className="font-bold text-gray-900">{form.student_name || 'Customer name'}</p>
                        {form.company && <p className="text-gray-500">{form.company}</p>}
                        {form.location && <p className="text-gray-500">{form.location}</p>}
                        {form.state_name && <p className="text-gray-500">{form.state_name}{form.state_code ? ` (${form.state_code})` : ''}</p>}
                        {form.customer_gstin && <p className="text-gray-500">GSTIN: {form.customer_gstin}</p>}
                      </div>
                      <div className="text-right text-gray-500 shrink-0">GST: {settings.gstin}</div>
                    </div>
                    <table className="w-full">
                      <thead>
                        <tr className="bg-gray-900 text-white">
                          <th className="text-left px-2 py-1.5">DESCRIPTION</th>
                          <th className="text-right px-2 py-1.5">NO.</th>
                          <th className="text-right px-2 py-1.5">UNIT</th>
                          <th className="text-right px-2 py-1.5">AMOUNT</th>
                        </tr>
                      </thead>
                      <tbody>
                        {c.items.map((it, i) => (
                          <tr key={i} className={i % 2 ? 'bg-gray-50' : ''}>
                            <td className="px-2 py-1.5">{it.description || '—'}</td>
                            <td className="px-2 py-1.5 text-right">{it.participants}</td>
                            <td className="px-2 py-1.5 text-right">₹{cNum(it.unit_price)}</td>
                            <td className="px-2 py-1.5 text-right font-medium">₹{cNum(it.amount)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <div className="flex justify-end mt-2">
                      <div className="w-56 space-y-1">
                        <div className="flex justify-between"><span className="text-gray-500">Sub-Total</span><span className="font-medium">₹{cNum(c.subtotal)}</span></div>
                        {c.cgst > 0 && <div className="flex justify-between"><span className="text-gray-500">CGST ({c.cgstRate}%)</span><span>₹{cNum(c.cgst)}</span></div>}
                        {c.sgst > 0 && <div className="flex justify-between"><span className="text-gray-500">SGST ({c.sgstRate}%)</span><span>₹{cNum(c.sgst)}</span></div>}
                        {c.igst > 0 && <div className="flex justify-between"><span className="text-gray-500">IGST ({c.igstRate}%)</span><span>₹{cNum(c.igst)}</span></div>}
                        {c.exportBill && <div className="flex justify-between"><span className="text-gray-500">IGST (0%) Export</span><span>₹0</span></div>}
                        <div className="flex justify-between border-t border-gray-200 pt-1 font-bold text-gray-900"><span>Total</span><span>₹{cNum(c.total)}</span></div>
                      </div>
                    </div>
                  </div>
                </div>
              </CardBody>
            </Card>
          </div>
        </div>
      ) : (
        <Card>
          <CardBody>
            <div className="relative mb-3">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input className="input-field pl-9" placeholder="Search by invoice no, name, company…" value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[720px]">
                <thead>
                  <tr className="border-b border-gray-100">
                    {columns.map((col) => (
                      <th key={col.key} className="text-left px-3 py-2.5 text-[11px] font-semibold text-gray-400 uppercase tracking-wider whitespace-nowrap">{col.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={columns.length} className="px-3 py-8"><div className="h-6 skeleton w-full" /></td></tr>
                  ) : invoices.length === 0 ? (
                    <tr><td colSpan={columns.length} className="text-center py-10 text-sm text-gray-400">
                      <FileText size={28} className="mx-auto mb-2 text-gray-300" />
                      No GST invoices yet. Create your first one.
                    </td></tr>
                  ) : invoices.map((r) => (
                    <tr key={r.id} className="border-b border-gray-50 hover:bg-gray-50/60">
                      {columns.map((col) => (
                        <td key={col.key} className="px-3 py-3">{col.render(r)}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {total > 20 && (
              <div className="flex items-center justify-end gap-2 mt-3">
                <button className="btn-secondary text-xs" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Prev</button>
                <span className="text-xs text-gray-500">Page {page}</span>
                <button className="btn-secondary text-xs" disabled={page * 20 >= total} onClick={() => setPage((p) => p + 1)}>Next</button>
              </div>
            )}
          </CardBody>
        </Card>
      )}

      <Modal open={showEnrollPicker} onClose={() => setShowEnrollPicker(false)} title="Select Enrollment" size="lg">
        <div className="relative mb-3">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input className="input-field pl-9" placeholder="Search by student, phone or course…" value={enrollSearch}
            onChange={(e) => setEnrollSearch(e.target.value)} autoFocus />
        </div>
        <div className="border rounded-xl max-h-96 overflow-y-auto divide-y divide-gray-50">
          {filteredEnrollments.length === 0 ? (
            <div className="text-center py-10 text-sm text-gray-400">No enrollments found</div>
          ) : filteredEnrollments.map((en) => (
            <button key={en.id} onClick={() => selectEnrollment(en)} className="w-full text-left px-4 py-3 hover:bg-gray-50">
              <div className="flex justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold text-gray-900 text-sm">{en.student_name}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{en.course_name}{en.student_phone ? ` · ${en.student_phone}` : ''}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-semibold">₹{Number(en.total_amount).toLocaleString()}</p>
                </div>
              </div>
            </button>
          ))}
        </div>
      </Modal>
    </div>
  );
}