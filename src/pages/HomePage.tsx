import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTranslation } from '../contexts/LanguageContext';
import { getUserCreatedPolls, getPublicPolls } from '../lib/firestoreService';
import { Poll } from '../lib/types';
import { PollCard } from '../components/poll/PollCard';
import { DeletePollModal } from '../components/poll/DeletePollModal';
import { Button } from '../components/common/Button';
import { Vote, PlusCircle, Search, Calendar } from 'lucide-react';
import { useToast } from '../contexts/ToastContext';

export const HomePage: React.FC = () => {
  const { currentUser } = useAuth();
  const { showToast } = useToast();
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<'my' | 'public'>('my');
  const [directPollId, setDirectPollId] = useState('');
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

  const handleDirectAccess = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanId = directPollId.trim().replace(/^.*\/poll\//, '').replace(/^#\/poll\//, '');
    if (!cleanId) {
      showToast('error', t('home.enterPollIdError'));
      return;
    }
    navigate(`/poll/${cleanId}`);
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-8">

      {/* Direct Poll Access Box */}
      <section className="bg-white rounded-2xl p-4 sm:p-6 border border-slate-200 shadow-sm">
        <form onSubmit={handleDirectAccess} className="flex flex-col sm:flex-row items-center gap-3">
          <div className="flex items-center gap-2 text-slate-700 font-bold text-sm shrink-0">
            <Search className="w-4 h-4 text-indigo-600" />
            <span>{t('home.joinPoll')}</span>
          </div>
          <input
            type="text"
            value={directPollId}
            onChange={e => setDirectPollId(e.target.value)}
            placeholder={t('home.pollIdPlaceholder')}
            className="flex-1 w-full text-sm bg-white text-slate-900 placeholder:text-slate-400 px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all shadow-sm"
          />
          <Button type="submit" variant="secondary" size="md" className="w-full sm:w-auto shrink-0">
            {t('home.openPoll')}
          </Button>
        </form>
      </section>

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

          <div className="flex items-center gap-3">
            <Link
              to="/create-schedule"
              className="text-xs font-bold text-indigo-600 hover:text-indigo-700 flex items-center gap-1 bg-indigo-50 hover:bg-indigo-100/70 px-2.5 py-1 rounded-lg transition-colors border border-indigo-200"
            >
              <Calendar className="w-3 h-3" />
              <span>{t('schedule.homeCreateBtn')}</span>
            </Link>
            <Link to="/create" className="text-xs font-bold text-indigo-600 hover:text-indigo-700">
              {t('common.newPoll')}
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
