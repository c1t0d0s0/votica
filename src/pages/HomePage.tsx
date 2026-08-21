import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { getUserCreatedPolls, getPublicPolls } from '../lib/firestoreService';
import { Poll } from '../lib/types';
import { PollCard } from '../components/poll/PollCard';
import { Button } from '../components/common/Button';
import { Vote, PlusCircle, Search } from 'lucide-react';
import { useToast } from '../contexts/ToastContext';

export const HomePage: React.FC = () => {
  const { currentUser } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<'my' | 'public'>('my');
  const [directPollId, setDirectPollId] = useState('');
  const [myPolls, setMyPolls] = useState<Poll[]>([]);
  const [publicPolls, setPublicPolls] = useState<Poll[]>([]);

  useEffect(() => {
    const loadPolls = async () => {
      try {
        if (currentUser) {
          const userPolls = await getUserCreatedPolls(currentUser.uid);
          setMyPolls(userPolls);
        }
        const pub = await getPublicPolls();
        setPublicPolls(pub);
      } catch (e) {
        console.error('Error loading polls:', e);
      }
    };
    loadPolls();
  }, [currentUser]);

  const handleDirectAccess = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanId = directPollId.trim().replace(/^.*\/poll\//, '').replace(/^#\/poll\//, '');
    if (!cleanId) {
      showToast('error', '投票IDまたはURLを入力してください');
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
            <span>投票に参加:</span>
          </div>
          <input
            type="text"
            value={directPollId}
            onChange={e => setDirectPollId(e.target.value)}
            placeholder="共有された投票IDまたはURLを貼り付け (例: poll_abc123)"
            className="flex-1 w-full text-sm bg-white text-slate-900 placeholder:text-slate-400 px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all shadow-sm"
          />
          <Button type="submit" variant="secondary" size="md" className="w-full sm:w-auto shrink-0">
            投票を開く
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
                自分が作成した投票 ({myPolls.length})
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
              公開中の投票 ({publicPolls.length})
            </button>
          </div>

          <Link to="/create" className="text-xs font-bold text-indigo-600 hover:text-indigo-700">
            + 新規作成
          </Link>
        </div>

        {/* Tab Content */}
        {activeTab === 'my' && currentUser && (
          <div>
            {myPolls.length === 0 ? (
              <div className="text-center py-12 bg-white rounded-3xl border border-dashed border-slate-300 p-8">
                <Vote className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <h3 className="text-base font-bold text-slate-700">作成した投票はありません</h3>
                <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                  チームの意思決定やアンケートのための投票フォームを数秒で作成できます。
                </p>
                <Link to="/create" className="mt-4 inline-block">
                  <Button variant="primary" size="sm" leftIcon={<PlusCircle className="w-4 h-4" />}>
                    最初の投票を作成
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {myPolls.map(poll => (
                  <PollCard key={poll.id} poll={poll} isCreator={true} />
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
                <h3 className="text-base font-bold text-slate-700">現在公開中の投票はありません</h3>
                <p className="text-xs text-slate-400 mt-1">
                  新しい投票を作成して参加者を招待しましょう！
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {publicPolls.map(poll => (
                  <PollCard
                    key={poll.id}
                    poll={poll}
                    isCreator={currentUser?.uid === poll.creatorUid}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
};
