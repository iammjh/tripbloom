import React from 'react';
import { useNavigate } from 'react-router-dom';
import { LuHistory, LuLogOut, LuPlane, LuStar, LuUser } from 'react-icons/lu';
import Button from '../ui/Button.jsx';
import { BackIcon } from '../ui/icons.js';
import { useAuth } from '../../context/AuthContext';

// The customer sections, in the order shown in the tab row.
export const CUSTOMER_TABS = [
  { key: 'trips', icon: LuPlane, label: 'My trips', path: '/customer' },
  { key: 'reviews', icon: LuStar, label: 'My reviews', path: '/customer/reviews' },
  { key: 'history', icon: LuHistory, label: 'History', path: '/customer/history' },
  { key: 'profile', icon: LuUser, label: 'Profile', path: '/customer/profile' },
];

// Segmented tab row shared by every customer section. `active` is the key of the current section.
export function CustomerTabs({ active }) {
  const navigate = useNavigate();
  return (
    <nav aria-label="Customer sections">
      <div className="glass grid grid-cols-2 gap-1 rounded-2xl p-1 sm:inline-flex sm:max-w-full sm:rounded-full">
        {CUSTOMER_TABS.map(({ key, icon: Icon, label, path }) => {
          const current = key === active;
          return (
            <button
              key={key}
              type="button"
              aria-current={current ? 'page' : undefined}
              onClick={() => navigate(path)}
              className={`flex min-h-[40px] items-center justify-center gap-2 rounded-full px-4 text-sm font-semibold transition-colors duration-150 ${
                current ? 'bg-brand text-on-brand' : 'text-text-muted hover:text-text'
              }`}
            >
              <Icon aria-hidden="true" className="h-4 w-4" />
              {label}
            </button>
          );
        })}
      </div>
    </nav>
  );
}

// Page frame for customer sections other than the dashboard: back link, title, tabs and log out.
export default function CustomerPageFrame({ active, eyebrow, title, description, children }) {
  const navigate = useNavigate();
  const { logout } = useAuth();
  return (
    <div className="dark mesh-bg min-h-screen text-text">
      <div className="mx-auto max-w-5xl space-y-8 px-4 py-8 sm:px-6 lg:px-8">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <Button variant="ghost" size="sm" icon={BackIcon} onClick={() => navigate('/customer')} className="-ml-3 mb-2">
              Back to dashboard
            </Button>
            <p className="text-sm font-semibold uppercase tracking-wider text-brand">{eyebrow}</p>
            <h1 className="mt-2 font-display text-3xl font-bold text-text sm:text-4xl">{title}</h1>
            {description && <p className="mt-2 max-w-2xl text-base text-text-muted">{description}</p>}
          </div>
          <Button variant="secondary" icon={LuLogOut} onClick={() => { logout(); navigate('/'); }}>Log out</Button>
        </header>

        <CustomerTabs active={active} />

        {children}
      </div>
    </div>
  );
}
