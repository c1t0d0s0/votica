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

      {/* Main Creation Hero Section (2 Large Side-by-Side Cards) */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
        {/* Card 1: Create Schedule Adjustment */}
        <Link
          to="/create-schedule"
          className="group relative bg-white hover:bg-gradient-to-br hover:from-white hover:to-indigo-50/40 p-6 sm:p-7 rounded-3xl border-2 border-slate-200 hover:border-indigo-400 shadow-sm hover:shadow-xl hover:-translate-y-0.5 transition-all flex flex-col justify-between"
        >
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 group-hover:scale-110 group-hover:bg-indigo-600 group-hover:text-white transition-all shadow-xs">
                <Calendar className="w-6 h-6" />
              </div>
              <span className="inline-flex items-center gap-1 text-xs font-bold px-3 py-1 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 group-hover:bg-indigo-100 transition-colors">
                <Clock className="w-3.5 h-3.5" />
                <span>{t('home.createScheduleCardBadge')}</span>
              </span>
            </div>

            <div>
              <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight group-hover:text-indigo-600 transition-colors">
                {t('home.createScheduleCardTitle')}
              </h2>
              <p className="text-xs sm:text-sm text-slate-500 mt-2 leading-relaxed">
                {t('home.createScheduleCardDesc')}
              </p>
            </div>
          </div>

          <div className="pt-6 mt-4 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-indigo-600 group-hover:text-indigo-700">
            <span>{t('schedule.homeCreateBtn')}</span>
            <div className="w-8 h-8 rounded-full bg-indigo-50 flex items-center justify-center group-hover:translate-x-1 group-hover:bg-indigo-600 group-hover:text-white transition-all">
              <ArrowRight className="w-4 h-4" />
            </div>
          </div>
        </Link>

        {/* Card 2: Create Standard Poll */}
        <Link
          to="/create"
          className="group relative bg-white hover:bg-gradient-to-br hover:from-white hover:to-pink-50/40 p-6 sm:p-7 rounded-3xl border-2 border-slate-200 hover:border-pink-400 shadow-sm hover:shadow-xl hover:-translate-y-0.5 transition-all flex flex-col justify-between"
        >
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="w-12 h-12 rounded-2xl bg-pink-50 border border-pink-100 flex items-center justify-center text-pink-600 group-hover:scale-110 group-hover:bg-pink-600 group-hover:text-white transition-all shadow-xs">
                <Vote className="w-6 h-6" />
              </div>
              <span className="inline-flex items-center gap-1 text-xs font-bold px-3 py-1 rounded-full bg-pink-50 text-pink-700 border border-pink-200 group-hover:bg-pink-100 transition-colors">
                <Sparkles className="w-3.5 h-3.5" />
                <span>{t('home.createPollCardBadge')}</span>
              </span>
            </div>

            <div>
              <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight group-hover:text-pink-600 transition-colors">
                {t('home.createPollCardTitle')}
              </h2>
              <p className="text-xs sm:text-sm text-slate-500 mt-2 leading-relaxed">
                {t('home.createPollCardDesc')}
              </p>
            </div>
          </div>

          <div className="pt-6 mt-4 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-pink-600 group-hover:text-pink-700">
            <span>{t('common.createPoll')}</span>
            <div className="w-8 h-8 rounded-full bg-pink-50 flex items-center justify-center group-hover:translate-x-1 group-hover:bg-pink-600 group-hover:text-white transition-all">
              <ArrowRight className="w-4 h-4" />
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
