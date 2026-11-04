import { useEffect, useMemo, useState } from 'react';
import {
  CalendarDays, ChevronLeft, ChevronRight, Plus, Users, Plane,
  Pencil, Trash2, CalendarClock, Sparkles,
} from 'lucide-react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { Card, CardHeader, CardBody } from '../components/ui/Card';
import Modal from '../components/ui/Modal';
import StatsCard from '../components/ui/StatsCard';
import { istDate, istMonth } from '../utils/ist';

const MANAGER_ROLES = ['admin', 'manager', 'hr'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const LEAVE_TYPES = {
  planned: { label: 'Planned', chip: 'bg-indigo-50 text-indigo-700 border-indigo-100' },
  casual: { label: 'Casual', chip: 'bg-emerald-50 text-emerald-700 border-emerald-100' },
  sick: { label: 'Sick', chip: 'bg-rose-50 text-rose-700 border-rose-100' },
  unpaid: { label: 'Unpaid', chip: 'bg-amber-50 text-amber-700 border-amber-100' },
  other: { label: 'Other', chip: 'bg-gray-100 text-gray-600 border-gray-200' },
};

const ROLE_LABELS = {
  admin: 'Admin',
  manager: 'Manager',
  ops: 'Operations',
  hr: 'HR',
  sales: 'Sales Rep',
};

function parseDay(value) {
  return new Date(`${value}T00:00:00`);
}

function fmtDate(value, withYear = false) {
  const d = parseDay(value);
  return `${d.getDate()} ${MONTHS[d.getMonth()]}${withYear ? ` ${d.getFullYear()}` : ''}`;
}

function fmtRange(start, end) {
  if (start === end) return fmtDate(start, true);
  const a = parseDay(start);
  const b = parseDay(end);
  if (a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth())
    return `${a.getDate()} – ${fmtDate(end, true)}`;
  return `${fmtDate(start)} – ${fmtDate(end, true)}`;
}

function daysInclusive(start, end) {
  return Math.round((parseDay(end) - parseDay(start)) / 86400000) + 1;
}

function monthBounds(month) {
  const [year, m] = month.split('-').map(Number);
  const last = new Date(year, m, 0).getDate();
  return {
    first: `${month}-01`,
    last: `${month}-${String(last).padStart(2, '0')}`,
    year,
    month: m,
    days: last,
  };
}

function overlapDaysInMonth(leave, month) {
  const { first, last } = monthBounds(month);
  const start = leave.start_date > first ? leave.start_date : first;
  const end = leave.end_date < last ? leave.end_date : last;
  return start <= end ? daysInclusive(start, end) : 0;
}

function shiftMonth(month, delta) {
  const [year, m] = month.split('-').map(Number);
  const d = new Date(year, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function buildCalendar(month) {
  const { year, month: m, days } = monthBounds(month);
  const lead = (new Date(year, m - 1, 1).getDay() + 6) % 7; // Monday-first
  const cells = Array.from({ length: lead }, () => null);
  for (let d = 1; d <= days; d += 1)
    cells.push(`${month}-${String(d).padStart(2, '0')}`);
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

function emptyForm(userId, date) {
  return {
    user_id: String(userId || ''),
    start_date: date || '',
    end_date: date || '',
    leave_type: 'planned',
    reason: '',
  };
}

export default function PlannedLeave() {
  const { user } = useAuth();
  const toast = useToast();
  const isManager = MANAGER_ROLES.includes(user?.role);
  const today = istDate();

  const [month, setMonth] = useState(istMonth());
  const [leaves, setLeaves] = useState([]);
  const [team, setTeam] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterUser, setFilterUser] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm(user?.id, today));
  const [saving, setSaving] = useState(false);

  const bounds = useMemo(() => monthBounds(month), [month]);
  const cells = useMemo(() => buildCalendar(month), [month]);

  useEffect(() => {
    if (!isManager) return;
    api.users.listSimple()
      .then((rows) => {
        const sorted = [...rows].sort((a, b) => {
          if (a.id === user?.id) return -1;
          if (b.id === user?.id) return 1;
          return a.name.localeCompare(b.name);
        });
        setTeam(sorted);
      })
      .catch(() => {});
  }, [isManager, user?.id]);

  useEffect(() => { load(); }, [month, filterUser]); // eslint-disable-line react-hooks/exhaustive-deps

  async function load() {
    setLoading(true);
    try {
      const params = { month };
      if (isManager && filterUser) params.user_id = filterUser;
      setLeaves(await api.plannedLeaves.list(params));
    } catch (e) {
      toast.error(e.message || 'Failed to load planned leaves');
      setLeaves([]);
    } finally {
      setLoading(false);
    }
  }

  const stats = useMemo(() => {
    const totalDays = leaves.reduce((sum, l) => sum + overlapDaysInMonth(l, month), 0);
    const people = new Set(leaves.map((l) => l.user_id)).size;
    const upcoming = leaves.filter((l) => l.end_date >= today).length;
    const mine = leaves
      .filter((l) => l.user_id === user?.id && l.end_date >= today)
      .sort((a, b) => a.start_date.localeCompare(b.start_date))[0];
    return { totalDays, people, upcoming, mine };
  }, [leaves, month, today, user?.id]);

  function openCreate(date) {
    setEditing(null);
    setForm(emptyForm(filterUser || user?.id, date || ''));
    setShowModal(true);
  }

  function openEdit(leave) {
    setEditing(leave);
    setForm({
      user_id: String(leave.user_id),
      start_date: leave.start_date,
      end_date: leave.end_date,
      leave_type: leave.leave_type,
      reason: leave.reason || '',
    });
    setShowModal(true);
  }

  function closeModal() {
    if (saving) return;
    setShowModal(false);
    setEditing(null);
  }

  async function save(e) {
    e.preventDefault();
    if (!form.start_date || !form.end_date) return toast.error('Choose both dates');
    if (form.end_date < form.start_date) return toast.error('End date cannot be before the start date');
    setSaving(true);
    try {
      const payload = {
        start_date: form.start_date,
        end_date: form.end_date,
        leave_type: form.leave_type,
        reason: form.reason.trim() || null,
      };
      if (isManager) payload.user_id = Number(form.user_id) || user.id;
      if (editing) {
        await api.plannedLeaves.update(editing.id, payload);
        toast.success('Planned leave updated');
      } else {
        await api.plannedLeaves.create(payload);
        toast.success('Leave planned — attendance marked as On Leave');
      }
      setShowModal(false);
      setEditing(null);
      await load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function remove(leave) {
    if (!window.confirm(`Delete planned leave for ${leave.name} (${fmtRange(leave.start_date, leave.end_date)})?`)) return;
    try {
      await api.plannedLeaves.remove(leave.id);
      toast.success('Planned leave removed');
      await load();
    } catch (e) {
      toast.error(e.message);
    }
  }

  const formDays = form.start_date && form.end_date && form.end_date >= form.start_date
    ? daysInclusive(form.start_date, form.end_date)
    : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Planned Leave</h1>
          <p className="text-sm text-gray-400 mt-0.5">Plan time off and keep attendance in sync</p>
        </div>
        <button onClick={() => openCreate(today)} className="btn-primary flex items-center justify-center gap-2 text-sm">
          <Plus size={17} /> Plan leave
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatsCard icon={CalendarDays} label="Leaves this month" value={leaves.length} color="primary" sub={`${MONTHS[bounds.month - 1]} ${bounds.year}`} />
        <StatsCard icon={Sparkles} label="Planned days" value={stats.totalDays} color="blue" sub="counted in this month" />
        <StatsCard icon={Users} label="People away" value={stats.people} color="emerald" sub={`${stats.upcoming} still upcoming`} />
        <StatsCard
          icon={Plane}
          label="Your next leave"
          value={stats.mine ? fmtDate(stats.mine.start_date) : '—'}
          color="amber"
          sub={stats.mine ? fmtRange(stats.mine.start_date, stats.mine.end_date) : 'nothing planned'}
        />
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <CalendarClock size={16} className="text-primary-600" />
              <h3 className="font-semibold text-gray-900">{MONTHS[bounds.month - 1]} {bounds.year}</h3>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setMonth(shiftMonth(month, -1))}
                className="p-2 rounded-xl border border-gray-200 text-gray-500 hover:bg-gray-50 transition-colors"
                aria-label="Previous month"
              >
                <ChevronLeft size={16} />
              </button>
              <button
                onClick={() => setMonth(istMonth())}
                className="px-3 py-2 rounded-xl border border-gray-200 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors"
              >
                Today
              </button>
              <button
                onClick={() => setMonth(shiftMonth(month, 1))}
                className="p-2 rounded-xl border border-gray-200 text-gray-500 hover:bg-gray-50 transition-colors"
                aria-label="Next month"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        </CardHeader>
        <CardBody className="p-2.5 sm:p-5">
          <div className="grid grid-cols-7 gap-1 sm:gap-2">
            {DAY_LABELS.map((day) => (
              <div key={day} className="text-center text-[10px] font-semibold uppercase tracking-wide text-gray-400 py-1">
                {day}
              </div>
            ))}
            {cells.map((date, index) => {
              if (!date) return <div key={`empty-${index}`} />;
              const dayLeaves = leaves.filter((l) => l.start_date <= date && l.end_date >= date);
              const d = parseDay(date);
              const isToday = date === today;
              const isSunday = d.getDay() === 0;
              return (
                <button
                  type="button"
                  key={date}
                  onClick={() => openCreate(date)}
                  className={`min-h-[74px] sm:min-h-[104px] rounded-xl border p-1.5 sm:p-2 text-left align-top transition-colors ${
                    isToday
                      ? 'border-primary-400 bg-primary-50/40 ring-1 ring-primary-300'
                      : isSunday
                        ? 'border-gray-100 bg-gray-50/60 hover:border-primary-200'
                        : 'border-gray-100 bg-white hover:border-primary-200 hover:bg-primary-50/20'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className={`text-[11px] sm:text-xs font-semibold ${isToday ? 'text-primary-700' : isSunday ? 'text-gray-400' : 'text-gray-500'}`}>
                      {d.getDate()}
                    </span>
                    {dayLeaves.length > 0 && (
                      <span className="text-[9px] text-gray-400">{dayLeaves.length}</span>
                    )}
                  </div>
                  <div className="mt-1 space-y-0.5">
                    {dayLeaves.slice(0, 3).map((leave) => {
                      const meta = LEAVE_TYPES[leave.leave_type] || LEAVE_TYPES.planned;
                      return (
                        <span
                          key={leave.id}
                          className={`block truncate rounded border px-1 py-0.5 text-[9px] sm:text-[10px] font-medium ${meta.chip}`}
                        >
                          {leave.user_id === user?.id ? 'You' : leave.name?.split(' ')[0]}
                        </span>
                      );
                    })}
                    {dayLeaves.length > 3 && (
                      <span className="block pl-1 text-[9px] text-gray-400">+{dayLeaves.length - 3} more</span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
          <p className="mt-3 text-[11px] text-gray-400">Tip: click any date to plan a leave for that day.</p>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Plane size={16} className="text-indigo-600" />
              <h3 className="font-semibold text-gray-900">Planned leaves</h3>
              <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-500">{leaves.length}</span>
            </div>
            {isManager && (
              <select
                value={filterUser}
                onChange={(e) => setFilterUser(e.target.value)}
                className="input-field py-2 text-sm w-full sm:w-56"
              >
                <option value="">Whole team</option>
                {team.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.name}{member.id === user?.id ? ' (you)' : ''}
                  </option>
                ))}
              </select>
            )}
          </div>
        </CardHeader>

        {loading ? (
          <CardBody>
            <p className="text-sm text-gray-400 text-center py-8">Loading planned leaves...</p>
          </CardBody>
        ) : leaves.length === 0 ? (
          <CardBody>
            <div className="text-center py-10">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-500">
                <Plane size={22} />
              </div>
              <p className="text-sm font-medium text-gray-700">No planned leave this month</p>
              <p className="text-xs text-gray-400 mt-1">Click a date on the calendar or use “Plan leave”.</p>
              <button onClick={() => openCreate(today)} className="btn-secondary mt-4 inline-flex items-center gap-2 text-sm">
                <Plus size={16} /> Plan leave
              </button>
            </div>
          </CardBody>
        ) : (
          <div className="divide-y divide-gray-50">
            {leaves.map((leave) => {
              const meta = LEAVE_TYPES[leave.leave_type] || LEAVE_TYPES.planned;
              const canEdit = isManager || leave.user_id === user?.id;
              return (
                <div key={leave.id} className="flex flex-col sm:flex-row sm:items-center gap-2 px-5 py-3.5">
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary-50 text-xs font-bold text-primary-700">
                      {leave.name?.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate text-sm font-semibold text-gray-900">
                          {leave.user_id === user?.id ? 'You' : leave.name}
                        </p>
                        <span className={`rounded-lg border px-2 py-0.5 text-[10px] font-medium ${meta.chip}`}>
                          {meta.label}
                        </span>
                        {isManager && leave.user_id !== user?.id && (
                          <span className="text-[10px] text-gray-400">{ROLE_LABELS[leave.role] || leave.role}</span>
                        )}
                      </div>
                      <p className="mt-0.5 truncate text-xs text-gray-400">
                        {fmtRange(leave.start_date, leave.end_date)} · {daysInclusive(leave.start_date, leave.end_date)} day
                        {daysInclusive(leave.start_date, leave.end_date) === 1 ? '' : 's'}
                        {leave.reason ? ` · ${leave.reason}` : ''}
                      </p>
                    </div>
                  </div>
                  {canEdit && (
                    <div className="flex items-center gap-1 self-end sm:self-auto">
                      <button
                        onClick={() => openEdit(leave)}
                        className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-primary-50 hover:text-primary-600"
                        aria-label="Edit planned leave"
                      >
                        <Pencil size={15} />
                      </button>
                      <button
                        onClick={() => remove(leave)}
                        className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600"
                        aria-label="Delete planned leave"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <Modal open={showModal} onClose={closeModal} title={editing ? 'Edit planned leave' : 'Plan a leave'}>
        <form onSubmit={save} className="space-y-4">
          {isManager && (
            <div>
              <label className="mb-1.5 block text-xs font-medium text-gray-500">Team member</label>
              <select
                value={form.user_id}
                onChange={(e) => setForm({ ...form, user_id: e.target.value })}
                className="input-field"
                required
              >
                <option value="" disabled>Select a team member</option>
                {team.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.name}{member.id === user?.id ? ' (you)' : ''} · {ROLE_LABELS[member.role] || member.role}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-gray-500">From</label>
              <input
                type="date"
                value={form.start_date}
                onChange={(e) => {
                  const start_date = e.target.value;
                  setForm((prev) => ({
                    ...prev,
                    start_date,
                    end_date: prev.end_date && prev.end_date >= start_date ? prev.end_date : start_date,
                  }));
                }}
                className="input-field"
                required
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-gray-500">To</label>
              <input
                type="date"
                value={form.end_date}
                min={form.start_date || undefined}
                onChange={(e) => setForm({ ...form, end_date: e.target.value })}
                className="input-field"
                required
              />
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-gray-500">Leave type</label>
            <select
              value={form.leave_type}
              onChange={(e) => setForm({ ...form, leave_type: e.target.value })}
              className="input-field"
            >
              {Object.entries(LEAVE_TYPES).map(([value, meta]) => (
                <option key={value} value={value}>{meta.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-gray-500">Reason (optional)</label>
            <textarea
              value={form.reason}
              onChange={(e) => setForm({ ...form, reason: e.target.value })}
              rows={3}
              maxLength={300}
              placeholder="e.g. Family function, travel, medical appointment"
              className="input-field resize-none"
            />
          </div>

          <p className="rounded-xl bg-indigo-50/70 px-3 py-2 text-xs text-indigo-700">
            {formDays > 0
              ? `${formDays} day${formDays === 1 ? '' : 's'} will be shown as On Leave in attendance.`
              : 'Choose dates to see how attendance will be marked.'}
          </p>

          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={closeModal} className="btn-secondary text-sm">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary text-sm">
              {saving ? 'Saving...' : editing ? 'Save changes' : 'Plan leave'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
