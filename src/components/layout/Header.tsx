import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useTranslation } from '../../contexts/LanguageContext';
import { Button } from '../common/Button';
import { FirebaseConfigModal } from '../common/FirebaseConfigModal';
import {
  Vote,
  PlusCircle,
  LogIn,
  LogOut,
  Settings,
  User as UserIcon,
  ShieldCheck,
  Globe,
} from 'lucide-react';

export const Header: React.FC = () => {
  const { currentUser, isFirebaseConfigured, signInWithGoogle, signInAsDemoUser, logout } = useAuth();
  const { t, language, toggleLanguage } = useTranslation();
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);

  // Show Firebase settings button only in local environment
  const isLocalEnvironment =
    import.meta.env.DEV ||
    (typeof window !== 'undefined' &&
      (window.location.hostname === 'localhost' ||
        window.location.hostname === '127.0.0.1' ||
        window.location.hostname.startsWith('192.168.') ||
        window.location.hostname.endsWith('.local')));

  return (
    <>
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2.5 group">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-pink-500 flex items-center justify-center text-white shadow-md shadow-indigo-200 group-hover:scale-105 transition-transform">
              <Vote className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xl font-black tracking-tight bg-gradient-to-r from-indigo-600 to-pink-600 bg-clip-text text-transparent">
                Votica
              </span>
              <span className="hidden sm:inline-block ml-2 text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                {t('common.runoffBadge')}
              </span>
            </div>
          </Link>

          {/* Right Navigation */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Language Switcher */}
            <button
              onClick={toggleLanguage}
              title={t('header.languageSwitch')}
              aria-label={t('header.languageSwitch')}
              className="flex items-center gap-1 text-xs font-bold px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 transition-colors shadow-xs"
            >
              <Globe className="w-3.5 h-3.5 text-indigo-600" />
              <span>{language === 'ja' ? 'EN' : '日本語'}</span>
            </button>

            {/* Create Poll Button */}
            <Link to="/create">
              <Button
                variant="primary"
                size="sm"
                leftIcon={<PlusCircle className="w-4 h-4" />}
                className="hidden sm:inline-flex shadow-sm"
              >
                {t('common.createPoll')}
              </Button>
            </Link>

            {/* Firebase Status pill (Local environment only) */}
            {isLocalEnvironment && (
              <button
                onClick={() => setIsConfigModalOpen(true)}
                title={isFirebaseConfigured ? t('header.firebaseConnected') : t('header.demoMode')}
                className={`flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border transition-colors ${
                  isFirebaseConfigured
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                    : 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100'
                }`}
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                <span className="hidden md:inline font-medium">
                  {isFirebaseConfigured ? 'Firebase' : 'Demo'}
                </span>
                <Settings className="w-3 h-3 text-slate-400" />
              </button>
            )}

            {/* Auth Actions */}
            {currentUser ? (
              <div className="relative">
                <button
                  onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                  className="flex items-center gap-2 p-1 pl-2 pr-2.5 rounded-full border border-slate-200 hover:border-slate-300 hover:bg-slate-50 transition-all text-left"
                >
                  {currentUser.photoURL ? (
                    <img
                      src={currentUser.photoURL}
                      alt={currentUser.displayName || t('common.user')}
                      className="w-7 h-7 rounded-full object-cover ring-1 ring-indigo-500"
                    />
                  ) : (
                    <div className="w-7 h-7 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-xs font-bold">
                      {(currentUser.displayName || 'U')[0]}
                    </div>
                  )}
                  <span className="text-xs font-medium text-slate-700 max-w-[90px] truncate hidden sm:inline">
                    {currentUser.displayName || t('common.user')}
                  </span>
                </button>

                {/* Dropdown Menu */}
                {isUserMenuOpen && (
                  <>
                    <div
                      className="fixed inset-0 z-40"
                      onClick={() => setIsUserMenuOpen(false)}
                    />
                    <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-xl border border-slate-100 py-2 z-50 animate-slide-up">
                      <div className="px-4 py-2 border-b border-slate-100">
                        <p className="text-xs font-bold text-slate-900 truncate">
                          {currentUser.displayName}
                        </p>
                        <p className="text-[11px] text-slate-500 truncate mt-0.5">
                          {currentUser.email || t('header.googleSignedIn')}
                        </p>
                      </div>

                      <Link
                        to="/"
                        onClick={() => setIsUserMenuOpen(false)}
                        className="flex items-center gap-2 px-4 py-2 text-xs text-slate-700 hover:bg-slate-50 transition-colors"
                      >
                        <UserIcon className="w-4 h-4 text-slate-400" />
                        {t('header.myDashboard')}
                      </Link>

                      <Link
                        to="/create"
                        onClick={() => setIsUserMenuOpen(false)}
                        className="flex items-center gap-2 px-4 py-2 text-xs text-indigo-600 hover:bg-indigo-50 font-medium transition-colors sm:hidden"
                      >
                        <PlusCircle className="w-4 h-4" />
                        {t('header.createNewPoll')}
                      </Link>

                      <button
                        onClick={() => {
                          setIsUserMenuOpen(false);
                          logout();
                        }}
                        className="w-full flex items-center gap-2 px-4 py-2 text-xs text-rose-600 hover:bg-rose-50 transition-colors"
                      >
                        <LogOut className="w-4 h-4" />
                        {t('header.logout')}
                      </button>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-1.5">
                <Button
                  variant="outline"
                  size="sm"
                  leftIcon={<LogIn className="w-4 h-4 text-indigo-600" />}
                  onClick={signInWithGoogle}
                >
                  {t('header.signInWithGoogle')}
                </Button>
                {!isFirebaseConfigured && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => signInAsDemoUser()}
                    className="text-xs text-slate-500 hover:text-slate-800"
                  >
                    {t('header.tryDemo')}
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Config Modal */}
      <FirebaseConfigModal
        isOpen={isConfigModalOpen}
        onClose={() => setIsConfigModalOpen(false)}
      />
    </>
  );
};
