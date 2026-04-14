import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useData } from '../hooks/useData';
import { LogOut, LayoutDashboard, Globe, User as UserIcon, Menu, X } from 'lucide-react';
import { AnnouncementBar } from './AnnouncementBar';
import { motion, AnimatePresence } from 'motion/react';

export const Navbar = () => {
  const { user, isAdmin, logout } = useAuth();
  const { settings } = useData();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const isPublicView = location.pathname === '/';

  return (
    <header className="sticky top-0 z-50">
      {settings.showAnnouncement && settings.announcement && (
        <AnnouncementBar 
          text={settings.announcement} 
          speed={settings.announcementSpeed}
        />
      )}
      <nav className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 sm:h-20">
            <div className="flex items-center">
              <Link to="/" className="flex items-center space-x-2 sm:space-x-4 group">
                <div className="flex flex-col overflow-hidden">
                  <span className="text-sm sm:text-xl font-black text-gray-900 leading-none tracking-tighter uppercase truncate">
                    {settings.tagline1 || 'Samriddhi Welfare Association'}
                  </span>
                  <span className="text-[8px] sm:text-[11px] font-bold text-indigo-600 uppercase tracking-widest mt-0.5 sm:mt-1 truncate">
                    {settings.tagline2 || 'Collective savings, strong future'}
                  </span>
                </div>
              </Link>
            </div>

            {/* Desktop Navigation */}
            <div className="hidden md:flex items-center space-x-4">
              <Link to="/" className="text-gray-600 hover:text-indigo-600 px-3 py-2 rounded-md text-sm font-medium transition-colors">
                Public View
              </Link>
              
              {isAdmin && !isPublicView && (
                <Link to="/finance-based-saving" className="text-gray-600 hover:text-indigo-600 px-3 py-2 rounded-md text-sm font-medium transition-colors flex items-center">
                  <LayoutDashboard className="w-4 h-4 mr-1" />
                  Dashboard
                </Link>
              )}

              {user && !isPublicView ? (
                <div className="flex items-center space-x-3 ml-4 border-l pl-4">
                  <div className="flex items-center space-x-2">
                    <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center">
                      <UserIcon className="w-4 h-4 text-gray-500" />
                    </div>
                    <span className="text-sm text-gray-700">{user.email}</span>
                  </div>
                  <button
                    onClick={handleLogout}
                    className="text-gray-500 hover:text-red-600 transition-colors"
                    title="Logout"
                  >
                    <LogOut className="w-5 h-5" />
                  </button>
                </div>
              ) : !user && !isPublicView && (
                <Link
                  to="/finance-based-saving-login"
                  className="ml-4 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-all shadow-sm"
                >
                  Admin Login
                </Link>
              )}
            </div>

            {/* Mobile menu button */}
            <div className="flex md:hidden items-center">
              <button
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                className="inline-flex items-center justify-center p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-indigo-500"
              >
                <span className="sr-only">Open main menu</span>
                {isMenuOpen ? <X className="block h-6 w-6" /> : <Menu className="block h-6 w-6" />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Navigation */}
        <AnimatePresence>
          {isMenuOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="md:hidden bg-white border-t border-gray-100 overflow-hidden"
            >
              <div className="px-2 pt-2 pb-3 space-y-1">
                <Link
                  to="/"
                  onClick={() => setIsMenuOpen(false)}
                  className="block px-3 py-2 rounded-md text-base font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-50"
                >
                  Public View
                </Link>
                {isAdmin && !isPublicView && (
                  <Link
                    to="/finance-based-saving"
                    onClick={() => setIsMenuOpen(false)}
                    className="block px-3 py-2 rounded-md text-base font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-50"
                  >
                    Dashboard
                  </Link>
                )}
              </div>
              <div className="pt-4 pb-3 border-t border-gray-100 px-4">
                {user && !isPublicView ? (
                  <div className="space-y-3">
                    <div className="flex items-center">
                      <div className="flex-shrink-0">
                        <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center">
                          <UserIcon className="w-6 h-6 text-gray-500" />
                        </div>
                      </div>
                      <div className="ml-3">
                        <div className="text-base font-medium text-gray-800 truncate max-w-[200px]">{user.email}</div>
                      </div>
                    </div>
                    <button
                      onClick={() => { handleLogout(); setIsMenuOpen(false); }}
                      className="w-full flex items-center justify-center px-4 py-2 border border-transparent text-base font-medium rounded-md text-white bg-red-600 hover:bg-red-700"
                    >
                      <LogOut className="w-5 h-5 mr-2" />
                      Sign out
                    </button>
                  </div>
                ) : !user && !isPublicView && (
                  <Link
                    to="/finance-based-saving-login"
                    onClick={() => setIsMenuOpen(false)}
                    className="w-full flex items-center justify-center px-4 py-2 border border-transparent text-base font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
                  >
                    Admin Login
                  </Link>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </nav>
    </header>
  );
};
