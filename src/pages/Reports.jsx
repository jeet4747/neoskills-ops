import { useState, useEffect } from 'react';
import { FileText, Download } from 'lucide-react';
import { api } from '../services/api';
import { Card, CardHeader, CardBody } from '../components/ui/Card';
import Table from '../components/ui/Table';

export default function Reports() {
  const [activeTab, setActiveTab] = useState('salesperson');
  const [salesperson, setSalesperson] = useState([]);
  const [bankWise, setBankWise] = useState([]);
  const [pending, setPending] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.reports.salesperson(),
      api.reports.bankWise(),
      api.reports.pendingPayments(),
    ])
      .then(([s, b, p]) => { setSalesperson(s); setBankWise(b); setPending(p); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const tabs = [
    { key: 'salesperson', label: 'Salesperson Performance' },
    { key: 'bank', label: 'Bank-wise Collection' },
    { key: 'pending', label: 'Pending Payments' },
  ];

  const salespersonCols = [
    { key: 'salesperson', label: 'Salesperson' },
    { key: 'enrollments', label: 'Enrollments' },
    { key: 'collected', label: 'Collected', render: (r) => `₹${Number(r.collected).toLocaleString()}` },
    { key: 'pending_collection', label: 'Pending', render: (r) => `₹${Number(r.pending_collection).toLocaleString()}` },
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
    { key: 'phone', label: 'Phone' },
    { key: 'course_name', label: 'Course' },
    { key: 'salesperson', label: 'Salesperson' },
    { key: 'pending_amount', label: 'Pending Amount', render: (r) => (
      <span className="text-amber-600 font-medium">₹{Number(r.pending_amount).toLocaleString()}</span>
    )},
  ];

  function exportCSV(data, filename) {
    if (!data.length) return;
    const headers = Object.keys(data[0]);
    const csv = [headers.join(','), ...data.map((r) => headers.map((h) => `"${r[h] || ''}"`).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Reports</h1>
      </div>

      <div className="flex gap-1 bg-gray-100 p-1 rounded-lg w-fit">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
              activeTab === tab.key ? 'bg-white shadow-sm' : 'hover:bg-gray-50'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-32">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600" />
        </div>
      ) : (
        <>
          {activeTab === 'salesperson' && (
            <Card>
              <CardHeader className="flex items-center justify-between">
                <h3 className="font-semibold">Salesperson Performance Report</h3>
                <button onClick={() => exportCSV(salesperson, 'salesperson-performance')} className="btn-ghost flex items-center gap-1 text-sm">
                  <Download size={14} /> CSV
                </button>
              </CardHeader>
              <CardBody className="p-0"><Table columns={salespersonCols} data={salesperson} /></CardBody>
            </Card>
          )}

          {activeTab === 'bank' && (
            <Card>
              <CardHeader className="flex items-center justify-between">
                <h3 className="font-semibold">Bank-wise Collection Report</h3>
                <button onClick={() => exportCSV(bankWise, 'bank-wise-collection')} className="btn-ghost flex items-center gap-1 text-sm">
                  <Download size={14} /> CSV
                </button>
              </CardHeader>
              <CardBody className="p-0"><Table columns={bankCols} data={bankWise} /></CardBody>
            </Card>
          )}

          {activeTab === 'pending' && (
            <Card>
              <CardHeader className="flex items-center justify-between">
                <h3 className="font-semibold">Pending Payments Report</h3>
                <button onClick={() => exportCSV(pending, 'pending-payments')} className="btn-ghost flex items-center gap-1 text-sm">
                  <Download size={14} /> CSV
                </button>
              </CardHeader>
              <CardBody className="p-0"><Table columns={pendingCols} data={pending} /></CardBody>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
