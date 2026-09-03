import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Enrollments from './pages/Enrollments';
import Approvals from './pages/Approvals';
import Payments from './pages/Payments';
import BankAccounts from './pages/BankAccounts';
import Reports from './pages/Reports';
import Users from './pages/Users';
import SalespersonDetail from './pages/SalespersonDetail';
import EnrollmentDetail from './pages/EnrollmentDetail';
import Team from './pages/Team';
import Receipts from './pages/Receipts';
import Batches from './pages/Batches';
import Tasks from './pages/Tasks';
import TrainingCalendar from './pages/TrainingCalendar';
import Broadcast from './pages/Broadcast';
import Attendance from './pages/Attendance';
import AppLayout from './components/Layout/AppLayout';

function ProtectedRoute({ children, roles }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) {
    return <Navigate to="/" replace />;
  }
  return children;
}

function PublicRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (user) return <Navigate to="/" replace />;
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
      <Route path="/register" element={<PublicRoute><Register /></PublicRoute>} />

      <Route
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="enrollments" element={<Enrollments />} />
        <Route path="enrollments/:id" element={<EnrollmentDetail />} />
        <Route path="salesperson/:id" element={<SalespersonDetail />} />
        <Route
          path="team"
          element={
            <ProtectedRoute roles={['admin', 'manager', 'hr']}>
              <Team />
            </ProtectedRoute>
          }
        />

        <Route
          path="approvals"
          element={
            <ProtectedRoute roles={['manager', 'admin', 'ops']}>
              <Approvals />
            </ProtectedRoute>
          }
        />
        <Route path="payments" element={<Payments />} />
        <Route path="batches" element={<Navigate to="/training-calendar" replace />} />
        <Route path="tasks" element={<Tasks />} />
        <Route path="attendance" element={<Attendance />} />
        <Route path="training-calendar" element={<TrainingCalendar />} />
        <Route
          path="receipts"
          element={
            <ProtectedRoute roles={['admin', 'manager', 'ops']}>
              <Receipts />
            </ProtectedRoute>
          }
        />
        <Route
          path="bank-accounts"
          element={
            <ProtectedRoute roles={['admin', 'manager', 'ops']}>
              <BankAccounts />
            </ProtectedRoute>
          }
        />
        <Route
          path="reports"
          element={
            <ProtectedRoute roles={['manager', 'admin', 'ops']}>
              <Reports />
            </ProtectedRoute>
          }
        />
        <Route
          path="users"
          element={
            <ProtectedRoute roles={['manager', 'admin']}>
              <Users />
            </ProtectedRoute>
          }
        />
        <Route
          path="broadcast"
          element={
            <ProtectedRoute roles={['admin']}>
              <Broadcast />
            </ProtectedRoute>
          }
        />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
