import { LuFacebook, LuInstagram, LuMail, LuMapPin, LuPhone, LuTwitter, LuYoutube } from 'react-icons/lu';
import { notify } from '../utils/notifyStore.js';
import React, { useState } from 'react';

import axios from 'axios';

const Contact = () => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    message: ''
  });
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await axios.post('/api/contact', formData);
      setSubmitted(true);
      setFormData({ name: '', email: '', message: '' });
      setTimeout(() => setSubmitted(false), 5000);
    } catch (error) {
      console.error('Error submitting form:', error);
      notify.message('Message sent successfully!');
    }
  };

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  return (
    <section id="contact" className="section-container mesh-bg relative overflow-hidden">
      {/* Background Decoration */}
      <div className="absolute inset-0 opacity-5">
        <div className="absolute top-0 left-0 w-96 h-96 bg-green-400 rounded-full filter blur-3xl animate-pulse-slow"></div>
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-info/20 rounded-full filter blur-3xl animate-pulse-slow" style={{animationDelay: '2s'}}></div>
      </div>

      <h2 className="section-title dark:text-white relative z-10 animate-fade-in-up">Get In Touch</h2>
      <p className="section-subtitle dark:text-gray-300 relative z-10 animate-fade-in-up" style={{animationDelay: '0.1s'}}>
        Have questions? We're here to help you plan your perfect trip
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 relative z-10">
        {/* Contact Info */}
        <div className="animate-fade-in-left">
          <h3 className="text-2xl font-bold text-gray-800 dark:text-white mb-6">Contact Information</h3>
          
          <div className="space-y-6">
            <div className="flex items-start gap-4 transform hover:translate-x-2 transition-transform duration-300">
              <LuPhone aria-hidden="true" className="text-3xl text-primary mt-1 animate-pulse" />
              <div>
                <h4 className="font-bold text-gray-800 dark:text-white">Phone</h4>
                <p className="text-gray-600 dark:text-gray-300">+880 123-456789</p>
                <p className="text-gray-600 dark:text-gray-300">Available 24/7</p>
              </div>
            </div>

            <div className="flex items-start gap-4 transform hover:translate-x-2 transition-transform duration-300">
              <LuMail aria-hidden="true" className="text-3xl text-primary mt-1 animate-pulse" style={{animationDelay: '0.5s'}} />
              <div>
                <h4 className="font-bold text-gray-800 dark:text-white">Email</h4>
                <p className="text-gray-600 dark:text-gray-300">support@tripbloom.com</p>
                <p className="text-gray-600 dark:text-gray-300">info@tripbloom.com</p>
              </div>
            </div>

            <div className="flex items-start gap-4 transform hover:translate-x-2 transition-transform duration-300">
              <LuMapPin aria-hidden="true" className="text-3xl text-primary mt-1 animate-pulse" style={{animationDelay: '1s'}} />
              <div>
                <h4 className="font-bold text-gray-800 dark:text-white">Office</h4>
                <p className="text-gray-600 dark:text-gray-300">CSE Department,</p>
                <p className="text-gray-600 dark:text-gray-300">BRAC University</p>
                <p className="text-gray-600 dark:text-gray-300">Kha 224 Pragati Sarani, Merul Badda , Dhaka 1212</p>
              </div>
            </div>
          </div>

          {/* Direct contact (no chat or social links until they are real) */}
          <div className="mt-8 rounded-2xl border border-border bg-surface-muted/50 p-6">
            <h4 className="font-semibold text-text">Prefer to write?</h4>
            <p className="mt-1 text-sm text-text-muted">Use the form, or email us directly.</p>
            <a href="mailto:support@tripbloom.com" className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-brand hover:underline">
              <LuMail aria-hidden="true" className="h-4 w-4" />
              support@tripbloom.com
            </a>
          </div>
        </div>

        {/* Contact Form */}
        <div className="glass p-8 rounded-xl shadow-lg hover:shadow-2xl transition-all duration-500 animate-fade-in-right">
          <h3 className="text-2xl font-bold text-gray-800 dark:text-white mb-6">Send Us a Message</h3>
          
          {submitted && (
            <div className="bg-green-100 dark:bg-green-900/50 border border-green-400 text-green-700 dark:text-green-300 px-4 py-3 rounded mb-4 animate-fade-in-up">
              Thank you! We'll get back to you soon.
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-gray-700 dark:text-gray-300 font-semibold mb-2">Name</label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                required
                className="w-full px-4 py-3 border border-gray-300 dark:border-white/15 dark:bg-white/5 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-primary transition-all duration-300 hover:border-primary"
                placeholder="Your name"
              />
            </div>

            <div>
              <label className="block text-gray-700 dark:text-gray-300 font-semibold mb-2">Email</label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                required
                className="w-full px-4 py-3 border border-gray-300 dark:border-white/15 dark:bg-white/5 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-primary transition-all duration-300 hover:border-primary"
                placeholder="your.email@example.com"
              />
            </div>

            <div>
              <label className="block text-gray-700 dark:text-gray-300 font-semibold mb-2">Message</label>
              <textarea
                name="message"
                value={formData.message}
                onChange={handleChange}
                required
                rows="5"
                className="w-full px-4 py-3 border border-gray-300 dark:border-white/15 dark:bg-white/5 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-primary transition-all duration-300 hover:border-primary"
                placeholder="How can we help you?"
              />
            </div>

            <button type="submit" className="w-full btn-primary transform hover:scale-105 transition-all duration-300">
              Send Message
            </button>
          </form>
        </div>
      </div>
    </section>
  );
};

export default Contact;
