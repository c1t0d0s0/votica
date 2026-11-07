import React, { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Vote as VoteIcon, Calendar, ChevronDown, Settings2, CheckCircle2, Circle } from 'lucide-react';
import { useTranslation } from '../../contexts/LanguageContext';
import { Button } from '../common/Button';

/** Poll / Schedule switch tabs shared by both create pages (identical size on both pages). */
export const CreateModeTabs: React.FC<{ active: 'poll' | 'schedule' }> = ({ active }) => {
  const { t } = useTranslation();
  const base =
    'flex-1 sm:flex-initial sm:min-w-[129px] flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold transition-colors';
  const activeCls = (color: string) => `${base} bg-white ${color} shadow-xs cursor-default`;
  const idleCls = `${base} text-slate-600 hover:text-slate-900`;

  const pollContent = (
    <>
      <VoteIcon className="w-4 h-4" />
      <span>{t('schedule.tabPoll')}</span>
    </>
  );
  const scheduleContent = (
    <>
      <Calendar className="w-4 h-4" />
      <span>{t('schedule.tabScheduleAdjust')}</span>
    </>
  );

  return (
    <div className="flex items-center gap-2 mb-5 p-1 rounded-2xl bg-slate-100 border border-slate-200 w-full sm:w-fit">
      {active === 'poll' ? (
        <span className={activeCls('text-rose-600')} aria-current="page">
          {pollContent}
        </span>
      ) : (
        <Link to="/create" className={idleCls}>
          {pollContent}
        </Link>
      )}
      {active === 'schedule' ? (
        <span className={activeCls('text-indigo-600')} aria-current="page">
          {scheduleContent}
        </span>
      ) : (
        <Link to="/create-schedule" className={idleCls}>
          {scheduleContent}
        </Link>
      )}
    </div>
  );
};

/** Numbered required step card: "① Title *" */
export const StepCard: React.FC<{
  step: number;
  title: string;
  htmlFor?: string;
  aside?: ReactNode;
  children: ReactNode;
}> = ({ step, title, htmlFor, aside, children }) => {
  const heading = (
    <>
      <span className="w-7 h-7 rounded-full bg-indigo-600 text-white text-sm flex items-center justify-center shrink-0">
        {step}
      </span>
      <span>{title}</span>
      <span className="text-rose-500">*</span>
    </>
  );
  return (
    <section className="bg-white p-5 sm:p-6 rounded-3xl border border-slate-200 shadow-sm">
      <div className="flex items-center justify-between gap-3 mb-3">
        {htmlFor ? (
          <label htmlFor={htmlFor} className="flex items-center gap-2 text-base font-black text-slate-900">
            {heading}
          </label>
        ) : (
          <h2 className="flex items-center gap-2 text-base font-black text-slate-900">{heading}</h2>
        )}
        {aside}
      </div>
      {children}
    </section>
  );
};

/** Large title input used as step 1 on both create pages. */
export const TitleInput: React.FC<{
  id: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}> = ({ id, value, onChange, placeholder }) => (
  <input
    id={id}
    type="text"
    required
    autoFocus
    maxLength={100}
    value={value}
    onChange={e => onChange(e.target.value)}
    placeholder={placeholder}
    className="w-full text-base sm:text-lg px-4 py-3 rounded-2xl border-2 border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 focus:outline-none transition-all"
  />
);

/** Collapsible "Advanced settings (optional)" card with a one-line summary when closed. */
export const AdvancedSettings: React.FC<{
  open: boolean;
  onToggle: () => void;
  summary: string;
  description: string;
  children: ReactNode;
}> = ({ open, onToggle, summary, description, children }) => {
  const { t } = useTranslation();
  return (
    <section className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="w-full flex items-start justify-between gap-3 p-5 sm:p-6 text-left hover:bg-slate-50/70 cursor-pointer"
      >
        <span className="min-w-0">
          <span className="flex items-center gap-2 text-base font-black text-slate-900">
            <Settings2 className="w-5 h-5 text-indigo-600" />
            {t('scheduleEx.advancedTitle')}
          </span>
          <span className="block text-sm text-slate-500 mt-1">{open ? description : summary}</span>
        </span>
        <ChevronDown className={`w-5 h-5 text-slate-500 shrink-0 mt-0.5 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && <div className="px-5 sm:px-6 pb-6 space-y-7 border-t border-slate-100 pt-5">{children}</div>}
    </section>
  );
};

/** Sub heading inside the advanced settings. */
export const SubHeading: React.FC<{ icon: ReactNode; label: string }> = ({ icon, label }) => (
  <h4 className="text-sm font-black text-slate-800 flex items-center gap-2">
    {icon}
    <span>{label}</span>
  </h4>
);

/** Sticky checklist + submit button (sidebar on desktop, bottom bar on mobile). */
export const SubmitPanel: React.FC<{
  checks: Array<{ ok: boolean; label: string }>;
  submitLabel: string;
  note: string;
  isLoading: boolean;
  disabled: boolean;
}> = ({ checks, submitLabel, note, isLoading, disabled }) => {
  const { t } = useTranslation();
  return (
    <div className="sticky bottom-3 lg:static z-20 bg-white/95 backdrop-blur p-4 sm:p-5 rounded-3xl border border-slate-200 shadow-lg lg:shadow-sm space-y-3">
      <p className="text-sm font-black text-slate-800">{t('scheduleEx.checklistTitle')}</p>
      <ul className="space-y-1.5">
        {checks.map(c => (
          <li key={c.label} className={`flex items-center gap-2 text-sm ${c.ok ? 'text-emerald-700' : 'text-slate-600'}`}>
            {c.ok ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <Circle className="w-4 h-4 text-slate-300" />}
            <span className={c.ok ? 'line-through decoration-emerald-300' : 'font-semibold'}>{c.label}</span>
          </li>
        ))}
      </ul>
      <Button type="submit" variant="primary" size="lg" isLoading={isLoading} disabled={disabled} className="w-full shadow-md">
        {submitLabel}
      </Button>
      <p className="text-xs text-slate-500">{note}</p>
    </div>
  );
};
