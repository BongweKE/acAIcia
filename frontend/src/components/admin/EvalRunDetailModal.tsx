import React, { useEffect, useState } from 'react';
import { X, ChevronDown, ChevronUp } from 'lucide-react';
import { getEvaluationRunDetails } from '../../api/client';
import { EvaluationDetail } from '../../types';

interface EvalRunDetailModalProps {
  runId: string;
  onClose: () => void;
}

export const EvalRunDetailModal: React.FC<EvalRunDetailModalProps> = ({ runId, onClose }) => {
  const [loading, setLoading] = useState(true);
  const [run, setRun] = useState<any>(null);
  const [details, setDetails] = useState<EvaluationDetail[]>([]);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  useEffect(() => {
    getEvaluationRunDetails(runId)
      .then(res => {
        setRun(res.run);
        setDetails(res.details || []);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [runId]);

  const getColorClass = (score: number | undefined) => {
    if (score === undefined || score === null) return 'text-gray-500';
    if (score >= 0.7) return 'text-green-400';
    if (score >= 0.5) return 'text-amber-400';
    return 'text-red-400';
  };

  const getScoreDisplay = (score: number | undefined) => {
    if (score === undefined || score === null) return '-';
    return score.toFixed(2);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
      <div className="bg-forest-900 border border-forest-700 rounded-2xl max-w-5xl w-full max-h-[85vh] overflow-hidden flex flex-col">
        <div className="p-5 border-b border-forest-700/60 flex justify-between items-center bg-forest-950">
          <div>
            <h2 className="text-lg font-bold text-gray-100">Evaluation Run: {runId}</h2>
            {run && (
              <div className="flex gap-4 mt-2 text-xs text-gray-400">
                <span>Dataset: <strong className="text-gray-200">{run.dataset_name}</strong></span>
                <span>Judge: <strong className="text-gray-200">{run.judge_model || run.model_provider || 'N/A'}</strong></span>
                <span>Duration: <strong className="text-gray-200">{(run.duration_sec ?? run.details?.duration_sec)?.toFixed(1) || '-'}s</strong></span>
                <span>Cost: <strong className="text-gray-200">${((run.run_cost_usd ?? run.total_cost_usd) || 0).toFixed(4)}</strong></span>
                <span>Status: <strong className={(run.passed ?? run.details?.passed) ? 'text-green-400' : 'text-red-400'}>{(run.passed ?? run.details?.passed) ? 'Passed' : 'Failed'}</strong></span>
              </div>
            )}
          </div>
          <button onClick={onClose} className="p-2 hover:bg-forest-800 rounded-lg text-gray-400 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="overflow-auto flex-1 p-5">
          {loading ? (
            <div className="flex justify-center items-center h-40">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500"></div>
            </div>
          ) : (
            <table className="w-full text-left text-sm text-gray-300">
              <thead className="text-xs text-gray-400 bg-forest-800/50">
                <tr>
                  <th className="p-3 rounded-tl-lg">#</th>
                  <th className="p-3">Question</th>
                  <th className="p-3">Type</th>
                  <th className="p-3">Faith</th>
                  <th className="p-3">Relev</th>
                  <th className="p-3">Prec</th>
                  <th className="p-3">Recall</th>
                  <th className="p-3">Citation</th>
                  <th className="p-3">Hit@5</th>
                  <th className="p-3 rounded-tr-lg">Latency</th>
                </tr>
              </thead>
              <tbody>
                {details.map((d) => {
                  const rowId = d.detail_id || String(d.question_index);
                  return (
                    <React.Fragment key={rowId}>
                      <tr 
                        className="border-b border-forest-700/40 hover:bg-forest-800/30 cursor-pointer"
                        onClick={() => setExpandedRow(expandedRow === rowId ? null : rowId)}
                      >
                        <td className="p-3">{d.question_index}</td>
                        <td className="p-3 max-w-[200px] truncate" title={d.input_query}>{d.input_query}</td>
                        <td className="p-3">
                          {d.question_type}
                          {d.question_type === 'canary' && <span className="ml-1" title="Canary Question">🐤</span>}
                        </td>
                        <td className={`p-3 font-medium ${getColorClass(d.faithfulness)}`}>{getScoreDisplay(d.faithfulness)}</td>
                        <td className={`p-3 font-medium ${getColorClass(d.answer_relevancy)}`}>{getScoreDisplay(d.answer_relevancy)}</td>
                        <td className={`p-3 font-medium ${getColorClass(d.context_precision)}`}>{getScoreDisplay(d.context_precision)}</td>
                        <td className={`p-3 font-medium ${getColorClass(d.context_recall)}`}>{getScoreDisplay(d.context_recall)}</td>
                        <td className={`p-3 font-medium ${getColorClass(d.citation_quality)}`}>{getScoreDisplay(d.citation_quality)}</td>
                        <td className="p-3">{d.hit_at_5 === true ? '✅' : d.hit_at_5 === false ? '❌' : '-'}</td>
                        <td className="p-3">{d.latency_ms ? `${d.latency_ms}ms` : '-'}</td>
                      </tr>
                      {expandedRow === rowId && (d.actual_output || d.retrieval_context || d.notes) && (
                        <tr className="bg-forest-950 border-b border-forest-700/40">
                          <td colSpan={10} className="p-4">
                            <div className="space-y-4">
                              {d.notes && (
                                <div>
                                  <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Notes / Diagnostic</h4>
                                  <p className="text-xs text-amber-300 font-mono bg-forest-900/60 p-2 rounded">{d.notes}</p>
                                </div>
                              )}
                              <div>
                                <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Expected Output</h4>
                                <p className="text-sm text-gray-200 bg-forest-900/50 p-3 rounded">{d.expected_output || 'N/A'}</p>
                              </div>
                              <div>
                                <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Actual Output</h4>
                                <p className="text-sm text-gray-200 bg-forest-900/50 p-3 rounded">{d.actual_output || 'N/A'}</p>
                              </div>
                              {d.retrieval_context && d.retrieval_context.length > 0 && (
                                <div>
                                  <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Retrieval Context ({d.retrieval_context.length})</h4>
                                  <ul className="list-disc pl-5 space-y-1">
                                    {d.retrieval_context.map((ctx, idx) => (
                                      <li key={idx} className="text-sm text-gray-300 line-clamp-2" title={ctx}>{ctx}</li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
                {details.length === 0 && (
                  <tr>
                    <td colSpan={10} className="p-8 text-center text-gray-500">No details found for this run</td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};
