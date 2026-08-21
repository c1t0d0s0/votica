import React from 'react';
import { Vote } from 'lucide-react';

export const Footer: React.FC = () => {
  return (
    <footer className="border-t border-slate-200 bg-white/50 backdrop-blur-sm py-6 mt-auto">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
        <div className="flex items-center gap-2">
          <Vote className="w-4 h-4 text-indigo-600" />
          <span className="font-semibold text-slate-700">Votica</span>
          <span>- 決選投票対応 汎用投票プラットフォーム</span>
        </div>

        <div className="flex items-center gap-4 text-slate-400 font-medium">
          <span>&copy; {new Date().getFullYear()} cuio.net</span>
        </div>
      </div>
    </footer>
  );
};
