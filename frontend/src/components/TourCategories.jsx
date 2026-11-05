import React from 'react';
import { useNavigate } from 'react-router-dom';
import { LuBus, LuHotel, LuSignpost, LuUser, LuUsers, LuUtensils, LuArrowRight } from 'react-icons/lu';
import Button from './ui/Button.jsx';

const CATEGORIES = [
  {
    key: 'personal',
    title: 'Personal tours',
    subtitle: 'Designed around you',
    route: '/packages?type=PERSONAL',
    cta: 'Customise a tour',
    icon: LuUser,
    accent: 'text-brand bg-brand/10',
    features: [
      { icon: LuUser, text: 'Itinerary built around your interests' },
      { icon: LuSignpost, text: 'Flexible dates and destinations' },
      { icon: LuHotel, text: 'Choose your accommodation level' },
      { icon: LuBus, text: 'Private or shared transport' },
    ],
  },
  {
    key: 'group',
    title: 'Group tours',
    subtitle: 'Travel with fellow guests',
    route: '/packages?type=GROUP',
    cta: 'Browse group departures',
    icon: LuUsers,
    accent: 'text-info bg-info/10',
    features: [
      { icon: LuUsers, text: 'Fixed schedule, set price' },
      { icon: LuHotel, text: 'Hotels and resorts arranged for you' },
      { icon: LuBus, text: 'Group transport included' },
      { icon: LuUtensils, text: 'Meals and activities as listed' },
    ],
  },
];

const TourCategories = () => {
  const navigate = useNavigate();

  return (
    <section id="packages" aria-labelledby="categories-heading" className="mesh-bg py-16 lg:py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <header className="mx-auto mb-12 max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-wider text-brand">Tours</p>
          <h2 id="categories-heading" className="mt-2 font-display text-3xl font-bold text-text sm:text-4xl">Choose how you want to travel</h2>
          <p className="mt-3 text-base text-text-muted">Build your own itinerary, or join a group that has already been planned.</p>
        </header>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {CATEGORIES.map(category => {
            const Icon = category.icon;
            return (
              <article key={category.key} className="flex flex-col rounded-2xl glass p-6 shadow-sm sm:p-8">
                <div className="flex items-center gap-4">
                  <span className={`flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-xl ${category.accent}`}>
                    <Icon aria-hidden="true" className="h-7 w-7" />
                  </span>
                  <div>
                    <h3 className="font-display text-2xl font-bold text-text">{category.title}</h3>
                    <p className="text-sm text-text-muted">{category.subtitle}</p>
                  </div>
                </div>

                <ul className="my-6 grid gap-3 sm:grid-cols-2">
                  {category.features.map(feature => {
                    const FeatureIcon = feature.icon;
                    return (
                      <li key={feature.text} className="flex items-start gap-3 text-sm text-text">
                        <FeatureIcon aria-hidden="true" className="mt-0.5 h-4 w-4 flex-shrink-0 text-brand" />
                        <span>{feature.text}</span>
                      </li>
                    );
                  })}
                </ul>

                <div className="mt-auto">
                  <Button className="w-full" onClick={() => navigate(category.route)} icon={LuArrowRight}>
                    {category.cta}
                  </Button>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default TourCategories;
