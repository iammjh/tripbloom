import React, { useEffect, useState } from 'react';
import { LuCalendarDays, LuMegaphone, LuPencil, LuPlus, LuToggleLeft, LuToggleRight, LuTrash2, LuUsers } from 'react-icons/lu';
import axios from 'axios';
import Badge from './ui/Badge.jsx';
import Button from './ui/Button.jsx';
import EmptyState from './ui/EmptyState.jsx';
import ErrorState from './ui/ErrorState.jsx';
import FormField, { inputClass } from './ui/FormField.jsx';
import IconButton from './ui/IconButton.jsx';
import Modal from './ui/Modal.jsx';
import Skeleton from './ui/Skeleton.jsx';
import { AdminPageHeader } from './admin/AdminPrimitives.jsx';
import { confirmAction } from '../utils/confirmStore.js';
import { notify } from '../utils/notifyStore.js';

const TYPES = [
  { value: 'INFO', label: 'Info', tone: 'info' },
  { value: 'WARNING', label: 'Warning', tone: 'warning' },
  { value: 'SUCCESS', label: 'Success', tone: 'success' },
  { value: 'ERROR', label: 'Error', tone: 'danger' },
  { value: 'MAINTENANCE', label: 'Maintenance', tone: 'neutral' },
];
const PRIORITIES = [
  { value: 'LOW', label: 'Low', tone: 'neutral' },
  { value: 'MEDIUM', label: 'Medium', tone: 'info' },
  { value: 'HIGH', label: 'High', tone: 'warning' },
  { value: 'URGENT', label: 'Urgent', tone: 'danger' },
];
const AUDIENCES = [
  { value: 'ALL', label: 'Everyone' },
  { value: 'CUSTOMERS', label: 'Customers' },
  { value: 'OPERATORS', label: 'Tour operators' },
  { value: 'ADMINS', label: 'Administrators' },
];

const EMPTY_FORM = {
  title: '',
  message: '',
  type: 'INFO',
  targetAudience: ['ALL'],
  priority: 'MEDIUM',
  startDate: new Date().toISOString().split('T')[0],
  endDate: '',
  isActive: true,
};

const authHeader = () => ({ headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });
const dateText = (value) => (value ? new Date(value).toLocaleDateString() : '—');

// The customer-facing look of an announcement, shown live while the editor is open.
function AnnouncementPreview({ form }) {
  const type = TYPES.find(item => item.value === form.type) || TYPES[0];
  return (
    <div className="rounded-xl border border-border bg-surface-muted p-4">
      <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-text-muted">Preview</p>
      <div className="rounded-xl border border-border bg-surface p-4">
        <div className="flex items-center gap-2">
          <Badge tone={type.tone}>{type.label}</Badge>
        </div>
        <p className="mt-2 font-semibold text-text">{form.title || 'Your title appears here'}</p>
        <p className="mt-1 whitespace-pre-line text-sm text-text-muted">{form.message || 'The message customers will read.'}</p>
      </div>
    </div>
  );
}

// One announcement as a tile: type, priority, text, audience, dates and the quick controls.
function AnnouncementTile({ announcement, onEdit, onDelete, onToggle }) {
  const type = TYPES.find(item => item.value === announcement.type) || TYPES[0];
  const priority = PRIORITIES.find(item => item.value === announcement.priority) || PRIORITIES[1];
  const audiences = (announcement.targetAudience || ['ALL']).map(value => AUDIENCES.find(item => item.value === value)?.label || value);
  return (
    <article className={`glass flex flex-col gap-4 rounded-2xl p-5 transition-opacity ${announcement.isActive ? '' : 'opacity-70'}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={type.tone}>{type.label}</Badge>
          <Badge tone={priority.tone}>{priority.label}</Badge>
        </div>
        <div className="flex flex-none items-center">
          <IconButton label="Edit" icon={LuPencil} onClick={() => onEdit(announcement)} />
          <IconButton label="Delete" icon={LuTrash2} variant="danger" onClick={() => onDelete(announcement._id)} />
        </div>
      </div>

      <div className="min-w-0 flex-1">
        <h3 className="font-display text-lg font-semibold text-text">{announcement.title}</h3>
        <p className="mt-2 line-clamp-3 whitespace-pre-line text-sm text-text-muted">{announcement.message}</p>
      </div>

      <ul className="flex flex-wrap gap-2 text-xs text-text-muted">
        {audiences.map(label => (
          <li key={label} className="inline-flex items-center gap-1 rounded-full bg-surface-muted px-2.5 py-1">
            <LuUsers aria-hidden="true" className="h-3 w-3" />{label}
          </li>
        ))}
      </ul>

      <div className="flex items-center justify-between gap-3 border-t border-border pt-4 text-xs text-text-muted">
        <span className="inline-flex items-center gap-1.5">
          <LuCalendarDays aria-hidden="true" className="h-3.5 w-3.5" />
          {dateText(announcement.startDate)} → {announcement.endDate ? dateText(announcement.endDate) : 'no end date'}
        </span>
        <button
          type="button"
          onClick={() => onToggle(announcement)}
          aria-pressed={Boolean(announcement.isActive)}
          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-semibold transition-colors ${announcement.isActive ? 'bg-success/10 text-success' : 'bg-surface-muted text-text-muted'}`}
        >
          {announcement.isActive ? <LuToggleRight aria-hidden="true" className="h-4 w-4" /> : <LuToggleLeft aria-hidden="true" className="h-4 w-4" />}
          {announcement.isActive ? 'Live' : 'Hidden'}
        </button>
      </div>
    </article>
  );
}

// Announcements: a tile grid with a "New Announcement" tile, and an editor with a live preview.
export default function AnnouncementsManager() {
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingAnnouncement, setEditingAnnouncement] = useState(null);
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const fetchAnnouncements = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await axios.get('/api/admin/announcements', authHeader());
      setAnnouncements(response.data.announcements || []);
    } catch (failure) {
      console.error('Failed to fetch announcements:', failure);
      setError('Announcements could not be loaded.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAnnouncements(); }, []);

  const openNew = () => {
    setEditingAnnouncement(null);
    setFormData(EMPTY_FORM);
    setShowModal(true);
  };

  const openEdit = (announcement) => {
    setEditingAnnouncement(announcement);
    setFormData({
      title: announcement.title,
      message: announcement.message,
      type: announcement.type,
      targetAudience: announcement.targetAudience,
      priority: announcement.priority,
      startDate: announcement.startDate ? new Date(announcement.startDate).toISOString().split('T')[0] : '',
      endDate: announcement.endDate ? new Date(announcement.endDate).toISOString().split('T')[0] : '',
      isActive: announcement.isActive,
    });
    setShowModal(true);
  };

  const toggleAudience = (audience) => {
    const current = formData.targetAudience.filter(item => item !== 'ALL');
    if (audience === 'ALL') return setFormData({ ...formData, targetAudience: ['ALL'] });
    const next = current.includes(audience) ? current.filter(item => item !== audience) : [...current, audience];
    setFormData({ ...formData, targetAudience: next.length ? next : ['ALL'] });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      if (editingAnnouncement) {
        await axios.put(`/api/admin/announcements/${editingAnnouncement._id}`, formData, authHeader());
        notify.message('Announcement updated.');
      } else {
        await axios.post('/api/admin/announcements', formData, authHeader());
        notify.message('Announcement published.');
      }
      setShowModal(false);
      fetchAnnouncements();
    } catch (failure) {
      const message = failure.response?.data?.message || failure.message || 'Unknown error';
      notify.error(`The announcement could not be saved: ${message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!(await confirmAction({ message: 'Delete this announcement? Customers will stop seeing it.', danger: true }))) return;
    try {
      await axios.delete(`/api/admin/announcements/${id}`, authHeader());
      notify.message('Announcement deleted.');
      fetchAnnouncements();
    } catch (failure) {
      console.error('Failed to delete announcement:', failure);
      notify.error('The announcement could not be deleted. Please try again.');
    }
  };

  const toggleActive = async (announcement) => {
    try {
      await axios.put(`/api/admin/announcements/${announcement._id}`, { isActive: !announcement.isActive }, authHeader());
      fetchAnnouncements();
    } catch (failure) {
      console.error('Failed to toggle announcement:', failure);
      notify.error('The announcement status could not be changed.');
    }
  };

  return (
    <div className="space-y-6">
      <AdminPageHeader
        description="Messages shown to customers, tour operators or administrators while they are active."
      />

      {loading && (
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3" aria-live="polite">
          <p className="sr-only">Loading announcements…</p>
          {[0, 1, 2].map(i => <Skeleton key={i} className="h-64 w-full rounded-2xl" />)}
        </div>
      )}

      {!loading && error && <ErrorState title="Announcements could not be loaded" message={error} onRetry={fetchAnnouncements} />}

      {!loading && !error && (
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          <div className="flex min-h-[16rem] flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-brand/40 bg-brand/5 p-6 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand text-on-brand">
              <LuPlus aria-hidden="true" className="h-6 w-6" />
            </span>
            <button type="button" onClick={openNew} className="font-semibold text-text underline-offset-4 hover:underline">New Announcement</button>
            <span className="max-w-[16rem] text-sm text-text-muted">Write a message and choose who sees it.</span>
          </div>

          {announcements.map(announcement => (
            <AnnouncementTile
              key={announcement._id}
              announcement={announcement}
              onEdit={openEdit}
              onDelete={handleDelete}
              onToggle={toggleActive}
            />
          ))}
        </div>
      )}

      {!loading && !error && announcements.length === 0 && (
        <EmptyState icon={LuMegaphone} title="No announcements yet" description="Published announcements appear as tiles here." />
      )}

      <Modal
        open={showModal}
        onClose={() => { if (!saving) setShowModal(false); }}
        title={editingAnnouncement ? 'Edit announcement' : 'New announcement'}
        description="Customers see the preview as it will appear."
        size="xl"
        rootClassName="dark"
      >
        <form onSubmit={handleSubmit} className="grid gap-5 lg:grid-cols-5">
          <div className="space-y-5 lg:col-span-3">
            <FormField id="announcement-title" label="Title" required>
              <input
                id="announcement-title"
                type="text"
                required
                value={formData.title}
                onChange={e => setFormData({ ...formData, title: e.target.value })}
                placeholder="Enter announcement title"
                className={inputClass}
              />
            </FormField>

            <FormField id="announcement-message" label="Message" required>
              <textarea
                id="announcement-message"
                required
                rows={5}
                value={formData.message}
                onChange={e => setFormData({ ...formData, message: e.target.value })}
                placeholder="Enter announcement message"
                className={`${inputClass} resize-none`}
              />
            </FormField>

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField id="announcement-type" label="Type">
                <select id="announcement-type" value={formData.type} onChange={e => setFormData({ ...formData, type: e.target.value })} className={inputClass}>
                  {TYPES.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}
                </select>
              </FormField>
              <FormField id="announcement-priority" label="Priority">
                <select id="announcement-priority" value={formData.priority} onChange={e => setFormData({ ...formData, priority: e.target.value })} className={inputClass}>
                  {PRIORITIES.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}
                </select>
              </FormField>
            </div>

            <fieldset>
              <legend className="mb-2 text-sm font-medium text-text">Who sees it</legend>
              <div className="grid gap-2 sm:grid-cols-2">
                {AUDIENCES.map(item => {
                  const checked = formData.targetAudience.includes(item.value);
                  return (
                    <label key={item.value} className={`flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2.5 text-sm transition-colors ${checked ? 'border-brand/50 bg-brand/5 text-text' : 'border-border text-text-muted hover:text-text'}`}>
                      <input type="checkbox" checked={checked} onChange={() => toggleAudience(item.value)} className="h-4 w-4 accent-brand" />
                      {item.label}
                    </label>
                  );
                })}
              </div>
            </fieldset>

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField id="announcement-start" label="Start date">
                <input id="announcement-start" type="date" value={formData.startDate} onChange={e => setFormData({ ...formData, startDate: e.target.value })} className={inputClass} />
              </FormField>
              <FormField id="announcement-end" label="End date (optional)">
                <input id="announcement-end" type="date" value={formData.endDate} onChange={e => setFormData({ ...formData, endDate: e.target.value })} className={inputClass} />
              </FormField>
            </div>

            <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-border px-4 py-3">
              <input type="checkbox" checked={formData.isActive} onChange={e => setFormData({ ...formData, isActive: e.target.checked })} className="h-5 w-5 accent-brand" />
              <span className="text-sm font-semibold text-text">Live now</span>
            </label>

            <div className="flex flex-col-reverse gap-3 border-t border-border pt-5 sm:flex-row sm:justify-end">
              <Button variant="secondary" onClick={() => setShowModal(false)} disabled={saving}>Cancel</Button>
              <Button type="submit" loading={saving}>{editingAnnouncement ? 'Update Announcement' : 'Create Announcement'}</Button>
            </div>
          </div>

          <div className="lg:col-span-2">
            <AnnouncementPreview form={formData} />
          </div>
        </form>
      </Modal>
    </div>
  );
}
