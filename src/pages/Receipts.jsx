import { useState, useEffect, useCallback } from 'react';
import {
  Plus, Search, FileText, Download, Pencil, Trash2, Save,
  X, ArrowLeft, Copy, RefreshCw, User, Banknote, Settings2,
} from 'lucide-react';
import { useToast } from '../context/ToastContext';
import { api } from '../services/api';
import { Card, CardHeader, CardBody } from '../components/ui/Card';
import Table from '../components/ui/Table';
import Modal from '../components/ui/Modal';
import Badge from '../components/ui/Badge';

const EMPTY_ITEM = { description: '', qty: 1, rate: '', amount: 0 };

const MODE_OPTIONS = [
  { value: 'upi', label: 'UPI' },
  { value: 'card', label: 'Card' },
  { value: 'neft', label: 'NEFT/RTGS' },
  { value: 'cash', label: 'Cash' },
  { value: 'cheque', label: 'Cheque' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
];

function emptyForm() {
  return {
    id: null,
    enrollment_id: '',
    student_name: '',
    student_phone: '',
    student_email: '',
    student_city: '',
    course_name: '',
    items: [{ ...EMPTY_ITEM }],
    company: 'neoskills',
    tax_rate: 0,
    discount: 0,
    received_amount: '',
    payment_mode: 'upi',
    transaction_id: '',
    bank_account_name: '',
    bank_account_number: '',
    bank_name: '',
    bank_ifsc: '',
    notes: '',
    prefix: 'NEO',
  };
}

export default function Receipts() {
  const toast = useToast();
  const [mode, setMode] = useState('create');
  const [form, setForm] = useState(emptyForm());
  const [receipts, setReceipts] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [enrollments, setEnrollments] = useState([]);
  const [enrollSearch, setEnrollSearch] = useState('');
  const [templates, setTemplates] = useState([]);
  const [brands, setBrands] = useState([]);
  const [saving, setSaving] = useState(false);
  const [downloading, setDownloading] = useState(null);
  const [showEnrollPicker, setShowEnrollPicker] = useState(false);
  const [showTemplateSave, setShowTemplateSave] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [loading, setLoading] = useState(true);
  const [previewUrl, setPreviewUrl] = useState(null);

  const load = useCallback(async (p = 1, s = '') => {
    try {
      setLoading(true);
      const data = await api.receipts.list({ page: p, limit: 20, search: s });
      setReceipts(data.receipts || []);
      setTotal(data.total || 0);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    if (mode === 'history') load(page, search);
  }, [mode, page, search, load]);

  useEffect(() => {
    api.receiptTemplates.list().then(setTemplates).catch(() => {});
    api.brands.list().then(setBrands).catch(() => {});
  }, []);

  function selectEnrollment(en) {
    setForm((f) => ({
      ...f,
      enrollment_id: en.id,
      student_name: en.student_name || '',
      student_phone: en.student_phone || '',
      student_email: en.student_email || '',
      student_city: en.student_city || '',
      course_name: en.course_name || '',
      items: [{
        description: en.course_name || 'Course Fee',
        qty: 1,
        rate: en.total_amount || '',
        amount: Number(en.total_amount) || 0,
      }],
      received_amount: en.pending_amount || en.total_amount || '',
    }));
    setShowEnrollPicker(false);
    setEnrollSearch('');
  }

  function applyTemplate(t) {
    setForm((f) => ({
      ...f,
      prefix: t.prefix || f.prefix,
      company: t.company || f.company,
      payment_mode: t.payment_mode || f.payment_mode,
      bank_account_name: t.bank_account_name || f.bank_account_name,
      bank_account_number: t.bank_account_number || f.bank_account_number,
      bank_name: t.bank_name || f.bank_name,
      bank_ifsc: t.bank_ifsc || f.bank_ifsc,
      notes: t.notes || f.notes,
    }));
    toast.success(`Template "${t.name}" applied`);
  }

  const filteredEnrollments = enrollments.filter((en) => {
    const q = enrollSearch.toLowerCase();
    return !q || en.student_name?.toLowerCase().includes(q)
      || en.student_phone?.toLowerCase().includes(q)
      || en.course_name?.toLowerCase().includes(q);
  }).slice(0, 30);

  function updateItem(index, patch) {
    setForm((f) => {
      const items = f.items.map((it, i) => (i === index ? { ...it, ...patch } : it));
      return { ...f, items };
    });
  }

  function addItem() {
    setForm((f) => ({ ...f, items: [...f.items, { ...EMPTY_ITEM }] }));
  }

  function removeItem(index) {
    setForm((f) => ({ ...f, items: f.items.length > 1 ? f.items.filter((_, i) => i !== index) : f.items }));
  }

  const computed = useCallback((f) => {
    const items = (f.items || []).map((it) => ({
      ...it,
      qty: Number(it.qty) || 1,
      rate: Number(it.rate) || 0,
      amount: (Number(it.qty) || 1) * (Number(it.rate) || 0),
    }));
    const subtotal = items.reduce((s, it) => s + it.amount, 0);
    const discount = Number(f.discount) || 0;
    const taxRate = Number(f.tax_rate) || 0;
    const taxAmount = ((subtotal - discount) * taxRate) / 100;
    const totalAmount = subtotal - discount + taxAmount;
    const received = Number(f.received_amount) || 0;
    const balance = Math.max(0, totalAmount - received);
    return { items, subtotal, taxAmount, totalAmount, balance };
  }, []);

  async function handleSave() {
    if (!form.student_name.trim()) return toast.error('Enter student / customer name');
    if (!form.items.length || !form.items[0].description) return toast.error('Add at least one item description');
    setSaving(true);
    try {
      const c = computed(form);
      const payload = {
        ...form,
        enrollment_id: form.enrollment_id ? parseInt(form.enrollment_id) : null,
        items: c.items,
        subtotal: c.subtotal,
        tax_amount: c.taxAmount,
        total_amount: c.totalAmount,
        balance_amount: c.balance,
      };
      let saved;
      if (form.id) {
        saved = await api.receipts.update(form.id, payload);
        toast.success('Receipt updated');
      } else {
        saved = await api.receipts.create(payload);
        toast.success(`Receipt ${saved.receipt_number} created`);
        setForm(emptyForm());
      }
      await load(1, '');
      setMode('history');
    } catch (e) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveAsTemplate() {
    if (!templateName.trim()) return toast.error('Enter template name');
    try {
      await api.receiptTemplates.create({ ...form, name: templateName });
      toast.success('Template saved');
      setShowTemplateSave(false);
      setTemplateName('');
      const list = await api.receiptTemplates.list();
      setTemplates(list);
    } catch (e) {
      toast.error(e.message);
    }
  }

  async function handleDownload(id, number) {
    setDownloading(id);
    try {
      await api.receipts.downloadPdf(id, `Receipt-${number}.pdf`);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setDownloading(null);
    }
  }

  async function handleEdit(r) {
    const c = computed(r);
    setForm({ ...emptyForm(), ...r, items: r.items?.length ? r.items : c.items });
    setMode('create');
  }

  async function handleDelete(r) {
    if (!window.confirm(`Delete receipt ${r.receipt_number}?`)) return;
    try {
      await api.receipts.remove(r.id);
      toast.success('Receipt deleted');
      await load(page, search);
    } catch (e) {
      toast.error(e.message);
    }
  }

  async function handleNew() {
    setForm(emptyForm());
    setPreviewUrl(null);
    setMode('create');
    const en = await api.enrollments.list({}).catch(() => []);
    setEnrollments(en);
  }

  async function openEnrollPicker() {
    const en = await api.enrollments.list({}).catch(() => []);
    setEnrollments(en);
    setShowEnrollPicker(true);
  }

  const c = computed(form);
  const cNum = (n) => (n === '' || n == null ? '' : Number(n).toLocaleString());
  const brandName = (key) => (brands.find((b) => b.key === key) || { name: key }).name;

  const columns = [
    { key: 'receipt_number', label: 'Receipt No.', render: (r) => <span className="font-semibold text-gray-900">{r.receipt_number}</span> },
    { key: 'company', label: 'Company', render: (r) => <span className="text-xs text-gray-500">{brandName(r.company)}</span> },
    { key: 'student_name', label: 'Customer', render: (r) => <div><p className="font-medium">{r.student_name}</p><p className="text-xs text-gray-400">{r.course_name}</p></div> },
    { key: 'created_at', label: 'Date', render: (r) => new Date(r.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) },
    { key: 'total_amount', label: 'Total', render: (r) => `₹${Number(r.total_amount).toLocaleString()}` },
    { key: 'received_amount', label: 'Received', render: (r) => <span className="text-emerald-600 font-medium">₹{Number(r.received_amount).toLocaleString()}</span> },
    { key: 'balance_amount', label: 'Balance', render: (r) => Number(r.balance_amount) > 0 ? <span className="text-amber-600 font-medium">₹{Number(r.balance_amount).toLocaleString()}</span> : <span className="text-gray-400">—</span> },
    { key: 'payment_mode', label: 'Mode', render: (r) => <Badge status={r.payment_mode === 'cash' ? 'approved' : r.payment_mode === 'pending' ? 'pending' : 'completed'}>{r.payment_mode?.toUpperCase()}</Badge> },
    { key: 'actions', label: '', render: (r) => (
      <div className="flex items-center gap-1">
        <button onClick={() => handleDownload(r.id, r.receipt_number)} disabled={downloading === r.id} className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-500 hover:text-primary-600" title="Download PDF">
          <Download size={15} />
        </button>
        <button onClick={() => handleEdit(r)} className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-500 hover:text-primary-600" title="Edit">
          <Pencil size={15} />
        </button>
        <button onClick={() => handleDelete(r)} className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-500 hover:text-red-600" title="Delete">
          <Trash2 size={15} />
        </button>
      </div>
    ) },
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Receipts</h1>
          <p className="text-sm text-gray-400 mt-0.5">Create customizable receipts, invoices & payment receipts</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setMode(mode === 'create' ? 'history' : 'create')}
            className={mode === 'history' ? 'btn-primary flex items-center gap-2' : 'btn-secondary flex items-center gap-2'}
          >
            {mode === 'create' ? (
              <><FileText size={16} /> Receipt History ({total})</>
            ) : (
              <><Plus size={16} /> Create Receipt</>
            )}
          </button>
        </div>
      </div>

      {mode === 'history' && (
        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
              <div className="relative w-full sm:w-80">
                <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  className="input-field pl-9"
                  placeholder="Search by receipt no, customer or course..."
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                />
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <span>{total} total</span>
                <div className="flex items-center gap-1">
                  <button disabled={page <= 1} onClick={() => setPage(page - 1)} className="btn-secondary px-3 py-1.5 text-xs">Prev</button>
                  <span className="px-2">{page}</span>
                  <button disabled={page * 20 >= total} onClick={() => setPage(page + 1)} className="btn-secondary px-3 py-1.5 text-xs">Next</button>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardBody className="p-0">
            {loading ? (
              <div className="p-8 space-y-3">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-10 skeleton" />)}</div>
            ) : receipts.length === 0 ? (
              <div className="text-center py-16 text-gray-400 text-sm">
                <FileText size={32} className="mx-auto mb-3 text-gray-300" />
                No receipts yet. Create your first receipt.
              </div>
            ) : (
              <Table columns={columns} data={receipts} />
            )}
          </CardBody>
        </Card>
      )}

      {mode === 'create' && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-5 items-start">
          {/* ------- Editor form ------- */}
          <div className="space-y-5">
            {form.id && (
              <Card>
                <CardBody className="flex items-center justify-between">
                  <p className="text-sm text-gray-500">Editing <span className="font-semibold text-gray-900">{form.receipt_number}</span></p>
                  <button onClick={() => { setForm(emptyForm()); setPreviewUrl(null); }} className="btn-ghost flex items-center gap-1.5 text-sm"><X size={14} /> Cancel edit</button>
                </CardBody>
              </Card>
            )}

            <Card>
              <CardHeader className="flex items-center justify-between">
                <h3 className="font-semibold text-gray-900">Customer & Enrollment</h3>
                <button onClick={openEnrollPicker} className="btn-secondary text-xs flex items-center gap-1.5 px-3 py-1.5">
                  <User size={13} /> Pick from enrollment
                </button>
              </CardHeader>
              <CardBody className="space-y-3">
                <div>
                  <label className="text-xs text-gray-500 font-medium mb-1 block">Company on receipt</label>
                  <select className="input-field" value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })}>
                    {brands.length ? brands.map((b) => (
                      <option key={b.key} value={b.key}>{b.name}</option>
                    )) : (
                      <>
                        <option value="neoskills">Neoskills Learning Solutions</option>
                        <option value="careervue">CareerVUE</option>
                        <option value="frolics">Frolics Solutions</option>
                      </>
                    )}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-gray-500 font-medium mb-1 block">Customer name *</label>
                    <input className="input-field" value={form.student_name} onChange={(e) => setForm({ ...form, student_name: e.target.value })} placeholder="Student / customer name" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 font-medium mb-1 block">Phone</label>
                    <input className="input-field" value={form.student_phone} onChange={(e) => setForm({ ...form, student_phone: e.target.value })} placeholder="Mobile number" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 font-medium mb-1 block">Email</label>
                    <input className="input-field" value={form.student_email} onChange={(e) => setForm({ ...form, student_email: e.target.value })} placeholder="Email" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 font-medium mb-1 block">City</label>
                    <input className="input-field" value={form.student_city} onChange={(e) => setForm({ ...form, student_city: e.target.value })} placeholder="City" />
                  </div>
                </div>
                <div>
                  <label className="text-xs text-gray-500 font-medium mb-1 block">Course / Description</label>
                  <input className="input-field" value={form.course_name} onChange={(e) => setForm({ ...form, course_name: e.target.value })} placeholder="Course name (optional)" />
                </div>
              </CardBody>
            </Card>

            <Card>
              <CardHeader>
                <h3 className="font-semibold text-gray-900">Line Items</h3>
              </CardHeader>
              <CardBody className="space-y-2">
                {form.items.map((item, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <input
                      className="input-field flex-1"
                      placeholder="Item / module description"
                      value={item.description}
                      onChange={(e) => updateItem(index, { description: e.target.value })}
                    />
                    <input
                      className="input-field w-16 text-right"
                      placeholder="Qty"
                      value={item.qty}
                      onChange={(e) => updateItem(index, { qty: e.target.value })}
                    />
                    <input
                      className="input-field w-28 text-right"
                      placeholder="Rate ₹"
                      value={item.rate}
                      onChange={(e) => updateItem(index, { rate: e.target.value })}
                    />
                    <span className="w-24 text-right text-sm font-medium text-gray-700">
                      ₹{cNum((Number(item.qty) || 1) * (Number(item.rate) || 0))}
                    </span>
                    <button onClick={() => removeItem(index)} className="p-1.5 hover:bg-red-50 rounded-lg text-gray-400 hover:text-red-600">
                      <X size={15} />
                    </button>
                  </div>
                ))}
                <button onClick={addItem} className="text-sm text-primary-600 hover:text-primary-700 font-medium flex items-center gap-1.5">
                  <Plus size={15} /> Add line item
                </button>

                <div className="grid grid-cols-3 gap-3 pt-3 border-t border-gray-100">
                  <div>
                    <label className="text-xs text-gray-500 font-medium mb-1 block">Tax rate (%)</label>
                    <input className="input-field" type="number" value={form.tax_rate} onChange={(e) => setForm({ ...form, tax_rate: e.target.value })} />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 font-medium mb-1 block">Discount (₹)</label>
                    <input className="input-field" type="number" value={form.discount} onChange={(e) => setForm({ ...form, discount: e.target.value })} />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 font-medium mb-1 block">Received amount (₹)</label>
                    <input className="input-field" type="number" value={form.received_amount} onChange={(e) => setForm({ ...form, received_amount: e.target.value })} />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3 bg-gray-50 rounded-xl p-3 text-sm">
                  <div><p className="text-xs text-gray-400">Subtotal</p><p className="font-semibold">₹{cNum(c.subtotal)}</p></div>
                  <div><p className="text-xs text-gray-400">Tax</p><p className="font-semibold">₹{cNum(c.taxAmount)}</p></div>
                  <div><p className="text-xs text-gray-400">Balance</p><p className="font-semibold text-amber-600">₹{cNum(c.balance)}</p></div>
                </div>
              </CardBody>
            </Card>

            <Card>
              <CardHeader className="flex items-center justify-between">
                <h3 className="font-semibold text-gray-900">Payment & Bank Details</h3>
                <button onClick={() => setShowTemplateSave(true)} className="btn-secondary text-xs flex items-center gap-1.5 px-3 py-1.5">
                  <Save size={13} /> Save as template
                </button>
              </CardHeader>
              <CardBody className="space-y-3">
                {templates.length > 0 && (
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs text-gray-500 font-medium">Templates:</span>
                    {templates.map((t) => (
                      <button key={t.id} onClick={() => applyTemplate(t)} className="text-xs bg-gray-100 hover:bg-primary-50 hover:text-primary-700 text-gray-600 px-2.5 py-1 rounded-lg flex items-center gap-1">
                        <Copy size={11} /> {t.name}
                      </button>
                    ))}
                  </div>
                )}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-gray-500 font-medium mb-1 block">Payment mode</label>
                    <select className="input-field" value={form.payment_mode} onChange={(e) => setForm({ ...form, payment_mode: e.target.value })}>
                      {MODE_OPTIONS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 font-medium mb-1 block">Transaction / Ref ID</label>
                    <input className="input-field" value={form.transaction_id} onChange={(e) => setForm({ ...form, transaction_id: e.target.value })} placeholder="UPI ref / Txn ID" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 font-medium mb-1 block">Bank account name</label>
                    <input className="input-field" value={form.bank_account_name} onChange={(e) => setForm({ ...form, bank_account_name: e.target.value })} placeholder="Account holder name" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 font-medium mb-1 block">Bank name</label>
                    <input className="input-field" value={form.bank_name} onChange={(e) => setForm({ ...form, bank_name: e.target.value })} placeholder="e.g. HDFC Bank" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 font-medium mb-1 block">Account number</label>
                    <input className="input-field" value={form.bank_account_number} onChange={(e) => setForm({ ...form, bank_account_number: e.target.value })} placeholder="Account no." />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 font-medium mb-1 block">IFSC</label>
                    <input className="input-field" value={form.bank_ifsc} onChange={(e) => setForm({ ...form, bank_ifsc: e.target.value })} placeholder="IFSC code" />
                  </div>
                  <div className="col-span-2">
                    <label className="text-xs text-gray-500 font-medium mb-1 block">Notes / footer message</label>
                    <textarea className="input-field" rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Optional note shown on receipt" />
                  </div>
                </div>
              </CardBody>
            </Card>

            <div className="flex items-center gap-3 justify-end">
              <button onClick={handleSave} disabled={saving} className="btn-primary flex items-center gap-2">
                <Save size={16} /> {saving ? 'Saving…' : form.id ? 'Update Receipt' : 'Save Receipt'}
              </button>
              <button
                onClick={() => handleSave().then(() => {})}
                className="btn-success flex items-center gap-2"
              >
                <Download size={16} /> Save & Download
              </button>
            </div>
          </div>

          {/* ------- Preview ------- */}
          <div className="xl:sticky xl:top-6">
            <Card>
              <CardHeader className="flex items-center justify-between">
                <h3 className="font-semibold text-gray-900">Live Preview</h3>
                <span className="text-xs text-gray-400">{form.receipt_number || 'NEO-YYYY-NNNN'}</span>
              </CardHeader>
              <CardBody className="p-3">
                <div className="border border-gray-200 rounded-xl bg-white overflow-hidden">
                  <div className="p-6 space-y-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-bold text-gray-900">{brandName(form.company)}</p>
                        <p className="text-[11px] text-gray-400 mt-0.5">4th Floor, Office No-402, Yugal Parnavi, Baner, Pune 411045</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold text-gray-900">TAX INVOICE</p>
                        <p className="text-xs text-gray-400 mt-1">{form.receipt_number || 'NEO-YYYY-NNNN'}</p>
                      </div>
                    </div>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-lg font-bold text-gray-900">{form.student_name || 'Customer Name'}</p>
                        <p className="text-xs text-gray-500">{form.student_phone}{form.student_city ? ` · ${form.student_city}` : ''}</p>
                        {form.course_name && <p className="text-sm text-gray-600 mt-1 font-medium">{form.course_name}</p>}
                      </div>
                    </div>
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-gray-900 text-white text-xs">
                          <th className="text-left px-3 py-2">DESCRIPTION</th>
                          <th className="text-right px-3 py-2">QTY</th>
                          <th className="text-right px-3 py-2">RATE</th>
                          <th className="text-right px-3 py-2">AMOUNT</th>
                        </tr>
                      </thead>
                      <tbody>
                        {c.items.map((it, i) => (
                          <tr key={i} className={i % 2 ? 'bg-gray-50' : ''}>
                            <td className="px-3 py-2">{it.description}</td>
                            <td className="px-3 py-2 text-right">{it.qty}</td>
                            <td className="px-3 py-2 text-right">₹{cNum(it.rate)}</td>
                            <td className="px-3 py-2 text-right font-medium">₹{cNum(it.amount)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <div className="flex justify-end">
                      <div className="w-52 space-y-1 text-sm">
                        <div className="flex justify-between"><span className="text-gray-500">Subtotal</span><span className="font-medium">₹{cNum(c.subtotal)}</span></div>
                        {Number(form.discount) > 0 && <div className="flex justify-between"><span className="text-gray-500">Discount</span><span className="font-medium text-red-600">-₹{cNum(form.discount)}</span></div>}
                        {Number(form.tax_rate) > 0 && <div className="flex justify-between"><span className="text-gray-500">Tax</span><span className="font-medium">₹{cNum(c.taxAmount)}</span></div>}
                        <div className="flex justify-between border-t border-gray-200 pt-1.5 font-bold"><span>Total</span><span>₹{cNum(c.totalAmount)}</span></div>
                        <div className="flex justify-between text-emerald-600 font-semibold"><span>Received</span><span>₹{cNum(form.received_amount)}</span></div>
                        {c.balance > 0 && <div className="flex justify-between text-amber-600 font-semibold"><span>Balance</span><span>₹{cNum(c.balance)}</span></div>}
                      </div>
                    </div>
                    {form.bank_name && (
                      <div className="border-t border-gray-100 pt-3 text-xs text-gray-500 space-y-0.5">
                        <p className="font-semibold text-gray-700">PAYMENT DETAILS</p>
                        {form.bank_account_name && <p>Account: {form.bank_account_name}</p>}
                        {form.bank_name && <p>Bank: {form.bank_name}</p>}
                        {form.bank_account_number && <p>A/c: {form.bank_account_number}</p>}
                        {form.bank_ifsc && <p>IFSC: {form.bank_ifsc}</p>}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center justify-between mt-4 gap-2">
                  <div className="flex items-center gap-1.5 text-xs text-gray-400">
                    <Settings2 size={13} /> Prefix: <input className="input-field w-20 py-1 text-xs" value={form.prefix} onChange={(e) => setForm({ ...form, prefix: e.target.value })} />
                  </div>
                  <button onClick={() => handleSave().then(() => {})} className="btn-secondary text-xs flex items-center gap-1.5 px-3 py-1.5">
                    <RefreshCw size={13} /> Generate number on save
                  </button>
                </div>
              </CardBody>
            </Card>
          </div>
        </div>
      )}

      {/* Enrollment picker */}
      <Modal open={showEnrollPicker} onClose={() => setShowEnrollPicker(false)} title="Select Enrollment" size="lg">
        <div className="relative mb-3">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input className="input-field pl-9" placeholder="Search by student, phone or course..." value={enrollSearch} onChange={(e) => setEnrollSearch(e.target.value)} autoFocus />
        </div>
        <div className="border rounded-xl max-h-96 overflow-y-auto divide-y divide-gray-50">
          {filteredEnrollments.length === 0 ? (
            <div className="text-center py-10 text-sm text-gray-400">No enrollments found</div>
          ) : filteredEnrollments.map((en) => (
            <button key={en.id} onClick={() => selectEnrollment(en)} className="w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold text-gray-900 text-sm">{en.student_name}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{en.course_name}{en.student_phone ? ` · ${en.student_phone}` : ''}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-semibold text-gray-900">₹{Number(en.total_amount).toLocaleString()}</p>
                  <p className="text-[10px] text-emerald-600">Paid ₹{Number(en.paid_amount || 0).toLocaleString()}</p>
                </div>
              </div>
            </button>
          ))}
        </div>
      </Modal>

      {/* Save template modal */}
      <Modal open={showTemplateSave} onClose={() => setShowTemplateSave(false)} title="Save as Template" size="sm">
        <div className="space-y-3">
          <div>
            <label className="text-xs text-gray-500 font-medium mb-1 block">Template name</label>
            <input className="input-field" value={templateName} onChange={(e) => setTemplateName(e.target.value)} placeholder="e.g. Default NSL HDFC" autoFocus />
          </div>
          <p className="text-xs text-gray-400">Saves payment mode, bank details, notes & prefix so you can reuse them with one click.</p>
          <button onClick={handleSaveAsTemplate} className="btn-primary w-full">Save Template</button>
        </div>
      </Modal>
    </div>
  );
}
