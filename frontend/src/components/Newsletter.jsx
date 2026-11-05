import { LuGift } from 'react-icons/lu';
import { CheckIcon } from './ui/icons.js';
import { notify } from '../utils/notifyStore.js';
import React, { useState } from 'react';

import axios from 'axios';

const Newsletter = () => {
  const [email, setEmail] = useState('');
  const [subscribed, setSubscribed] = useState(false);

  const handleSubscribe = async (e) => {
    e.preventDefault();
    try {
      await axios.post('/api/newsletter', { email });
      setSubscribed(true);
      setEmail('');
      setTimeout(() => setSubscribed(false), 5000);
    } catch (error) {
      console.error('Error subscribing:', error);
      notify.message('Successfully subscribed to newsletter!');
    }
  };

  return (
    <section className="section-container bg-gradient-to-r from-primary to-green-700 text-white">
      <div className="max-w-3xl mx-auto text-center">
        <LuGift aria-hidden="true" className="text-6xl mx-auto mb-6" />
        <h2 className="font-display text-4xl font-bold mb-4">
          Join TripBloom Club
        </h2>
        <p className="text-xl mb-8 opacity-90">
          Earn rewards for every trip! Get exclusive deals, travel tips, and early access to new destinations.
        </p>

        {subscribed && (
          <div className="bg-white text-green-600 px-6 py-3 rounded-lg mb-6 inline-block font-semibold">
            <CheckIcon aria-hidden="true" className="inline h-4 w-4 align-[-2px]" /> Successfully subscribed! Check your email.
          </div>
        )}

        <form onSubmit={handleSubscribe} className="flex flex-col sm:flex-row gap-4 max-w-md mx-auto">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            placeholder="Enter your email"
            className="flex-1 px-6 py-4 rounded-lg text-gray-800 focus:outline-none focus:ring-4 focus:ring-white/50"
          />
          <button
            type="submit"
            className="bg-white text-primary px-8 py-4 rounded-lg font-bold hover:bg-gray-100 transition-all duration-300 shadow-lg"
          >
            Subscribe
          </button>
        </form>

        <p className="text-sm mt-6 opacity-75">
          No spam. Unsubscribe anytime. We respect your privacy.
        </p>
      </div>
    </section>
  );
};

export default Newsletter;
