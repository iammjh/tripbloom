import React from 'react';
import { LuCalendarCheck, LuCreditCard, LuReceipt, LuShieldCheck, LuTrophy, LuUndo2 } from 'react-icons/lu';

// Each point describes a feature the product actually has. Removed claims: AI recommendations, a payment gateway,
// green certification and instant confirmation (payments are verified by the team).
const REASONS = [
  { icon: LuCalendarCheck, title: 'Tailored or fixed trips', text: 'Build a personal tour around your dates and pace, or join a group departure with a set schedule.' },
  { icon: LuShieldCheck, title: 'Identity-checked users', text: 'Travellers and operators submit identity documents that our team reviews before they take part.' },
  { icon: LuCreditCard, title: 'Clear payments', text: 'Pay by bKash, Nagad, Rocket, bank transfer, card or cash, then submit the receipt reference for verification.' },
  { icon: LuReceipt, title: 'Recorded receipts', text: 'Every verified payment and refund is recorded against your booking, so your balance is always visible.' },
  { icon: LuUndo2, title: 'Published cancellation policy', text: 'The earlier you cancel, the more you get back. The refund schedule is shown before you confirm.' },
  { icon: LuTrophy, title: 'Reward points', text: 'Earn points on your bookings and use them to reduce the cost of a future trip.' },
];

const WhyChooseUs = () => (
  <section id="about" aria-labelledby="why-heading" className="mesh-bg py-16 lg:py-20">
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
      <header className="mx-auto mb-12 max-w-2xl text-center">
        <p className="text-sm font-semibold uppercase tracking-wider text-brand">Why TripBloom</p>
        <h2 id="why-heading" className="mt-2 font-display text-3xl font-bold text-text sm:text-4xl">Planned properly, paid transparently</h2>
        <p className="mt-3 text-base text-text-muted">The details that matter before, during and after your trip.</p>
      </header>
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
        {REASONS.map(reason => {
          const Icon = reason.icon;
          return (
            <div key={reason.title} className="flex flex-col rounded-2xl glass p-6 transition-colors hover:border-brand/40">
              <span className="mb-4 flex h-11 w-11 items-center justify-center rounded-lg bg-brand/10 text-brand">
                <Icon aria-hidden="true" className="h-5 w-5" />
              </span>
              <h3 className="text-base font-semibold text-text">{reason.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-text-muted">{reason.text}</p>
            </div>
          );
        })}
      </div>
    </div>
  </section>
);

export default WhyChooseUs;
