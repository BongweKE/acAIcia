import React from 'react';
import { RAGStage } from '../../context/ChatContext';
import { Loader2, Sparkles } from 'lucide-react';

interface StatusIndicatorProps {
  currentStage: RAGStage;
  isProcessing: boolean;
}

export const StatusIndicator: React.FC<StatusIndicatorProps> = ({ isProcessing }) => {
  if (!isProcessing) return null;

  return (
    <div className="bg-card/80 backdrop-blur-sm border border-border/80 rounded-xl p-4 my-3 shadow-sm animate-in fade-in duration-300">
      <div className="flex items-center gap-3">
        <div className="relative flex h-8 w-8 items-center justify-center rounded-lg bg-accent/10 text-accent shrink-0">
          <Loader2 className="h-4 w-4 animate-spin text-accent" />
          <span className="absolute -top-0.5 -right-0.5 flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-accent" />
          </span>
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-foreground tracking-tight flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-accent" />
              Synthesising peer-reviewed evidence...
            </span>
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Ingesting literature excerpts, validating citations, and formulating response
          </p>
        </div>
      </div>
    </div>
  );
};
