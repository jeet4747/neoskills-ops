import { useState } from 'react';
import { Send, Radio, CheckCircle, AlertCircle } from 'lucide-react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { Card, CardHeader, CardBody } from '../components/ui/Card';

export default function Broadcast() {
  const { user } = useAuth();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [url, setUrl] = useState('/');
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState(null);

  if (user?.email !== 'contact@neoskills.co.in') {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-400">Access restricted</p>
      </div>
    );
  }

  async function handleSend(e) {
    e.preventDefault();
    if (!title.trim() || !body.trim()) return;
    setSending(true);
    setResult(null);
    try {
      const res = await api.push.broadcast({ title: title.trim(), body: body.trim(), url: url.trim() || '/' });
      setResult(res);
      setTitle('');
      setBody('');
      setUrl('/');
    } catch (err) {
      setResult({ error: err.message });
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Push Notification</h1>
        <p className="text-sm text-gray-400 mt-0.5">Send push notification to all subscribed users</p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Radio size={18} className="text-primary-600" />
            <h3 className="font-semibold text-gray-900">Compose Notification</h3>
          </div>
        </CardHeader>
        <CardBody>
          <form onSubmit={handleSend} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Title *</label>
              <input
                className="input-field"
                placeholder="e.g. Important Update"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Message *</label>
              <textarea
                className="input-field min-h-[100px]"
                placeholder="Write your notification message..."
                value={body}
                onChange={(e) => setBody(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Open page when tapped</label>
              <select className="input-field" value={url} onChange={(e) => setUrl(e.target.value)}>
                <option value="/">Dashboard</option>
                <option value="/tasks">Kanban</option>
                <option value="/enrollments">Enrollments</option>
                <option value="/payments">Payments</option>
                <option value="/batches">Batches</option>
              </select>
            </div>

            {result && !result.error && (
              <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-200 rounded-xl p-4">
                <CheckCircle size={20} className="text-emerald-500 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-emerald-800">Notification sent!</p>
                  <p className="text-xs text-emerald-600 mt-0.5">
                    Sent to {result.sent} devices ({result.uniqueUsers} users) · {result.failed} failed
                  </p>
                </div>
              </div>
            )}

            {result?.error && (
              <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-xl p-4">
                <AlertCircle size={20} className="text-red-500 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-red-800">Failed to send</p>
                  <p className="text-xs text-red-600 mt-0.5">{result.error}</p>
                </div>
              </div>
            )}

            <div className="flex justify-end pt-2 border-t">
              <button type="submit" className="btn-primary px-6 flex items-center gap-2" disabled={sending || !title.trim() || !body.trim()}>
                <Send size={16} />
                {sending ? 'Sending...' : 'Send Notification'}
              </button>
            </div>
          </form>
        </CardBody>
      </Card>

      <Card>
        <CardBody className="p-4">
          <p className="text-xs text-gray-400 leading-relaxed">
            This sends a native push notification to all users who have enabled notifications on their device.
            The notification will appear on their phone's home screen even if the app is closed.
            Only active users with valid push subscriptions will receive it.
          </p>
        </CardBody>
      </Card>
    </div>
  );
}
