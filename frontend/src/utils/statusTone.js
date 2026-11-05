// One place that decides how a status, role or flag looks. Input may be any case or separator style ("tour_operator", "Tour Operator").
const TONE_BY_STATUS = {
  success: ['CONFIRMED', 'COMPLETED', 'SUCCESS', 'APPROVED', 'ACTIVE', 'OPEN', 'VERIFIED', 'YES'],
  warning: ['PENDING', 'FULL', 'UNDER_REVIEW', 'REVIEW', 'PENDING_REVIEW'],
  danger: ['CANCELLED', 'REJECTED', 'FAILED', 'SUSPENDED', 'INACTIVE', 'BLOCKED', 'OVERBOOKED', 'NO'],
  info: ['REFUNDED', 'TOUR_OPERATOR', 'OPERATOR'],
  brand: ['ADMIN'],
};

const normalize = value => String(value ?? '').trim().toUpperCase().replace(/[\s-]+/g, '_');

export function statusTone(value) {
  const key = normalize(value);
  for (const [tone, keys] of Object.entries(TONE_BY_STATUS)) {
    if (keys.includes(key)) return tone;
  }
  return 'neutral';
}

// Tailwind classes per tone. Colours come from the semantic tokens in index.css, so dark mode follows automatically.
const TONE_CLASSES = {
  success: 'bg-success/10 text-success ring-success/30',
  warning: 'bg-warning/10 text-warning ring-warning/30',
  danger: 'bg-danger/10 text-danger ring-danger/30',
  info: 'bg-info/10 text-info ring-info/30',
  brand: 'bg-brand/10 text-brand ring-brand/30',
  neutral: 'bg-surface-muted text-text-muted ring-border',
};

export function toneClasses(tone) {
  return TONE_CLASSES[tone] || TONE_CLASSES.neutral;
}

// Human label: "TOUR_OPERATOR" -> "Tour operator", "pending" -> "Pending".
export function statusLabel(value) {
  const words = normalize(value).toLowerCase().split('_').filter(Boolean);
  if (words.length === 0) return 'Unknown';
  const [first, ...rest] = words;
  return [first.charAt(0).toUpperCase() + first.slice(1), ...rest].join(' ');
}
