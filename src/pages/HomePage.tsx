import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTranslation } from '../contexts/LanguageContext';
import { getUserCreatedPolls, getPublicPolls } from '../lib/firestoreService';
import { Poll } from '../lib/types';
import { PollCard } from '../components/poll/PollCard';
import { DeletePollModal } from '../components/poll/DeletePollModal';
import { Button } from '../components/common/Button';
import { Vote, PlusCircle, Calendar, ArrowRight, Sparkles, Clock } from 'lucide-react';

export const HomePage: React.FC = () => {
  const { currentUser } = useAuth();
  const { t } = useTranslation();

  const [activeTab, setActiveTab] = useState<'my' | 'public'>('my');
  const [myPolls, setMyPolls] = useState<Poll[]>([]);
  const [publicPolls, setPublicPolls] = useState<Poll[]>([]);
  const [pollToDelete, setPollToDelete] = useState<Poll | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  const loadPolls = useCallback(async () => {
    try {
      if (currentUser) {
        const userPolls = await getUserCreatedPolls(currentUser.uid);
        setMyPolls(userPolls);
      } else {
        setMyPolls([]);
      }
      const pub = await getPublicPolls();
      setPublicPolls(pub);
    } catch (e) {
      console.error('Error loading polls:', e);
    }
  }, [currentUser]);

  useEffect(() => {
    loadPolls();
  }, [loadPolls]);

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-10">

      {/* Main Creation Hero Section (2 High-Affordance Big CTA Buttons) */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
        {/* Button 1: Create Schedule Adjustment */}
        <Link
          to="/create-schedule"
          className="group relative overflow-hidden bg-gradient-to-br from-indigo-600 via-indigo-700 to-blue-800 text-white p-6 sm:p-8 rounded-3xl shadow-lg shadow-indigo-600/25 hover:shadow-2xl hover:shadow-indigo-600/40 hover:-translate-y-1 active:scale-[0.98] transition-all duration-200 flex flex-col justify-between cursor-pointer border border-indigo-400/30"
        >
          {/* Background Decorative Watermark Icon */}
          <div className="absolute -right-4 -bottom-4 text-white/10 pointer-events-none group-hover:scale-110 group-hover:rotate-3 transition-transform duration-300">
            <Calendar className="w-36 h-36" strokeWidth={1.5} />
          </div>

          <div className="relative z-10 space-y-4">
            <div className="flex items-center justify-between">
              <div className="w-13 h-13 rounded-2xl bg-white/15 backdrop-blur-md border border-white/25 flex items-center justify-center text-white shadow-inner group-hover:scale-110 transition-transform">
                <Calendar className="w-7 h-7 stroke-[2.5]" />
              </div>
              <span className="inline-flex items-center gap-1.5 text-xs font-bold px-3.5 py-1.5 rounded-full bg-white/20 text-white backdrop-blur-md border border-white/30 shadow-xs">
                <Clock className="w-3.5 h-3.5" />
                <span>{t('home.createScheduleCardBadge')}</span>
              </span>
            </div>

            <div>
              <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight leading-tight drop-shadow-xs">
                {t('home.createScheduleCardTitle')}
              </h2>
              <p className="text-xs sm:text-sm text-indigo-100/90 mt-2.5 leading-relaxed max-w-sm">
                {t('home.createScheduleCardDesc')}
              </p>
            </div>
          </div>

          <div className="relative z-10 pt-6 mt-6 border-t border-white/15 flex items-center justify-between">
            <span className="text-xs font-bold text-indigo-100 tracking-wide">
              {t('schedule.tabScheduleAdjust')}
            </span>
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white text-indigo-700 font-bold text-xs shadow-md group-hover:bg-indigo-50 group-hover:px-5 transition-all">
              <span>{t('schedule.homeCreateBtn')}</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </div>
          </div>
        </Link>

        {/* Button 2: Create Standard Poll */}
        <Link
          to="/create"
          className="group relative overflow-hidden bg-gradient-to-br from-rose-600 via-pink-600 to-purple-800 text-white p-6 sm:p-8 rounded-3xl shadow-lg shadow-pink-600/25 hover:shadow-2xl hover:shadow-pink-600/40 hover:-translate-y-1 active:scale-[0.98] transition-all duration-200 flex flex-col justify-between cursor-pointer border border-pink-400/30"
        >
          {/* Background Decorative Watermark Icon */}
          <div className="absolute -right-4 -bottom-4 text-white/10 pointer-events-none group-hover:scale-110 group-hover:-rotate-3 transition-transform duration-300">
            <Vote className="w-36 h-36" strokeWidth={1.5} />
          </div>

          <div className="relative z-10 space-y-4">
            <div className="flex items-center justify-between">
              <div className="w-13 h-13 rounded-2xl bg-white/15 backdrop-blur-md border border-white/25 flex items-center justify-center text-white shadow-inner group-hover:scale-110 transition-transform">
                <Vote className="w-7 h-7 stroke-[2.5]" />
              </div>
              <span className="inline-flex items-center gap-1.5 text-xs font-bold px-3.5 py-1.5 rounded-full bg-white/20 text-white backdrop-blur-md border border-white/30 shadow-xs">
                <Sparkles className="w-3.5 h-3.5" />
                <span>{t('home.createPollCardBadge')}</span>
              </span>
            </div>

            <div>
              <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight leading-tight drop-shadow-xs">
                {t('home.createPollCardTitle')}
              </h2>
              <p className="text-xs sm:text-sm text-pink-100/90 mt-2.5 leading-relaxed max-w-sm">
                {t('home.createPollCardDesc')}
              </p>
            </div>
          </div>

          <div className="relative z-10 pt-6 mt-6 border-t border-white/15 flex items-center justify-between">
            <span className="text-xs font-bold text-pink-100 tracking-wide">
              {t('schedule.tabStandardPoll')}
            </span>
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white text-pink-700 font-bold text-xs shadow-md group-hover:bg-pink-50 group-hover:px-5 transition-all">
              <span>{t('common.createPoll')}</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </div>
          </div>
        </Link>
      </section>

      {/* Polls Dashboard Tabs */}
      <section className="space-y-6">
        <div className="flex items-center justify-between border-b border-slate-200 pb-2">
          <div className="flex items-center gap-4">
            {currentUser && (
              <button
                onClick={() => setActiveTab('my')}
                className={`pb-2 text-sm font-bold border-b-2 transition-all cursor-pointer ${
                  activeTab === 'my'
                    ? 'border-indigo-600 text-indigo-600'
                    : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
              >
                {t('home.myPollsTab', { count: myPolls.length })}
              </button>
            )}
            <button
              onClick={() => setActiveTab('public')}
              className={`pb-2 text-sm font-bold border-b-2 transition-all cursor-pointer ${
                activeTab === 'public' || !currentUser
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              {t('home.publicPollsTab', { count: publicPolls.length })}
            </button>
          </div>
        </div>

        {/* Tab Content */}
        {activeTab === 'my' && currentUser && (
          <div>
            {myPolls.length === 0 ? (
              <div className="text-center py-12 bg-white rounded-3xl border border-dashed border-slate-300 p-8">
                <Vote className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <h3 className="text-base font-bold text-slate-700">{t('home.noMyPollsTitle')}</h3>
                <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                  {t('home.noMyPollsDesc')}
                </p>
                <div className="mt-4 flex items-center justify-center gap-2.5 flex-wrap">
                  <Link to="/create-schedule">
                    <Button variant="outline" size="sm" leftIcon={<Calendar className="w-4 h-4 text-indigo-600" />}>
                      {t('schedule.homeCreateBtn')}
                    </Button>
                  </Link>
                  <Link to="/create">
                    <Button variant="primary" size="sm" leftIcon={<PlusCircle className="w-4 h-4" />}>
                      {t('home.createFirstPoll')}
                    </Button>
                  </Link>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {myPolls.map(poll => (
                  <PollCard
                    key={poll.id}
                    poll={poll}
                    isCreator={true}
                    onDelete={p => {
                      setPollToDelete(p);
                      setIsDeleteModalOpen(true);
                    }}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {(activeTab === 'public' || !currentUser) && (
          <div>
            {publicPolls.length === 0 ? (
              <div className="text-center py-12 bg-white rounded-3xl border border-dashed border-slate-300 p-8">
                <Vote className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <h3 className="text-base font-bold text-slate-700">{t('home.noPublicPollsTitle')}</h3>
                <p className="text-xs text-slate-400 mt-1">
                  {t('home.noPublicPollsDesc')}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {publicPolls.map(poll => (
                  <PollCard
                    key={poll.id}
                    poll={poll}
                    isCreator={currentUser?.uid === poll.creatorUid}
                    onDelete={
                      currentUser?.uid === poll.creatorUid
                        ? p => {
                            setPollToDelete(p);
                            setIsDeleteModalOpen(true);
                          }
                        : undefined
                    }
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </section>

      {/* Delete Poll Modal */}
      {pollToDelete && (
        <DeletePollModal
          isOpen={isDeleteModalOpen}
          onClose={() => {
            setIsDeleteModalOpen(false);
            setPollToDelete(null);
          }}
          pollTitle={pollToDelete.title}
          pollId={pollToDelete.id}
          onSuccess={() => {
            loadPolls();
          }}
        />
      )}
    </div>
  );
};
