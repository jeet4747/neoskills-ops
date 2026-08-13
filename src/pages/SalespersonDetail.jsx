import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Banknote, Users, Clock, TrendingUp, AlertCircle, Phone, Mail, ExternalLink, BookOpen } from 'lucide-react';
import { api } from '../services/api';
import { useToast } from '../context/ToastContext';
import { Card, CardHeader, CardBody } from '../components/ui/Card';
import Table from '../components/ui/Table';
import Badge from '../components/ui/Badge';

const ENROLL_STATUS = {
  waiting_approval: 'Approval Pending',
  active: 'Payment Pending',
  completed: 'Completed',
};

export default function SalespersonDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const [profile, setProfile] = useState(null);
  const [enrollments, setEnrollments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { load(); }, [id]);

  async function load() {
    try {
      const [profileData, enrollmentsData] = await Promise.all([
        api.users.getProfile(id),
        api.enrollments.list({ sales_user_id: id }),
      ]);
      setProfile(profileData);
      setEnrollments(enrollmentsData);
    } catch (e) {
      toast.error('Failed to load salesperson data');
      navigate('/');
    } finally {
      setLoading(false);
    }
  }

  const collected = Number(profile?.collected || 0);
  const totalBusiness = Number(profile?.total_business || 0);
  const pending = Number(profile?.pending || 0);

  const enrollColumns = [
    {
      key: 'student_name', label: 'Student',
      render: (r) => (
        <div>
          <p className="font-medium text-gray-900">{r.student_name}</p>
          <p className="text-xs text-gray-400">{r.course_name}</p>
        </div>
      ),
    },
    {
      key: 'student_phone', label: 'Contact',
      render: (r) => (
        <div>
          <p className="flex items-center gap-1 text-gray-700"><Phone size={12} className="text-gray-400" /> {r.student_phone || '-'}</p>
          <p className="flex items-center gap-1 text-xs text-gray-400"><Mail size={12} className="text-gray-400" /> {r.student_email || ''}</p>
        </div>
      ),
    },
    { key: 'total_amount', label: 'Total', render: (r) => `₹${Number(r.total_amount).toLocaleString()}` },
    { key: 'paid_amount', label: 'Received', render: (r) => <span className="text-emerald-600 font-medium">₹{Number(r.paid_amount || 0).toLocaleString()}</span> },
    { key: 'pending_amount', label: 'Pending', render: (r) => <span className="text-amber-600 font-medium">₹{Number(r.pending_amount || 0).toLocaleString()}</span> },
    {
      key: 'telecrm_link', label: 'TeleCRM',
      render: (r) => r.telecrm_link ? (
        <a href={r.telecrm_link} target="_blank" rel="noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="inline-flex items-center gap-1 text-primary-600 hover:underline text-xs">
          <BookOpen size={13} /> Open
        </a>
      ) : '-',
    },
    { key: 'status', label: 'Status', render: (r) => <Badge status={r.status}>{ENROLL_STATUS[r.status] || r.status}</Badge> },
    {
      key: 'created_at', label: 'Date',
      render: (r) => new Date(r.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
    },
    {
      key: 'view', label: '',
      render: () => <ExternalLink size={15} className="text-gray-300" />,
    },
  ];

  if (loading) {
    return (
      <div className="space-y-5">
        <div className="h-8 w-48 skeleton" />
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-5">{[1,2,3,4,5].map(i => <div key={i} className="h-24 skeleton" />)}</div>
        <div className="h-64 skeleton" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <button onClick={() => navigate(-1)} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors">
        <ArrowLeft size={15} /> Back
      </button>

      <div className="flex items-center gap-4">
        <div className="w-14 h-14 bg-primary-500 rounded-2xl flex items-center justify-center text-white text-xl font-bold">
          {profile?.name?.charAt(0).toUpperCase()}
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{profile?.name}</h1>
          <p className="text-sm text-gray-500">{profile?.email}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-5">
        <Card><CardBody>
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-100 rounded-xl shrink-0"><TrendingUp size={20} className="text-indigo-600" /></div>
            <div className="min-w-0 flex-1">
              <p className="text-xs text-gray-400 uppercase tracking-wider">Total Business</p>
              <p className="text-base sm:text-xl font-bold text-gray-900 break-words">₹{totalBusiness.toLocaleString()}</p>
            </div>
          </div>
        </CardBody></Card>
        <Card><CardBody>
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-100 rounded-xl shrink-0"><Banknote size={20} className="text-emerald-600" /></div>
            <div className="min-w-0 flex-1">
              <p className="text-xs text-gray-400 uppercase tracking-wider">Received</p>
              <p className="text-base sm:text-xl font-bold text-emerald-600 break-words">₹{collected.toLocaleString()}</p>
            </div>
          </div>
        </CardBody></Card>
        <Card><CardBody>
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-amber-100 rounded-xl shrink-0"><Clock size={20} className="text-amber-600" /></div>
            <div className="min-w-0 flex-1">
              <p className="text-xs text-gray-400 uppercase tracking-wider">Pending</p>
              <p className="text-base sm:text-xl font-bold text-amber-600 break-words">₹{pending.toLocaleString()}</p>
            </div>
          </div>
        </CardBody></Card>
        <Card><CardBody>
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-100 rounded-xl shrink-0"><Users size={20} className="text-blue-600" /></div>
            <div className="min-w-0 flex-1">
              <p className="text-xs text-gray-400 uppercase tracking-wider">Total Nominations</p>
              <p className="text-base sm:text-xl font-bold text-gray-900 break-words">{profile?.enrollments || enrollments.length}</p>
            </div>
          </div>
        </CardBody></Card>
        <Card><CardBody>
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-purple-100 rounded-xl shrink-0"><AlertCircle size={20} className="text-purple-600" /></div>
            <div className="min-w-0 flex-1">
              <p className="text-xs text-gray-400 uppercase tracking-wider">Approval Needed</p>
              <p className="text-base sm:text-xl font-bold text-gray-900 break-words">{profile?.pending_approvals || 0}</p>
            </div>
          </div>
        </CardBody></Card>
      </div>

      {totalBusiness > 0 && (
        <Card>
          <CardBody>
            <div className="flex items-center justify-between text-sm mb-2">
              <span className="text-gray-500">Collection progress</span>
              <span className="font-bold text-gray-900">{totalBusiness ? Math.round((collected / totalBusiness) * 100) : 0}% received</span>
            </div>
            <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
              <div className="h-full bg-emerald-500 rounded-full transition-all"
                style={{ width: `${totalBusiness ? Math.min((collected / totalBusiness) * 100, 100) : 0}%` }} />
            </div>
            <p className="text-xs text-gray-400 mt-2">₹{collected.toLocaleString()} received of ₹{totalBusiness.toLocaleString()} total business</p>
          </CardBody>
        </Card>
      )}

      <Card>
        <CardHeader>
          <h3 className="font-semibold text-gray-900">All Nominations ({enrollments.length})</h3>
        </CardHeader>
        <CardBody className="p-0">
          <Table columns={enrollColumns} data={enrollments} onRowClick={(r) => navigate(`/enrollments/${r.id}`)} />
          {!enrollments.length && (
            <div className="text-center py-12 text-sm text-gray-400">No nominations yet</div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
