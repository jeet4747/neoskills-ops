import { useState, useEffect } from 'react';
import {
  Building2, Briefcase, FileSearch, UserCheck, Send, Users, Layers,
  Plus, X, ExternalLink, Trash2, Search, Filter,
} from 'lucide-react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { Card, CardHeader, CardBody } from '../components/ui/Card';
import Modal from '../components/ui/Modal';
import { GradientStatsCard } from '../components/ui/StatsCard';

const OPENING_STATUS = [
  { value: 'open', label: 'Open', color: 'bg-emerald-50 text-emerald-600' },
  { value: 'on_hold', label: 'On Hold', color: 'bg-amber-50 text-amber-600' },
  { value: 'filled', label: 'Filled', color: 'bg-blue-50 text-blue-600' },
  { value: 'closed', label: 'Closed', color: 'bg-gray-100 text-gray-500' },
];

const CANDIDATE_STATUS = {
  applied: { label: 'Applied', color: 'bg-gray-100 text-gray-600' },
  screening: { label: 'Screening', color: 'bg-amber-50 text-amber-600' },
  shortlisted: { label: 'Shortlisted', color: 'bg-blue-50 text-blue-600' },
  forwarded: { label: 'Forwarded', color: 'bg-emerald-50 text-emerald-600' },
  rejected: { label: 'Rejected', color: 'bg-red-50 text-red-600' },
  hired: { label: 'Hired', color: 'bg-purple-50 text-purple-600' },
};

const TABS = ['companies', 'openings', 'candidates'];

const inputCls = 'input-field text-sm';
const labelCls = 'block text-sm font-medium text-gray-700 mb-1.5';

function fmtDate(t) {
  if (!t) return '—';
  const d = new Date(t);
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
}

export default function Hiring() {
  const { user } = useAuth();
  const toast = useToast();
  const isHr = user?.role === 'hr';
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('companies');
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  const [showAddCompany, setShowAddCompany] = useState(false);
  const [showAddOpening, setShowAddOpening] = useState(false);
  const [showAddCandidate, setShowAddCandidate] = useState(false);
  const [saving, setSaving] = useState(false);

  const [companyForm, setCompanyForm] = useState({ name: '', contact_person: '', email: '', phone: '' });
  const [openingForm, setOpeningForm] = useState({ company_id: '', title: '', location: '', experience: '', salary: '', skills: '', openings_count: 1 });
  const [candidateForm, setCandidateForm] = useState({ name: '', email: '', phone: '', resume_url: '', opening_id: '', source: '', status: 'applied', screening_note: '' });

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try { setData(await api.hiring.overview()); }
    catch (e) { toast.error(e.message); }
    finally { setLoading(false); }
  }

  async function submitCompany() {
    if (!companyForm.name.trim()) return toast.error('Company name required');
    setSaving(true);
    try {
      await api.hiring.createCompany(companyForm);
      toast.success('Company added');
      setShowAddCompany(false);
      setCompanyForm({ name: '', contact_person: '', email: '', phone: '' });
      await load();
    } catch (e) { toast.error(e.message); }
    finally { setSaving(false); }
  }

  async function submitOpening() {
    if (!openingForm.company_id || !openingForm.title.trim()) return toast.error('Company and job title required');
    setSaving(true);
    try {
      await api.hiring.createOpening(openingForm);
      toast.success('Opening added');
      setShowAddOpening(false);
      setOpeningForm({ company_id: '', title: '', location: '', experience: '', salary: '', skills: '', openings_count: 1 });
      await load();
    } catch (e) { toast.error(e.message); }
    finally { setSaving(false); }
  }

  async function submitCandidate() {
    if (!candidateForm.name.trim()) return toast.error('Candidate name required');
    setSaving(true);
    try {
      await api.hiring.createCandidate(candidateForm);
      toast.success('Candidate added');
      setShowAddCandidate(false);
      setCandidateForm({ name: '', email: '', phone: '', resume_url: '', opening_id: '', source: '', status: 'applied', screening_note: '' });
      await load();
    } catch (e) { toast.error(e.message); }
    finally { setSaving(false); }
  }

  async function updateCandidate(c, patch) {
    try {
      await api.hiring.updateCandidate(c.id, patch);
      await load();
    } catch (e) { toast.error(e.message); }
  }

  async function forwardCandidate(c) {
    try {
      await api.hiring.forwardCandidate(c.id);
      toast.success(`${c.name} forwarded to ${c.company_name || 'company'}`);
      await load();
    } catch (e) { toast.error(e.message); }
  }

  async function removeCandidate(c) {
    if (!window.confirm(`Delete candidate ${c.name}?`)) return;
    try {
      await api.hiring.removeCandidate(c.id);
      toast.success('Candidate removed');
      await load();
    } catch (e) { toast.error(e.message); }
  }

  async function setOpeningStatus(o, status) {
    try {
      await api.hiring.updateOpeningStatus(o.id, status);
      await load();
    } catch (e) { toast.error(e.message); }
  }

  if (loading || !data) {
    return <div className="space-y-4">{[1,2,3,4].map((i) => <div key={i} className="h-24 skeleton w-full" />)}</div>;
  }

  const { companies, openings, candidates, stats } = data;

  const filteredOpenings = openings.filter((o) =>
    (!filterStatus || o.status === filterStatus) &&
    (!search || `${o.title} ${o.company_name}`.toLowerCase().includes(search.toLowerCase()))
  );
  const filteredCandidates = candidates.filter((c) =>
    (!filterStatus || c.status === filterStatus) &&
    (!search || `${c.name} ${c.email} ${c.opening_title} ${c.company_name}`.toLowerCase().includes(search.toLowerCase()))
  );

  const selectInput =
    <select className={inputCls} value={openingForm.company_id} onChange={(e) => setOpeningForm({ ...openingForm, company_id: e.target.value })}>
      <option value="">Select company</option>
      {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
    </select>;

  const candidateOpeningSelect =
    <select className={inputCls} value={candidateForm.opening_id} onChange={(e) => setCandidateForm({ ...candidateForm, opening_id: e.target.value, company_id: '' })}>
      <option value="">Select opening</option>
      {openings.filter((o) => o.status !== 'closed').map((o) => <option key={o.id} value={o.id}>{o.title} · {o.company_name}</option>)}
    </select>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Hiring</h1>
          <p className="text-sm text-gray-400 mt-0.5">Hiring partner · companies, openings, resume screening & forwarding</p>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
        <GradientStatsCard icon={Building2} label="Companies" value={stats.companies} color="primary" />
        <GradientStatsCard icon={Briefcase} label="Open Openings" value={stats.open_openings} color="blue" />
        <GradientStatsCard icon={FileSearch} label="In Screening" value={stats.screening} color="amber" />
        <GradientStatsCard icon={Send} label="Forwarded" value={stats.forwarded} color="emerald" />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-blue-50 rounded-xl p-4 border border-blue-100">
          <p className="text-[11px] text-blue-500 flex items-center gap-1"><Layers size={12} /> Total Openings</p>
          <p className="text-xl font-bold text-blue-700">{stats.total_openings}</p>
        </div>
        <div className="bg-purple-50 rounded-xl p-4 border border-purple-100">
          <p className="text-[11px] text-purple-500 flex items-center gap-1"><UserCheck size={12} /> Shortlisted</p>
          <p className="text-xl font-bold text-purple-700">{stats.shortlisted}</p>
        </div>
        <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
          <p className="text-[11px] text-gray-400 flex items-center gap-1"><Users size={12} /> Candidates</p>
          <p className="text-xl font-bold text-gray-700">{stats.candidates}</p>
        </div>
        <div className="bg-emerald-50 rounded-xl p-4 border border-emerald-100">
          <p className="text-[11px] text-emerald-500 flex items-center gap-1"><FileSearch size={12} /> Hired</p>
          <p className="text-xl font-bold text-emerald-700">{stats.hired}</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between w-full flex-wrap gap-3">
            <div className="flex items-center gap-2">
              <Search size={16} className="text-gray-400" />
              <input className="input-field text-sm w-48" placeholder="Search..." value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <div className="flex items-center gap-2">
              <div className="flex rounded-xl border border-gray-200 p-1 bg-gray-50">
                {TABS.map((t) => (
                  <button key={t} onClick={() => setTab(t)}
                    className={`px-4 py-1.5 rounded-lg text-xs font-semibold capitalize transition-all ${tab === t ? 'bg-white shadow-sm text-primary-700' : 'text-gray-500 hover:text-gray-700'}`}>
                    {t}
                  </button>
                ))}
              </div>
              {tab === 'companies' && (
                <button onClick={() => setShowAddCompany(true)} className="btn-primary flex items-center gap-1.5 text-xs px-3 py-2">
                  <Plus size={14} /> Company
                </button>
              )}
              {tab === 'openings' && companies.length > 0 && (
                <button onClick={() => setShowAddOpening(true)} className="btn-primary flex items-center gap-1.5 text-xs px-3 py-2">
                  <Plus size={14} /> Opening
                </button>
              )}
              {tab === 'candidates' && openings.filter((o) => o.status !== 'closed').length > 0 && (
                <button onClick={() => setShowAddCandidate(true)} className="btn-primary flex items-center gap-1.5 text-xs px-3 py-2">
                  <Plus size={14} /> Candidate
                </button>
              )}
            </div>
          </div>
        </CardHeader>

        <CardBody className="p-5">
          {tab === 'companies' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {companies.map((c) => (
                <div key={c.id} className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="w-10 h-10 rounded-xl bg-primary-100 text-primary-700 flex items-center justify-center font-bold shrink-0">
                        {c.name?.charAt(0).toUpperCase()}
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-gray-900 truncate">{c.name}</p>
                        {c.contact_person && <p className="text-xs text-gray-400 truncate">{c.contact_person}</p>}
                      </div>
                    </div>
                  </div>
                  <div className="mt-3 flex items-center justify-between text-xs">
                    <span className="text-gray-400">{c.openings} opening{c.openings !== 1 ? 's' : ''}</span>
                    {(c.email || c.phone) && <span className="text-gray-500 truncate max-w-[180px]">{c.email || c.phone}</span>}
                  </div>
                </div>
              ))}
              {companies.length === 0 && <p className="text-sm text-gray-400 text-center col-span-full py-8">No companies yet. Add your first hiring partner company.</p>}
            </div>
          )}

          {tab === 'openings' && (
            <div className="space-y-3">
              {filteredOpenings.map((o) => (
                <div key={o.id} className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0"><Briefcase size={16} /></span>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-900">{o.title}</p>
                      <p className="text-xs text-gray-400 truncate">{o.company_name}{o.location ? ` · ${o.location}` : ''}{o.experience ? ` · ${o.experience}` : ''}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {o.salary && <span className="text-xs text-gray-500">{o.salary}</span>}
                    <span className="text-xs text-gray-400">{o.openings_count} position{o.openings_count !== 1 ? 's' : ''}</span>
                    <select className="text-xs rounded-lg border border-gray-200 py-1 px-2"
                      value={o.status}
                      onChange={(e) => setOpeningStatus(o, e.target.value)}>
                      {OPENING_STATUS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                    </select>
                  </div>
                </div>
              ))}
              {filteredOpenings.length === 0 && <p className="text-sm text-gray-400 text-center py-8">No openings found.</p>}
            </div>
          )}

          {tab === 'candidates' && (() => {
            const show = filteredCandidates;
            const stages = ['applied', 'screening', 'shortlisted', 'forwarded', 'rejected', 'hired'];
            return (
              <div className="space-y-3">
                {(isHr) && (
                  <div className="flex flex-wrap gap-2 mb-1">
                    <select className="text-xs rounded-lg border border-gray-200 py-1.5 px-2" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
                      <option value="">All statuses</option>
                      {stages.map((s) => <option key={s} value={s}>{CANDIDATE_STATUS[s].label}</option>)}
                    </select>
                  </div>
                )}
                {show.map((c) => {
                  const meta = CANDIDATE_STATUS[c.status] || CANDIDATE_STATUS.applied;
                  return (
                    <div key={c.id} className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="w-9 h-9 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center font-bold shrink-0">
                            {c.name?.charAt(0).toUpperCase()}
                          </span>
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-gray-900">{c.name}</p>
                            <p className="text-xs text-gray-400 truncate">
                              {c.email}{c.phone ? ` · ${c.phone}` : ''}
                            </p>
                            <p className="text-[10px] text-gray-400 mt-0.5">
                              {c.opening_title || 'No opening'} {c.company_name ? `→ ${c.company_name}` : ''}
                              {c.source ? ` · ${c.source}` : ''}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-semibold ${meta.color}`}>{meta.label}</span>
                          <span className="text-[10px] text-gray-400">{fmtDate(c.forwarded_at || c.created_at)}</span>
                        </div>
                      </div>
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <select className="text-xs rounded-lg border border-gray-200 py-1.5 px-2"
                          value={c.status} onChange={(e) => updateCandidate(c, { status: e.target.value })}>
                          {stages.map((s) => <option key={s} value={s}>{CANDIDATE_STATUS[s].label}</option>)}
                        </select>
                        {c.status !== 'forwarded' && c.status !== 'hired' && c.status !== 'rejected' && (
                          <button onClick={() => forwardCandidate(c)}
                            className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors">
                            <Send size={12} /> Forward
                          </button>
                        )}
                        {c.resume_url && (
                          <a href={c.resume_url} target="_blank" rel="noreferrer"
                            className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-gray-50 text-gray-600 hover:bg-gray-100 transition-colors">
                            <ExternalLink size={12} /> Resume
                          </a>
                        )}
                        <button onClick={() => removeCandidate(c)} className="p-1.5 text-gray-300 hover:text-red-500 rounded-lg hover:bg-red-50 transition-colors" aria-label="Delete candidate">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  );
                })}
                {show.length === 0 && <p className="text-sm text-gray-400 text-center py-8">No candidates found.</p>}
              </div>
            );
          })()}
        </CardBody>
      </Card>

      <Modal open={showAddCompany} onClose={() => setShowAddCompany(false)} title="Add Company">
        <div className="space-y-4">
          <div>
            <label className={labelCls}>Company Name *</label>
            <input className={inputCls} placeholder="e.g. TechMahindra" value={companyForm.name}
              onChange={(e) => setCompanyForm({ ...companyForm, name: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Contact Person</label>
              <input className={inputCls} placeholder="HR name" value={companyForm.contact_person}
                onChange={(e) => setCompanyForm({ ...companyForm, contact_person: e.target.value })} />
            </div>
            <div>
              <label className={labelCls}>Email</label>
              <input className={inputCls} placeholder="hr@company.com" value={companyForm.email}
                onChange={(e) => setCompanyForm({ ...companyForm, email: e.target.value })} />
            </div>
          </div>
          <div>
            <label className={labelCls}>Phone</label>
            <input className={inputCls} placeholder="Phone" value={companyForm.phone}
              onChange={(e) => setCompanyForm({ ...companyForm, phone: e.target.value })} />
          </div>
          <div className="flex justify-end gap-3 pt-2 border-t">
            <button onClick={() => setShowAddCompany(false)} className="btn-secondary">Cancel</button>
            <button onClick={submitCompany} className="btn-primary px-6" disabled={saving || !companyForm.name.trim()}>
              {saving ? 'Saving...' : 'Add Company'}
            </button>
          </div>
        </div>
      </Modal>

      <Modal open={showAddOpening} onClose={() => setShowAddOpening(false)} title="Add Opening">
        <div className="space-y-4">
          <div>
            <label className={labelCls}>Company *</label>
            {selectInput}
          </div>
          <div>
            <label className={labelCls}>Job Title *</label>
            <input className={inputCls} placeholder="e.g. Business Development Executive" value={openingForm.title}
              onChange={(e) => setOpeningForm({ ...openingForm, title: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Location</label>
              <input className={inputCls} placeholder="e.g. Pune" value={openingForm.location}
                onChange={(e) => setOpeningForm({ ...openingForm, location: e.target.value })} />
            </div>
            <div>
              <label className={labelCls}>Experience</label>
              <input className={inputCls} placeholder="e.g. 0-2 yrs" value={openingForm.experience}
                onChange={(e) => setOpeningForm({ ...openingForm, experience: e.target.value })} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Salary</label>
              <input className={inputCls} placeholder="e.g. ₹3LPA" value={openingForm.salary}
                onChange={(e) => setOpeningForm({ ...openingForm, salary: e.target.value })} />
            </div>
            <div>
              <label className={labelCls}>Openings</label>
              <input type="number" min="1" className={inputCls} value={openingForm.openings_count}
                onChange={(e) => setOpeningForm({ ...openingForm, openings_count: parseInt(e.target.value) || 1 })} />
            </div>
          </div>
          <div>
            <label className={labelCls}>Skills</label>
            <input className={inputCls} placeholder="e.g. sales, communication, English" value={openingForm.skills}
              onChange={(e) => setOpeningForm({ ...openingForm, skills: e.target.value })} />
          </div>
          <div className="flex justify-end gap-3 pt-2 border-t">
            <button onClick={() => setShowAddOpening(false)} className="btn-secondary">Cancel</button>
            <button onClick={submitOpening} className="btn-primary px-6" disabled={saving || !openingForm.company_id || !openingForm.title.trim()}>
              {saving ? 'Saving...' : 'Add Opening'}
            </button>
          </div>
        </div>
      </Modal>

      <Modal open={showAddCandidate} onClose={() => setShowAddCandidate(false)} title="Add Candidate">
        <div className="space-y-4">
          <div>
            <label className={labelCls}>Candidate Name *</label>
            <input className={inputCls} placeholder="Full name" value={candidateForm.name}
              onChange={(e) => setCandidateForm({ ...candidateForm, name: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Email</label>
              <input className={inputCls} placeholder="candidate@email.com" value={candidateForm.email}
                onChange={(e) => setCandidateForm({ ...candidateForm, email: e.target.value })} />
            </div>
            <div>
              <label className={labelCls}>Phone</label>
              <input className={inputCls} placeholder="Phone" value={candidateForm.phone}
                onChange={(e) => setCandidateForm({ ...candidateForm, phone: e.target.value })} />
            </div>
          </div>
          <div>
            <label className={labelCls}>Opening</label>
            {candidateOpeningSelect}
          </div>
          <div>
            <label className={labelCls}>Resume URL</label>
            <input className={inputCls} placeholder="https://..." value={candidateForm.resume_url}
              onChange={(e) => setCandidateForm({ ...candidateForm, resume_url: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Source</label>
              <input className={inputCls} placeholder="e.g. LinkedIn" value={candidateForm.source}
                onChange={(e) => setCandidateForm({ ...candidateForm, source: e.target.value })} />
            </div>
            <div>
              <label className={labelCls}>Status</label>
              <select className={inputCls} value={candidateForm.status}
                onChange={(e) => setCandidateForm({ ...candidateForm, status: e.target.value })}>
                {Object.keys(CANDIDATE_STATUS).map((s) => <option key={s} value={s}>{CANDIDATE_STATUS[s].label}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className={labelCls}>Screening Note</label>
            <textarea className={inputCls} rows={2} placeholder="Notes" value={candidateForm.screening_note}
              onChange={(e) => setCandidateForm({ ...candidateForm, screening_note: e.target.value })} />
          </div>
          <div className="flex justify-end gap-3 pt-2 border-t">
            <button onClick={() => setShowAddCandidate(false)} className="btn-secondary">Cancel</button>
            <button onClick={submitCandidate} className="btn-primary px-6" disabled={saving || !candidateForm.name.trim()}>
              {saving ? 'Saving...' : 'Add Candidate'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}