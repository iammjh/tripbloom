import { LuChevronDown, LuChevronUp, LuUserCog, LuUsers } from 'react-icons/lu';
import React, { useState } from 'react';

// Sidebar dropdown for the people pages: all users and tour operators.
const ManageUsersMenu = ({ navigate }) => {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        aria-expanded={open}
        className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-text-muted transition-colors hover:bg-surface-muted hover:text-text"
      >
        <LuUsers aria-hidden="true" className="h-4 w-4 flex-none" />
        <span className="min-w-0 flex-1 truncate text-left">Manage users</span>
        {open ? <LuChevronUp aria-hidden="true" className="h-4 w-4" /> : <LuChevronDown aria-hidden="true" className="h-4 w-4" />}
      </button>
      {open && (
        <div className="mt-1 space-y-1 pl-4">
          <button type="button" onClick={() => navigate('/admin/users')} className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm text-text-muted transition-colors hover:bg-surface-muted hover:text-text">
            <LuUsers aria-hidden="true" className="h-4 w-4" />All users
          </button>
          <button type="button" onClick={() => navigate('/admin/operators')} className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm text-text-muted transition-colors hover:bg-surface-muted hover:text-text">
            <LuUserCog aria-hidden="true" className="h-4 w-4" />Operators
          </button>
        </div>
      )}
    </div>
  );
};

export default ManageUsersMenu;
