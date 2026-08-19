import React from 'react';
import { StageLatencyAverages } from '../../types';
import { Clock, ShieldCheck, FileText, Search, Cpu } from 'lucide-react';

interface LatencyBreakdownProps {
  stageLatencies: StageLatencyAverages;
}

export const LatencyBreakdown: React.FC<LatencyBreakdownProps> = ({ stageLatencies }) => {
  const { guardian_ms, architect_ms, retrieval_ms, synthesis_ms } = stageLatencies;
  const totalMs = (guardian_ms || 0) + (architect_ms || 0) + (retrieval_ms || 0) + (synthesis_ms || 0) || 1;

  const stages = [
    {
      name: 'Guardian Check',
      ms: guardian_ms,
      description: 'Prompt safety & domain alignment filter',
      icon: <ShieldCheck className="w-4 h-4 text-purple-400" />,
      color: 'bg-purple-500',
      textColor: 'text-purple-300',
    },
    {
      name: 'Architect Rewriter',
      ms: architect_ms,
      description: 'Agriscience query expansion & terminology optimization',
      icon: <FileText className="w-4 h-4 text-blue-400" />,
      color: 'bg-blue-500',
      textColor: 'text-blue-300',
    },
    {
      name: 'Hybrid Retrieval',
      ms: retrieval_ms,
      description: 'Dense vector search + BM25 reciprocal rank fusion',
      icon: <Search className="w-4 h-4 text-teal-400" />,
      color: 'bg-teal-500',
      textColor: 'text-teal-300',
    },
    {
      name: 'Synthesis Engine',
      ms: synthesis_ms,
      description: 'LLM citation-grounded response generation',
      icon: <Cpu className="w-4 h-4 text-emerald-400" />,
      color: 'bg-emerald-500',
      textColor: 'text-emerald-300',
    },
  ];

  return (
    <div className="p-5 bg-forest-800/40 border border-forest-700/60 rounded-2xl space-y-4 shadow-md">
      <div className="flex items-center justify-between border-b border-forest-800 pb-3">
        <div className="flex items-center gap-2">
          <Clock className="w-5 h-5 text-emerald-400" />
          <h3 className="text-sm font-bold text-gray-200 uppercase tracking-wider">
            RAG Pipeline Stage Latency Breakdown
          </h3>
        </div>
        <div className="text-xs font-mono text-gray-400">
          Avg Total: <span className="text-emerald-300 font-bold">{Math.round(totalMs)} ms</span>
        </div>
      </div>

      {/* Visual Stacked Progress Bar */}
      <div className="h-3 w-full bg-forest-950 rounded-full overflow-hidden flex gap-0.5 p-0.5 border border-forest-700">
        {stages.map((stage) => {
          const pct = Math.max(2, Math.round(((stage.ms || 0) / totalMs) * 100));
          return (
            <div
              key={stage.name}
              style={{ width: `${pct}%` }}
              className={`h-full ${stage.color} rounded-sm transition-all duration-500`}
              title={`${stage.name}: ${stage.ms}ms (${pct}%)`}
            />
          );
        })}
      </div>

      {/* Stage Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
        {stages.map((stage) => {
          const pct = Math.round(((stage.ms || 0) / totalMs) * 100);
          return (
            <div
              key={stage.name}
              className="p-3 bg-forest-900/60 border border-forest-700/50 rounded-xl space-y-1.5 hover:border-forest-600 transition-colors"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-forest-800 rounded-lg border border-forest-700">
                    {stage.icon}
                  </div>
                  <span className="text-xs font-bold text-gray-200">{stage.name}</span>
                </div>
                <div className="text-right">
                  <span className={`text-sm font-bold font-mono ${stage.textColor}`}>
                    {stage.ms} ms
                  </span>
                  <span className="text-[10px] text-gray-400 ml-1.5 font-mono">({pct}%)</span>
                </div>
              </div>
              <p className="text-[11px] text-gray-400 leading-snug">{stage.description}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
};
