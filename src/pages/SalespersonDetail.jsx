import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, DollarSign, Users, Clock, Medal } from 'lucide-react';
import { api } from '../services/api';
import { useToast } from '../context/ToastContext';
import { Card, CardHeader, CardBody } from '../components/ui/Card';
import Table from '../components/ui/Table';
import Badge from '../components/ui/Badge';

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

  const enrollColumns = [
    { key: 'student_name', label: 'Student' },
    { key: 'course_name', label: 'Course' },
    { key: 'total_amount', label: 'Amount', render: (r) => `₹${Number(r.total_amount).toLocaleString()}` },
    { key: 'status', label: 'Status', render: (r) => <Badge status={r.status} /> },
    { key: 'created_at', label: 'Date', render: (r) => new Date(r.created_at).toLocaleDateString() },
  ];

  if (loading) {
    return (
      <div className="space-y-5">
        <div className="h-8 w-48 skeleton" />
        <div className="grid grid-cols-3 gap-5">{[1,2,3].map(i => <div key={i} className="h-24 skeleton" />)}</div>
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

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
        <Card><CardBody>
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-100 rounded-xl"><DollarSign size={20} className="text-blue-600" /></div>
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wider">Collected</p>
              <p className="text-xl font-bold text-gray-900">₹{Number(profile?.collected || 0).toLocaleString()}</p>
            </div>
          </div>
        </CardBody></Card>
        <Card><CardBody>
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-amber-100 rounded-xl"><Clock size={20} className="text-amber-600" /></div>
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wider">Pending</p>
              <p className="text-xl font-bold text-amber-600">₹{Number(profile?.pending || 0).toLocaleString()}</p>
            </div>
          </div>
        </CardBody></Card>
        <Card><CardBody>
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-100 rounded-xl"><Users size={20} className="text-emerald-600" /></div>
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wider">Enrollments</p>
              <p className="text-xl font-bold text-gray-900">{profile?.enrollments || enrollments.length}</p>
            </div>
          </div>
        </CardBody></Card>
        <Card><CardBody>
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-purple-100 rounded-xl"><Medal size={20} className="text-purple-600" /></div>
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wider">Pending Approvals</p>
              <p className="text-xl font-bold text-gray-900">{profile?.pending_approvals || 0}</p>
            </div>
          </div>
        </CardBody></Card>
      </div>

      <Card>
        <CardHeader>
          <h3 className="font-semibold text-gray-900">Enrollments ({enrollments.length})</h3>
        </CardHeader>
        <CardBody className="p-0">
          <Table columns={enrollColumns} data={enrollments} />
          {!enrollments.length && (
            <div className="text-center py-12 text-sm text-gray-400">No enrollments yet</div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
