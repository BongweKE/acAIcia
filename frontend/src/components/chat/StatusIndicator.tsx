import React from 'react';
import { RAGStage } from '../../context/ChatContext';
import { ShieldCheck, Cpu, Search, Sparkles, CheckCircle2, Loader2 } from 'lucide-react';

interface StatusIndicatorProps {
  currentStage: RAGStage;
  isProcessing: boolean;
}

interface StageStep {
  id: RAGStage;
  name: string;
  description: string;
  icon: React.ReactNode;
}

const STAGES: StageStep[] = [
  {
    id: 'Guardian Check',
    name: 'Guardian Check',
    description: 'Safety moderation & domain constraint validation',
    icon: <ShieldCheck className="w-4 h-4" />,
  },
  {
    id: 'Query Architect',
    name: 'Query Architect',
    description: 'Agriscience query expansion & parameter optimization',
    icon: <Cpu className="w-4 h-4" />,
  },
  {
    id: 'Hybrid Retrieval',
    name: 'Hybrid Retrieval',
    description: 'Dense vector embeddings + full-text RRF search',
    icon: <Search className="w-4 h-4" />,
  },
  {
    id: 'Synthesis Engine',
    name: 'Synthesis Engine',
    description: 'Peer-reviewed evidence integration & citation tagging',
    icon: <Sparkles className="w-4 h-4" />,
  },
];

export const StatusIndicator: React.FC<StatusIndicatorProps> = ({ currentStage, isProcessing }) => {
  if (!isProcessing || !currentStage) return null;

  const currentStageIndex = STAGES.findIndex((s) => s.id === currentStage);

  return (
    <div className="bg-card border border-border rounded-xl p-4 my-3 shadow-sm space-y-4 animate-in fade-in duration-300">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Loader2 className="w-4 h-4 text-accent animate-spin" />
          <span className="text-xs font-semibold text-accent font-mono uppercase tracking-wider">
            Processing Agriscience RAG Query...
          </span>
        </div>
        <span className="text-xs font-mono text-muted-foreground">
          Stage {currentStageIndex + 1} of 4
        </span>
      </div>

      {/* Stage Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5">
        {STAGES.map((stage, idx) => {
          const isDone = currentStageIndex > idx;
          const isCurrent = currentStageIndex === idx;

          return (
            <div
              key={stage.name}
              className={`p-2.5 rounded-lg border transition-all duration-200 flex items-start gap-2.5 ${
                isCurrent
                  ? 'bg-accent/10 border-accent/40 text-foreground font-semibold'
                  : isDone
                  ? 'bg-muted/40 border-border text-foreground'
                  : 'bg-background border-border/50 text-muted-foreground opacity-60'
              }`}
            >
              <div
                className={`p-1.5 rounded-md shrink-0 mt-0.5 ${
                  isCurrent
                    ? 'bg-accent text-accent-foreground'
                    : isDone
                    ? 'bg-accent/10 text-accent'
                    : 'bg-muted text-muted-foreground'
                }`}
              >
                {isDone ? <CheckCircle2 className="w-4 h-4 text-accent" /> : stage.icon}
              </div>

              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs leading-tight">{stage.name}</span>
                  {isCurrent && <Loader2 className="w-3 h-3 text-accent animate-spin shrink-0" />}
                </div>
                <p className="text-[10px] text-muted-foreground leading-snug mt-0.5 line-clamp-2">
                  {stage.description}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
