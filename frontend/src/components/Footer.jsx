import React from 'react';
import { Link } from 'react-router-dom';
import { LuArrowUp, LuMail } from 'react-icons/lu';

// Every link here goes somewhere that exists: sections on this page, the browse route, or an address.
const EXPLORE = [
  { label: 'Home', href: '#home' },
  { label: 'About TripBloom', href: '#about' },
  { label: 'Tour categories', href: '#packages' },
  { label: 'Popular destinations', href: '#destinations' },
  { label: 'Browse all packages', to: '/browse-packages' },
];

const SUPPORT = [
  { label: 'Contact us', href: '#contact' },
  { label: 'Email support@tripbloom.com', href: 'mailto:support@tripbloom.com', icon: LuMail },
];

const linkClass = 'inline-flex items-center gap-2 text-sm text-text-muted transition-colors hover:text-brand focus-visible:text-brand';

function FooterLink({ link }) {
  const Icon = link.icon;
  const content = (
    <>
      {Icon && <Icon aria-hidden="true" className="h-4 w-4 flex-shrink-0" />}
      <span>{link.label}</span>
    </>
  );
  if (link.to) return <Link to={link.to} className={linkClass}>{content}</Link>;
  return <a href={link.href} className={linkClass}>{content}</a>;
}

const Footer = () => {
  const year = new Date().getFullYear();

  const backToTop = () => window.scrollTo({ top: 0, behavior: 'smooth' });

  return (
    <footer className="px-4 pb-8 pt-16 sm:px-6 lg:px-8">
      <div className="glass mx-auto max-w-7xl rounded-2xl p-8 sm:p-10">
        <div className="grid grid-cols-1 gap-10 md:grid-cols-3">
          <div>
            <div className="flex items-center gap-3">
              <img src="/tripbloom_logo.svg" alt="" className="h-12 w-12" />
              <p className="font-display text-2xl font-bold text-brand">TripBloom</p>
            </div>
            <p className="mt-4 font-medium text-text">Where every journey blossoms.</p>
            <p className="mt-2 max-w-xs text-sm leading-relaxed text-text-muted">
              Personal and group tours, with every payment recorded and every change explained.
            </p>
          </div>

          <nav aria-label="Explore">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-text">Explore</h2>
            <ul className="mt-4 space-y-3">
              {EXPLORE.map(link => <li key={link.label}><FooterLink link={link} /></li>)}
            </ul>
          </nav>

          <nav aria-label="Support">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-text">Support</h2>
            <ul className="mt-4 space-y-3">
              {SUPPORT.map(link => <li key={link.label}><FooterLink link={link} /></li>)}
            </ul>
          </nav>
        </div>

        {/* Three columns on larger screens, all top-aligned, so the credit sits on the same line as the copyright text. */}
        <div className="mt-10 flex flex-col items-center gap-4 border-t border-white/10 pt-6 sm:grid sm:grid-cols-3 sm:items-start sm:gap-6">
          <div className="text-center text-xs text-text-muted sm:text-left">
            <p>© {year} TripBloom. All rights reserved.</p>
            <p className="mt-1">Powered by Best CSE University's student</p>
          </div>
          {/* Aligned to the bottom of the row, so it sits on the same line as "Powered by ... CSE University's student". */}
          <p className="text-center text-xs text-text-muted sm:self-end">
            Developed by{' '}
            <a
              href="https://iammjh.github.io"
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-text underline-offset-4 hover:underline"
            >
              iammjh
            </a>
          </p>
          <div className="flex justify-center sm:justify-end">
            <button
              type="button"
              onClick={backToTop}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-lg border border-white/15 bg-white/5 px-4 text-sm font-medium text-text transition-colors hover:bg-white/10"
            >
              <LuArrowUp aria-hidden="true" className="h-4 w-4" />
              Back to top
            </button>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
