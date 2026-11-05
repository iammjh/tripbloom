import {LuMenu, LuX} from 'react-icons/lu';
import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

import AuthModal from './AuthModal';

const Navbar = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);

  const navLinks = [
    { name: 'Home', href: '#home' },
    { name: 'Packages', href: '#packages' },
    { name: 'Destinations', href: '#destinations' },
    { name: 'About', href: '#about' },
    { name: 'Contact', href: '#contact' },
  ];

  // Get user info from localStorage
  const userName = localStorage.getItem('userName');
  const userRole = localStorage.getItem('userRole');
  const [showDropdown, setShowDropdown] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const handleBookNow = (e) => {
    e && e.preventDefault && e.preventDefault();
    // If we're on the homepage, scroll to the packages section if present
    if (location.pathname === '/' || location.hash === '#home') {
      const el = document.getElementById('packages');
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return;
      }
    }
    // Otherwise navigate to the browse packages page
    navigate('/browse-packages');
  };

  return (
    <nav className="glass glass-strong shadow-lg fixed w-full top-0 z-50 transition-colors duration-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <div className="flex items-center space-x-2">
            <img src="/tripbloom_logo.svg" alt="TripBloom Logo" className="w-14 h-14" />
            <h1 className="font-display text-2xl font-bold text-primary">
              TripBloom
            </h1>
          </div>
          {/* Desktop Menu */}
          <div className="hidden md:flex space-x-8 items-center">
            {navLinks.map((link) => (
              <a
                key={link.name}
                href={link.href}
                className="text-gray-700 dark:text-gray-300 hover:text-primary dark:hover:text-primary transition-colors duration-300 font-medium"
              >
                {link.name}
              </a>
            ))}
            {/* Dark Mode Toggle */}
          </div>

          {/* CTA/User Buttons */}
          <div className="hidden md:flex items-center space-x-3 relative">
            <button onClick={handleBookNow} className="btn-primary">Book Now</button>
            {!userName ? (
              <button 
                onClick={() => setShowAuthModal(true)}
                className="px-6 py-2.5 border-2 border-primary text-primary dark:border-green-400 dark:text-green-400 font-semibold rounded-lg hover:bg-primary hover:text-white dark:hover:bg-green-400 dark:hover:text-gray-900 transition-all duration-300 flex items-center gap-2 shadow-md hover:shadow-lg transform hover:scale-105"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                Log In
              </button>
            ) : (
              <div className="relative">
                <button
                  onClick={() => setShowDropdown(!showDropdown)}
                  className="px-6 py-2.5 border-2 border-primary text-primary dark:border-green-400 dark:text-green-400 font-semibold rounded-lg flex items-center gap-2 shadow-md hover:shadow-lg transform hover:scale-105"
                >
                  {userName}
                  <svg className="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {showDropdown && (
                  <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-lg py-2 z-50 border border-gray-200 dark:border-gray-700">
                    {userRole === 'customer' ? (
                      <>
                        <button
                          onClick={() => {
                            setShowDropdown(false);
                            navigate('/customer');
                          }}
                          className="w-full text-left px-6 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 font-semibold"
                        >
                          Profile
                        </button>
                        <button
                          onClick={() => {
                            localStorage.removeItem('userName');
                            localStorage.removeItem('userRole');
                            setShowDropdown(false);
                            navigate('/');
                          }}
                          className="w-full text-left px-6 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 text-red-600 dark:text-red-400 font-semibold"
                        >
                          Log Out
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => {
                            setShowDropdown(false);
                            navigate(userRole === 'admin' ? '/admin' : '/operator');
                          }}
                          className="w-full text-left px-6 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 font-semibold"
                        >
                          Dashboard
                        </button>
                        <button
                          onClick={() => {
                            localStorage.removeItem('userName');
                            localStorage.removeItem('userRole');
                            setShowDropdown(false);
                            navigate('/');
                          }}
                          className="w-full text-left px-6 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 text-red-600 dark:text-red-400 font-semibold"
                        >
                          Log Out
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Mobile Menu Button */}
          <div className="md:hidden flex items-center space-x-2">
            {/* Dark Mode Toggle Mobile */}
            
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="text-gray-700 dark:text-gray-300 hover:text-primary"
            >
              {isOpen ? <LuX aria-hidden="true" size={24} /> : <LuMenu aria-hidden="true" size={24} />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      {isOpen && (
        <div className="md:hidden bg-white/95 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 backdrop-blur-md">
          <div className="px-2 pt-2 pb-3 space-y-1">
            {navLinks.map((link) => (
              <a
                key={link.name}
                href={link.href}
                className="block px-3 py-2 text-gray-700 dark:text-gray-300 hover:text-primary hover:bg-gray-50 dark:hover:bg-gray-800 rounded-md"
                onClick={() => setIsOpen(false)}
              >
                {link.name}
              </a>
            ))}
            <button onClick={(e) => { handleBookNow(e); setIsOpen(false); }} className="w-full btn-primary mt-2">Book Now</button>
            <button 
              onClick={() => {
                setShowAuthModal(true);
                setIsOpen(false);
              }}
              className="w-full mt-2 px-4 py-2.5 border-2 border-primary text-primary dark:border-green-400 dark:text-green-400 font-semibold rounded-lg hover:bg-primary hover:text-white dark:hover:bg-green-400 dark:hover:text-gray-900 transition-all duration-300 flex items-center justify-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              Log In
            </button>
          </div>
        </div>
      )}

      {/* Auth Modal */}
      <AuthModal isOpen={showAuthModal} onClose={() => setShowAuthModal(false)} />
    </nav>
  );
};

export default Navbar;
