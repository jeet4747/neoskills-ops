import { useEffect, useState } from 'react';
import { KeyRound } from 'lucide-react';
import Modal from './ui/Modal';
import { auth } from '../services/api';
import { useToast } from '../context/ToastContext';

const EMPTY = { currentPassword: '', newPassword: '', confirmPassword: '' };

export default function ChangePasswordModal({ open, onClose }) {
  const toast = useToast();
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setForm(EMPTY);
      setError('');
      setSaving(false);
    }
  }, [open]);

  function setField(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (!form.currentPassword) return setError('Enter your current password.');
    if (form.newPassword.length < 6) return setError('New password must be at least 6 characters.');
    if (form.newPassword !== form.confirmPassword) return setError('New passwords do not match.');
    if (form.newPassword === form.currentPassword) return setError('New password must be different from the current password.');
    setSaving(true);
    try {
      await auth.changePassword({
        currentPassword: form.currentPassword,
        newPassword: form.newPassword,
      });
      toast.success('Password changed. Use the new password next time you sign in.');
      onClose();
    } catch (err) {
      setError(err.message || 'Could not change password.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={saving ? () => {} : onClose} title="Change Password" size="sm">
      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label className="text-xs text-gray-500 font-medium mb-1 block">Current password *</label>
          <input
            className="input-field"
            type="password"
            autoComplete="current-password"
            value={form.currentPassword}
            onChange={(e) => setField('currentPassword', e.target.value)}
            autoFocus
          />
        </div>
        <div>
          <label className="text-xs text-gray-500 font-medium mb-1 block">New password *</label>
          <input
            className="input-field"
            type="password"
            autoComplete="new-password"
            value={form.newPassword}
            onChange={(e) => setField('newPassword', e.target.value)}
            placeholder="At least 6 characters"
          />
        </div>
        <div>
          <label className="text-xs text-gray-500 font-medium mb-1 block">Confirm new password *</label>
          <input
            className="input-field"
            type="password"
            autoComplete="new-password"
            value={form.confirmPassword}
            onChange={(e) => setField('confirmPassword', e.target.value)}
          />
        </div>
        {error && <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</p>}
        <button type="submit" disabled={saving} className="btn-primary w-full flex items-center justify-center gap-2">
          <KeyRound size={16} /> {saving ? 'Saving…' : 'Change Password'}
        </button>
      </form>
    </Modal>
  );
}
