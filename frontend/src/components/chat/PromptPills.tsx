import React from 'react';
import { useChat } from '../../context/ChatContext';
import { Sparkles, ArrowRight } from 'lucide-react';

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
    <div className="space-y-3">
      <div className="flex items-center gap-2 font-mono text-[10px] font-semibold text-accent uppercase tracking-wider">
        <Sparkles className="w-3.5 h-3.5" />
        <span>Suggested Research Questions</span>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        {pills.map((pill, idx) => (
          <button
            key={idx}
            type="button"
            disabled={isProcessing}
            onClick={() => handlePillClick(pill)}
            className="group text-left p-3 bg-card hover:bg-muted border border-border hover:border-accent/40 rounded-xl text-xs text-foreground transition-all shadow-sm flex items-center justify-between gap-2 disabled:opacity-50"
          >
            <span className="line-clamp-2">{pill}</span>
            <ArrowRight className="w-3.5 h-3.5 text-accent opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
          </button>
        ))}
      </div>
    </div>
  );
};
