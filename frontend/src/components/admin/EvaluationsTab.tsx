import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, ThumbsUp, ThumbsDown, AlertCircle, CheckCircle2, 
  ChevronRight, Search, Play, FlaskConical, BarChart3, Clock, XCircle 
} from 'lucide-react';
import { 
  getAdminEvaluations, resolveAlert, triggerEvaluationRun, getEvaluationTrends 
} from '../../api/client';
import { RAGASScore, AdminMetricsResponse } from '../../types';
import { EvalRunDetailModal } from './EvalRunDetailModal';
import { Line } from 'react-chartjs-2';
import { 
  Chart as ChartJS, CategoryScale, LinearScale, PointElement, 
  LineElement, Title, Tooltip, Legend, Filler 
} from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler);

interface Props {
  metrics: AdminMetricsResponse;
}

const ScoreRing = ({ 
  label, score, samples, isCount, total, invertColor 
}: { 
  label: string; 
  score?: number; 
  samples: number; 
  isCount?: boolean; 
  total?: number;
  invertColor?: boolean;
}) => {
  let percent = 0;
  let displayValue = '-';
  if (isCount) {
    if (score !== undefined) {
      percent = total && total > 0 ? (score / total) * 100 : 0;
      displayValue = String(score);
    }
  } else {
    if (score !== undefined) {
      percent = score * 100;
      displayValue = percent.toFixed(0) + '%';
    }
  }

  const isGood = invertColor ? (isCount ? (score === 0) : percent <= 20) : percent >= 80;
  const isMedium = invertColor ? (isCount ? (score !== undefined && score <= 1) : percent <= 40) : percent >= 60;

  const color = isGood ? 'text-emerald-500' : isMedium ? 'text-amber-500' : 'text-red-500';
  const strokeColor = isGood ? 'stroke-emerald-500' : isMedium ? 'stroke-amber-500' : 'stroke-red-500';
  
  return (
    <div className="bg-forest-900/50 p-4 rounded-xl border border-forest-700/40 flex flex-col items-center justify-center">
      <div className="relative w-16 h-16 mb-2 flex items-center justify-center">
        <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
          <path className="stroke-forest-800" strokeWidth="3" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
          <path className={`${strokeColor} transition-all duration-1000`} strokeWidth="3" strokeDasharray={`${percent}, 100`} fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
        </svg>
        <span className={`absolute text-lg font-bold ${color}`}>{displayValue}</span>
      </div>
      <p className="text-xs font-semibold text-gray-300 text-center leading-tight h-8">{label}</p>
      <p className="text-[10px] text-gray-500 mt-1">n={samples}</p>
    </div>
  );
};

export const EvaluationsTab: React.FC<Props> = ({ metrics }) => {
  const [evalRuns, setEvalRuns] = useState<any[]>([]);
  const [trends, setTrends] = useState<any[]>([]);
  const [alerts, setAlerts] = useState(metrics.system_alerts || []);
  const [fbFilter, setFbFilter] = useState<'all' | 'up' | 'down'>('all');
  const [fbSearch, setFbSearch] = useState('');
  
  const [isRunning, setIsRunning] = useState(false);
  const [runningRunId, setRunningRunId] = useState<string | null>(null);
  const [evalDataset, setEvalDataset] = useState('test_questions.csv');
  const [evalLimit, setEvalLimit] = useState(20);
  const [evalMode, setEvalMode] = useState('full');
  const [toastMessage, setToastMessage] = useState('');

  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const runsRes = await getAdminEvaluations(1, 10);
      const runs = runsRes.evaluation_runs || runsRes.data || (Array.isArray(runsRes) ? runsRes : []);
      setEvalRuns(runs);
      const trendsRes = await getEvaluationTrends(20);
      setTrends(trendsRes.trends || []);
    } catch (e) {
      console.error(e);
    }
  };

  const handleResolveAlert = async (id: string) => {
    try {
      await resolveAlert(id);
      setAlerts(prev => prev.map(a => a.alert_id === id ? { ...a, resolved: true } : a));
    } catch (e) {
      console.error(e);
    }
  };

  const handleTriggerEval = async () => {
    try {
      setIsRunning(true);
      setToastMessage('Evaluation triggered...');
      const res = await triggerEvaluationRun({ dataset: evalDataset, limit: evalLimit, eval_mode: evalMode });
      setRunningRunId(res.run_id);
      setToastMessage(`Run started: ${res.run_id}`);
      
      // Simple poll simulation
      const interval = setInterval(async () => {
        try {
          const checkRes = await getAdminEvaluations(1, 10);
          const runs = checkRes.evaluation_runs || checkRes.data || (Array.isArray(checkRes) ? checkRes : []);
          setEvalRuns(runs);
          const currentRun = runs.find((r: any) => r.run_id === res.run_id);
          const currentStatus = currentRun ? (currentRun.status || currentRun.details?.status) : null;
          if (currentRun && currentStatus && currentStatus !== 'running') {
            setIsRunning(false);
            setRunningRunId(null);
            setToastMessage('Evaluation completed!');
            clearInterval(interval);
            setTimeout(() => setToastMessage(''), 3000);
            fetchData();
          }
        } catch (e) {}
      }, 5000);
    } catch (e) {
      console.error(e);
      setToastMessage('Failed to trigger evaluation');
      setIsRunning(false);
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
  
  // Try to find metrics from latest trend or latest evaluation run if not in RAGASScore
  const latestTrend = trends.length > 0 ? trends[trends.length - 1] : null;
  const latestRun = evalRuns.length > 0 ? evalRuns[0] : null;

  const faithfulness = (latestScore as any).faithfulness 
    ?? latestTrend?.avg_faithfulness 
    ?? latestRun?.details?.avg_faithfulness 
    ?? latestRun?.avg_faithfulness;

  const answerRelevance = (latestScore as any).answer_relevance 
    ?? latestTrend?.avg_answer_relevancy 
    ?? latestRun?.details?.avg_answer_relevancy 
    ?? latestRun?.avg_answer_relevancy;

  const contextPrecision = (latestScore as any).context_precision 
    ?? latestTrend?.avg_context_precision 
    ?? latestRun?.details?.avg_context_precision 
    ?? latestRun?.context_precision;

  const citationQuality = (latestScore as any).citation_quality 
    ?? latestTrend?.avg_citation_quality 
    ?? latestRun?.details?.avg_citation_quality;

  const canaryViolations = latestTrend?.canary_violations 
    ?? latestRun?.details?.canary_violations 
    ?? 0;

  const canaryTotal = latestTrend?.canary_total 
    ?? latestRun?.details?.canary_total 
    ?? (canaryViolations > 0 ? canaryViolations : 1);

  const overallScore = (latestScore as any).overall_score ?? (
    (faithfulness !== undefined && answerRelevance !== undefined && contextPrecision !== undefined)
      ? ((faithfulness + answerRelevance + contextPrecision) / 3)
      : undefined
  );
  const effectiveSamples = samples || latestRun?.num_questions || 0;

  const chartData = {
    labels: trends.map(t => new Date(t.timestamp).toLocaleDateString()),
    datasets: [
      {
        label: 'Faithfulness',
        data: trends.map(t => t.avg_faithfulness || 0),
        borderColor: '#10b981', // emerald-500
        backgroundColor: '#10b981',
        tension: 0.3,
      },
      {
        label: 'Relevancy',
        data: trends.map(t => t.avg_answer_relevancy || 0),
        borderColor: '#14b8a6', // teal-500
        backgroundColor: '#14b8a6',
        tension: 0.3,
      },
      {
        label: 'Precision',
        data: trends.map(t => t.avg_context_precision || 0),
        borderColor: '#3b82f6', // blue-500
        backgroundColor: '#3b82f6',
        tension: 0.3,
      },
      {
        label: 'Citation Quality',
        data: trends.map(t => t.avg_citation_quality || 0),
        borderColor: '#f59e0b', // amber-500
        backgroundColor: '#f59e0b',
        tension: 0.3,
      }
    ],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { labels: { color: '#e5e7eb' } }
    },
    scales: {
      y: {
        min: 0,
        max: 1.0,
        grid: { color: '#374151' },
        ticks: { color: '#9ca3af' },
        border: { dash: [5, 5] }
      },
      x: {
        grid: { display: false },
        ticks: { color: '#9ca3af' }
      }
    }
  };

  return (
    <div className="space-y-6">
      {toastMessage && (
        <div className="bg-emerald-900/50 text-emerald-200 p-3 rounded-lg border border-emerald-700/50 flex justify-between items-center">
          <span>{toastMessage}</span>
        </div>
      )}
      
      {/* Trigger Evaluation Section */}
      <div className="bg-forest-800/40 border border-forest-700/60 rounded-2xl p-4 flex flex-wrap gap-4 items-center">
        <button 
          onClick={handleTriggerEval}
          disabled={isRunning}
          className="bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-800 text-white px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-semibold transition-colors"
        >
          {isRunning ? <Clock className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
          Run Evaluation
        </button>
        <select 
          value={evalDataset} 
          onChange={e => setEvalDataset(e.target.value)}
          className="bg-forest-950 border border-forest-700 text-sm text-gray-200 rounded-lg px-3 py-2 focus:border-emerald-500 focus:outline-none"
        >
          <option value="test_questions.csv">test_questions.csv</option>
          <option value="test_questions_difficult.csv">test_questions_difficult.csv</option>
          <option value="test_questions_fire_mgt.csv">test_questions_fire_mgt.csv</option>
          <option value="test_question_soils.csv">test_question_soils.csv</option>
        </select>
        <input 
          type="number" 
          value={evalLimit} 
          onChange={e => setEvalLimit(Number(e.target.value))}
          className="bg-forest-950 border border-forest-700 text-sm text-gray-200 rounded-lg px-3 py-2 w-24 focus:border-emerald-500 focus:outline-none"
          placeholder="Limit"
        />
        <select 
          value={evalMode} 
          onChange={e => setEvalMode(e.target.value)}
          className="bg-forest-950 border border-forest-700 text-sm text-gray-200 rounded-lg px-3 py-2 focus:border-emerald-500 focus:outline-none"
        >
          <option value="full">full</option>
          <option value="retrieval_only">retrieval_only</option>
          <option value="fast_smoke">fast_smoke</option>
        </select>
      </div>

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
        <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
          <ScoreRing label="Faithfulness" score={faithfulness} samples={effectiveSamples} />
          <ScoreRing label="Answer Relevance" score={answerRelevance} samples={effectiveSamples} />
          <ScoreRing label="Context Precision" score={contextPrecision} samples={effectiveSamples} />
          <ScoreRing label="Overall Score" score={overallScore} samples={effectiveSamples} />
          <ScoreRing label="Citation Quality" score={citationQuality} samples={effectiveSamples} />
          <ScoreRing label="Canary Violations" score={canaryViolations} samples={canaryTotal} isCount={true} total={canaryTotal} invertColor={true} />
        </div>
      </div>

      <div className="bg-forest-800/40 border border-forest-700/60 rounded-2xl overflow-hidden p-4">
        <h3 className="text-sm font-semibold text-gray-200 mb-4 flex items-center gap-2"><BarChart3 className="w-4 h-4 text-emerald-400"/> Score Trend</h3>
        <div className="h-64 relative">
          <Line data={chartData} options={chartOptions} />
          {/* Threshold line */}
          <div className="absolute top-[30%] left-0 right-0 border-t-2 border-dashed border-red-500/50 pointer-events-none" title="Pass Threshold (0.70)" />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-forest-800/40 border border-forest-700/60 rounded-2xl overflow-hidden flex flex-col h-[400px]">
          <div className="p-4 border-b border-forest-700/60 bg-forest-900/50">
            <h3 className="text-sm font-semibold text-gray-200">Recent Evaluation Runs</h3>
          </div>
          <div className="overflow-auto flex-1 p-4">
            <div className="space-y-3">
              {evalRuns.length > 0 ? evalRuns.map((r, i) => {
                const isPassed = r.passed !== undefined && r.passed !== null ? r.passed : r.details?.passed;
                const duration = r.duration_sec ?? r.details?.duration_sec;
                return (
                  <div 
                    key={i} 
                    className="p-3 bg-forest-900/50 border border-forest-700/40 rounded-lg flex items-center justify-between cursor-pointer hover:bg-forest-800/60 transition-colors"
                    onClick={() => setSelectedRunId(r.run_id)}
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-sm text-gray-200 font-medium">Auto-Eval {new Date(r.timestamp).toLocaleDateString()}</p>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded ${isPassed ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                          {isPassed ? 'PASS' : 'FAIL'}
                        </span>
                      </div>
                      <div className="flex gap-3 text-xs text-gray-400 mt-1">
                        <span>{r.dataset_name}</span>
                        <span>Q: {r.num_questions}</span>
                        <span>Avg Score: {
                          r.details?.avg_faithfulness !== undefined && r.details?.avg_faithfulness !== null
                            ? ((r.details.avg_faithfulness + (r.details.avg_answer_relevancy || 0) + (r.context_precision || 0)) / 3).toFixed(2)
                            : r.avg_faithfulness !== undefined && r.avg_faithfulness !== null
                            ? ((r.avg_faithfulness + (r.avg_answer_relevancy || 0) + (r.avg_context_precision || 0)) / 3).toFixed(2)
                            : r.faithfulness_score
                            ? ((r.faithfulness_score + (r.answer_relevance_score || 0) + (r.context_precision || 0)) / 3).toFixed(2)
                            : '-'
                        }</span>
                        <span>{duration !== undefined ? `${duration.toFixed(1)}s` : '-'}</span>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-gray-500" />
                  </div>
                );
              }) : <div className="text-gray-500 text-center py-8 text-sm">No evaluation runs found</div>}
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
      
      {selectedRunId && (
        <EvalRunDetailModal 
          runId={selectedRunId} 
          onClose={() => setSelectedRunId(null)} 
        />
      )}
    </div>
  );
};
