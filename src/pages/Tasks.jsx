import { useState, useEffect, useCallback } from 'react';
import { Plus, Calendar, User, GripVertical, Pencil, Trash2, Filter } from 'lucide-react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import Modal from '../components/ui/Modal';
import Badge from '../components/ui/Badge';

const COLUMNS = [
  { key: 'queued', label: 'Queued', color: 'bg-gray-100', headerColor: 'bg-gray-500' },
  { key: 'backlog', label: 'Backlog', color: 'bg-red-50', headerColor: 'bg-red-400' },
  { key: 'todo', label: 'To Do', color: 'bg-blue-50', headerColor: 'bg-blue-500' },
  { key: 'in_progress', label: 'In Progress', color: 'bg-amber-50', headerColor: 'bg-amber-500' },
  { key: 'in_review', label: 'In Review', color: 'bg-purple-50', headerColor: 'bg-purple-500' },
  { key: 'done', label: 'Done', color: 'bg-emerald-50', headerColor: 'bg-emerald-500' },
];

const PRIORITY_LABELS = { low: 'Low', medium: 'Medium', high: 'High', urgent: 'Urgent' };

export default function Tasks() {
  const { user } = useAuth();
  const toast = useToast();
  const canManage = user?.role === 'admin' || user?.role === 'manager';

  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState([]);
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ title: '', description: '', assignee_id: '', priority: 'medium', due_date: '' });
  const [saving, setSaving] = useState(false);
  const [draggedTask, setDraggedTask] = useState(null);
  const [viewFilter, setViewFilter] = useState('all');

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const [taskData, userData] = await Promise.all([
        api.tasks.list(),
        canManage ? api.users?.list?.() || Promise.resolve([]) : Promise.resolve([]),
      ]);
      setTasks(taskData);
      if (canManage && Array.isArray(userData)) setUsers(userData);
    } catch (e) {
      toast.error('Failed to load tasks');
    } finally {
      setLoading(false);
    }
  }, [toast, canManage]);

  useEffect(() => { load(); }, [load]);

  const filteredTasks = tasks.filter((t) => {
    if (viewFilter === 'my') return t.assignee_id === user?.id;
    return true;
  });

  function getTasksForColumn(status) {
    return filteredTasks.filter((t) => t.status === status);
  }

  function openCreate() {
    setForm({ title: '', description: '', assignee_id: '', priority: 'medium', due_date: '' });
    setShowCreate(true);
  }

  function openEdit(task) {
    setForm({
      title: task.title,
      description: task.description || '',
      assignee_id: task.assignee_id ? String(task.assignee_id) : '',
      priority: task.priority,
      due_date: task.due_date ? task.due_date.slice(0, 10) : '',
    });
    setEditing(task);
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
    } catch (e) { toast.error(e.message); }
    finally { setSaving(false); }
  }

  async function handleDelete(task) {
    if (!window.confirm(`Delete "${task.title}"?`)) return;
    try {
      await api.tasks.remove(task.id);
      toast.success('Task deleted');
      load();
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
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Tasks</h1>
          <p className="text-sm text-gray-400 mt-0.5">{tasks.length} total tasks</p>
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
          {canManage && (
            <button onClick={openCreate} className="flex items-center gap-2 px-4 py-2.5 bg-primary-600 text-white text-sm font-medium rounded-xl hover:bg-primary-700 transition-colors">
              <Plus size={16} /> New Task
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
        </div>
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-4 min-h-[calc(100vh-220px)]">
          {COLUMNS.map((col) => {
            const colTasks = getTasksForColumn(col.key);
            return (
              <div key={col.key} className="flex-shrink-0 w-72">
                <div className={`flex items-center gap-2 px-3 py-2 rounded-t-xl ${col.color} border-b-2 ${col.headerColor.replace('bg-', 'border-')}`}>
                  <div className={`w-2 h-2 rounded-full ${col.headerColor}`} />
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
                      onClick={() => openEdit(task)}
                      className={`bg-white rounded-xl border border-gray-100 p-3 cursor-grab active:cursor-grabbing hover:shadow-md hover:border-gray-200 transition-all group ${draggedTask?.id === task.id ? 'opacity-50 shadow-lg' : ''}`}
                    >
                      <div className="flex items-start justify-between gap-2 mb-2">
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
                      <div className="flex items-center justify-between gap-2 mt-2">
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
                <option value="">Unassigned</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
                ))}
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
                  <option value="">Unassigned</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
                  ))}
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
    </div>
  );
}
