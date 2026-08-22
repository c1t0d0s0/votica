import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTranslation } from '../contexts/LanguageContext';
import { getUserCreatedPolls, getPublicPolls } from '../lib/firestoreService';
import { Poll } from '../lib/types';
import { PollCard } from '../components/poll/PollCard';
import { DeletePollModal } from '../components/poll/DeletePollModal';
import { Button } from '../components/common/Button';
import { Vote, PlusCircle, Calendar } from 'lucide-react';

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
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-8">

      {/* Polls Dashboard Tabs */}
      <section className="space-y-6">
        <div className="flex items-center justify-between border-b border-slate-200 pb-2">
          <div className="flex items-center gap-4">
            {currentUser && (
              <button
                onClick={() => setActiveTab('my')}
                className={`pb-2 text-sm font-bold border-b-2 transition-all ${
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
              className={`pb-2 text-sm font-bold border-b-2 transition-all ${
                activeTab === 'public' || !currentUser
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              {t('home.publicPollsTab', { count: publicPolls.length })}
            </button>
          </div>

          <div className="flex items-center gap-2 sm:gap-3 flex-wrap justify-end">
            <Link
              to="/create-schedule"
              className="text-xs font-bold text-indigo-600 hover:text-indigo-700 flex items-center gap-1 bg-indigo-50 hover:bg-indigo-100/70 px-2.5 py-1 rounded-lg transition-colors border border-indigo-200 shrink-0"
            >
              <Calendar className="w-3 h-3" />
              <span>{t('schedule.homeCreateBtn')}</span>
            </Link>
            <Link
              to="/create"
              className="text-xs font-bold text-indigo-600 hover:text-indigo-700 flex items-center gap-1 bg-indigo-50 hover:bg-indigo-100/70 px-2.5 py-1 rounded-lg transition-colors border border-indigo-200 shrink-0"
            >
              <PlusCircle className="w-3 h-3" />
              <span>{t('common.createPoll')}</span>
            </Link>
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
