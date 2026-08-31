import React from 'react';
import { EvaluationRun } from '../../types';
import { CheckCircle2, XCircle, BarChart3, Activity } from 'lucide-react';

interface EvaluationTableProps {
  evaluations: EvaluationRun[];
}

export const EvaluationTable: React.FC<EvaluationTableProps> = ({ evaluations }) => {
  const formatScore = (score: number) => {
    if (score === undefined || score === null) return 'N/A';
    const val = score > 1 ? score : Math.round(score * 100);
    return `${val}%`;
  };

  return (
    <div className="p-5 bg-forest-800/40 border border-forest-700/60 rounded-2xl space-y-4 shadow-md">
      <div className="flex items-center justify-between border-b border-forest-800 pb-3">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-emerald-400" />
          <h3 className="text-sm font-bold text-gray-200 uppercase tracking-wider">
            Recent Evaluation Benchmark Runs
          </h3>
        </div>
        <span className="text-xs text-gray-400 font-mono">
          RAGAS Metrics (Faithfulness, Relevance, Recall)
        </span>
      </div>

      {!evaluations || evaluations.length === 0 ? (
        <div className="p-6 text-center text-xs text-gray-400 font-mono bg-forest-900/40 rounded-xl border border-forest-800">
          No evaluation benchmark runs recorded yet.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-gray-300">
            <thead className="bg-forest-900/80 text-gray-400 font-mono text-[11px] uppercase tracking-wider border-b border-forest-800">
              <tr>
                <th className="py-2.5 px-3">Dataset / Timestamp</th>
                <th className="py-2.5 px-3">Hit Rate @ 5</th>
                <th className="py-2.5 px-3">Context Precision</th>
                <th className="py-2.5 px-3">Avg Latency</th>
                <th className="py-2.5 px-3 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-forest-800/60 font-mono">
              {evaluations.map((run, idx) => {
                const formattedDate = run.timestamp
                  ? new Date(run.timestamp).toLocaleString(undefined, {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })
                  : `Run #${idx + 1}`;

                const isPassed = run.passed !== undefined 
                  ? run.passed 
                  : (run.hit_rate_at_5 !== undefined ? run.hit_rate_at_5 >= 80 : true);

                const hitScore = run.hit_rate_at_5 !== undefined ? run.hit_rate_at_5 : run.faithfulness_score;
                const precScore = run.context_precision !== undefined ? run.context_precision : run.answer_relevance_score;
                const latency = run.avg_latency_ms ? `${(run.avg_latency_ms / 1000).toFixed(1)}s` : 'N/A';

                return (
                  <tr key={idx} className="hover:bg-forest-800/50 transition-colors">
                    <td className="py-3 px-3 text-gray-200 font-sans font-medium whitespace-nowrap">
                      <div>{run.dataset_name || 'Benchmark Run'}</div>
                      <div className="text-[10px] text-gray-400 font-mono">{formattedDate} • n={run.num_questions || 5}</div>
                    </td>
                    <td className="py-3 px-3 font-semibold text-emerald-300">
                      {formatScore(hitScore ?? 0)}
                    </td>
                    <td className="py-3 px-3 font-semibold text-teal-300">
                      {formatScore(precScore ?? 0)}
                    </td>
                    <td className="py-3 px-3 font-semibold text-blue-300">
                      {latency}
                    </td>
                    <td className="py-3 px-3 text-right whitespace-nowrap">
                      {isPassed ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-950/60 text-emerald-300 border border-emerald-500/40">
                          <CheckCircle2 className="w-3 h-3 text-emerald-400" /> PASS
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-950/60 text-rose-300 border border-rose-500/40">
                          <XCircle className="w-3 h-3 text-rose-400" /> FAIL
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
