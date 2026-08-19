import React from 'react';
import { useChat } from '../../context/ChatContext';
import { Sparkles, HelpCircle } from 'lucide-react';

interface PromptPillsProps {
  onSelectPill?: (pillText: string) => void;
}

export const PromptPills: React.FC<PromptPillsProps> = ({ onSelectPill }) => {
  const { pills, submitUserQuery, isProcessing } = useChat();

  if (!pills || pills.length === 0) return null;

  const handlePillClick = (pillText: string) => {
    if (isProcessing) return;
    if (onSelectPill) {
      onSelectPill(pillText);
    } else {
      submitUserQuery(pillText);
    }
  };

  return (
    <div className="space-y-2.5">
      <div className="flex items-center gap-2 text-xs font-semibold text-emerald-400 uppercase tracking-wider">
        <Sparkles className="w-3.5 h-3.5" />
        <span>Suggested Research Questions</span>
      </div>

      <div className="flex flex-wrap gap-2">
        {pills.map((pill, idx) => (
          <button
            key={idx}
            disabled={isProcessing}
            onClick={() => handlePillClick(pill)}
            className="group text-left px-3.5 py-2 bg-forest-800/60 hover:bg-forest-700/80 active:bg-emerald-950/40 border border-forest-700/60 hover:border-emerald-500/50 rounded-xl text-xs text-gray-200 hover:text-white transition-all shadow-sm hover:shadow-glow flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <HelpCircle className="w-3.5 h-3.5 text-emerald-400 group-hover:scale-110 transition-transform shrink-0" />
            <span className="line-clamp-2">{pill}</span>
          </button>
        ))}
      </div>
    </div>
  );
};
