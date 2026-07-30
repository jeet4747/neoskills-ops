import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Trophy } from 'lucide-react';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      navigate('/');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-gray-100">
      <div className="hidden lg:flex w-1/2 gradient-primary items-center justify-center p-12 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-20 left-20 w-72 h-72 bg-white rounded-full blur-3xl" />
          <div className="absolute bottom-20 right-20 w-96 h-96 bg-accent-500 rounded-full blur-3xl" />
        </div>
        <div className="relative z-10 text-center max-w-md">
          <div className="w-16 h-16 bg-accent-500 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg">
            <Trophy size={32} className="text-primary-900" />
          </div>
          <h1 className="text-4xl font-bold text-white mb-3">NeoOps</h1>
          <p className="text-xl text-white/70 mb-2">Sales Command Center</p>
          <p className="text-white/40 text-sm">Track performance. Close deals. Grow revenue.</p>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <div className="lg:hidden text-center mb-8">
            <div className="w-12 h-12 bg-primary-500 rounded-2xl flex items-center justify-center mx-auto mb-3">
              <Trophy size={24} className="text-white" />
            </div>
            <h1 className="text-xl font-bold text-primary-600">NeoOps</h1>
            <p className="text-sm text-gray-400">Sales Command Center</p>
          </div>

          <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 space-y-5">
            <div>
              <h2 className="text-xl font-bold text-gray-900">Welcome back</h2>
              <p className="text-sm text-gray-400 mt-1">Sign in to your account</p>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-600 text-sm px-4 py-3 rounded-xl flex items-center gap-2">
                <span>⚠️</span> {error}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
              <input
                type="email"
                className="input-field"
                placeholder="you@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Password</label>
              <input
                type="password"
                className="input-field"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            <button type="submit" className="btn-primary w-full flex items-center justify-center gap-2" disabled={loading}>
              {loading ? (
                <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : null}
              {loading ? 'Signing in...' : 'Sign In'}
            </button>

            <p className="text-center text-sm text-gray-400">
              First time?{' '}
              <Link to="/register" className="text-primary-600 hover:text-primary-700 font-medium">
                Create an account
              </Link>
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}
