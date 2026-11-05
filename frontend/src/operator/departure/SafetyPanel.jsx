import React, { useState } from 'react';
import { LuCircleCheck, LuCircleX, LuTriangleAlert } from 'react-icons/lu';
import Badge from '../../components/ui/Badge.jsx';
import Button from '../../components/ui/Button.jsx';
import FormField, { inputClass } from '../../components/ui/FormField.jsx';
import { INCIDENT_SEVERITY_OPTIONS, SAFETY_ITEMS, incidentTone } from '../../utils/operatorDeparture.js';

const shortDateTime = value => value ? new Date(value).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '';

// Pre-trip checks and the incident log. Incidents are saved on the departure, so they are still there after a reload.
export default function SafetyPanel({ checklist, incidents, disabled, onToggle, onLogIncident }) {
  const [showForm, setShowForm] = useState(false);
  const [description, setDescription] = useState('');
  const [severity, setSeverity] = useState('MEDIUM');
  const [formError, setFormError] = useState('');

  const submit = async event => {
    event.preventDefault();
    if (!description.trim()) { setFormError('Describe the incident before saving.'); return; }
    setFormError('');
    const saved = await onLogIncident({ description, severity });
    if (saved) {
      setDescription('');
      setSeverity('MEDIUM');
      setShowForm(false);
    }
  };

  return (
    <div className="space-y-8">
      <section aria-labelledby="safety-heading" className="space-y-3">
        <h2 id="safety-heading" className="font-display text-lg font-semibold text-text">Pre-trip safety checks</h2>
        <ul className="grid gap-3 md:grid-cols-2">
          {SAFETY_ITEMS.map(item => {
            const checked = Boolean(checklist[item.key]);
            return (
              <li key={item.key}>
                <button
                  type="button"
                  disabled={disabled}
                  aria-pressed={checked}
                  onClick={() => onToggle(item.key)}
                  className={`glass flex min-h-[56px] w-full items-center justify-between gap-3 rounded-2xl p-4 text-left transition-colors disabled:opacity-60 ${checked ? 'ring-1 ring-success/50' : 'hover:bg-surface-muted'}`}
                >
                  <span className="font-semibold text-text">{item.label}</span>
                  {checked
                    ? <LuCircleCheck aria-hidden="true" className="h-6 w-6 flex-none text-success" />
                    : <LuCircleX aria-hidden="true" className="h-6 w-6 flex-none text-text-muted" />}
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      <section aria-labelledby="incident-heading" className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="incident-heading" className="font-display text-lg font-semibold text-text">Incident log</h2>
          <Button size="sm" variant="secondary" icon={LuTriangleAlert} disabled={disabled} onClick={() => setShowForm(open => !open)} aria-expanded={showForm}>
            {showForm ? 'Close form' : 'Log incident'}
          </Button>
        </div>

        {showForm && (
          <form onSubmit={submit} noValidate className="glass grid gap-4 rounded-2xl p-5 md:grid-cols-[1fr_12rem]">
            <FormField id="incident-description" label="What happened" error={formError} required className="md:col-span-2">
              <textarea id="incident-description" rows={3} value={description} onChange={e => setDescription(e.target.value)} className={inputClass} aria-invalid={Boolean(formError) || undefined} />
            </FormField>
            <FormField id="incident-severity" label="Severity">
              <select id="incident-severity" value={severity} onChange={e => setSeverity(e.target.value)} className={inputClass}>
                {INCIDENT_SEVERITY_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </FormField>
            <div className="flex items-end justify-end gap-2 md:col-span-1">
              <Button variant="ghost" onClick={() => setShowForm(false)}>Cancel</Button>
              <Button type="submit" disabled={disabled}>Save incident</Button>
            </div>
          </form>
        )}

        {incidents.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-text-muted">No incidents logged for this departure.</p>
        ) : (
          <ul className="space-y-2">
            {incidents.map(incident => (
              <li key={incident._id || `${incident.reportedAt}-${incident.description}`} className="glass flex flex-wrap items-start justify-between gap-3 rounded-2xl p-4">
                <div className="min-w-0 flex-1">
                  <p className="text-text">{incident.description}</p>
                  <p className="mt-1 text-xs text-text-muted">{shortDateTime(incident.reportedAt)}</p>
                </div>
                <Badge tone={incidentTone(incident.severity)}>{incident.severity}</Badge>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
