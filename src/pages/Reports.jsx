import { useState, useEffect } from 'react';
import { FileText, Download } from 'lucide-react';
import { api } from '../services/api';
import { useToast } from '../context/ToastContext';
import { Card, CardHeader, CardBody } from '../components/ui/Card';
import Table from '../components/ui/Table';
import { CATEGORIES } from '../config/constants';

const EMPTY_FILTERS = { category: '', status: '', from: '', to: '', sales_user_id: '' };

export default function Reports() {
  const toast = useToast();
  const [activeTab, setActiveTab] = useState('category');
  const [salesperson, setSalesperson] = useState([]);
  const [bankWise, setBankWise] = useState([]);
  const [pending, setPending] = useState([]);
  const [categoryData, setCategoryData] = useState({ rows: [], totals: null });
  const [salespeople, setSalespeople] = useState([]);
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.reports.salesperson(),
      api.reports.bankWise(),
      api.reports.pendingPayments(),
      api.reports.category(),
      api.users.list(),
    ])
      .then(([s, b, p, c, u]) => {
        setSalesperson(s);
        setBankWise(b);
        setPending(p);
        setCategoryData(c);
        setSalespeople(u.filter((x) => x.role === 'sales' || x.can_sell || x.role === 'admin'));
      })
      .catch(() => toast.error('Failed to load reports'))
      .finally(() => setLoading(false));
  }, [toast]);

  useEffect(() => {
    if (activeTab !== 'category') return;
    let cancelled = false;
    setLoading(true);
    api.reports.category(filters)
      .then((c) => { if (!cancelled) setCategoryData(c); })
      .catch(() => { if (!cancelled) toast.error('Failed to load category analytics'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [activeTab, filters, toast]);

  const tabs = [
    { key: 'category', label: 'Category Analytics' },
    { key: 'salesperson', label: 'Salesperson Performance' },
    { key: 'bank', label: 'Bank-wise Collection' },
    { key: 'pending', label: 'Pending Payments' },
  ];

  const categoryCols = [
    { key: 'category', label: 'Category' },
    { key: 'enrollments', label: 'Enrollments' },
    { key: 'total_amount', label: 'Total Fee', render: (r) => `₹${Number(r.total_amount).toLocaleString()}` },
    { key: 'collected', label: 'Collected', render: (r) => <span className="text-emerald-600 font-medium">{`₹${Number(r.collected).toLocaleString()}`}</span> },
    { key: 'pending', label: 'Pending', render: (r) => <span className="text-amber-600 font-medium">{`₹${Number(r.pending).toLocaleString()}`}</span> },
  ];

  const salespersonCols = [
    { key: 'salesperson', label: 'Salesperson' },
    { key: 'enrollments', label: 'Enrollments' },
    { key: 'collected', label: 'Collected', render: (r) => `₹${Number(r.collected).toLocaleString()}` },
    { key: 'pending_collection', label: 'Pending', render: (r) => <span className="text-amber-600 font-medium">{`₹${Number(r.pending_collection).toLocaleString()}`}</span> },
    { key: 'pending_approvals', label: 'Pending Approvals' },
  ];

  const bankCols = [
    { key: 'account_name', label: 'Account' },
    { key: 'bank_name', label: 'Bank' },
    { key: 'account_number', label: 'Account No' },
    { key: 'transactions', label: 'Transactions' },
    { key: 'total_collected', label: 'Total Collected', render: (r) => `₹${Number(r.total_collected).toLocaleString()}` },
  ];

  const pendingCols = [
    { key: 'student_name', label: 'Student' },
    { key: 'phone', label: 'Phone', render: (r) => r.phone || '-' },
    { key: 'course_name', label: 'Course' },
    { key: 'salesperson', label: 'Salesperson' },
    { key: 'pending_amount', label: 'Pending Amount', render: (r) => (
      <span className="text-amber-600 font-semibold">{`₹${Number(r.pending_amount).toLocaleString()}`}</span>
    )},
  ];

  function exportCSV(data, filename) {
    if (!data.length) { toast.info('No data to export'); return; }
    const headers = Object.keys(data[0]);
    const csv = [headers.join(','), ...data.map((r) => headers.map((h) => `"${r[h] || ''}"`).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${filename}.csv`;
    a.click();
    toast.success(`${filename} exported`);
  }

  const currentData = activeTab === 'category' ? categoryData.rows
    : activeTab === 'salesperson' ? salesperson
    : activeTab === 'bank' ? bankWise : pending;
  const currentCols = activeTab === 'category' ? categoryCols
    : activeTab === 'salesperson' ? salespersonCols
    : activeTab === 'bank' ? bankCols : pendingCols;

  function setFilter(key, value) {
    setFilters((f) => ({ ...f, [key]: value }));
  }

  const inputCls = 'input-field text-xs py-2';

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Reports</h1>
        <p className="text-sm text-gray-400 mt-0.5">Export insights and track performance</p>
      </div>

      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-full overflow-x-auto">
        {tabs.map((tab) => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-all whitespace-nowrap ${
              activeTab === tab.key ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'
            }`}>
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'category' && (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 p-4 bg-white border border-gray-100 rounded-2xl">
          <div>
            <label className="text-[11px] text-gray-500 font-medium mb-1 block">Category</label>
            <select className={inputCls} value={filters.category} onChange={(e) => setFilter('category', e.target.value)}>
              <option value="">All categories</option>
              {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[11px] text-gray-500 font-medium mb-1 block">Status</label>
            <select className={inputCls} value={filters.status} onChange={(e) => setFilter('status', e.target.value)}>
              <option value="">All statuses</option>
              <option value="active">Active</option>
              <option value="completed">Completed</option>
            </select>
          </div>
          <div>
            <label className="text-[11px] text-gray-500 font-medium mb-1 block">From</label>
            <input type="date" className={inputCls} value={filters.from} onChange={(e) => setFilter('from', e.target.value)} />
          </div>
          <div>
            <label className="text-[11px] text-gray-500 font-medium mb-1 block">To</label>
            <input type="date" className={inputCls} value={filters.to} onChange={(e) => setFilter('to', e.target.value)} />
          </div>
          <div>
            <label className="text-[11px] text-gray-500 font-medium mb-1 block">Salesperson</label>
            <select className={inputCls} value={filters.sales_user_id} onChange={(e) => setFilter('sales_user_id', e.target.value)}>
              <option value="">All salespeople</option>
              {salespeople.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </div>
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          <div className="h-12 skeleton w-full" />
          {[1,2,3,4,5].map(i => <div key={i} className="h-10 skeleton w-full" />)}
        </div>
      ) : (
        <Card>
          <CardHeader className="flex items-center justify-between">
            <h3 className="font-semibold text-gray-900">
              {tabs.find(t => t.key === activeTab)?.label}
            </h3>
            <button onClick={() => exportCSV(currentData, `${activeTab}-report`)}
              className="btn-ghost flex items-center gap-1.5 text-sm">
              <Download size={14} /> Export CSV
            </button>
          </CardHeader>
          <CardBody className="p-0">
            {currentData.length > 0 ? (
              <>
                {activeTab === 'category' && categoryData.totals && (
                  <div className="flex flex-wrap gap-4 px-5 py-3 border-b border-gray-100 text-sm">
                    <span className="text-gray-500">Total: <b className="text-gray-900">{categoryData.totals.enrollments}</b> enrollments</span>
                    <span className="text-gray-500">Fee: <b>{`₹${Number(categoryData.totals.total_amount).toLocaleString()}`}</b></span>
                    <span className="text-gray-500">Collected: <b className="text-emerald-600">{`₹${Number(categoryData.totals.collected).toLocaleString()}`}</b></span>
                    <span className="text-gray-500">Pending: <b className="text-amber-600">{`₹${Number(categoryData.totals.pending).toLocaleString()}`}</b></span>
                  </div>
                )}
                <Table columns={currentCols} data={currentData} />
              </>
            ) : (
              <div className="text-center py-12">
                <div className="w-14 h-14 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
                  <FileText size={28} className="text-gray-300" />
                </div>
                <h3 className="text-sm font-medium text-gray-500 mb-1">No data yet</h3>
                <p className="text-xs text-gray-400">Reports will populate as enrollments and payments are recorded</p>
              </div>
            )}
          </CardBody>
        </Card>
      )}
    </div>
  );
}