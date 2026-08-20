import { useState, useEffect, useCallback, useRef } from 'react';
import { Plus, Calendar, Trash2, Search, Tag, MessageSquare, Activity, Send, X } from 'lucide-react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import Modal from '../components/ui/Modal';
import Badge from '../components/ui/Badge';

const COLUMNS = [
  { key: 'queued', label: 'Queued', color: 'bg-gray-100', dot: 'bg-gray-500' },
  { key: 'backlog', label: 'Backlog', color: 'bg-red-50', dot: 'bg-red-400' },
  { key: 'todo', label: 'To Do', color: 'bg-blue-50', dot: 'bg-blue-500' },
  { key: 'in_progress', label: 'In Progress', color: 'bg-amber-50', dot: 'bg-amber-500' },
  { key: 'in_review', label: 'In Review', color: 'bg-purple-50', dot: 'bg-purple-500' },
  { key: 'done', label: 'Done', color: 'bg-emerald-50', dot: 'bg-emerald-500' },
];

const PRIORITY_LABELS = { low: 'Low', medium: 'Medium', high: 'High', urgent: 'Urgent' };

function timeAgo(date) {
  const secs = Math.floor((Date.now() - new Date(date)) / 1000);
  if (secs < 60) return 'just now';
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`;
  return `${Math.floor(secs / 86400)}d ago`;
}

const ACTIVITY_ICONS = {
  created: '➕',
  edited: '✏️',
  moved: '➡️',
  commented: '💬',
  label_updated: '🏷️',
};

export default function Tasks() {
  const { user } = useAuth();
  const toast = useToast();
  const canManage = user?.role === 'admin' || user?.role === 'manager';

  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState([]);
  const [allLabels, setAllLabels] = useState([]);
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ title: '', description: '', assignee_id: '', priority: 'medium', due_date: '' });
  const [saving, setSaving] = useState(false);
  const [draggedTask, setDraggedTask] = useState(null);

  const [search, setSearch] = useState('');
  const [filterPriority, setFilterPriority] = useState('');
  const [filterAssignee, setFilterAssignee] = useState('');
  const [viewFilter, setViewFilter] = useState('all');

  const [detail, setDetail] = useState(null);
  const [comments, setComments] = useState([]);
  const [activities, setActivities] = useState([]);
  const [commentText, setCommentText] = useState('');
  const [sendingComment, setSendingComment] = useState(false);
  const [detailTab, setDetailTab] = useState('comments');
  const [detailLabels, setDetailLabels] = useState([]);
  const commentsEnd = useRef(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const [taskData, userData, labelData] = await Promise.all([
        api.tasks.list(),
        api.users?.listSimple?.() || Promise.resolve([]),
        api.taskLabels.list(),
      ]);
      setTasks(taskData);
      if (Array.isArray(userData)) setUsers(userData);
      setAllLabels(labelData);
    } catch (e) {
      toast.error('Failed to load tasks');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  const filteredTasks = tasks.filter((t) => {
    if (viewFilter === 'my' && t.assignee_id !== user?.id) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      if (!(t.title || '').toLowerCase().includes(q) && !(t.description || '').toLowerCase().includes(q)) return false;
    }
    if (filterPriority && t.priority !== filterPriority) return false;
    if (filterAssignee && String(t.assignee_id) !== filterAssignee) return false;
    return true;
  });

  function getTasksForColumn(status) {
    return filteredTasks.filter((t) => t.status === status);
  }

  function openCreate() {
    setForm({ title: '', description: '', assignee_id: '', priority: 'medium', due_date: '' });
    setShowCreate(true);
  }

  async function openDetail(task) {
    setDetail(task);
    setDetailTab('comments');
    setDetailLabels(task.labels || []);
    setCommentText('');
    try {
      const [c, a] = await Promise.all([api.tasks.comments(task.id), api.tasks.activities(task.id)]);
      setComments(c);
      setActivities(a);
    } catch (e) { toast.error('Failed to load task details'); }
  }

  async function handleCreate(e) {
    e.preventDefault();
    if (!form.title.trim()) { toast.error('Title is required'); return; }
    setSaving(true);
    try {
      await api.tasks.create({
        title: form.title.trim(),
        description: form.description.trim() || null,
        assignee_id: form.assignee_id ? parseInt(form.assignee_id) : null,
        priority: form.priority,
        due_date: form.due_date || null,
      });
      toast.success('Task created');
      setShowCreate(false);
      load();
    } catch (e) { toast.error(e.message); }
    finally { setSaving(false); }
  }

  async function handleEdit(e) {
    e.preventDefault();
    if (!form.title.trim()) { toast.error('Title is required'); return; }
    setSaving(true);
    try {
      await api.tasks.update(editing.id, {
        title: form.title.trim(),
        description: form.description.trim() || null,
        assignee_id: form.assignee_id ? parseInt(form.assignee_id) : null,
        priority: form.priority,
        due_date: form.due_date || null,
      });
      toast.success('Task updated');
      setEditing(null);
      load();
      if (detail?.id === editing.id) openDetail({ ...detail, ...form });
    } catch (e) { toast.error(e.message); }
    finally { setSaving(false); }
  }

  async function handleDelete(task) {
    if (!window.confirm(`Delete "${task.title}"?`)) return;
    try {
      await api.tasks.remove(task.id);
      toast.success('Task deleted');
      if (detail?.id === task.id) setDetail(null);
      load();
    } catch (e) { toast.error(e.message); }
  }

  async function handleSendComment() {
    if (!commentText.trim()) return;
    setSendingComment(true);
    try {
      const c = await api.tasks.addComment(detail.id, commentText.trim());
      setComments((prev) => [...prev, c]);
      setCommentText('');
      setTimeout(() => commentsEnd.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    } catch (e) { toast.error(e.message); }
    finally { setSendingComment(false); }
  }

  async function handleToggleLabel(labelId) {
    const current = detailLabels.map((l) => l.id);
    const next = current.includes(labelId) ? current.filter((id) => id !== labelId) : [...current, labelId];
    try {
      await api.tasks.updateLabels(detail.id, next);
      const updated = allLabels.filter((l) => next.includes(l.id));
      setDetailLabels(updated);
      setTasks((prev) => prev.map((t) => t.id === detail.id ? { ...t, labels: updated } : t));
    } catch (e) { toast.error(e.message); }
  }

  function handleDragStart(e, task) {
    setDraggedTask(task);
    e.dataTransfer.effectAllowed = 'move';
  }

  function handleDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }

  async function handleDrop(e, newStatus) {
    e.preventDefault();
    if (!draggedTask || draggedTask.status === newStatus) { setDraggedTask(null); return; }
    try {
      await api.tasks.updateStatus(draggedTask.id, newStatus);
      setTasks((prev) => prev.map((t) => t.id === draggedTask.id ? { ...t, status: newStatus } : t));
    } catch (err) { toast.error(err.message); }
    setDraggedTask(null);
  }

  function isOverdue(dueDate) {
    if (!dueDate) return false;
    return new Date(dueDate) < new Date(new Date().toDateString());
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Kanban</h1>
          <p className="text-sm text-gray-400 mt-0.5">{filteredTasks.length} tasks{search || filterPriority || filterAssignee ? ' (filtered)' : ''}</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-gray-100 rounded-xl p-0.5">
            <button onClick={() => setViewFilter('all')}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${viewFilter === 'all' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
              All
            </button>
            <button onClick={() => setViewFilter('my')}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${viewFilter === 'my' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
              My Tasks
            </button>
          </div>
          <button onClick={openCreate} className="flex items-center gap-2 px-4 py-2.5 bg-primary-600 text-white text-sm font-medium rounded-xl hover:bg-primary-700 transition-colors">
            <Plus size={16} /> New Task
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input className="input-field pl-9 py-2 text-sm" placeholder="Search tasks..."
            value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <select className="input-field py-2 text-sm w-36" value={filterPriority} onChange={(e) => setFilterPriority(e.target.value)}>
          <option value="">All Priority</option>
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
          <option value="urgent">Urgent</option>
        </select>
        {users.length > 0 && (
          <select className="input-field py-2 text-sm w-40" value={filterAssignee} onChange={(e) => setFilterAssignee(e.target.value)}>
            <option value="">All Assignees</option>
            {users.map((u) => (<option key={u.id} value={u.id}>{u.name}</option>))}
          </select>
        )}
        {(search || filterPriority || filterAssignee) && (
          <button onClick={() => { setSearch(''); setFilterPriority(''); setFilterAssignee(''); }}
            className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1">
            <X size={12} /> Clear
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
        </div>
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-4 min-h-[calc(100vh-260px)]">
          {COLUMNS.map((col) => {
            const colTasks = getTasksForColumn(col.key);
            return (
              <div key={col.key} className="flex-shrink-0 w-72">
                <div className={`flex items-center gap-2 px-3 py-2 rounded-t-xl ${col.color} border-b-2 ${col.dot.replace('bg-', 'border-')}`}>
                  <div className={`w-2 h-2 rounded-full ${col.dot}`} />
                  <h3 className="text-sm font-semibold text-gray-700">{col.label}</h3>
                  <span className="text-xs font-medium text-gray-500 bg-white/60 px-1.5 py-0.5 rounded-md">{colTasks.length}</span>
                </div>
                <div
                  className={`min-h-[200px] rounded-b-xl p-2 space-y-2 transition-colors ${draggedTask ? 'border-2 border-dashed border-gray-300 hover:border-primary-400 hover:bg-primary-50/30' : ''}`}
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDrop(e, col.key)}
                >
                  {colTasks.map((task) => (
                    <div
                      key={task.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, task)}
                      onClick={() => openDetail(task)}
                      className={`bg-white rounded-xl border border-gray-100 p-3 cursor-grab active:cursor-grabbing hover:shadow-md hover:border-gray-200 transition-all group ${draggedTask?.id === task.id ? 'opacity-50 shadow-lg' : ''}`}
                    >
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <h4 className="text-sm font-medium text-gray-900 flex-1 min-w-0">{task.title}</h4>
                        {canManage && (
                          <button onClick={(ev) => { ev.stopPropagation(); handleDelete(task); }}
                            className="p-1 text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all shrink-0"
                            title="Delete task">
                            <Trash2 size={13} />
                          </button>
                        )}
                      </div>
                      {task.description && (
                        <p className="text-xs text-gray-500 mb-2 line-clamp-2">{task.description}</p>
                      )}
                      {task.labels && task.labels.length > 0 && (
                        <div className="flex flex-wrap gap-1 mb-2">
                          {task.labels.map((l) => (
                            <span key={l.id} className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium text-white"
                              style={{ backgroundColor: l.color }}>
                              {l.name}
                            </span>
                          ))}
                        </div>
                      )}
                      <div className="flex items-center justify-between gap-2">
                        <Badge status={task.priority}>{PRIORITY_LABELS[task.priority]}</Badge>
                        {task.due_date && (
                          <span className={`text-xs flex items-center gap-1 ${isOverdue(task.due_date) && task.status !== 'done' ? 'text-red-500 font-medium' : 'text-gray-400'}`}>
                            <Calendar size={11} />
                            {new Date(task.due_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                          </span>
                        )}
                      </div>
                      {task.assignee_name && (
                        <div className="flex items-center gap-1.5 mt-2 pt-2 border-t border-gray-50">
                          <div className="w-5 h-5 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center text-[10px] font-bold shrink-0">
                            {task.assignee_name.charAt(0).toUpperCase()}
                          </div>
                          <span className="text-xs text-gray-500 truncate">{task.assignee_name}</span>
                        </div>
                      )}
                    </div>
                  ))}
                  {colTasks.length === 0 && (
                    <div className="text-center py-8 text-gray-300 text-xs">
                      {draggedTask ? 'Drop here' : 'No tasks'}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create Task Modal */}
      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="New Task" size="md">
        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Title *</label>
            <input className="input-field" placeholder="What needs to be done?"
              value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Description</label>
            <textarea className="input-field min-h-[80px]" placeholder="Add details..."
              value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Assign to</label>
              <select className="input-field" value={form.assignee_id} onChange={(e) => setForm({ ...form, assignee_id: e.target.value })}>
                <option value="">{user?.role === 'sales' ? 'Assign to myself' : 'Unassigned'}</option>
                {users.map((u) => (<option key={u.id} value={u.id}>{u.name} ({u.role})</option>))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Priority</label>
              <select className="input-field" value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Due date</label>
            <input type="date" className="input-field" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} />
          </div>
          <div className="flex justify-end gap-3 pt-2 border-t">
            <button type="button" onClick={() => setShowCreate(false)} className="btn-secondary">Cancel</button>
            <button type="submit" className="btn-primary px-6" disabled={saving}>
              {saving ? 'Creating...' : 'Create Task'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Edit Task Modal */}
      <Modal open={!!editing} onClose={() => setEditing(null)} title="Edit Task" size="md">
        {editing && (
          <form onSubmit={handleEdit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Title *</label>
              <input className="input-field" value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })} required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Description</label>
              <textarea className="input-field min-h-[80px]"
                value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Assign to</label>
                <select className="input-field" value={form.assignee_id} onChange={(e) => setForm({ ...form, assignee_id: e.target.value })}>
                  <option value="">{user?.role === 'sales' ? 'Assign to myself' : 'Unassigned'}</option>
                  {users.map((u) => (<option key={u.id} value={u.id}>{u.name} ({u.role})</option>))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Priority</label>
                <select className="input-field" value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Due date</label>
              <input type="date" className="input-field" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} />
            </div>
            <div className="flex justify-end gap-3 pt-2 border-t">
              <button type="button" onClick={() => setEditing(null)} className="btn-secondary">Cancel</button>
              <button type="submit" className="btn-primary px-6" disabled={saving}>
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </form>
        )}
      </Modal>

      {/* Task Detail Modal */}
      <Modal open={!!detail} onClose={() => setDetail(null)} title="" size="lg">
        {detail && (
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-bold text-gray-900">{detail.title}</h3>
              <div className="flex flex-wrap items-center gap-2 mt-2">
                <Badge status={detail.priority}>{PRIORITY_LABELS[detail.priority]}</Badge>
                <span className="text-xs text-gray-400">•</span>
                <span className="text-xs text-gray-500">{detail.assignee_name || 'Unassigned'}</span>
                {detail.due_date && (
                  <>
                    <span className="text-xs text-gray-400">•</span>
                    <span className={`text-xs flex items-center gap-1 ${isOverdue(detail.due_date) && detail.status !== 'done' ? 'text-red-500' : 'text-gray-500'}`}>
                      <Calendar size={11} />
                      Due {new Date(detail.due_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </span>
                  </>
                )}
              </div>
              {detail.description && (
                <p className="text-sm text-gray-600 mt-2 whitespace-pre-wrap">{detail.description}</p>
              )}
            </div>

            <div>
              <div className="flex items-center gap-1.5 mb-2">
                <Tag size={13} className="text-gray-400" />
                <span className="text-xs font-medium text-gray-500">Labels</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {allLabels.map((l) => {
                  const active = detailLabels.some((dl) => dl.id === l.id);
                  return (
                    <button key={l.id} onClick={() => handleToggleLabel(l)}
                      className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium transition-all border ${
                        active ? 'text-white border-transparent shadow-sm' : 'text-gray-500 border-gray-200 hover:border-gray-300 bg-white'
                      }`}
                      style={active ? { backgroundColor: l.color } : {}}>
                      {l.name}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="border-t pt-1">
              <div className="flex items-center gap-1 bg-gray-100 rounded-xl p-0.5 mb-3">
                <button onClick={() => setDetailTab('comments')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                    detailTab === 'comments' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                  }`}>
                  <MessageSquare size={13} /> Comments ({comments.length})
                </button>
                <button onClick={() => setDetailTab('activity')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                    detailTab === 'activity' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                  }`}>
                  <Activity size={13} /> Activity
                </button>
              </div>

              {detailTab === 'comments' && (
                <div>
                  <div className="max-h-64 overflow-y-auto space-y-3 mb-3">
                    {comments.length === 0 && (
                      <p className="text-xs text-gray-400 text-center py-4">No comments yet</p>
                    )}
                    {comments.map((c) => (
                      <div key={c.id} className="flex gap-2.5">
                        <div className="w-7 h-7 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">
                          {c.user_name?.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-gray-900">{c.user_name}</span>
                            <span className="text-[10px] text-gray-400">{timeAgo(c.created_at)}</span>
                          </div>
                          <p className="text-sm text-gray-600 mt-0.5 whitespace-pre-wrap">{c.body}</p>
                        </div>
                      </div>
                    ))}
                    <div ref={commentsEnd} />
                  </div>
                  <div className="flex gap-2">
                    <input className="input-field flex-1 py-2 text-sm" placeholder="Write a comment..."
                      value={commentText} onChange={(e) => setCommentText(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendComment(); } }} />
                    <button onClick={handleSendComment} disabled={sendingComment || !commentText.trim()}
                      className="p-2 rounded-xl bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-40 transition-colors shrink-0">
                      <Send size={16} />
                    </button>
                  </div>
                </div>
              )}

              {detailTab === 'activity' && (
                <div className="max-h-64 overflow-y-auto space-y-2.5">
                  {activities.length === 0 && (
                    <p className="text-xs text-gray-400 text-center py-4">No activity yet</p>
                  )}
                  {activities.map((a) => (
                    <div key={a.id} className="flex items-start gap-2.5">
                      <span className="text-sm shrink-0 mt-0.5">{ACTIVITY_ICONS[a.action] || '📋'}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-600">
                          <span className="font-medium text-gray-900">{a.user_name}</span>{' '}
                          {a.details}
                        </p>
                        <span className="text-[10px] text-gray-400">{timeAgo(a.created_at)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t">
              {canManage && (
                <button onClick={() => { setEditing(detail); setForm({
                  title: detail.title, description: detail.description || '',
                  assignee_id: detail.assignee_id ? String(detail.assignee_id) : '',
                  priority: detail.priority, due_date: detail.due_date ? detail.due_date.slice(0, 10) : '',
                }); setDetail(null); }}
                  className="btn-secondary text-sm flex items-center gap-1.5">
                  ✏️ Edit
                </button>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
