import React, { useState, useEffect } from 'react';
import { AdminMetricsResponse, RAGASScore } from '../../types';
import { getAdminEvaluations, resolveAlert } from '../../api/client';
import { ShieldCheck, ThumbsUp, ThumbsDown, AlertCircle, CheckCircle2, ChevronRight, Search } from 'lucide-react';
import { EvaluationTable } from './EvaluationTable';

interface Props {
  metrics: AdminMetricsResponse;
}

const ScoreRing = ({ label, score, samples }: { label: string, score?: number, samples: number }) => {
  const radius = 30;
  const circumference = 2 * Math.PI * radius;
  const percent = score ? score * 100 : 0;
  const offset = circumference - (percent / 100) * circumference;
  
  const getColor = (s: number) => {
    if (s >= 0.8) return 'text-emerald-500 stroke-emerald-500';
    if (s >= 0.5) return 'text-amber-500 stroke-amber-500';
    return 'text-red-500 stroke-red-500';
  };

  return (
    <div className="flex flex-col items-center bg-forest-800/40 border border-forest-700/60 rounded-xl p-4">
      <div className="relative w-20 h-20 flex items-center justify-center mb-3">
        <svg className="w-full h-full transform -rotate-90" viewBox="0 0 80 80">
          <circle className="text-forest-700 stroke-current" strokeWidth="6" fill="transparent" r={radius} cx="40" cy="40" />
          <circle 
            className={`transition-all duration-1000 ease-out ${score ? getColor(score) : 'stroke-gray-500'}`} 
            strokeWidth="6" 
            strokeDasharray={circumference} 
            strokeDashoffset={score ? offset : circumference} 
            strokeLinecap="round" 
            fill="transparent" 
            r={radius} 
            cx="40" 
            cy="40" 
          />
        </svg>
        <span className="absolute text-lg font-bold text-gray-200">{score ? percent.toFixed(0) + '%' : '-'}</span>
      </div>
      <p className="text-xs font-semibold text-gray-300 text-center leading-tight h-8">{label}</p>
      <p className="text-[10px] text-gray-500 mt-1">n={samples}</p>
    </div>
  );
};

export const EvaluationsTab: React.FC<Props> = ({ metrics }) => {
  const [evalRuns, setEvalRuns] = useState<any[]>([]);
  const [alerts, setAlerts] = useState(metrics.system_alerts || []);
  const [fbFilter, setFbFilter] = useState<'all' | 'up' | 'down'>('all');
  const [fbSearch, setFbSearch] = useState('');

  useEffect(() => {
    getAdminEvaluations(1, 10).then(res => setEvalRuns(res.data || res || [])).catch(console.error);
  }, []);

  const handleResolveAlert = async (id: string) => {
    try {
      await resolveAlert(id);
      setAlerts(prev => prev.map(a => a.alert_id === id ? { ...a, resolved: true } : a));
    } catch (e) {
      console.error(e);
    }
  };

  const activeAlerts = alerts.filter(a => !a.resolved);
  
  const fbList = (metrics.recent_feedback || []).filter(f => {
    if (fbFilter === 'up' && f.rating !== 1) return false;
    if (fbFilter === 'down' && f.rating !== -1) return false;
    if (fbSearch && !f.correction_text?.toLowerCase().includes(fbSearch.toLowerCase())) return false;
    return true;
  });

  const latestScore: RAGASScore = metrics.ragas_scores?.[0] || {} as RAGASScore;
  const samples = metrics.ragas_scores?.length || 0;

  return (
    <div className="space-y-6">
      {activeAlerts.length > 0 && (
        <div className="bg-forest-800/40 border border-forest-700/60 rounded-2xl overflow-hidden">
          <div className="bg-red-900/30 p-4 border-b border-red-900/50 flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-red-500" />
            <h3 className="font-semibold text-red-200">Quality & System Alerts ({activeAlerts.length})</h3>
          </div>
          <div className="divide-y divide-forest-700/40">
            {activeAlerts.map(a => (
              <div key={a.alert_id} className="p-4 flex items-center justify-between hover:bg-forest-800/50">
                <div className="flex gap-4 items-start">
                  <div className={`mt-0.5 w-2 h-2 rounded-full ${a.severity === 'error' ? 'bg-red-500' : 'bg-amber-500'}`} />
                  <div>
                    <span className="text-xs uppercase tracking-wider text-gray-400 font-bold">{a.category}</span>
                    <p className="text-sm text-gray-200 mt-1">{a.message}</p>
                    <p className="text-xs text-gray-500 mt-1">{new Date(a.created_at).toLocaleString()}</p>
                  </div>
                </div>
                <button onClick={() => handleResolveAlert(a.alert_id)} className="px-3 py-1.5 bg-forest-700 hover:bg-forest-600 text-xs text-gray-200 rounded flex items-center gap-1 transition-colors">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Resolve
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div>
        <h3 className="text-sm font-semibold text-gray-200 mb-4 flex items-center gap-2"><ShieldCheck className="w-4 h-4 text-emerald-400"/> RAGAS Quality Metrics</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <ScoreRing label="Faithfulness" score={(latestScore as any).faithfulness} samples={samples} />
          <ScoreRing label="Answer Relevance" score={(latestScore as any).answer_relevance} samples={samples} />
          <ScoreRing label="Context Precision" score={(latestScore as any).context_precision} samples={samples} />
          <ScoreRing label="Overall Score" score={(latestScore as any).overall_score} samples={samples} />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-forest-800/40 border border-forest-700/60 rounded-2xl overflow-hidden flex flex-col h-[400px]">
          <div className="p-4 border-b border-forest-700/60 bg-forest-900/50">
            <h3 className="text-sm font-semibold text-gray-200">Recent Evaluation Runs</h3>
          </div>
          <div className="overflow-auto flex-1 p-4">
            <div className="space-y-3">
              {evalRuns.length > 0 ? evalRuns.map((r, i) => (
                <div key={i} className="p-3 bg-forest-900/50 border border-forest-700/40 rounded-lg flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-200 font-medium">Auto-Eval {new Date(r.timestamp).toLocaleDateString()}</p>
                    <div className="flex gap-3 text-xs text-gray-400 mt-1">
                      <span>Pass: {r.passed ? 'Yes' : 'No'}</span>
                      <span>Faith: {r.faithfulness_score?.toFixed(2)}</span>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-500" />
                </div>
              )) : <div className="text-gray-500 text-center py-8 text-sm">No evaluation runs found</div>}
            </div>
          </div>
        </div>

        <div className="bg-forest-800/40 border border-forest-700/60 rounded-2xl overflow-hidden flex flex-col h-[400px]">
          <div className="p-4 border-b border-forest-700/60 bg-forest-900/50 space-y-3">
            <h3 className="text-sm font-semibold text-gray-200">User Feedback</h3>
            <div className="flex justify-between items-center gap-2">
              <div className="flex bg-forest-950 rounded-lg p-1">
                <button onClick={() => setFbFilter('all')} className={`px-3 py-1 rounded text-xs ${fbFilter === 'all' ? 'bg-forest-700 text-white' : 'text-gray-400'}`}>All</button>
                <button onClick={() => setFbFilter('up')} className={`px-3 py-1 rounded text-xs flex gap-1 items-center ${fbFilter === 'up' ? 'bg-emerald-500/20 text-emerald-400' : 'text-gray-400'}`}><ThumbsUp className="w-3 h-3"/> Up</button>
                <button onClick={() => setFbFilter('down')} className={`px-3 py-1 rounded text-xs flex gap-1 items-center ${fbFilter === 'down' ? 'bg-red-500/20 text-red-400' : 'text-gray-400'}`}><ThumbsDown className="w-3 h-3"/> Down</button>
              </div>
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-2 text-gray-500" />
                <input 
                  type="text" 
                  placeholder="Search corrections..." 
                  value={fbSearch}
                  onChange={e => setFbSearch(e.target.value)}
                  className="bg-forest-950 border border-forest-700 text-xs text-gray-200 rounded-lg pl-8 pr-3 py-1.5 focus:border-emerald-500 focus:outline-none w-40" 
                />
              </div>
            </div>
          </div>
          <div className="overflow-auto flex-1">
            <div className="divide-y divide-forest-700/40">
              {fbList.map((f, i) => (
                <div key={i} className="p-4 hover:bg-forest-800/30">
                  <div className="flex gap-3">
                    {f.rating === 1 ? <ThumbsUp className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" /> : <ThumbsDown className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />}
                    <div>
                      <p className="text-xs text-gray-400 mb-1">
                        {new Date(f.created_at).toLocaleString()} {(f as any).user_email ? `• ${(f as any).user_email}` : f.user_id ? `• ${f.user_id.slice(0, 8)}` : ''}
                      </p>
                      <p className="text-sm text-gray-200">{f.correction_text || <span className="italic text-gray-500">No comment</span>}</p>
                    </div>
                  </div>
                </div>
              ))}
              {fbList.length === 0 && <div className="text-gray-500 text-center py-10 text-sm">No feedback matches filters</div>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
