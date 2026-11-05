import React from 'react';
import { LuSearch, LuPalette, LuLock, LuPlane } from 'react-icons/lu';

// Copy describes the real flow: payments are submitted and then verified by the TripBloom team, not confirmed instantly.
const STEPS = [
  { icon: LuSearch, title: 'Search & explore', text: 'Pick a destination or browse tour packages by type and budget.' },
  { icon: LuPalette, title: 'Customise your tour', text: 'Choose personal options, dates and travellers, or join a fixed group departure.' },
  { icon: LuLock, title: 'Book & submit payment', text: 'Send your payment reference. Our team checks the transfer and confirms your booking.' },
  { icon: LuPlane, title: 'Enjoy the journey', text: 'Get your itinerary, travel with support on hand, and earn reward points.' },
];

const HowItWorks = () => (
  <section aria-labelledby="how-heading" className="mesh-bg py-16 lg:py-20">
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
      <header className="mx-auto mb-12 max-w-2xl text-center">
        <p className="text-sm font-semibold uppercase tracking-wider text-brand">How it works</p>
        <h2 id="how-heading" className="mt-2 font-display text-3xl font-bold text-text sm:text-4xl">Your trip in four steps</h2>
      </header>
      <ol className="relative grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
        {STEPS.map((step, index) => {
          const Icon = step.icon;
          return (
            <li key={step.title} className="relative flex flex-col rounded-2xl glass p-6">
              <div className="mb-5 flex items-center justify-between">
                <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand/10 text-brand">
                  <Icon aria-hidden="true" className="h-6 w-6" />
                </span>
                <span aria-hidden="true" className="font-display text-3xl font-bold text-border">0{index + 1}</span>
              </div>
              <h3 className="text-lg font-semibold text-text">{step.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-text-muted">{step.text}</p>
            </li>
          );
        })}
      </ol>
    </div>
  </section>
);

export default HowItWorks;
