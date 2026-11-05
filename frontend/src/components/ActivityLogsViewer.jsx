import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { LuActivity, LuClock, LuEye, LuFilter, LuRefreshCw, LuSearch, LuUsers } from 'react-icons/lu';
import Badge from './ui/Badge.jsx';
import Button from './ui/Button.jsx';
import EmptyState from './ui/EmptyState.jsx';
import ErrorState from './ui/ErrorState.jsx';
import FormField, { inputClass } from './ui/FormField.jsx';
import IconButton from './ui/IconButton.jsx';
import Modal from './ui/Modal.jsx';
import Skeleton from './ui/Skeleton.jsx';
import { AdminPageHeader, AdminPanel, AdminTable, tdClass, thClass } from './admin/AdminPrimitives.jsx';

const LIMITS = [50, 100, 200];

// Plain-language names for every action the server writes.
const ACTION_LABELS = {
  USER_CREATED: 'User created',
  USER_UPDATED: 'User updated',
  USER_SUSPENDED: 'User suspended',
  USER_ACTIVATED: 'User reactivated',
  ROLE_CHANGED: 'Role changed',
  PACKAGE_APPROVED: 'Package approved',
  PACKAGE_REJECTED: 'Package rejected',
  PACKAGE_DELETED: 'Package deleted',
  REVIEW_DELETED: 'Review deleted',
  OPERATOR_CREATED: 'Operator created',
  OPERATOR_DELETED: 'Operator deleted',
  BOOKING_CANCELLED: 'Booking cancelled',
  REFUND_PROCESSED: 'Refund recorded',
  SETTINGS_UPDATED: 'Settings updated',
  ANNOUNCEMENT_CREATED: 'Announcement created',
  ANNOUNCEMENT_UPDATED: 'Announcement updated',
  ANNOUNCEMENT_DELETED: 'Announcement deleted',
  CONTACT_RESOLVED: 'Message handled',
  PAYMENT_VERIFIED: 'Payment verified',
  PAYMENT_REJECTED: 'Payment rejected',
  DATE_CHANGE_APPROVED: 'Date change approved',
  DATE_CHANGE_REJECTED: 'Date change rejected',
  KYC_APPROVED: 'KYC approved',
  KYC_REJECTED: 'KYC rejected',
};

// Badge tone: removals, cancellations and rejections stand out; money movements are amber; approvals are green.
function toneFor(action = '') {
  if (/DELETE|REJECT|SUSPEND|CANCEL/.test(action)) return 'danger';
  if (/REFUND/.test(action)) return 'warning';
  if (/CREATE|APPROVE|ACTIVATE|VERIFIED|RESOLVED|KYC_APPROVED/.test(action)) return 'success';
  if (/UPDATE|CHANGE|SETTINGS/.test(action)) return 'info';
  return 'neutral';
}

const labelFor = (action = '') => ACTION_LABELS[action] || action.replace(/_/g, ' ').toLowerCase().replace(/^\w/, c => c.toUpperCase());
const whoOf = (log) => log.adminId?.fullName || 'System';
const whenOf = (log) => new Date(log.createdAt).toLocaleString();

// A calendar date (YYYY-MM-DD) from the picker, as the start or end of that day in the admin's own time zone.
function dayBoundary(value, end) {
  const [year, month, day] = value.split('-').map(Number);
  return end
    ? new Date(year, month - 1, day, 23, 59, 59, 999).toISOString()
    : new Date(year, month - 1, day, 0, 0, 0, 0).toISOString();
}

function KpiTile({ icon: Icon, label, value, footnote }) {
  return (
    <section className="glass flex flex-col gap-3 rounded-2xl p-5">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 flex-none items-center justify-center rounded-xl bg-brand/10">
          <Icon aria-hidden="true" className="h-5 w-5 text-brand" />
        </span>
        <h2 className="min-w-0 text-sm font-medium text-text-muted">{label}</h2>
      </div>
      <p className="font-display text-2xl font-semibold text-text break-words">{value}</p>
      {footnote && <p className="text-xs text-text-muted">{footnote}</p>}
    </section>
  );
}

// Administrator activity. The server applies the action, administrator and date filters; search narrows the loaded rows.
export default function ActivityLogsViewer() {
  const [logs, setLogs] = useState([]);
  const [options, setOptions] = useState({ actions: [], admins: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState({ action: '', startDate: '', endDate: '', adminId: '', limit: 100 });
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedLog, setSelectedLog] = useState(null);

  const fetchOptions = async () => {
    try {
      const res = await axios.get('/api/admin/activity-logs/options', {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      setOptions({ actions: res.data.actions || [], admins: res.data.admins || [] });
    } catch (failure) {
      // The filters fall back to the loaded rows if the options cannot be read.
      console.error('Failed to load activity filter options:', failure);
    }
  };

  const fetchLogs = async () => {
    if (filter.startDate && filter.endDate && filter.startDate > filter.endDate) {
      setError('The From date is after the To date. Change one of them.');
      setLogs([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (filter.action) params.append('action', filter.action);
      if (filter.startDate) params.append('startDate', dayBoundary(filter.startDate, false));
      if (filter.endDate) params.append('endDate', dayBoundary(filter.endDate, true));
      if (filter.adminId) params.append('adminId', filter.adminId);
      params.append('limit', filter.limit);
      const response = await axios.get(`/api/admin/activity-logs?${params}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      setLogs(response.data.activities || []);
    } catch (failure) {
      console.error('Failed to fetch activity logs:', failure);
      setError('The activity log could not be loaded.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchOptions(); }, []);
  useEffect(() => { fetchLogs(); }, [filter]);

  // Options from the server; if they are missing, the loaded rows supply them.
  // Every action the system can record, plus any found in the server list or the loaded rows, so the list is never empty.
  const actionOptions = useMemo(
    () => [...new Set([...Object.keys(ACTION_LABELS), ...options.actions, ...logs.map(log => log.action).filter(Boolean)])].sort(),
    [options.actions, logs]
  );
  const adminOptions = useMemo(() => {
    if (options.admins.length) return options.admins.map(a => [a.id, a.name]);
    const map = new Map();
    logs.forEach(log => { if (log.adminId?._id) map.set(String(log.adminId._id), log.adminId.fullName || 'Administrator'); });
    return [...map.entries()];
  }, [options.admins, logs]);

  const visibleLogs = logs.filter(log => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return true;
    return [log.description, labelFor(log.action), log.action, whoOf(log), log.ipAddress].some(value => String(value || '').toLowerCase().includes(term));
  });

  // Summary tiles describe the rows currently loaded.
  const dayAgo = Date.now() - 24 * 60 * 60 * 1000;
  const last24h = logs.filter(log => new Date(log.createdAt).getTime() >= dayAgo).length;
  const topAction = useMemo(() => {
    const counts = new Map();
    logs.forEach(log => counts.set(log.action, (counts.get(log.action) || 0) + 1));
    const best = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
    return best ? { action: best[0], count: best[1] } : null;
  }, [logs]);
  const activeFilters = [filter.action, filter.adminId, filter.startDate, filter.endDate].filter(Boolean).length;

  return (
    <div className="space-y-6">
      <AdminPageHeader
        description="Every administrator action that changes the platform, newest first. An entry is written when the action succeeds."
        actions={<Button variant="secondary" icon={LuRefreshCw} onClick={fetchLogs} loading={loading}>Refresh</Button>}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiTile icon={LuActivity} label="Entries loaded" value={logs.length} footnote={activeFilters ? `${activeFilters} filter${activeFilters === 1 ? '' : 's'} applied` : 'No filters applied'} />
        <KpiTile icon={LuUsers} label="Administrators" value={options.admins.length || adminOptions.length} footnote="Administrators with at least one entry" />
        <KpiTile icon={LuClock} label="Last 24 hours" value={last24h} footnote="Entries in the loaded results" />
        <KpiTile
          icon={LuFilter}
          label="Most frequent action"
          value={topAction ? labelFor(topAction.action) : '—'}
          footnote={topAction ? `${topAction.count} of ${logs.length} loaded entries` : 'Nothing loaded yet'}
        />
      </div>

      <AdminPanel>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
          <FormField id="activity-search" label="Search" className="xl:col-span-2">
            <div className="relative">
              <LuSearch aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
              <input id="activity-search" type="search" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder="Description, action or administrator" className={`${inputClass} pl-9`} />
            </div>
          </FormField>
          <FormField id="activity-action" label="Action">
            <select id="activity-action" aria-label="Action" value={filter.action} onChange={e => setFilter({ ...filter, action: e.target.value })} className={inputClass}>
              <option value="">All actions</option>
              {actionOptions.map(action => <option key={action} value={action}>{labelFor(action)}</option>)}
            </select>
          </FormField>
          <FormField id="activity-admin" label="Administrator">
            <select id="activity-admin" aria-label="Administrator" value={filter.adminId} onChange={e => setFilter({ ...filter, adminId: e.target.value })} className={inputClass}>
              <option value="">Everyone</option>
              {adminOptions.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
            </select>
          </FormField>
          <FormField id="activity-start" label="From">
            <input id="activity-start" aria-label="From date" type="date" value={filter.startDate} onChange={e => setFilter({ ...filter, startDate: e.target.value })} className={inputClass} />
          </FormField>
          <FormField id="activity-end" label="To">
            <input id="activity-end" aria-label="To date" type="date" value={filter.endDate} onChange={e => setFilter({ ...filter, endDate: e.target.value })} className={inputClass} />
          </FormField>
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-text-muted">
          <span>
            Showing {visibleLogs.length} of {logs.length} loaded entries. Filters load the newest {filter.limit} matching entries.
          </span>
          <label className="flex items-center gap-2">
            Load
            <select aria-label="Entries to load" value={filter.limit} onChange={e => setFilter({ ...filter, limit: Number(e.target.value) })} className="min-h-[36px] rounded-lg border border-border bg-surface px-2 text-text">
              {LIMITS.map(limit => <option key={limit} value={limit}>{limit}</option>)}
            </select>
          </label>
        </div>
      </AdminPanel>

      {loading && <div className="space-y-3" aria-live="polite"><p className="sr-only">Loading activity…</p>{[0, 1, 2, 3].map(i => <Skeleton key={i} className="h-14 w-full rounded-xl" />)}</div>}
      {!loading && error && <ErrorState title="Activity could not be loaded" message={error} onRetry={fetchLogs} />}
      {!loading && !error && visibleLogs.length === 0 && (
        <EmptyState icon={LuActivity} title="No activity matches these filters" description="Try a wider date range or another action." />
      )}

      {!loading && !error && visibleLogs.length > 0 && (
        <AdminTable label="Administrator activity" minWidth={900}>
          <thead>
            <tr>
              <th scope="col" className={thClass}>When</th>
              <th scope="col" className={thClass}>Action</th>
              <th scope="col" className={thClass}>Administrator</th>
              <th scope="col" className={thClass}>Description</th>
              <th scope="col" className={thClass}><span className="sr-only">Details</span></th>
            </tr>
          </thead>
          <tbody>
            {visibleLogs.map(log => (
              <tr key={log._id} className="transition-colors hover:bg-surface-muted/60">
                <td className={`${tdClass} whitespace-nowrap text-text-muted`}>{whenOf(log)}</td>
                <td className={tdClass}><Badge tone={toneFor(log.action)}>{labelFor(log.action)}</Badge></td>
                <td className={tdClass}>{whoOf(log)}</td>
                <td className={`${tdClass} max-w-md truncate`} title={log.description || ''}>{log.description || '—'}</td>
                <td className={`${tdClass} text-right`}>
                  <IconButton label="View details" icon={LuEye} onClick={() => setSelectedLog(log)} />
                </td>
              </tr>
            ))}
          </tbody>
        </AdminTable>
      )}

      <Modal
        open={Boolean(selectedLog)}
        onClose={() => setSelectedLog(null)}
        title={selectedLog ? labelFor(selectedLog.action) : ''}
        description={selectedLog ? whenOf(selectedLog) : ''}
        size="md"
        rootClassName="dark"
      >
        {selectedLog && (
          <div className="space-y-4 text-sm">
            <dl className="grid grid-cols-2 gap-3 rounded-xl bg-surface-muted p-4">
              <div className="col-span-2"><dt className="text-text-muted">Administrator</dt><dd className="font-semibold text-text">{whoOf(selectedLog)}{selectedLog.adminId?.email ? ` (${selectedLog.adminId.email})` : ''}</dd></div>
              <div><dt className="text-text-muted">Record type</dt><dd className="font-semibold text-text">{selectedLog.targetType || '—'}</dd></div>
              <div><dt className="text-text-muted">IP address</dt><dd className="font-mono font-semibold text-text">{selectedLog.ipAddress || '—'}</dd></div>
              <div className="col-span-2"><dt className="text-text-muted">Description</dt><dd className="text-text">{selectedLog.description || '—'}</dd></div>
            </dl>
            <div>
              <p className="mb-2 font-semibold text-text">Details</p>
              <pre className="max-h-64 overflow-auto rounded-xl bg-surface-muted p-4 text-xs text-text">{JSON.stringify(selectedLog.metadata || {}, null, 2)}</pre>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
