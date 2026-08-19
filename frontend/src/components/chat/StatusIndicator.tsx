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
    description: 'Agriscience query expansion & sub-question breakdown',
    icon: <Cpu className="w-4 h-4" />,
  },
  {
    id: 'Hybrid Retrieval',
    name: 'Hybrid Retrieval',
    description: 'Dense vector embeddings + BM25 literature search',
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
    <div className="bg-forest-800/80 border border-forest-700/80 rounded-2xl p-4 my-3 backdrop-blur-md shadow-lg space-y-4 animate-in fade-in duration-300">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Loader2 className="w-4 h-4 text-emerald-400 animate-spin" />
          <span className="text-xs font-bold text-emerald-300 uppercase tracking-wider">
            Processing Agriscience RAG Query...
          </span>
        </div>
        <span className="text-xs font-mono text-gray-400">
          Stage {currentStageIndex + 1} of 4
        </span>
      </div>

      {/* Stage Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5">
        {STAGES.map((stage, idx) => {
          const isDone = currentStageIndex > idx;
          const isCurrent = currentStageIndex === idx;
          const isPending = currentStageIndex < idx;

          return (
            <div
              key={stage.name}
              className={`p-2.5 rounded-xl border transition-all duration-200 flex items-start gap-2.5 ${
                isCurrent
                  ? 'bg-emerald-950/40 border-emerald-500/50 text-emerald-200 shadow-glow'
                  : isDone
                  ? 'bg-forest-900/60 border-forest-700/60 text-gray-300'
                  : 'bg-forest-900/20 border-forest-800/40 text-gray-500 opacity-60'
              }`}
            >
              <div
                className={`p-1.5 rounded-lg shrink-0 mt-0.5 ${
                  isCurrent
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    : isDone
                    ? 'bg-forest-700/50 text-emerald-400'
                    : 'bg-forest-800 text-gray-500'
                }`}
              >
                {isDone ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : stage.icon}
              </div>

              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-semibold leading-tight">{stage.name}</span>
                  {isCurrent && <Loader2 className="w-3 h-3 text-emerald-400 animate-spin shrink-0" />}
                </div>
                <p className="text-[10px] text-gray-400 leading-snug mt-0.5 line-clamp-2">
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
