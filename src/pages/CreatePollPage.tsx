import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { createPoll } from '../lib/firestoreService';
import { PollOption, PollRound, Poll } from '../lib/types';
import { OptionInputList } from '../components/poll/OptionInputList';
import { Button } from '../components/common/Button';
import { getOptionColor } from '../lib/runoffUtils';
import {
  Vote,
  Calendar,
  Layers,
  Lock,
  Globe,
  Sparkles,
  LogIn,
  AlertCircle,
} from 'lucide-react';

export const CreatePollPage: React.FC = () => {
  const { currentUser, signInWithGoogle } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');

  // Default dates: start now, end 24 hours later
  const now = new Date();
  const defaultEnd = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const formatForInput = (d: Date) => {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
      d.getHours()
    )}:${pad(d.getMinutes())}`;
  };

  const [startDate, setStartDate] = useState(formatForInput(now));
  const [endDate, setEndDate] = useState(formatForInput(defaultEnd));

  // Options (starts with 3 options, up to 20)
  const [options, setOptions] = useState<PollOption[]>([
    { id: 'opt_1', text: '', color: getOptionColor(0) },
    { id: 'opt_2', text: '', color: getOptionColor(1) },
    { id: 'opt_3', text: '', color: getOptionColor(2) },
  ]);

  // Max choices
  const [maxChoices, setMaxChoices] = useState<number>(1);

  // Result visibility (default: false -> creator only)
  const [isPublicResult, setIsPublicResult] = useState<boolean>(false);

  // Authentication requirement (default: true -> Google login required)
  const [requireAuth, setRequireAuth] = useState<boolean>(true);

  // Voter names breakdown visibility (default: false -> hide who voted for what)
  const [showVoterNames, setShowVoterNames] = useState<boolean>(false);

  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!currentUser) {
      showToast('error', '投票を作成するにはGoogleログインが必要です');
      return;
    }

    if (!title.trim()) {
      showToast('error', '投票タイトルを入力してください');
      return;
    }

    const filledOptions = options.map(o => ({ ...o, text: o.text.trim() }));
    if (filledOptions.some(o => !o.text)) {
      showToast('error', 'すべての選択肢に内容を入力してください');
      return;
    }

    if (filledOptions.length < 2) {
      showToast('error', '選択肢は最低2つ必要です');
      return;
    }

    if (filledOptions.length > 20) {
      showToast('error', '選択肢の上限は20個までです');
      return;
    }

    const startTimestamp = new Date(startDate).getTime();
    const endTimestamp = new Date(endDate).getTime();
    if (isNaN(startTimestamp) || isNaN(endTimestamp)) {
      showToast('error', '日時の指定が正しくありません');
      return;
    }

    if (endTimestamp <= startTimestamp) {
      showToast('error', '終了日時は開始日時より未来に設定してください');
      return;
    }

    try {
      setIsSubmitting(true);

      const pollData: Omit<Poll, 'id' | 'createdAt' | 'updatedAt' | 'currentRound' | 'totalRounds'> = {
        title: title.trim(),
        description: description.trim(),
        creatorUid: currentUser.uid,
        creatorDisplayName: currentUser.displayName || '管理者',
        creatorEmail: currentUser.email || undefined,
        creatorPhotoURL: currentUser.photoURL || undefined,
        status: 'active',
        isPublicResult,
        requireAuth,
        showVoterNames,
      };

      const initialRound: Omit<PollRound, 'roundNumber'> = {
        title: '第1回 投票',
        description: '初期投票ラウンド',
        startDate: new Date(startDate).toISOString(),
        endDate: new Date(endDate).toISOString(),
        maxChoices: Math.min(maxChoices, filledOptions.length),
        options: filledOptions,
        status: 'open',
        candidateSource: 'manual',
      };

      const pollId = await createPoll(pollData, initialRound);
      showToast('success', '投票フォームを作成しました！');
      navigate(`/poll/${pollId}`);
    } catch (err: any) {
      console.error('Failed to create poll:', err);
      showToast('error', '投票の作成に失敗しました: ' + (err.message || ''));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
      {/* Page Header */}
      <div className="mb-8 text-center sm:text-left">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-50 text-indigo-700 text-xs font-bold mb-2">
          <Sparkles className="w-3.5 h-3.5" />
          <span>新規投票フォーム作成</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
          新しい投票を作成
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 mt-1">
          選択肢（最大20件）、投票期間、上限選択数を設定して共有リンクを発行します。
        </p>
      </div>

      {/* Login reminder if not logged in */}
      {!currentUser && (
        <div className="mb-6 p-4 rounded-2xl bg-amber-50 border border-amber-200 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
            <div className="text-xs text-amber-900">
              <span className="font-bold">Googleログインが必要です</span>
              <p className="text-amber-700 mt-0.5">
                作成者として管理権限を保持するため、Googleアカウントでの認証が必要です。
              </p>
            </div>
          </div>
          <Button
            type="button"
            variant="primary"
            size="sm"
            onClick={signInWithGoogle}
            leftIcon={<LogIn className="w-4 h-4" />}
            className="shrink-0 w-full sm:w-auto"
          >
            Googleでログイン
          </Button>
        </div>
      )}

      {/* Main Creation Form */}
      <form onSubmit={handleSubmit} className="space-y-8 bg-white p-6 sm:p-8 rounded-3xl border border-slate-200 shadow-sm">
        {/* Section 1: Basic Information */}
        <div className="space-y-4">
          <h3 className="text-base font-bold text-slate-900 pb-2 border-b border-slate-100 flex items-center gap-2">
            <Vote className="w-4 h-4 text-indigo-600" />
            <span>基本情報</span>
          </h3>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              投票タイトル <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="例: 次回ハッカソンの開発テーマ決定投票"
              className="w-full text-sm sm:text-base px-4 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-indigo-500 focus:outline-none focus:bg-white transition-all shadow-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">
              説明・概要 (任意)
            </label>
            <textarea
              rows={3}
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="投票の趣旨や選定基準、補足情報などを記入してください"
              className="w-full text-xs sm:text-sm px-4 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-indigo-500 focus:outline-none focus:bg-white transition-all shadow-sm"
            />
          </div>
        </div>

        {/* Section 2: Voting Period */}
        <div className="space-y-4">
          <h3 className="text-base font-bold text-slate-900 pb-2 border-b border-slate-100 flex items-center gap-2">
            <Calendar className="w-4 h-4 text-indigo-600" />
            <span>投票期間の設定</span>
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                開始日時 <span className="text-rose-500">*</span>
              </label>
              <input
                type="datetime-local"
                required
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                className="w-full text-xs sm:text-sm px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:outline-none focus:bg-white shadow-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                終了日時 (締め切り) <span className="text-rose-500">*</span>
              </label>
              <input
                type="datetime-local"
                required
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
                className="w-full text-xs sm:text-sm px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:outline-none focus:bg-white shadow-sm"
              />
            </div>
          </div>
        </div>

        {/* Section 3: Options List (Up to 20) */}
        <div className="space-y-4">
          <h3 className="text-base font-bold text-slate-900 pb-2 border-b border-slate-100 flex items-center gap-2">
            <Layers className="w-4 h-4 text-indigo-600" />
            <span>選択肢の設定</span>
          </h3>

          <OptionInputList options={options} onChange={setOptions} maxLimit={20} />
        </div>

        {/* Section 4: Selection Limits and Privacy */}
        <div className="space-y-4">
          <h3 className="text-base font-bold text-slate-900 pb-2 border-b border-slate-100 flex items-center gap-2">
            <Lock className="w-4 h-4 text-indigo-600" />
            <span>投票ルール &amp; 結果公開設定</span>
          </h3>

          {/* Max Choices Selector */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold text-slate-700">
                1人あたりの選択上限数 <span className="text-rose-500">*</span>
              </label>
              <span className="text-xs text-slate-500">
                {maxChoices === 1 ? '単一選択 (1つのみ)' : `複数選択 (最大${maxChoices}つ)`}
              </span>
            </div>

            <select
              value={maxChoices}
              onChange={e => setMaxChoices(Number(e.target.value))}
              className="w-full text-sm px-4 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:outline-none font-medium shadow-sm"
            >
              <option value={1}>1つだけ投票 (単一選択)</option>
              {options.length >= 2 && <option value={2}>最大 2つまで投票</option>}
              {options.length >= 3 && <option value={3}>最大 3つまで投票</option>}
              {options.length >= 4 && <option value={4}>最大 4つまで投票</option>}
              {options.length >= 5 && <option value={5}>最大 5つまで投票</option>}
              {options.length > 5 && (
                <option value={Math.min(10, options.length)}>
                  最大 {Math.min(10, options.length)}つまで投票
                </option>
              )}
            </select>
          </div>

          {/* Result Visibility Toggle */}
          <div className="pt-2">
            <label className="block text-xs font-bold text-slate-700 mb-2">
              投票結果の閲覧権限
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div
                onClick={() => setIsPublicResult(false)}
                className={`p-3.5 rounded-2xl border-2 cursor-pointer transition-all ${
                  !isPublicResult
                    ? 'border-indigo-600 bg-indigo-50/60 font-semibold shadow-sm'
                    : 'border-slate-200 bg-white hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center gap-2 text-xs text-slate-900">
                  <Lock className="w-4 h-4 text-indigo-600" />
                  <span className="font-bold">管理者のみ閲覧可能 (デフォルト)</span>
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  作成者のみが集計結果を確認できます。後からいつでも全体公開に切り替え可能です。
                </p>
              </div>

              <div
                onClick={() => setIsPublicResult(true)}
                className={`p-3.5 rounded-2xl border-2 cursor-pointer transition-all ${
                  isPublicResult
                    ? 'border-indigo-600 bg-indigo-50/60 font-semibold shadow-sm'
                    : 'border-slate-200 bg-white hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center gap-2 text-xs text-slate-900">
                  <Globe className="w-4 h-4 text-emerald-600" />
                  <span className="font-bold">全員にリアルタイム公開</span>
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  投票した参加者全員がリアルタイムで途中結果と集計グラフを閲覧できます。
                </p>
              </div>
            </div>
          </div>

          {/* Login Requirement Setting */}
          <div className="pt-2">
            <label className="block text-xs font-bold text-slate-700 mb-2">
              投票者の認証設定
            </label>
            <div
              onClick={() => setRequireAuth(!requireAuth)}
              className="p-4 rounded-2xl border border-slate-200 bg-slate-50 hover:bg-slate-100/80 transition-all cursor-pointer flex items-start gap-3.5 select-none"
            >
              <input
                type="checkbox"
                id="noLoginCheckbox"
                checked={!requireAuth}
                onChange={e => setRequireAuth(!e.target.checked)}
                className="mt-0.5 w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500 cursor-pointer"
              />
              <div className="flex-1 text-xs">
                <label
                  htmlFor="noLoginCheckbox"
                  className="font-bold text-slate-900 cursor-pointer flex items-center gap-1.5"
                >
                  <span>投票にはログイン不要にする (自己申告のユーザー名で投票可能)</span>
                </label>
                <p className="text-slate-500 mt-1 leading-relaxed">
                  チェックを入れると、参加者はGoogleログインしなくても自己申告のお名前を入力するだけで投票に参加できます。
                  チェックなし（推奨）の場合は、Google認証により厳格な1人1票が保証されます。
                </p>
              </div>
            </div>
          </div>

          {/* Voter Names Breakdown Setting */}
          <div className="pt-2">
            <label className="block text-xs font-bold text-slate-700 mb-2">
              投票者内訳の表示設定 (誰がどれに投票したか)
            </label>
            <div
              onClick={() => setShowVoterNames(!showVoterNames)}
              className="p-4 rounded-2xl border border-slate-200 bg-slate-50 hover:bg-slate-100/80 transition-all cursor-pointer flex items-start gap-3.5 select-none"
            >
              <input
                type="checkbox"
                id="showVoterNamesCheckbox"
                checked={showVoterNames}
                onChange={e => setShowVoterNames(e.target.checked)}
                className="mt-0.5 w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500 cursor-pointer"
              />
              <div className="flex-1 text-xs">
                <label
                  htmlFor="showVoterNamesCheckbox"
                  className="font-bold text-slate-900 cursor-pointer flex items-center gap-1.5"
                >
                  <span>結果ページで誰がどの選択肢に投票したか（投票者名）を表示する</span>
                </label>
                <p className="text-slate-500 mt-1 leading-relaxed">
                  チェックなし（デフォルト・推奨）の場合は、得票数とグラフのみ表示され、個人の投票先は非公開（匿名投票）となります。
                  チェックを入れると、結果ページで各選択肢に投票した人のお名前（記名投票）が表示されます。
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Submit action */}
        <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4">
          <span className="text-xs text-slate-400 text-center sm:text-left">
            作成後、同率1位が発生した場合は管理画面から決選投票を開始できます。
          </span>
          <Button
            type="submit"
            variant="primary"
            size="lg"
            isLoading={isSubmitting}
            disabled={!currentUser}
            className="w-full sm:w-auto px-8"
          >
            投票フォームを作成する
          </Button>
        </div>
      </form>
    </div>
  );
};
